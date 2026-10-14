import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PROFILE_COLS, type Conversation, type MiniProfile } from '../lib/types'
import { errMsg, timeAgo } from '../lib/util'
import Thread from '../components/Thread'
import { Avatar, Empty, ErrorBox, Modal, Notice, Skeletons } from '../components/ui'

interface Row extends Conversation { others: MiniProfile[]; unread: number }

export default function Messages() {
  const { id } = useParams(); const nav = useNavigate(); const { profile } = useAuth()
  const [rows, setRows] = useState<Row[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [newOpen, setNewOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const { data: mem, error } = await supabase.from('conversation_members').select('conversation_id,last_read_at').eq('user_id', profile!.id)
    if (error) { setErr(errMsg(error)); setLoading(false); return }
    const ids = (mem ?? []).map((m) => m.conversation_id as string)
    if (!ids.length) { setRows([]); setLoading(false); return }
    const [convs, others] = await Promise.all([
      supabase.from('conversations').select('*').in('id', ids).order('last_message_at', { ascending: false }),
      supabase.from('conversation_members').select(`conversation_id, profile:profiles!conversation_members_user_id_fkey(${PROFILE_COLS})`).in('conversation_id', ids).neq('user_id', profile!.id),
    ])
    if (convs.error) { setErr(errMsg(convs.error)); setLoading(false); return }
    const lastRead = new Map((mem ?? []).map((m) => [m.conversation_id as string, m.last_read_at as string]))
    const out: Row[] = await Promise.all(((convs.data as Conversation[]) ?? []).map(async (c) => {
      const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', c.id).neq('sender_id', profile!.id).gt('created_at', lastRead.get(c.id) ?? c.created_at ?? '1970-01-01')
      const o = (others.data ?? []).filter((x) => x.conversation_id === c.id).map((x) => x.profile as unknown as MiniProfile)
      return { ...c, others: o, unread: count ?? 0 }
    }))
    setRows(out); setLoading(false)
  }, [profile])
  useEffect(() => { load() }, [load])
  // refresh list on new messages
  useEffect(() => {
    const ch = supabase.channel('dm-list').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (pl) => { if ((pl.new as { conversation_id?: string }).conversation_id) load() }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const name = (r: Row) => r.is_group ? r.title || 'Group' : r.others[0]?.display_name || r.others[0]?.username || 'Direct message'
  const active = rows.find((r) => r.id === id)
  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[280px_1fr]">
      <div className={`space-y-2 ${id ? 'hidden lg:block' : ''}`}>
        <div className="flex items-center justify-between"><h1 className="font-display text-xl font-bold text-white">Messages</h1><button className="btn-primary !px-3" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" />New</button></div>
        {loading ? <Skeletons h="h-16" /> : err ? <ErrorBox message={err} onRetry={load} /> : !rows.length ? <Empty title="No conversations yet" hint="Start a DM or create a group." /> : rows.map((r) => (
          <Link key={r.id} to={`/messages/${r.id}`} className={`card flex items-center gap-3 p-3 ${r.id === id ? '!border-violet-400/50' : ''}`}>
            {r.is_group ? <div className="grid h-9 w-9 place-items-center rounded-full bg-violet-500/20"><Users className="h-4 w-4 text-violet-300" /></div> : <Avatar p={r.others[0]} />}
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{name(r)}</p><p className="text-xs text-slate-500">{timeAgo(r.last_message_at)} ago</p></div>
            {r.unread > 0 && r.id !== id && <span className="rounded-full bg-cyan-500 px-1.5 text-xs font-bold text-ink-950">{r.unread}</span>}
          </Link>
        ))}
      </div>
      <div className={id ? '' : 'hidden lg:block'}>
        {id ? (
          <Thread key={id} scope={{ kind: 'conversation', id }} header={<div className="flex items-center gap-2"><button className="text-cyan-300 lg:hidden" onClick={() => nav('/messages')} aria-label="Back">←</button><h2 className="truncate font-display text-lg font-bold text-white">{active ? name(active) : 'Conversation'}</h2></div>} />
        ) : <Empty title="Select a conversation" hint="Your direct messages and groups appear here." />}
      </div>
      {newOpen && <NewConversation onClose={() => setNewOpen(false)} onOpen={(cid) => { setNewOpen(false); load(); nav(`/messages/${cid}`) }} />}
    </div>
  )
}

function NewConversation({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const { profile } = useAuth()
  const [q, setQ] = useState(''); const [results, setResults] = useState<MiniProfile[]>([]); const [picked, setPicked] = useState<MiniProfile[]>([])
  const [title, setTitle] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => {
    const s = q.trim().replace(/[%_]/g, ''); if (s.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select(PROFILE_COLS).ilike('username', `${s}%`).neq('id', profile!.id).eq('status', 'active').limit(8)
      setResults((data as MiniProfile[]) ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [q, profile])
  async function go() {
    if (!picked.length) return
    setBusy(true); setErr('')
    const { data, error } = picked.length === 1 && !title.trim()
      ? await supabase.rpc('create_dm', { other: picked[0].id })
      : await supabase.rpc('create_group', { title: title.trim() || picked.map((p) => p.username).join(', ').slice(0, 60), members: picked.map((p) => p.id) })
    setBusy(false)
    if (error) setErr(errMsg(error)); else onOpen(data as string)
  }
  return (
    <Modal title="New conversation" onClose={onClose}>
      <div className="space-y-3">
        <div><label className="label" htmlFor="ps">Find people by username</label><input id="ps" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type 2+ letters" /></div>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {results.map((r) => <button key={r.id} className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-white/5" onClick={() => { if (!picked.some((p) => p.id === r.id)) setPicked([...picked, r]); setQ('') }}><Avatar p={r} size={28} />@{r.username}</button>)}
        </div>
        {!!picked.length && <div className="flex flex-wrap gap-1">{picked.map((p) => <button key={p.id} className="chip" onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}>@{p.username} ✕</button>)}</div>}
        {picked.length > 1 && <div><label className="label" htmlFor="gt">Group name</label><input id="gt" className="input" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} /></div>}
        {err && <Notice kind="error">{err}</Notice>}
        <button className="btn-primary w-full" disabled={busy || !picked.length} onClick={go}>{busy ? 'Starting…' : picked.length > 1 ? 'Create group' : 'Start chat'}</button>
      </div>
    </Modal>
  )
}
