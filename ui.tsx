import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Eye, Inbox, Loader2, RefreshCw, Crown } from 'lucide-react'
import type { MiniProfile } from '../lib/types'

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div role="status" aria-label={label} className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
}
export function Skeletons({ n = 3, h = 'h-28' }: { n?: number; h?: string }) {
  return <div className="space-y-3" aria-hidden>{Array.from({ length: n }).map((_, i) => <div key={i} className={`skeleton ${h}`} />)}</div>
}
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Inbox className="h-8 w-8 text-slate-500" />
      <p className="font-semibold text-slate-200">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-400">{hint}</p>}
      {action}
    </div>
  )
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 border-red-500/30 px-6 py-8 text-center">
      <AlertTriangle className="h-7 w-7 text-red-400" />
      <p className="text-sm text-red-200">{message}</p>
      {onRetry && <button className="btn-ghost" onClick={onRetry}><RefreshCw className="h-4 w-4" />Retry</button>}
    </div>
  )
}
export function Notice({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const c = kind === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : kind === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-3 py-2 text-sm ${c}`}>{children}</div>
}

export function Avatar({ p, size = 36 }: { p?: Pick<MiniProfile, 'username' | 'avatar_url' | 'display_name'> | null; size?: number }) {
  const name = p?.display_name || p?.username || '?'
  const style = { width: size, height: size }
  if (p?.avatar_url) return <img src={p.avatar_url} alt="" loading="lazy" style={style} className="shrink-0 rounded-full object-cover ring-1 ring-white/10" />
  return <div style={{ ...style, fontSize: size * 0.4 }} aria-hidden className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 font-bold text-white">{name[0].toUpperCase()}</div>
}
export function UserLink({ p, showAvatar = true }: { p?: MiniProfile | null; showAvatar?: boolean }) {
  if (!p) return <span className="text-slate-500">Unknown user</span>
  return (
    <Link to={`/u/${p.username}`} className="inline-flex items-center gap-2 font-semibold text-slate-100 hover:text-cyan-300">
      {showAvatar && <Avatar p={p} size={28} />}
      <span>{p.display_name || p.username}</span>
      {p.is_premium && <Crown className="h-3.5 w-3.5 text-amber-300" aria-label="Premium" />}
      {p.role !== 'user' && <span className="chip border-violet-500/40 text-violet-300">{p.role}</span>}
    </Link>
  )
}

/** Spoiler content is hidden until an explicit click. Text is not rendered into the DOM while hidden. */
export function SpoilerText({ text, spoiler, reference }: { text: string; spoiler: boolean; reference?: string | null }) {
  const [shown, setShown] = useState(false)
  if (!spoiler || shown) return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p>
  return (
    <button onClick={() => setShown(true)} className="flex w-full items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-left text-sm text-amber-200 hover:bg-amber-400/15" aria-label="Reveal spoiler">
      <Eye className="h-4 w-4 shrink-0" />
      <span>Spoiler{reference ? ` — ${reference}` : ''}. Click to reveal.</span>
    </button>
  )
}

export function SpoilerFields({ on, setOn, ref_, setRef }: { on: boolean; setOn: (v: boolean) => void; ref_: string; setRef: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
      <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="accent-violet-500" />Mark as spoiler</label>
      {on && <input aria-label="Anime title or episode reference" value={ref_} maxLength={120} onChange={(e) => setRef(e.target.value)} placeholder="Anime / episode (optional)" className="input max-w-xs !py-1.5" />}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-bold">{title}</h2><button className="btn-ghost !px-2 !py-1" onClick={onClose} aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  )
}
export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="font-display text-2xl font-bold text-white">{title}</h1>{sub && <p className="text-sm text-slate-400">{sub}</p>}</div>
      {right}
    </div>
  )
}
