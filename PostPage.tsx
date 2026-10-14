import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PROFILE_COLS, type Comment, type Post } from '../lib/types'
import { errMsg, timeAgo } from '../lib/util'
import { PostCard, POST_SELECT } from '../components/Posts'
import { ReportButton } from '../components/ReportBlock'
import { Empty, ErrorBox, Notice, Skeletons, SpoilerFields, SpoilerText, UserLink } from '../components/ui'

function CommentBox({ postId, parentId, onDone, autoFocus }: { postId: string; parentId?: string; onDone: (c: Comment) => void; autoFocus?: boolean }) {
  const { profile } = useAuth()
  const [body, setBody] = useState(''); const [sp, setSp] = useState(false); const [ref_, setRef] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  async function send() {
    if (!body.trim()) return
    setBusy(true); setErr('')
    const { data, error } = await supabase.from('comments').insert({ post_id: postId, parent_id: parentId ?? null, author_id: profile!.id, body: body.trim(), is_spoiler: sp }).select(`*, author:profiles!comments_author_id_fkey(${PROFILE_COLS})`).single()
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setBody(''); setSp(false); setRef(''); onDone(data as Comment)
  }
  return (
    <div className="space-y-2">
      <textarea autoFocus={autoFocus} className="input" rows={2} maxLength={2000} placeholder={parentId ? 'Write a reply…' : 'Add a comment…'} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Comment" />
      <SpoilerFields on={sp} setOn={setSp} ref_={ref_} setRef={setRef} />
      {err && <Notice kind="error">{err}</Notice>}
      <button className="btn-primary" disabled={busy || !body.trim()} onClick={send}>{busy ? 'Sending…' : parentId ? 'Reply' : 'Comment'}</button>
    </div>
  )
}

export default function PostPage() {
  const { id } = useParams(); const nav = useNavigate()
  const { profile, isStaff } = useAuth()
  const [post, setPost] = useState<Post | null>(null); const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [replyTo, setReplyTo] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const [p, c] = await Promise.all([
      supabase.from('posts').select(POST_SELECT).eq('id', id!).maybeSingle(),
      supabase.from('comments').select(`*, author:profiles!comments_author_id_fkey(${PROFILE_COLS})`).eq('post_id', id!).order('created_at', { ascending: true }).limit(300),
    ])
    if (p.error || c.error) setErr(errMsg(p.error || c.error))
    setPost((p.data as Post) ?? null); setComments((c.data as Comment[]) ?? []); setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])

  async function del(cid: string) {
    if (!confirm('Delete this comment?')) return
    const { error } = await supabase.from('comments').delete().eq('id', cid)
    if (error) setErr(errMsg(error)); else setComments((c) => c.filter((x) => x.id !== cid && x.parent_id !== cid))
  }
  const render = (parent: string | null, depth: number) =>
    comments.filter((c) => c.parent_id === parent).map((c) => (
      <div key={c.id} className={depth ? 'ml-4 border-l border-white/10 pl-3' : ''}>
        <div className="card mb-2 p-3">
          <div className="flex items-center justify-between"><UserLink p={c.author} /><span className="text-xs text-slate-500">{timeAgo(c.created_at)}</span></div>
          <div className="mt-2">{c.is_hidden ? <p className="text-sm italic text-slate-500">Hidden by moderators</p> : <SpoilerText text={c.body} spoiler={c.is_spoiler} />}</div>
          <div className="mt-2 flex gap-3 text-xs text-slate-400">
            {depth < 3 && <button className="hover:text-cyan-300" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>Reply</button>}
            {(profile?.id === c.author_id || isStaff) && <button className="hover:text-red-300" onClick={() => del(c.id)}>Delete</button>}
            <ReportButton type="comment" targetId={c.id} targetUserId={c.author_id} />
          </div>
          {replyTo === c.id && <div className="mt-3"><CommentBox autoFocus postId={c.post_id} parentId={c.id} onDone={(n) => { setComments((x) => [...x, n]); setReplyTo(null); setPost((p) => (p ? { ...p, comment_count: p.comment_count + 1 } : p)) }} /></div>}
        </div>
        {render(c.id, depth + 1)}
      </div>
    ))

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button className="text-sm text-cyan-300" onClick={() => nav(-1)}>← Back</button>
      {loading ? <Skeletons n={2} /> : err ? <ErrorBox message={err} onRetry={load} /> : !post ? <Empty title="Post not found" hint="It may have been deleted or hidden." action={<Link to="/home" className="btn-ghost">Go home</Link>} /> : (
        <>
          <PostCard post={post} onDeleted={() => nav('/home')} />
          <CommentBox postId={post.id} onDone={(n) => { setComments((x) => [...x, n]); setPost({ ...post, comment_count: post.comment_count + 1 }) }} />
          <h2 className="font-display text-lg font-bold">Comments</h2>
          {comments.length ? render(null, 0) : <Empty title="No comments yet" hint="Start the discussion." />}
        </>
      )}
    </div>
  )
}
