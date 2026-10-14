import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { AniListError, animeTitle, getAnime } from '../lib/anilist'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { AnimeMedia, Post } from '../lib/types'
import { errMsg, stripHtml } from '../lib/util'
import { Composer, Feed } from '../components/Posts'
import { Empty, ErrorBox, Notice, Skeletons } from '../components/ui'

const STATUSES = ['planning', 'watching', 'completed', 'paused', 'dropped'] as const

export default function AnimeDetail() {
  const { id } = useParams(); const { profile } = useAuth(); const aid = Number(id)
  const [m, setM] = useState<AnimeMedia | null>(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState('')
  const [wl, setWl] = useState<string>(''); const [wlErr, setWlErr] = useState(''); const [created, setCreated] = useState<Post | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setM(await getAnime(aid)) } catch (e) { setErr(e instanceof AniListError ? e.message : 'Could not load anime.') }
    const { data } = await supabase.from('anime_watchlists').select('status').eq('user_id', profile!.id).eq('anime_id', aid).maybeSingle()
    setWl(data?.status ?? ''); setLoading(false)
  }, [aid, profile])
  useEffect(() => { load() }, [load])

  async function setStatus(status: string) {
    if (!m) return
    setWlErr(''); const prev = wl; setWl(status)
    const { error } = status
      ? await supabase.from('anime_watchlists').upsert({ user_id: profile!.id, anime_id: m.id, title: animeTitle(m), cover_url: m.coverImage.large, status, updated_at: new Date().toISOString() })
      : await supabase.from('anime_watchlists').delete().eq('user_id', profile!.id).eq('anime_id', m.id)
    if (error) { setWl(prev); setWlErr(errMsg(error)) }
  }
  if (loading) return <Skeletons n={2} h="h-48" />
  if (err) return <ErrorBox message={err} onRetry={load} />
  if (!m) return <Empty title="Anime not found" />
  const alts = Array.from(new Set([m.title.romaji, m.title.english, m.title.native, ...m.synonyms].filter(Boolean) as string[])).filter((t) => t !== animeTitle(m))
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card flex flex-col gap-4 p-4 sm:flex-row">
        {m.coverImage.extraLarge || m.coverImage.large ? <img src={(m.coverImage.extraLarge || m.coverImage.large)!} alt={`${animeTitle(m)} cover`} className="mx-auto w-44 shrink-0 rounded-xl object-cover sm:mx-0" /> : null}
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="font-display text-2xl font-bold text-white">{animeTitle(m)}</h1>
          {!!alts.length && <p className="text-xs text-slate-500">Also known as: {alts.slice(0, 5).join(' · ')}</p>}
          <div className="flex flex-wrap gap-1.5"><span className="chip">{(m.status ?? 'UNKNOWN').replace(/_/g, ' ')}</span><span className="chip">{m.episodes ? `${m.episodes} episodes` : 'Episode count unavailable'}</span>{m.seasonYear && <span className="chip">{m.season} {m.seasonYear}</span>}{m.averageScore ? <span className="chip">★ {m.averageScore}/100</span> : null}{m.genres.map((g) => <span key={g} className="chip border-violet-500/30 text-violet-300">{g}</span>)}</div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{stripHtml(m.description) || 'No synopsis available.'}</p>
          <div className="flex flex-wrap items-end gap-3 pt-2">
            <div><label className="label" htmlFor="wl">My watchlist</label>
              <select id="wl" className="input !w-auto" value={wl} onChange={(e) => setStatus(e.target.value)}><option value="">Not on list</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            {m.siteUrl && <a className="btn-ghost" href={m.siteUrl} target="_blank" rel="noopener noreferrer">View on AniList <ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>
          {wlErr && <Notice kind="error">{wlErr}</Notice>}
        </div>
      </div>
      <h2 className="font-display text-lg font-bold">Discussion</h2>
      <Composer animeId={m.id} animeTitle={animeTitle(m)} onCreated={setCreated} />
      <Feed filter={{ animeId: m.id }} prepend={created} />
    </div>
  )
}
