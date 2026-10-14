import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { searchAnime, AniListError } from '../lib/anilist'
import { PROFILE_COLS, type AnimeMedia, type Community, type MiniProfile } from '../lib/types'
import { Feed } from '../components/Posts'
import { AnimeGrid } from './Anime'
import { Avatar, Empty, Notice, PageHeader, Skeletons } from '../components/ui'

type Tab = 'users' | 'communities' | 'posts' | 'anime'
export default function Search() {
  const [sp, setSp] = useSearchParams(); const q = (sp.get('q') ?? '').trim()
  const [input, setInput] = useState(q); const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<MiniProfile[]>([]); const [comms, setComms] = useState<Community[]>([]); const [anime, setAnime] = useState<AnimeMedia[]>([])
  const [loading, setLoading] = useState(false); const [animeErr, setAnimeErr] = useState('')
  useEffect(() => {
    if (q.length < 2) return
    let alive = true; setLoading(true); setAnimeErr('')
    const s = q.replace(/[%_,()]/g, '')
    Promise.all([
      supabase.from('profiles').select(PROFILE_COLS).or(`username.ilike.%${s}%,display_name.ilike.%${s}%`).eq('status', 'active').limit(20),
      supabase.from('communities').select('*').or(`name.ilike.%${s}%,description.ilike.%${s}%`).limit(20),
      searchAnime(q).then((r) => r.items).catch((e) => { setAnimeErr(e instanceof AniListError ? e.message : 'Anime search failed.'); return [] as AnimeMedia[] }),
    ]).then(([u, c, a]) => { if (!alive) return; setUsers((u.data as MiniProfile[]) ?? []); setComms((c.data as Community[]) ?? []); setAnime(a); setLoading(false) })
    return () => { alive = false }
  }, [q])
  const submit = (e: FormEvent) => { e.preventDefault(); setSp({ q: input.trim() }) }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Search" />
      <form onSubmit={submit} className="flex gap-2"><input className="input" autoFocus aria-label="Search" placeholder="Users, communities, posts, anime…" value={input} onChange={(e) => setInput(e.target.value)} /><button className="btn-primary">Search</button></form>
      {q.length < 2 ? <Empty title="Type at least 2 characters" /> : (
        <>
          <div className="flex flex-wrap gap-2" role="tablist">{(['users', 'communities', 'posts', 'anime'] as Tab[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`chip cursor-pointer capitalize ${tab === t ? '!border-violet-400 !text-white' : ''}`}>{t}</button>)}</div>
          {loading ? <Skeletons h="h-16" /> : tab === 'users' ? (users.length ? users.map((u) => <Link key={u.id} to={`/u/${u.username}`} className="card flex items-center gap-3 p-3"><Avatar p={u} /><div><p className="text-sm font-semibold text-white">{u.display_name || u.username}</p><p className="text-xs text-slate-500">@{u.username}</p></div></Link>) : <Empty title="No users found" />)
            : tab === 'communities' ? (comms.length ? comms.map((c) => <Link key={c.id} to={`/c/${c.slug}`} className="card block p-3"><p className="font-semibold text-white">{c.name}</p><p className="line-clamp-1 text-sm text-slate-400">{c.description}</p></Link>) : <Empty title="No communities found" />)
            : tab === 'posts' ? <Feed filter={{ query: q }} />
            : animeErr ? <Notice kind="error">{animeErr}</Notice> : anime.length ? <AnimeGrid items={anime} /> : <Empty title="No anime found" />}
        </>
      )}
    </div>
  )
}
