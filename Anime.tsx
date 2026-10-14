import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AniListError, animeTitle, searchAnime, trendingAnime } from '../lib/anilist'
import type { AnimeMedia } from '../lib/types'
import { Empty, ErrorBox, PageHeader, Skeletons } from '../components/ui'

export function AnimeGrid({ items }: { items: AnimeMedia[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((m) => (
        <Link key={m.id} to={`/anime/${m.id}`} className="card overflow-hidden transition hover:border-violet-400/40">
          {m.coverImage.large ? <img src={m.coverImage.large} alt="" loading="lazy" className="aspect-[2/3] w-full object-cover" /> : <div className="grid aspect-[2/3] place-items-center bg-white/5 text-xs text-slate-500">No cover</div>}
          <div className="p-2.5"><p className="line-clamp-2 text-sm font-semibold text-white">{animeTitle(m)}</p><p className="text-xs text-slate-500">{m.episodes ? `${m.episodes} eps` : 'Episodes unknown'}</p></div>
        </Link>
      ))}
    </div>
  )
}

export default function Anime() {
  const [sp, setSp] = useSearchParams(); const term = sp.get('q') ?? ''
  const [input, setInput] = useState(term)
  const [items, setItems] = useState<AnimeMedia[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [tick, setTick] = useState(0)
  const [page, setPage] = useState(1); const [hasNext, setHasNext] = useState(false)
  useEffect(() => {
    let alive = true
    setLoading(true); setErr(''); setPage(1)
    ;(term ? searchAnime(term, 1).then((r) => { setHasNext(r.hasNext); return r.items }) : trendingAnime().then((r) => { setHasNext(false); return r }))
      .then((r) => alive && setItems(r)).catch((e) => alive && setErr(e instanceof AniListError ? e.message : 'Could not load anime.')).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [term, tick])
  async function more() {
    try { const r = await searchAnime(term, page + 1); setItems((c) => [...c, ...r.items.filter((x) => !c.some((y) => y.id === x.id))]); setPage(page + 1); setHasNext(r.hasNext) } catch (e) { setErr(e instanceof AniListError ? e.message : 'Failed to load more.') }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); setSp(input.trim() ? { q: input.trim() } : {}) }
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Anime" sub={term ? `Results for “${term}”` : 'Trending now on AniList'} />
      <form onSubmit={submit} className="flex gap-2"><input className="input" aria-label="Search anime" placeholder="Search anime by title…" value={input} onChange={(e) => setInput(e.target.value)} /><button className="btn-primary">Search</button></form>
      {loading ? <Skeletons n={2} h="h-48" /> : err ? <ErrorBox message={err} onRetry={() => setTick((t) => t + 1)} /> : !items.length ? <Empty title="No anime found" hint="Try a different spelling or the romaji title." /> : <AnimeGrid items={items} />}
      {hasNext && !loading && <button className="btn-ghost w-full" onClick={more}>Load more</button>}
      <p className="text-center text-xs text-slate-600">Metadata provided by AniList.</p>
    </div>
  )
}
