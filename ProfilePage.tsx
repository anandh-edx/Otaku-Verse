import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Crown, MessageCircle, Settings as Cog } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Profile } from '../lib/types'
import { errMsg } from '../lib/util'
import { Feed } from '../components/Posts'
import { BlockButton, ReportButton } from '../components/ReportBlock'
import { Avatar, Empty, ErrorBox, Notice, Skeletons } from '../components/ui'

interface WL { anime_id: number; title: string; cover_url: string | null; status: string }

export default function ProfilePage() {
  const { username } = useParams(); const { profile: me } = useAuth(); const nav = useNavigate()
  const [p, setP] = useState<Profile | null>(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [actErr, setActErr] = useState('')
  const [following, setFollowing] = useState(false); const [counts, setCounts] = useState({ followers: 0, following: 0 }); const [wl, setWl] = useState<WL[]>([])
  const [tab, setTab] = useState<'posts' | 'watchlist'>('posts')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const { data, error } = await supabase.from('profiles').select('*').eq('username_lower', username!.toLowerCase()).maybeSingle()
    if (error) { setErr(errMsg(error)); setLoading(false); return }
    setP((data as Profile) ?? null)
    if (data) {
      const [f1, f2, f3, w] = await Promise.all([
        supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', data.id),
        supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', data.id),
        supabase.from('follows').select('follower_id').eq('follower_id', me!.id).eq('following_id', data.id).maybeSingle(),
        supabase.from('anime_watchlists').select('anime_id,title,cover_url,status').eq('user_id', data.id).order('updated_at', { ascending: false }).limit(60),
      ])
      setCounts({ followers: f1.count ?? 0, following: f2.count ?? 0 }); setFollowing(!!f3.data); setWl((w.data as WL[]) ?? [])
    }
    setLoading(false)
  }, [username, me])
  useEffect(() => { load() }, [load])

  async function toggleFollow() {
    if (!p) return
    setActErr(''); const was = following
    setFollowing(!was); setCounts((c) => ({ ...c, followers: c.followers + (was ? -1 : 1) }))
    const { error } = was
      ? await supabase.from('follows').delete().eq('follower_id', me!.id).eq('following_id', p.id)
      : await supabase.from('follows').insert({ follower_id: me!.id, following_id: p.id })
    if (error) { setFollowing(was); setCounts((c) => ({ ...c, followers: c.followers + (was ? 1 : -1) })); setActErr(errMsg(error)) }
  }
  async function dm() {
    const { data, error } = await supabase.rpc('create_dm', { other: p!.id })
    if (error) setActErr(errMsg(error)); else nav(`/messages/${data}`)
  }
  if (loading) return <Skeletons n={2} />
  if (err) return <ErrorBox message={err} onRetry={load} />
  if (!p) return <Empty title="User not found" action={<Link to="/home" className="btn-ghost">Go home</Link>} />
  const mine = me?.id === p.id
  const online = Date.now() - new Date(p.last_active_at).getTime() < 5 * 60_000
  const showWl = mine || p.watchlist_public
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar p={p} size={80} />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">{p.display_name || p.username}{p.is_premium && <Crown className="h-5 w-5 text-amber-300" aria-label="Premium" />}</h1>
            <p className="text-sm text-slate-400">@{p.username} · {online ? <span className="text-emerald-400">online</span> : `active ${new Date(p.last_active_at).toLocaleDateString()}`}</p>
            {p.status !== 'active' && <span className="chip mt-1 border-red-500/40 text-red-300">{p.status}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {mine ? <Link to="/settings" className="btn-ghost"><Cog className="h-4 w-4" />Edit profile</Link> : <>
              <button className={following ? 'btn-ghost' : 'btn-primary'} onClick={toggleFollow}>{following ? 'Following' : 'Follow'}</button>
              <button className="btn-ghost" onClick={dm}><MessageCircle className="h-4 w-4" />Message</button>
            </>}
          </div>
        </div>
        {p.bio && <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{p.bio}</p>}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
          <span><b className="text-white">{counts.followers}</b> followers</span><span><b className="text-white">{counts.following}</b> following</span>
          {p.favorite_anime && <span>Favorite: <b className="text-violet-300">{p.favorite_anime}</b></span>}<span>Joined {new Date(p.created_at).toLocaleDateString()}</span>
        </div>
        {!mine && <div className="mt-4 flex flex-wrap items-center gap-3"><BlockButton userId={p.id} /><ReportButton type="user" targetId={p.id} targetUserId={p.id} /></div>}
        {actErr && <div className="mt-3"><Notice kind="error">{actErr}</Notice></div>}
      </div>
      <div className="flex gap-2" role="tablist">
        {(['posts', 'watchlist'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`chip cursor-pointer capitalize ${tab === t ? '!border-violet-400 !text-white' : ''}`}>{t}</button>)}
      </div>
      {tab === 'posts' ? <Feed filter={{ authorId: p.id }} /> : !showWl ? <Empty title="Watchlist is private" /> : !wl.length ? <Empty title="Nothing on the watchlist yet" /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{wl.map((w) => (
          <Link key={w.anime_id} to={`/anime/${w.anime_id}`} className="card overflow-hidden">{w.cover_url && <img src={w.cover_url} alt="" loading="lazy" className="aspect-[2/3] w-full object-cover" />}<div className="p-2"><p className="line-clamp-1 text-sm font-semibold text-white">{w.title}</p><p className="text-xs capitalize text-slate-500">{w.status}</p></div></Link>
        ))}</div>
      )}
    </div>
  )
}
