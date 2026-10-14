import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { Post } from '../lib/types'
import { Composer, Feed } from '../components/Posts'
import { PageHeader } from '../components/ui'

export default function Home() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<'all' | 'following'>('all')
  const [created, setCreated] = useState<Post | null>(null)
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={`Hey ${profile?.display_name || profile?.username} 👋`} sub="What's the verse talking about?" right={<Link to="/chat" className="btn-ghost">Open global chat</Link>} />
      <Composer onCreated={setCreated} />
      <div className="flex gap-2" role="tablist">
        {(['all', 'following'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`chip cursor-pointer capitalize ${tab === t ? '!border-cyan-400 !text-white' : ''}`}>{t === 'all' ? 'Everyone' : 'Following'}</button>)}
      </div>
      <Feed key={tab} filter={tab === 'following' ? { followingOf: profile!.id } : {}} prepend={created} />
    </div>
  )
}
