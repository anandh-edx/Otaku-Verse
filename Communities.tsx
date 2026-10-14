import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Community } from '../lib/types'
import { errMsg } from '../lib/util'
import { Empty, ErrorBox, Modal, Notice, PageHeader, Skeletons } from '../components/ui'

export default function Communities() {
  const { profile } = useAuth()
  const [list, setList] = useState<Community[]>([]); const [mine, setMine] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [q, setQ] = useState(''); const [open, setOpen] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const [c, m] = await Promise.all([
      supabase.from('communities').select('*').order('member_count', { ascending: false }).limit(100),
      supabase.from('community_members').select('community_id').eq('user_id', profile!.id),
    ])
    if (c.error) setErr(errMsg(c.error))
    setList((c.data as Community[]) ?? []); setMine(new Set((m.data ?? []).map((r) => r.community_id as string))); setLoading(false)
  }, [profile])
  useEffect(() => { load() }, [load])
  const shown = list.filter((c) => (c.name + ' ' + (c.description ?? '')).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Communities" sub="Find your corner of the verse" right={<button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Create</button>} />
      <input className="input" placeholder="Filter communities…" aria-label="Filter communities" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading ? <Skeletons h="h-24" /> : err ? <ErrorBox message={err} onRetry={load} /> : !shown.length ? <Empty title="No communities match" /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((c) => (
            <Link key={c.id} to={`/c/${c.slug}`} className="card p-4 transition hover:border-violet-400/40">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-white">{c.name}</h2>{mine.has(c.id) && <span className="chip border-emerald-500/40 text-emerald-300">Joined</span>}</div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-400">{c.description || 'No description yet.'}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><Users className="h-3.5 w-3.5" />{c.member_count} members</p>
            </Link>
          ))}
        </div>
      )}
      {open && <CreateCommunity onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load() }} />}
    </div>
  )
}

function CreateCommunity({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { profile } = useAuth()
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [rules, setRules] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  async function submit() {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    if (name.trim().length < 3 || slug.length < 3) return setErr('Name must be at least 3 characters.')
    setBusy(true); setErr('')
    const { error } = await supabase.from('communities').insert({ slug, name: name.trim(), description: desc.trim() || null, rules: rules.trim() || null, created_by: profile!.id })
    setBusy(false)
    if (error) setErr(error.code === '23505' ? 'A community with that name already exists.' : errMsg(error)); else onCreated()
  }
  return (
    <Modal title="Create community" onClose={onClose}>
      <div className="space-y-3">
        <div><label className="label" htmlFor="cn">Name</label><input id="cn" className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label" htmlFor="cd">Description</label><textarea id="cd" className="input" rows={2} maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div><label className="label" htmlFor="cr">Rules</label><textarea id="cr" className="input" rows={3} maxLength={1500} value={rules} onChange={(e) => setRules(e.target.value)} /></div>
        {err && <Notice kind="error">{err}</Notice>}
        <button className="btn-primary w-full" disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create community'}</button>
      </div>
    </Modal>
  )
}
