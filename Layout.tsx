import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { Home, MessageCircle, Mail, Users, Clapperboard, Bell, Settings, Shield, LogOut, Search, Sparkles, WifiOff } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Avatar } from './ui'

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine)
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false)
    window.addEventListener('online', a); window.addEventListener('offline', b)
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b) }
  }, [])
  return on
}

function useUnread(uid?: string) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!uid) return
    let alive = true
    const load = async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('is_read', false)
      if (alive) setN(count ?? 0)
    }
    load()
    const ch = supabase.channel(`notif-badge-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, load).subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [uid])
  return n
}

export default function Layout() {
  const { profile, isStaff, signOut } = useAuth()
  const online = useOnline()
  const unread = useUnread(profile?.id)
  const nav = useNavigate()
  const [q, setQ] = useState('')

  const items = [
    { to: '/home', icon: Home, label: 'Home' },
    { to: '/chat', icon: MessageCircle, label: 'Chat' },
    { to: '/messages', icon: Mail, label: 'DMs' },
    { to: '/communities', icon: Users, label: 'Communities' },
    { to: '/anime', icon: Clapperboard, label: 'Anime' },
    { to: '/notifications', icon: Bell, label: 'Alerts', badge: unread },
  ]
  const link = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-violet-500/15 text-white shadow-glow' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`

  return (
    <div className="mx-auto flex min-h-full max-w-7xl">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 border-r border-white/10 p-4 lg:flex">
        <Link to="/home" className="mb-4 flex items-center gap-2 px-2 font-display text-xl font-extrabold text-white"><Sparkles className="h-6 w-6 text-violet-400" />Otaku Verse</Link>
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`) }} className="relative mb-2">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input aria-label="Search" className="input !pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} className={link}>
            <i.icon className="h-5 w-5" />{i.label}
            {!!i.badge && <span className="ml-auto rounded-full bg-cyan-500 px-1.5 text-xs font-bold text-ink-950">{i.badge > 99 ? '99+' : i.badge}</span>}
          </NavLink>
        ))}
        {isStaff && <NavLink to="/admin" className={link}><Shield className="h-5 w-5" />Moderation</NavLink>}
        <NavLink to="/premium" className={link}><Sparkles className="h-5 w-5" />Premium</NavLink>
        <NavLink to="/settings" className={link}><Settings className="h-5 w-5" />Settings</NavLink>
        <div className="mt-auto flex items-center gap-2 rounded-xl border border-white/10 p-2">
          {profile && <Link to={`/u/${profile.username}`} className="flex min-w-0 flex-1 items-center gap-2"><Avatar p={profile} /><span className="truncate text-sm font-semibold">{profile.display_name || profile.username}</span></Link>}
          <button className="btn-ghost !p-2" aria-label="Sign out" onClick={async () => { await signOut(); nav('/') }}><LogOut className="h-4 w-4" /></button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-ink-900/85 px-4 py-3 backdrop-blur lg:hidden">
          <Link to="/home" className="flex items-center gap-2 font-display text-lg font-extrabold text-white"><Sparkles className="h-5 w-5 text-violet-400" />Otaku Verse</Link>
          <div className="flex items-center gap-1">
            <Link to="/search" className="btn-ghost !p-2" aria-label="Search"><Search className="h-4 w-4" /></Link>
            <Link to="/settings" className="btn-ghost !p-2" aria-label="Settings"><Settings className="h-4 w-4" /></Link>
          </div>
        </header>
        {!online && <div role="status" className="flex items-center justify-center gap-2 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200"><WifiOff className="h-3.5 w-3.5" />You're offline. Changes won't be saved until you reconnect.</div>}
        <main className="flex-1 px-4 py-5 pb-24 lg:pb-8"><Outlet /></main>
      </div>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-white/10 bg-ink-900/95 backdrop-blur lg:hidden">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} aria-label={i.label} className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2 text-[10px] ${isActive ? 'text-violet-300' : 'text-slate-500'}`}>
            <i.icon className="h-5 w-5" />{i.label}
            {!!i.badge && <span className="absolute right-3 top-1 rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-ink-950">{i.badge > 9 ? '9+' : i.badge}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
