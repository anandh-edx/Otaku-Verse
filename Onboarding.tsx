import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Community } from '../lib/types'
import { errMsg } from '../lib/util'
import { Notice, Skeletons } from '../components/ui'

export default function Onboarding() {
  const { profile, refreshProfile } = useAuth(); const nav = useNavigate()
  const [comms, setComms] = useState<Community[]>([]); const [pick, setPick] = useState<Set<string>>(new Set()); const [fav, setFav] = useState('')
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => { supabase.from('communities').select('*').order('member_count', { ascending: false }).limit(30).then(({ data }) => { setComms((data as Community[]) ?? []); setLoading(false) }) }, [])
  const toggle = (id: string) => setPick((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  async function finish() {
    setBusy(true); setErr('')
    try {
      if (pick.size) { const { error } = await supabase.from('community_members').upsert(Array.from(pick).map((community_id) => ({ community_id, user_id: profile!.id })), { onConflict: 'community_id,user_id', ignoreDuplicates: true }); if (error) throw error }
      if (fav.trim()) { const { error } = await supabase.from('profiles').update({ favorite_anime: fav.trim().slice(0, 120) }).eq('id', profile!.id); if (error) throw error }
      await refreshProfile(); nav('/home', { replace: true })
    } catch (e) { setErr(errMsg(e)); setBusy(false) }
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="card space-y-5 p-6">
        <div className="text-center"><Sparkles className="mx-auto h-8 w-8 text-violet-400" /><h1 className="mt-2 font-display text-2xl font-bold text-white">Welcome, @{profile?.username}!</h1><p className="text-sm text-slate-400">Pick a few communities and tell us your favorite anime. You can change everything later.</p></div>
        <div><label className="label" htmlFor="fa">Favorite anime (optional)</label><input id="fa" className="input" maxLength={120} value={fav} onChange={(e) => setFav(e.target.value)} /></div>
        <div><p className="label">Join communities</p>
          {loading ? <Skeletons n={2} h="h-12" /> : <div className="flex flex-wrap gap-2">{comms.map((c) => <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={pick.has(c.id)} className={`chip cursor-pointer !px-3 !py-1.5 ${pick.has(c.id) ? '!border-violet-400 !bg-violet-500/20 !text-white' : ''}`}>{c.name}</button>)}</div>}</div>
        {err && <Notice kind="error">{err}</Notice>}
        <div className="flex gap-2"><button className="btn-primary flex-1" disabled={busy} onClick={finish}>{busy ? 'Saving…' : 'Enter the verse'}</button><button className="btn-ghost" onClick={() => nav('/home')}>Skip</button></div>
      </div>
    </div>
  )
}
