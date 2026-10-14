import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { compressImage, errMsg } from '../lib/util'
import { Avatar, Notice, PageHeader } from '../components/ui'

export function AppealBox() {
  const { profile } = useAuth()
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [res, setRes] = useState<{ k: 'error' | 'success'; t: string } | null>(null)
  async function submit() {
    setBusy(true); setRes(null)
    const { error } = await supabase.from('appeals').insert({ user_id: profile!.id, message: msg.trim() })
    setBusy(false)
    setRes(error ? { k: 'error', t: errMsg(error) } : { k: 'success', t: 'Appeal submitted. A moderator will review it.' }); if (!error) setMsg('')
  }
  return (
    <div className="space-y-2 text-left">
      <label className="label" htmlFor="ap">Appeal a moderation decision (10–1000 characters)</label>
      <textarea id="ap" className="input" rows={3} maxLength={1000} value={msg} onChange={(e) => setMsg(e.target.value)} />
      {res && <Notice kind={res.k}>{res.t}</Notice>}
      <button className="btn-ghost" disabled={busy || msg.trim().length < 10} onClick={submit}>{busy ? 'Sending…' : 'Submit appeal'}</button>
    </div>
  )
}

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth()
  const [f, setF] = useState({ display_name: profile?.display_name ?? '', bio: profile?.bio ?? '', favorite_anime: profile?.favorite_anime ?? '', watchlist_public: profile?.watchlist_public ?? true })
  const [prefs, setPrefs] = useState({ notify_replies: true, notify_follows: true, notify_mentions: true, notify_invites: true })
  const [msg, setMsg] = useState<{ k: 'error' | 'success'; t: string } | null>(null); const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState(''); const [pwMsg, setPwMsg] = useState<{ k: 'error' | 'success'; t: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { supabase.from('user_settings').select('notify_replies,notify_follows,notify_mentions,notify_invites').eq('user_id', profile!.id).maybeSingle().then(({ data }) => { if (data) setPrefs(data) }) }, [profile])

  async function save() {
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('profiles').update({ display_name: f.display_name.trim() || null, bio: f.bio.trim() || null, favorite_anime: f.favorite_anime.trim() || null, watchlist_public: f.watchlist_public }).eq('id', profile!.id)
    setBusy(false)
    if (error) setMsg({ k: 'error', t: errMsg(error) }); else { setMsg({ k: 'success', t: 'Profile saved.' }); refreshProfile() }
  }
  async function avatar(file: File | undefined) {
    if (!file) return
    setMsg(null)
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Image must be under 8MB.')
      const blob = await compressImage(file, 512, 0.85)
      if (blob.size > 2 * 1024 * 1024) throw new Error('Avatar must be under 2MB after compression.')
      const path = `${profile!.id}/avatar-${Date.now()}.${blob.type === 'image/gif' ? 'gif' : 'webp'}`
      const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: blob.type })
      if (up.error) throw up.error
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile!.id)
      if (error) throw error
      setMsg({ k: 'success', t: 'Avatar updated.' }); refreshProfile()
    } catch (e) { setMsg({ k: 'error', t: errMsg(e) }) }
  }
  async function setPref(k: keyof typeof prefs, v: boolean) {
    const prev = prefs; setPrefs({ ...prefs, [k]: v })
    const { error } = await supabase.from('user_settings').update({ [k]: v }).eq('user_id', profile!.id)
    if (error) { setPrefs(prev); setMsg({ k: 'error', t: errMsg(error) }) }
  }
  async function changePw() {
    if (pw.length < 8) return setPwMsg({ k: 'error', t: 'Password must be at least 8 characters.' })
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwMsg(error ? { k: 'error', t: errMsg(error) } : { k: 'success', t: 'Password updated.' }); if (!error) setPw('')
  }
  const T = ({ k, label }: { k: keyof typeof prefs; label: string }) => <label className="flex items-center justify-between py-1.5 text-sm"><span>{label}</span><input type="checkbox" className="h-4 w-4 accent-violet-500" checked={prefs[k]} onChange={(e) => setPref(k, e.target.checked)} /></label>
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Settings & privacy" />
      {profile!.status !== 'active' && <Notice kind="error">Your account is {profile!.status}{profile!.suspended_until ? ` until ${new Date(profile!.suspended_until).toLocaleString()}` : ''}.</Notice>}
      <section className="card space-y-3 p-5" aria-labelledby="s1">
        <h2 id="s1" className="font-display font-bold">Profile</h2>
        <div className="flex items-center gap-3"><Avatar p={profile} size={64} />
          <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => avatar(e.target.files?.[0])} />
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Change avatar</button></div>
        <div><label className="label" htmlFor="sd">Display name</label><input id="sd" className="input" maxLength={40} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></div>
        <div><label className="label" htmlFor="sb">Bio ({f.bio.length}/300)</label><textarea id="sb" className="input" rows={3} maxLength={300} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
        <div><label className="label" htmlFor="sf">Favorite anime</label><input id="sf" className="input" maxLength={120} value={f.favorite_anime} onChange={(e) => setF({ ...f, favorite_anime: e.target.value })} /></div>
        <label className="flex items-center justify-between text-sm"><span>Show my watchlist publicly</span><input type="checkbox" className="h-4 w-4 accent-violet-500" checked={f.watchlist_public} onChange={(e) => setF({ ...f, watchlist_public: e.target.checked })} /></label>
        {msg && <Notice kind={msg.k}>{msg.t}</Notice>}
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</button>
        <p className="text-xs text-slate-500">Your email is never shown to other users. Username can't be changed here.</p>
      </section>
      <section className="card p-5" aria-labelledby="s2"><h2 id="s2" className="mb-1 font-display font-bold">Notifications</h2>
        <T k="notify_replies" label="Comments & replies" /><T k="notify_follows" label="New followers" /><T k="notify_mentions" label="Mentions" /><T k="notify_invites" label="Group invitations" />
        <p className="mt-1 text-xs text-slate-500">Moderation notices are always delivered. Notifications never include spoiler text or private message content.</p></section>
      <section className="card space-y-2 p-5" aria-labelledby="s3"><h2 id="s3" className="font-display font-bold">Password</h2>
        <label className="label" htmlFor="npw">New password</label><input id="npw" type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} />
        {pwMsg && <Notice kind={pwMsg.k}>{pwMsg.t}</Notice>}<button className="btn-ghost" onClick={changePw}>Update password</button></section>
      <section className="card p-5" aria-labelledby="s4"><h2 id="s4" className="mb-2 font-display font-bold">Appeals</h2><AppealBox /></section>
    </div>
  )
}
