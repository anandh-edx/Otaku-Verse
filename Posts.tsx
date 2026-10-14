import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Heart, ImagePlus, MessageSquare, Pencil, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PROFILE_COLS, type Post } from '../lib/types'
import { compressImage, errMsg, mentions, timeAgo } from '../lib/util'
import { Empty, ErrorBox, Notice, Skeletons, SpoilerFields, SpoilerText, UserLink } from './ui'
import { ReportButton } from './ReportBlock'

export const POST_SELECT = `*, author:profiles!posts_author_id_fkey(${PROFILE_COLS}), community:communities(slug,name)`
const PAGE = 15

export function PostCard({ post, onDeleted, onUpdated }: { post: Post; onDeleted?: (id: string) => void; onUpdated?: (p: Post) => void }) {
  const { profile, isStaff } = useAuth()
  const [p, setP] = useState(post)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(post.body)
  const [err, setErr] = useState('')
  useEffect(() => setP(post), [post])

  useEffect(() => {
    if (!profile) return
    let alive = true
    Promise.all([
      supabase.from('post_likes').select('post_id').eq('post_id', post.id).eq('user_id', profile.id).maybeSingle(),
      supabase.from('bookmarks').select('post_id').eq('post_id', post.id).eq('user_id', profile.id).maybeSingle(),
    ]).then(([l, b]) => { if (alive) { setLiked(!!l.data); setSaved(!!b.data) } })
    return () => { alive = false }
  }, [post.id, profile])

  // Optimistic like with rollback on failure
  async function toggleLike() {
    if (!profile) return
    const was = liked
    setLiked(!was); setP((x) => ({ ...x, like_count: Math.max(0, x.like_count + (was ? -1 : 1)) }))
    const { error } = was
      ? await supabase.from('post_likes').delete().eq('post_id', p.id).eq('user_id', profile.id)
      : await supabase.from('post_likes').insert({ post_id: p.id, user_id: profile.id })
    if (error) { setLiked(was); setP((x) => ({ ...x, like_count: Math.max(0, x.like_count + (was ? 1 : -1)) })); setErr(errMsg(error)) }
  }
  async function toggleSave() {
    if (!profile) return
    const was = saved; setSaved(!was)
    const { error } = was
      ? await supabase.from('bookmarks').delete().eq('post_id', p.id).eq('user_id', profile.id)
      : await supabase.from('bookmarks').insert({ post_id: p.id, user_id: profile.id })
    if (error) { setSaved(was); setErr(errMsg(error)) }
  }
  async function saveEdit() {
    const text = body.trim(); if (!text) return
    const { data, error } = await supabase.from('posts').update({ body: text, edited_at: new Date().toISOString() }).eq('id', p.id).select(POST_SELECT).single()
    if (error) return setErr(errMsg(error))
    setP(data as Post); setEditing(false); onUpdated?.(data as Post)
  }
  async function remove() {
    if (!confirm('Delete this post?')) return
    const { error } = await supabase.from('posts').delete().eq('id', p.id)
    if (error) setErr(errMsg(error)); else onDeleted?.(p.id)
  }
  const mine = profile?.id === p.author_id
  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <UserLink p={p.author} />
          <p className="mt-0.5 text-xs text-slate-500">
            {timeAgo(p.created_at)}{p.edited_at && ' · edited'}
            {p.community && <> · <Link to={`/c/${p.community.slug}`} className="text-cyan-300 hover:underline">{p.community.name}</Link></>}
            {p.anime_id && <> · <Link to={`/anime/${p.anime_id}`} className="text-violet-300 hover:underline">{p.anime_title || 'Anime'}</Link></>}
          </p>
        </div>
        {p.is_hidden && <span className="chip border-red-500/40 text-red-300">hidden by moderators</span>}
      </div>
      <div className="mt-3">
        {editing ? (
          <div className="space-y-2">
            <textarea className="input" rows={4} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Edit post" />
            <div className="flex gap-2"><button className="btn-primary" onClick={saveEdit}>Save</button><button className="btn-ghost" onClick={() => { setEditing(false); setBody(p.body) }}>Cancel</button></div>
          </div>
        ) : (
          <>
            <SpoilerText text={p.body} spoiler={p.is_spoiler} reference={p.spoiler_ref} />
            {p.image_url && (p.is_spoiler ? null : <img src={p.image_url} alt="Post attachment" loading="lazy" className="mt-3 max-h-96 w-full rounded-xl object-cover" />)}
          </>
        )}
      </div>
      {err && <div className="mt-2"><Notice kind="error">{err}</Notice></div>}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-400">
        <button onClick={toggleLike} aria-pressed={liked} aria-label="Like" className={`inline-flex items-center gap-1 ${liked ? 'text-pink-400' : 'hover:text-pink-300'}`}><Heart className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} />{p.like_count}</button>
        <Link to={`/post/${p.id}`} className="inline-flex items-center gap-1 hover:text-cyan-300" aria-label="Comments"><MessageSquare className="h-4 w-4" />{p.comment_count}</Link>
        <button onClick={toggleSave} aria-pressed={saved} aria-label="Bookmark" className={`inline-flex items-center gap-1 ${saved ? 'text-amber-300' : 'hover:text-amber-200'}`}><Bookmark className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} /></button>
        <span className="ml-auto flex items-center gap-3">
          {mine && !editing && <button onClick={() => setEditing(true)} aria-label="Edit post" className="hover:text-white"><Pencil className="h-4 w-4" /></button>}
          {(mine || isStaff) && <button onClick={remove} aria-label="Delete post" className="hover:text-red-300"><Trash2 className="h-4 w-4" /></button>}
          <ReportButton type="post" targetId={p.id} targetUserId={p.author_id} />
        </span>
      </div>
    </article>
  )
}

export function Composer({ communityId, animeId, animeTitle, onCreated }: { communityId?: string | null; animeId?: number | null; animeTitle?: string | null; onCreated: (p: Post) => void }) {
  const { profile } = useAuth()
  const [body, setBody] = useState(''); const [spoiler, setSpoiler] = useState(false); const [ref_, setRef] = useState('')
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  if (!profile) return null
  if (profile.status === 'suspended') return <Notice kind="error">Your account is suspended. You can read but not post.</Notice>

  async function submit() {
    const text = body.trim(); if (!text) return
    setBusy(true); setErr('')
    try {
      let image_url: string | null = null
      if (file) {
        if (file.size > 8 * 1024 * 1024) throw new Error('Image must be under 8MB.')
        const blob = await compressImage(file, 1600)
        if (blob.size > 5 * 1024 * 1024) throw new Error('Image is still over 5MB after compression.')
        const ext = blob.type === 'image/gif' ? 'gif' : 'webp'
        const path = `${profile!.id}/${crypto.randomUUID()}.${ext}`
        const up = await supabase.storage.from('post-images').upload(path, blob, { contentType: blob.type, upsert: false })
        if (up.error) throw up.error
        image_url = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
      }
      const { data, error } = await supabase.from('posts').insert({
        author_id: profile!.id, body: text, community_id: communityId ?? null, anime_id: animeId ?? null, anime_title: animeTitle ?? null,
        is_spoiler: spoiler, spoiler_ref: spoiler && ref_.trim() ? ref_.trim() : null, image_url,
      }).select(POST_SELECT).single()
      if (error) throw error
      // mention notifications (server function notify() respects prefs/blocks; spoiler text never included)
      const names = mentions(text)
      if (names.length) {
        const { data: users } = await supabase.from('profiles').select('id').in('username_lower', names.map((n) => n.toLowerCase()))
        for (const u of users ?? []) if (u.id !== profile!.id) await supabase.rpc('notify', { target: u.id, actor: profile!.id, ntype: 'mention', pid: (data as Post).id, msg: 'mentioned you in a post' }).then(() => {}, () => {})
      }
      onCreated(data as Post)
      setBody(''); setSpoiler(false); setRef(''); setFile(null)
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <div className="card space-y-3 p-4">
      <textarea className="input" rows={3} maxLength={5000} placeholder="Share a thought, theory or recommendation…" value={body} onChange={(e) => setBody(e.target.value)} aria-label="New post" />
      <SpoilerFields on={spoiler} setOn={setSpoiler} ref_={ref_} setRef={setRef} />
      {file && <div className="flex items-center gap-2 text-xs text-slate-300"><span className="chip">{file.name}</span><button onClick={() => setFile(null)} aria-label="Remove image"><X className="h-4 w-4" /></button></div>}
      {err && <Notice kind="error">{err}</Notice>}
      <div className="flex items-center justify-between">
        <div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4" />Image</button>
        </div>
        <button className="btn-primary" disabled={busy || !body.trim()} onClick={submit}>{busy ? 'Posting…' : 'Post'}</button>
      </div>
    </div>
  )
}

export type FeedFilter = { communityId?: string; authorId?: string; animeId?: number; ids?: string[]; query?: string; followingOf?: string }

/** Paginated feed with latest/popular sorting. */
export function Feed({ filter, reloadKey = 0, prepend }: { filter: FeedFilter; reloadKey?: number; prepend?: Post | null }) {
  const [sort, setSort] = useState<'latest' | 'popular'>('latest')
  const [items, setItems] = useState<Post[]>([]); const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false); const [err, setErr] = useState(''); const [page, setPage] = useState(0)
  const fk = JSON.stringify(filter)

  const load = useCallback(async (pg: number) => {
    setLoading(true); setErr('')
    let ids = filter.ids
    if (filter.followingOf) {
      const { data } = await supabase.from('follows').select('following_id').eq('follower_id', filter.followingOf)
      ids = (data ?? []).map((r) => r.following_id as string).concat(filter.followingOf)
    }
    let q = supabase.from('posts').select(POST_SELECT)
    if (filter.communityId) q = q.eq('community_id', filter.communityId)
    if (filter.animeId) q = q.eq('anime_id', filter.animeId)
    if (filter.authorId) q = q.eq('author_id', filter.authorId)
    if (filter.query) q = q.ilike('body', `%${filter.query.replace(/[%_]/g, '')}%`)
    if (filter.ids && !filter.ids.length) { setItems([]); setMore(false); setLoading(false); return }
    if (filter.followingOf) q = q.in('author_id', ids!)
    else if (filter.ids) q = q.in('id', filter.ids)
    q = sort === 'popular' ? q.order('like_count', { ascending: false }).order('created_at', { ascending: false }) : q.order('created_at', { ascending: false })
    const { data, error } = await q.range(pg * PAGE, pg * PAGE + PAGE)
    if (error) setErr(errMsg(error))
    else {
      const rows = (data as Post[]) ?? []
      setMore(rows.length > PAGE)
      setItems((cur) => (pg === 0 ? rows.slice(0, PAGE) : [...cur, ...rows.slice(0, PAGE)]))
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fk, sort])

  useEffect(() => { setPage(0); load(0) }, [load, reloadKey])
  useEffect(() => { if (prepend) setItems((c) => (c.some((x) => x.id === prepend.id) ? c : [prepend, ...c])) }, [prepend])

  return (
    <div className="space-y-3">
      <div className="flex gap-2" role="tablist" aria-label="Sort posts">
        {(['latest', 'popular'] as const).map((s) => <button key={s} role="tab" aria-selected={sort === s} onClick={() => setSort(s)} className={`chip cursor-pointer capitalize ${sort === s ? '!border-violet-400 !text-white' : ''}`}>{s}</button>)}
      </div>
      {err ? <ErrorBox message={err} onRetry={() => load(page)} /> :
        loading && !items.length ? <Skeletons /> :
        !items.length ? <Empty title="No posts yet" hint="Be the first to start the conversation." /> :
        items.map((p) => <PostCard key={p.id} post={p} onDeleted={(id) => setItems((c) => c.filter((x) => x.id !== id))} />)}
      {more && !loading && <button className="btn-ghost w-full" onClick={() => { const n = page + 1; setPage(n); load(n) }}>Load more</button>}
      {loading && items.length > 0 && <Skeletons n={1} />}
    </div>
  )
}
