import { useCallback, useEffect, useRef, useState } from 'react'
import { CornerUpLeft, Pencil, SmilePlus, Trash2, Send, RotateCcw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PROFILE_COLS, type Message, type MiniProfile } from '../lib/types'
import { errMsg, fmtTime } from '../lib/util'
import { Avatar, ErrorBox, Notice, Skeletons, SpoilerFields, SpoilerText } from './ui'
import { ReportButton } from './ReportBlock'

const PAGE = 30
const EMOJI = ['👍', '❤️', '😂', '🔥', '😮', '😢']
type Scope = { kind: 'room'; id: string } | { kind: 'conversation'; id: string }
type Reactions = Record<string, { emoji: string; users: string[] }[]>

export default function Thread({ scope, header }: { scope: Scope; header?: React.ReactNode }) {
  const { profile } = useAuth()
  const col = scope.kind === 'room' ? 'room_id' : 'conversation_id'
  const [msgs, setMsgs] = useState<Message[]>([])
  const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [more, setMore] = useState(false)
  const [text, setText] = useState(''); const [sp, setSp] = useState(false); const [ref_, setRef] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null); const [editing, setEditing] = useState<Message | null>(null)
  const [typing, setTyping] = useState<string[]>([]); const [online, setOnline] = useState(0)
  const [reactions, setReactions] = useState<Reactions>({}); const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [sendErr, setSendErr] = useState('')
  const profiles = useRef<Map<string, MiniProfile>>(new Map())
  const bottom = useRef<HTMLDivElement>(null); const stick = useRef(true)
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const lastTypingSent = useRef(0)

  const hydrate = useCallback(async (rows: Message[]) => {
    const need = Array.from(new Set(rows.map((r) => r.sender_id))).filter((id) => !profiles.current.has(id))
    if (need.length) {
      const { data } = await supabase.from('profiles').select(PROFILE_COLS).in('id', need)
      for (const p of (data as MiniProfile[]) ?? []) profiles.current.set(p.id, p)
    }
    return rows.map((r) => ({ ...r, sender: profiles.current.get(r.sender_id) }))
  }, [])

  const loadReactions = useCallback(async (ids: string[]) => {
    if (!ids.length) return
    const { data } = await supabase.from('message_reactions').select('message_id,user_id,emoji').in('message_id', ids)
    setReactions((cur) => {
      const next = { ...cur }
      for (const id of ids) next[id] = []
      for (const r of data ?? []) {
        const list = next[r.message_id] ?? (next[r.message_id] = [])
        const e = list.find((x) => x.emoji === r.emoji)
        if (e) e.users.push(r.user_id); else list.push({ emoji: r.emoji, users: [r.user_id] })
      }
      return next
    })
  }, [])

  const markRead = useCallback(() => {
    if (!profile) return
    const tbl = scope.kind === 'room' ? 'room_members' : 'conversation_members'
    const key = scope.kind === 'room' ? 'room_id' : 'conversation_id'
    supabase.from(tbl).update({ last_read_at: new Date().toISOString() }).eq(key, scope.id).eq('user_id', profile.id).then(() => {})
  }, [scope.kind, scope.id, profile])

  const loadInitial = useCallback(async () => {
    setLoading(true); setErr('')
    const { data, error } = await supabase.from('messages').select('*').eq(col, scope.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(PAGE + 1)
    if (error) { setErr(errMsg(error)); setLoading(false); return }
    const rows = ((data as Message[]) ?? []).slice(0, PAGE).reverse()
    setMore((data?.length ?? 0) > PAGE)
    const hyd = await hydrate(rows)
    setMsgs(hyd); setLoading(false); loadReactions(hyd.map((m) => m.id)); markRead()
    stick.current = true
  }, [col, scope.id, hydrate, loadReactions, markRead])

  async function loadOlder() {
    const oldest = msgs[0]; if (!oldest) return
    const { data, error } = await supabase.from('messages').select('*').eq(col, scope.id).is('deleted_at', null).lt('created_at', oldest.created_at).order('created_at', { ascending: false }).limit(PAGE + 1)
    if (error) return setErr(errMsg(error))
    const rows = ((data as Message[]) ?? []).slice(0, PAGE).reverse()
    setMore((data?.length ?? 0) > PAGE)
    const hyd = await hydrate(rows)
    stick.current = false
    setMsgs((cur) => [...hyd.filter((h) => !cur.some((c) => c.id === h.id)), ...cur]); loadReactions(hyd.map((m) => m.id))
  }

  // Realtime: one channel per thread, cleaned up on unmount / scope change (no duplicate subscriptions)
  useEffect(() => {
    if (!profile) return
    setMsgs([]); setReactions({}); setReplyTo(null); setEditing(null); setTyping([])
    loadInitial()
    const ch = supabase.channel(`thread-${scope.kind}-${scope.id}`, { config: { presence: { key: profile.id }, broadcast: { self: false } } })
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `${col}=eq.${scope.id}` }, async (pl) => {
      const row = pl.new as Message
      const [h] = await hydrate([row])
      setMsgs((cur) => (cur.some((m) => m.id === row.id) ? cur.map((m) => (m.id === row.id ? { ...h, pending: false } : m)) : [...cur, h]))
      if (row.sender_id !== profile.id) markRead()
    })
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `${col}=eq.${scope.id}` }, (pl) => {
      const row = pl.new as Message
      setMsgs((cur) => (row.deleted_at ? cur.filter((m) => m.id !== row.id) : cur.map((m) => (m.id === row.id ? { ...m, ...row, sender: m.sender } : m))))
    })
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (pl) => {
      const id = ((pl.new as { message_id?: string }).message_id) || ((pl.old as { message_id?: string }).message_id)
      if (id) loadReactions([id])
    })
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      const name = payload?.name as string; if (!name) return
      setTyping((cur) => (cur.includes(name) ? cur : [...cur, name]))
      clearTimeout(typingTimers.current.get(name))
      typingTimers.current.set(name, setTimeout(() => setTyping((cur) => cur.filter((n) => n !== name)), 3000))
    })
    ch.on('presence', { event: 'sync' }, () => setOnline(Object.keys(ch.presenceState()).length))
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { await ch.track({ at: Date.now() }); loadInitial() } // reconnect: refetch to fill gaps
    })
    chanRef.current = ch
    const timers = typingTimers.current
    return () => { supabase.removeChannel(ch); chanRef.current = null; timers.forEach(clearTimeout); timers.clear() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.kind, scope.id, profile?.id])

  useEffect(() => { if (stick.current) bottom.current?.scrollIntoView({ block: 'end' }) }, [msgs.length])

  function onType(v: string) {
    setText(v)
    const now = Date.now()
    if (v && now - lastTypingSent.current > 1500 && chanRef.current && profile) {
      lastTypingSent.current = now
      chanRef.current.send({ type: 'broadcast', event: 'typing', payload: { name: profile.display_name || profile.username } })
    }
  }

  async function insert(m: Message) {
    const { data, error } = await supabase.from('messages').insert({
      id: m.id, [col]: scope.id, sender_id: m.sender_id, body: m.body, reply_to: m.reply_to, is_spoiler: m.is_spoiler, spoiler_ref: m.spoiler_ref,
    }).select('*').single()
    if (error) {
      setMsgs((cur) => cur.map((x) => (x.id === m.id ? { ...x, pending: false, failed: true } : x)))
      setSendErr(error.message.includes('rate') || error.code === 'P0001' ? 'Slow down — you are sending messages too fast.' : errMsg(error))
    } else {
      setMsgs((cur) => cur.map((x) => (x.id === m.id ? { ...(data as Message), sender: x.sender } : x))) // server timestamp replaces optimistic
      setSendErr('')
    }
  }
  async function send() {
    const body = text.trim(); if (!body || !profile) return
    if (editing) {
      const { error } = await supabase.from('messages').update({ body, edited_at: new Date().toISOString() }).eq('id', editing.id)
      if (error) return setSendErr(errMsg(error))
      setMsgs((cur) => cur.map((m) => (m.id === editing.id ? { ...m, body, edited_at: new Date().toISOString() } : m)))
      setEditing(null); setText(''); return
    }
    const m: Message = { id: crypto.randomUUID(), room_id: scope.kind === 'room' ? scope.id : null, conversation_id: scope.kind === 'conversation' ? scope.id : null, sender_id: profile.id, body, reply_to: replyTo?.id ?? null, is_spoiler: sp, spoiler_ref: sp && ref_.trim() ? ref_.trim() : null, is_hidden: false, created_at: new Date().toISOString(), edited_at: null, deleted_at: null, sender: profile, pending: true }
    stick.current = true
    setMsgs((cur) => [...cur, m]); setText(''); setReplyTo(null); setSp(false); setRef('')
    await insert(m)
  }
  async function remove(m: Message) {
    if (!confirm('Delete this message?')) return
    const { error } = await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', m.id)
    if (error) setSendErr(errMsg(error)); else setMsgs((cur) => cur.filter((x) => x.id !== m.id))
  }
  async function react(m: Message, emoji: string) {
    setPickerFor(null)
    const mine = reactions[m.id]?.find((r) => r.emoji === emoji)?.users.includes(profile!.id)
    const { error } = mine
      ? await supabase.from('message_reactions').delete().eq('message_id', m.id).eq('user_id', profile!.id).eq('emoji', emoji)
      : await supabase.from('message_reactions').insert({ message_id: m.id, user_id: profile!.id, emoji })
    if (error) setSendErr(errMsg(error)); else loadReactions([m.id])
  }
  const byId = (id: string | null) => (id ? msgs.find((m) => m.id === id) : undefined)
  const suspended = profile?.status === 'suspended'

  return (
    <div className="card flex h-[calc(100dvh-11rem)] min-h-[420px] flex-col overflow-hidden lg:h-[calc(100dvh-7rem)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="min-w-0">{header}</div>
        <span className="chip shrink-0"><span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-400" />{online} online</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
        {loading ? <Skeletons h="h-12" n={5} /> : err ? <ErrorBox message={err} onRetry={loadInitial} /> : (
          <>
            {more && <button className="btn-ghost mx-auto !py-1 text-xs" onClick={loadOlder}>Load earlier messages</button>}
            {!msgs.length && <p className="py-10 text-center text-sm text-slate-500">No messages yet. Say hi 👋</p>}
            {msgs.map((m) => {
              const mine = m.sender_id === profile?.id; const parent = byId(m.reply_to)
              return (
                <div key={m.id} className={`group flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  <Avatar p={m.sender} size={32} />
                  <div className={`max-w-[80%] ${mine ? 'items-end text-right' : ''}`}>
                    <div className="text-xs text-slate-500">{m.sender?.display_name || m.sender?.username || '…'} · {fmtTime(m.created_at)}{m.edited_at && ' · edited'}</div>
                    <div className={`mt-0.5 inline-block rounded-2xl px-3 py-2 text-left ${mine ? 'bg-violet-600/80 text-white' : 'bg-white/5'} ${m.failed ? 'ring-1 ring-red-400' : ''} ${m.pending ? 'opacity-60' : ''}`}>
                      {m.reply_to && <div className="mb-1 border-l-2 border-cyan-400/60 pl-2 text-xs text-slate-300/80">{parent ? (parent.is_spoiler ? 'Spoiler message' : parent.body.slice(0, 80)) : 'Earlier message'}</div>}
                      {m.is_hidden ? <p className="text-sm italic text-slate-400">Hidden by moderators</p> : <SpoilerText text={m.body} spoiler={m.is_spoiler} reference={m.spoiler_ref} />}
                    </div>
                    {m.failed && <button className="mt-1 flex items-center gap-1 text-xs text-red-300" onClick={() => { setMsgs((c) => c.map((x) => (x.id === m.id ? { ...x, failed: false, pending: true } : x))); insert(m) }}><RotateCcw className="h-3 w-3" />Failed. Tap to retry</button>}
                    {!!reactions[m.id]?.length && (
                      <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : ''}`}>
                        {reactions[m.id].map((r) => <button key={r.emoji} onClick={() => react(m, r.emoji)} className={`chip cursor-pointer ${r.users.includes(profile!.id) ? '!border-cyan-400' : ''}`}>{r.emoji} {r.users.length}</button>)}
                      </div>
                    )}
                    {!m.pending && !m.failed && (
                      <div className={`mt-1 flex items-center gap-3 text-slate-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${mine ? 'justify-end' : ''}`}>
                        <button aria-label="Reply" onClick={() => setReplyTo(m)} className="hover:text-white"><CornerUpLeft className="h-3.5 w-3.5" /></button>
                        <span className="relative">
                          <button aria-label="Add reaction" onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)} className="hover:text-white"><SmilePlus className="h-3.5 w-3.5" /></button>
                          {pickerFor === m.id && <span className="absolute bottom-6 left-0 z-10 flex gap-1 rounded-xl border border-white/10 bg-ink-800 p-1.5 shadow-xl">{EMOJI.map((e) => <button key={e} onClick={() => react(m, e)} className="rounded p-1 hover:bg-white/10">{e}</button>)}</span>}
                        </span>
                        {mine && <button aria-label="Edit message" onClick={() => { setEditing(m); setText(m.body) }} className="hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>}
                        {mine && <button aria-label="Delete message" onClick={() => remove(m)} className="hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>}
                        <ReportButton type="message" targetId={m.id} targetUserId={m.sender_id} compact />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
        <div ref={bottom} />
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="h-4 text-xs text-slate-400" aria-live="polite">{typing.length > 0 && `${typing.slice(0, 2).join(', ')}${typing.length > 2 ? ' and others' : ''} typing…`}</div>
        {sendErr && <div className="mb-2"><Notice kind="error">{sendErr}</Notice></div>}
        {suspended ? <Notice kind="error">Your account is suspended; you can read but not send messages.</Notice> : (
          <>
            {(replyTo || editing) && <div className="mb-2 flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-300"><span>{editing ? 'Editing message' : `Replying to ${replyTo!.sender?.username ?? 'message'}`}</span><button onClick={() => { setReplyTo(null); setEditing(null); setText('') }} aria-label="Cancel">✕</button></div>}
            {!editing && <div className="mb-2"><SpoilerFields on={sp} setOn={setSp} ref_={ref_} setRef={setRef} /></div>}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send() }}>
              <input className="input" aria-label="Message" maxLength={2000} placeholder="Message…" value={text} onChange={(e) => onType(e.target.value)} />
              <button className="btn-primary" aria-label="Send" disabled={!text.trim()}><Send className="h-4 w-4" /></button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
