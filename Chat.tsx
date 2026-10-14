import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Hash, Globe2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Room } from '../lib/types'
import { errMsg } from '../lib/util'
import Thread from '../components/Thread'
import { Empty, ErrorBox, Skeletons } from '../components/ui'

export default function Chat() {
  const { slug } = useParams(); const { profile } = useAuth()
  const [rooms, setRooms] = useState<Room[]>([]); const [unread, setUnread] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true); const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const { data, error } = await supabase.from('chat_rooms').select('*').eq('is_private', false).order('is_global', { ascending: false }).order('name')
    if (error) { setErr(errMsg(error)); setLoading(false); return }
    const list = (data as Room[]) ?? []; setRooms(list); setLoading(false)
    const { data: mem } = await supabase.from('room_members').select('room_id,last_read_at').eq('user_id', profile!.id)
    const out: Record<string, number> = {}
    await Promise.all((mem ?? []).map(async (m) => {
      const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('room_id', m.room_id).neq('sender_id', profile!.id).gt('created_at', m.last_read_at)
      out[m.room_id] = count ?? 0
    }))
    setUnread(out)
  }, [profile])
  useEffect(() => { load() }, [load])

  const room = slug ? rooms.find((r) => r.slug === slug) : rooms.find((r) => r.is_global)

  // Join (idempotent) so unread tracking works
  useEffect(() => {
    if (room && profile) supabase.from('room_members').upsert({ room_id: room.id, user_id: profile.id }, { onConflict: 'room_id,user_id', ignoreDuplicates: true }).then(() => {})
  }, [room, profile])

  if (loading) return <Skeletons n={4} />
  if (err) return <ErrorBox message={err} onRetry={load} />
  if (!slug && room) return <Navigate to={`/chat/${room.slug}`} replace />
  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Chat rooms" className="card flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible">
        {rooms.map((r) => (
          <Link key={r.id} to={`/chat/${r.slug}`} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm ${room?.id === r.id ? 'bg-violet-500/15 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
            {r.is_global ? <Globe2 className="h-4 w-4" /> : <Hash className="h-4 w-4" />}{r.name}
            {!!unread[r.id] && room?.id !== r.id && <span className="ml-auto rounded-full bg-cyan-500 px-1.5 text-xs font-bold text-ink-950">{unread[r.id]}</span>}
          </Link>
        ))}
      </nav>
      {room ? (
        <Thread key={room.id} scope={{ kind: 'room', id: room.id }} header={<><h1 className="truncate font-display text-lg font-bold text-white">#{room.name}</h1>{room.description && <p className="truncate text-xs text-slate-500">{room.description}</p>}</>} />
      ) : <Empty title="Room not found" hint="Pick a room from the list." />}
    </div>
  )
}
