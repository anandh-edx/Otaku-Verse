import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Community, Post } from '../lib/types'
import { errMsg } from '../lib/util'
import { Composer, Feed } from '../components/Posts'
import { Empty, ErrorBox, Notice, Skeletons } from '../components/ui'

export default function CommunityDetail() {
  const { slug } = useParams(); const { profile } = useAuth()
  const [c, setC] = useState<Community | null>(null); const [member, setMember] = useState(false)
  const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [actErr, setActErr] = useState(''); const [created, setCreated] = useState<Post | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const { data, error } = await supabase.from('communities').select('*').eq('slug', slug!).maybeSingle()
    if (error) setErr(errMsg(error))
    setC((data as Community) ?? null)
    if (data) { const m = await supabase.from('community_members').select('user_id').eq('community_id', data.id).eq('user_id', profile!.id).maybeSingle(); setMember(!!m.data) }
    setLoading(false)
  }, [slug, profile])
  useEffect(() => { load() }, [load])
  async function toggle() {
    if (!c) return
    setActErr('')
    const was = member; setMember(!was)
    setC({ ...c, member_count: Math.max(0, c.member_count + (was ? -1 : 1)) })
    const { error } = was
      ? await supabase.from('community_members').delete().eq('community_id', c.id).eq('user_id', profile!.id)
      : await supabase.from('community_members').insert({ community_id: c.id, user_id: profile!.id })
    if (error) { setMember(was); setC(c); setActErr(errMsg(error)) }
  }
  if (loading) return <Skeletons n={2} />
  if (err) return <ErrorBox message={err} onRetry={load} />
  if (!c) return <Empty title="Community not found" />
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="font-display text-2xl font-bold text-white">{c.name}</h1><p className="text-xs text-slate-500">{c.member_count} members</p></div>
          <button className={member ? 'btn-ghost' : 'btn-primary'} onClick={toggle}>{member ? 'Leave' : 'Join'}</button>
        </div>
        {c.description && <p className="mt-3 text-sm text-slate-300">{c.description}</p>}
        {c.rules && <details className="mt-3 text-sm"><summary className="cursor-pointer text-cyan-300">Community rules</summary><p className="mt-2 whitespace-pre-wrap text-slate-400">{c.rules}</p></details>}
        {actErr && <div className="mt-3"><Notice kind="error">{actErr}</Notice></div>}
      </div>
      {member ? <Composer communityId={c.id} onCreated={setCreated} /> : <Notice kind="info">Join this community to post.</Notice>}
      <Feed filter={{ communityId: c.id }} prepend={created} />
    </div>
  )
}
