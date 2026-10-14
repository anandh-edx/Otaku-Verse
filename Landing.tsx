import { Link } from 'react-router-dom'
import { MessageCircle, Users, Clapperboard, ShieldCheck, EyeOff, Sparkles } from 'lucide-react'
import { useAuth } from '../lib/auth'

const features = [
  { icon: MessageCircle, t: 'Real-time chat', d: 'Global chat, topic rooms, DMs and group conversations that persist across devices.' },
  { icon: Users, t: 'Communities', d: 'Post, comment and follow in anime communities, from theories to seasonal watch-alongs.' },
  { icon: Clapperboard, t: 'Anime discovery', d: 'Search AniList metadata, keep a watchlist and discuss any title.' },
  { icon: EyeOff, t: 'Spoiler protection', d: 'Spoilers stay hidden until you choose to reveal them. Notifications never show spoiler text.' },
  { icon: ShieldCheck, t: 'Safe by design', d: 'Block, report, moderator review and audit logs, enforced in the database.' },
]

export default function Landing() {
  const { session } = useAuth()
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-display text-xl font-extrabold text-white"><Sparkles className="h-6 w-6 text-violet-400" />Otaku Verse</span>
        <nav className="flex gap-2">
          {session ? <Link className="btn-primary" to="/home">Open app</Link> : <><Link className="btn-ghost" to="/signin">Sign in</Link><Link className="btn-primary" to="/signup">Join free</Link></>}
        </nav>
      </header>
      <section className="py-14 text-center sm:py-20">
        <p className="mb-3 text-xs font-semibold tracking-[0.25em] text-cyan-300">YOUR WORLD. YOUR ANIME. YOUR COMMUNITY.</p>
        <h1 className="font-display text-4xl font-extrabold leading-tight text-white sm:text-6xl">Where anime fans <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">actually talk</span></h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">Chat live, share theories, track what you watch, and find your people. Free to join, with safety tools built in.</p>
        <div className="mt-7 flex justify-center gap-3">
          <Link to={session ? '/chat' : '/signup'} className="btn-primary !px-6 !py-3">{session ? 'Jump into chat' : 'Create account'}</Link>
          <Link to="/guidelines" className="btn-ghost !px-6 !py-3">Community guidelines</Link>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Features">
        {features.map((f) => (
          <div key={f.t} className="card p-5"><f.icon className="mb-3 h-6 w-6 text-violet-400" /><h2 className="font-semibold text-white">{f.t}</h2><p className="mt-1 text-sm text-slate-400">{f.d}</p></div>
        ))}
      </section>
      <footer className="mt-12 border-t border-white/10 py-6 text-center text-xs text-slate-500">Otaku Verse is for discussion and discovery. Anime metadata from AniList. No episodes are hosted here.</footer>
    </div>
  )
}
