import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PROFILE_COLS, type MiniProfile } from '../lib/types'
import { errMsg, timeAgo } from '../lib/util'
import { Empty, ErrorBox, Modal, Notice, PageHeader, Skeletons, UserLink } from '../components/ui'

interface Report { id: string; reporter_id: string; target_type: 'user' | 'post' | 'comment' | 'message'; target_id: string; target_user_id: string | null; category: string; details: string | null; status: string; created_at: string }
interface Appeal { id: string; user_id: string; message: string; status: string; created_at: string }
interface Action { id: string; moderator_id: string; action: string; target_type: string | null; target_user_id: string | null; reason: string | null; created_at: string }
type Tab = 'reports' | 'appeals' | 'users' | 'audit'

function useProfiles() {
  const [map, setMap] = useState<Record<string, MiniProfile>>({})
  const ensure = useCallback(async (ids: (string | null)[]) => {
    const need = Array.from(new Set(ids.filter(Boolean) as string[])).filter((i) => !map[i])
    if (!need.length) return
    const { data } = await supabase.from('profiles').select(PROFILE_COLS).in('id', need)
    setMap((m) => ({ ...m, ...Object.fromEntries(((data as MiniProfile[]) ?? []).map((p) => [p.id, p])) }))
  }, [map])
  return { map, ensure }
}

async function preview(r: Report): Promise<string> {
  const t = r.target_type === 'post' ? 'posts' : r.target_type === 'comment' ? 'comments' : r.target_type === 'message' ? 'messages' : null
  if (!t) return 'User report'
  const { data } = await supabase.from(t).select('body,is_hidden').eq('id', r.target_id).maybeSingle()
  return data ? `${data.is_hidden ? '[hidden] ' : ''}${data.body}` : '(content deleted or unavailable)'
}

export default function Admin() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('reports')
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Moderation" sub={isAdmin ? 'Admin dashboard' : 'Moderator dashboard'} />
      <div className="flex flex-wrap gap-2" role="tablist">{(['reports', 'appeals', 'users', 'audit'] as Tab[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`chip cursor-pointer capitalize ${tab === t ? '!border-violet-400 !text-white' : ''}`}>{t === 'audit' ? 'audit log' : t}</button>)}</div>
      {tab === 'reports' ? <Reports /> : tab === 'appeals' ? <Appeals /> : tab === 'users' ? <UsersTab /> : <Audit />}
    </div>
  )
}

function Reports() {
  const { map, ensure } = useProfiles()
  const [status, setStatus] = useState('open'); const [rows, setRows] = useState<Report[]>([]); const [prev, setPrev] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [busy, setBusy] = useState(''); const [target, setTarget] = useState<Report | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const { data, error } = await supabase.from('content_reports').select('*').eq('status', status).order('created_at', { ascending: false }).limit(50)
    if (error) { setErr(errMsg(error)); setLoading(false); return }
    const r = (data as Report[]) ?? []; setRows(r); setLoading(false)
    ensure(r.flatMap((x) => [x.reporter_id, x.target_user_id]))
    const p: Record<string, string> = {}; await Promise.all(r.map(async (x) => { p[x.id] = await preview(x) })); setPrev(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])
  useEffect(() => { load() }, [load])

  async function act(fn: () => PromiseLike<{ error: { message: string } | null }>, id: string) {
    setBusy(id); setErr('')
    const { error } = await fn(); setBusy('')
    if (error) setErr(errMsg(error)); else load()
  }
  const why = (r: Report) => `Report: ${r.category}`
  return (
    <div className="space-y-3">
      <div className="flex gap-2">{['open', 'reviewing', 'resolved', 'dismissed'].map((s) => <button key={s} onClick={() => setStatus(s)} className={`chip cursor-pointer capitalize ${status === s ? '!border-cyan-400 !text-white' : ''}`}>{s}</button>)}</div>
      {err && <Notice kind="error">{err}</Notice>}
      {loading ? <Skeletons /> : !rows.length ? <Empty title={`No ${status} reports`} /> : rows.map((r) => (
        <div key={r.id} className="card space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="chip capitalize">{r.target_type} · {r.category}</span><span className="text-xs text-slate-500">{timeAgo(r.created_at)} ago</span></div>
          <p className="rounded-lg bg-black/30 p-2 text-sm text-slate-300 break-words">{prev[r.id] ?? '…'}</p>
          {r.details && <p className="text-sm text-slate-400">“{r.details}”</p>}
          <div className="flex flex-wrap gap-x-4 text-xs text-slate-500"><span>Reporter: {map[r.reporter_id]?.username ?? '…'}</span><span>Target user: {r.target_user_id ? map[r.target_user_id]?.username ?? '…' : '—'}</span></div>
          {status === 'open' || status === 'reviewing' ? (
            <div className="flex flex-wrap gap-2">
              {r.target_type !== 'user' && <button className="btn-danger" disabled={busy === r.id} onClick={() => act(() => supabase.rpc('mod_hide_content', { ttype: r.target_type, tid: r.target_id, hide: true, why: why(r) }), r.id)}>Hide content</button>}
              {r.target_user_id && <button className="btn-ghost" onClick={() => setTarget(r)}>Take action on user</button>}
              <button className="btn-ghost" disabled={busy === r.id} onClick={() => act(() => supabase.rpc('mod_resolve_report', { rid: r.id, new_status: 'resolved', note: 'Resolved' }), r.id)}>Resolve</button>
              <button className="btn-ghost" disabled={busy === r.id} onClick={() => act(() => supabase.rpc('mod_resolve_report', { rid: r.id, new_status: 'dismissed', note: 'Dismissed' }), r.id)}>Dismiss</button>
            </div>
          ) : null}
        </div>
      ))}
      {target?.target_user_id && <UserActionModal uid={target.target_user_id} name={map[target.target_user_id]?.username ?? 'user'} onClose={() => setTarget(null)} onDone={() => { setTarget(null); load() }} />}
    </div>
  )
}

function UserActionModal({ uid, name, onClose, onDone }: { uid: string; name: string; onClose: () => void; onDone: () => void }) {
  const [action, setAction] = useState<'warn' | 'suspended' | 'banned' | 'active'>('warn'); const [days, setDays] = useState(3); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  async function go() {
    if (reason.trim().length < 3) return setErr('A reason is required (it is written to the audit log).')
    setBusy(true); setErr('')
    const { error } = action === 'warn' ? await supabase.rpc('mod_warn_user', { uid, why: reason.trim() }) : await supabase.rpc('mod_set_user_status', { uid, new_status: action, days, why: reason.trim() })
    setBusy(false); if (error) setErr(errMsg(error)); else onDone()
  }
  return (
    <Modal title={`Action on @${name}`} onClose={onClose}>
      <div className="space-y-3">
        <div><label className="label" htmlFor="ua">Action</label><select id="ua" className="input" value={action} onChange={(e) => setAction(e.target.value as typeof action)}><option value="warn">Warn</option><option value="suspended">Suspend</option><option value="banned">Ban</option><option value="active">Unban / reinstate</option></select></div>
        {action === 'suspended' && <div><label className="label" htmlFor="ud">Days</label><input id="ud" type="number" min={1} max={365} className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} /></div>}
        <div><label className="label" htmlFor="ur">Reason</label><textarea id="ur" className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {err && <Notice kind="error">{err}</Notice>}
        <button className="btn-primary w-full" disabled={busy} onClick={go}>{busy ? 'Applying…' : 'Apply'}</button>
      </div>
    </Modal>
  )
}

function Appeals() {
  const { map, ensure } = useProfiles()
  const [rows, setRows] = useState<Appeal[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const { data, error } = await supabase.from('appeals').select('*').eq('status', 'open').order('created_at').limit(50)
    if (error) setErr(errMsg(error)); else { setRows((data as Appeal[]) ?? []); ensure(((data as Appeal[]) ?? []).map((a) => a.user_id)) }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load() }, [load])
  async function review(id: string, approve: boolean) {
    const { error } = await supabase.rpc('mod_review_appeal', { aid: id, approve }); if (error) setErr(errMsg(error)); else load()
  }
  return loading ? <Skeletons /> : err ? <ErrorBox message={err} onRetry={load} /> : !rows.length ? <Empty title="No open appeals" /> : <div className="space-y-3">{rows.map((a) => (
    <div key={a.id} className="card space-y-2 p-4"><div className="flex justify-between text-sm"><UserLink p={map[a.user_id]} /><span className="text-xs text-slate-500">{timeAgo(a.created_at)} ago</span></div><p className="text-sm text-slate-300">{a.message}</p>
      <div className="flex gap-2"><button className="btn-primary" onClick={() => review(a.id, true)}>Approve</button><button className="btn-danger" onClick={() => review(a.id, false)}>Deny</button></div></div>))}</div>
}

function UsersTab() {
  const { profile } = useAuth()
  const [q, setQ] = useState(''); const [res, setRes] = useState<(MiniProfile & { status: string })[]>([]); const [target, setTarget] = useState<MiniProfile | null>(null)
  useEffect(() => {
    const s = q.trim().replace(/[%_,()]/g, ''); if (s.length < 2) { setRes([]); return }
    const t = setTimeout(async () => { const { data } = await supabase.from('profiles').select(`${PROFILE_COLS},status`).ilike('username', `%${s}%`).limit(15); setRes((data as unknown as (MiniProfile & { status: string })[]) ?? []) }, 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="space-y-3">
      <input className="input" aria-label="Find user" placeholder="Search username…" value={q} onChange={(e) => setQ(e.target.value)} />
      {res.map((u) => <div key={u.id} className="card flex items-center justify-between p-3"><div><UserLink p={u} /><span className="ml-2 chip capitalize">{u.status}</span></div>{u.id !== profile!.id && <button className="btn-ghost" onClick={() => setTarget(u)}>Action</button>}</div>)}
      <p className="text-xs text-slate-500">Moderator/admin roles can only be assigned by a database admin (SQL), never from the app.</p>
      {target && <UserActionModal uid={target.id} name={target.username} onClose={() => setTarget(null)} onDone={() => { setTarget(null); setQ('') }} />}
    </div>
  )
}

function Audit() {
  const { map, ensure } = useProfiles()
  const [rows, setRows] = useState<Action[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('moderation_actions').select('*').order('created_at', { ascending: false }).limit(100)
    if (error) setErr(errMsg(error)); else { setRows((data as Action[]) ?? []); ensure(((data as Action[]) ?? []).flatMap((a) => [a.moderator_id, a.target_user_id])) }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load() }, [load])
  return loading ? <Skeletons /> : err ? <ErrorBox message={err} onRetry={load} /> : !rows.length ? <Empty title="No moderation actions yet" /> : (
    <div className="card divide-y divide-white/5">{rows.map((a) => <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm"><span className="chip">{a.action.replace(/_/g, ' ')}</span><span>{map[a.moderator_id]?.username ?? '…'}</span>{a.target_user_id && <span className="text-slate-400">→ @{map[a.target_user_id]?.username ?? '…'}</span>}<span className="text-slate-500">{a.reason}</span><span className="ml-auto text-xs text-slate-500">{timeAgo(a.created_at)} ago</span></div>)}</div>
  )
}
