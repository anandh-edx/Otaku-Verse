import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PROFILE_COLS, type Notification } from '../lib/types'
import { errMsg, timeAgo } from '../lib/util'
import { Avatar, Empty, ErrorBox, PageHeader, Skeletons } from '../components/ui'

const LABEL: Record<string, string> = { comment: 'commented on your post', reply: 'replied to you', follow: 'started following you', mention: 'mentioned you', invite: 'added you to a group', moderation: 'Moderation update' }

export default function Notifications() {
  const { profile } = useAuth()
  const [items, setItems] = useState<Notification[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const { data, error } = await supabase.from('notifications').select(`*, actor:profiles!notifications_actor_id_fkey(${PROFILE_COLS})`).eq('user_id', profile!.id).order('created_at', { ascending: false }).limit(60)
    if (error) setErr(errMsg(error)); else setItems((data as unknown as Notification[]) ?? [])
    setLoading(false)
  }, [profile])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const ch = supabase.channel('notif-page').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile!.id}` }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile, load])

  async function markAll() {
    const prev = items; setItems((c) => c.map((n) => ({ ...n, is_read: true })))
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile!.id).eq('is_read', false)
    if (error) { setItems(prev); setErr(errMsg(error)) }
  }
  async function open(n: Notification) {
    if (!n.is_read) { setItems((c) => c.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))); await supabase.from('notifications').update({ is_read: true }).eq('id', n.id) }
  }
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <PageHeader title="Notifications" right={items.some((n) => !n.is_read) ? <button className="btn-ghost" onClick={markAll}>Mark all read</button> : undefined} />
      {loading ? <Skeletons h="h-16" /> : err ? <ErrorBox message={err} onRetry={load} /> : !items.length ? <Empty title="You're all caught up" hint="Replies, follows and mentions show up here." /> : items.map((n) => {
        const target = n.post_id ? `/post/${n.post_id}` : n.type === 'follow' && n.actor ? `/u/${n.actor.username}` : n.type === 'invite' ? '/messages' : n.type === 'moderation' ? '/settings' : '#'
        return (
          <Link key={n.id} to={target} onClick={() => open(n)} className={`card flex items-center gap-3 p-3 ${n.is_read ? '' : '!border-cyan-400/40'}`}>
            <Avatar p={n.actor} />
            <div className="min-w-0 flex-1 text-sm"><span className="font-semibold text-white">{n.actor?.display_name || n.actor?.username || 'Otaku Verse'}</span> <span className="text-slate-400">{n.type === 'moderation' ? n.message : LABEL[n.type] ?? n.type}</span></div>
            <span className="text-xs text-slate-500">{timeAgo(n.created_at)}</span>
          </Link>
        )
      })}
    </div>
  )
}
