import { useEffect, useState } from 'react'
import { Flag, ShieldOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errMsg } from '../lib/util'
import { Modal, Notice } from './ui'

const CATS = ['spam', 'harassment', 'hate', 'nsfw', 'spoiler', 'misinformation', 'other'] as const

export function ReportButton({ type, targetId, targetUserId, compact }: { type: 'user' | 'post' | 'comment' | 'message'; targetId: string; targetUserId?: string | null; compact?: boolean }) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [cat, setCat] = useState<(typeof CATS)[number]>('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ k: 'error' | 'success'; t: string } | null>(null)
  if (!profile || profile.id === targetUserId) return null

  async function submit() {
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: profile!.id, target_type: type, target_id: targetId, target_user_id: targetUserId ?? null, category: cat, details: details.trim() || null,
    })
    setBusy(false)
    if (error) setMsg({ k: 'error', t: errMsg(error) })
    else { setMsg({ k: 'success', t: 'Report sent to moderators. Thank you.' }); setDetails('') }
  }
  return (
    <>
      <button className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-300" onClick={() => setOpen(true)} aria-label={`Report ${type}`}>
        <Flag className="h-3.5 w-3.5" />{!compact && 'Report'}
      </button>
      {open && (
        <Modal title={`Report ${type}`} onClose={() => { setOpen(false); setMsg(null) }}>
          <div className="space-y-3">
            <div><label className="label" htmlFor="rc">Category</label>
              <select id="rc" className="input" value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="label" htmlFor="rd">Details (optional)</label>
              <textarea id="rd" className="input" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></div>
            {msg && <Notice kind={msg.k}>{msg.t}</Notice>}
            <button className="btn-primary w-full" disabled={busy || msg?.k === 'success'} onClick={submit}>{busy ? 'Sending…' : 'Submit report'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}

export function BlockButton({ userId, onChange }: { userId: string; onChange?: (blocked: boolean) => void }) {
  const { profile } = useAuth()
  const [blocked, setBlocked] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (profile) supabase.from('user_blocks').select('blocked_id').eq('blocker_id', profile.id).eq('blocked_id', userId).maybeSingle().then(({ data }) => setBlocked(!!data))
  }, [profile, userId])
  if (!profile || profile.id === userId) return null
  async function toggle() {
    setBusy(true); setErr('')
    const next = !blocked
    const { error } = next
      ? await supabase.from('user_blocks').insert({ blocker_id: profile!.id, blocked_id: userId })
      : await supabase.from('user_blocks').delete().eq('blocker_id', profile!.id).eq('blocked_id', userId)
    setBusy(false)
    if (error) setErr(errMsg(error)); else { setBlocked(next); onChange?.(next) }
  }
  return (
    <span className="inline-flex flex-col items-start">
      <button className="btn-danger" disabled={busy || blocked === null} onClick={toggle}><ShieldOff className="h-4 w-4" />{blocked ? 'Unblock' : 'Block'}</button>
      {err && <span className="mt-1 text-xs text-red-300">{err}</span>}
    </span>
  )
}
