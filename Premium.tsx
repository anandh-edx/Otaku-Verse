import { useEffect, useState } from 'react'
import { Crown, Palette, BadgeCheck, Wand2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Notice, PageHeader } from '../components/ui'

export default function Premium() {
  const { profile } = useAuth()
  const [tier, setTier] = useState<string>('free')
  useEffect(() => { supabase.from('user_entitlements').select('tier,expires_at').eq('user_id', profile!.id).maybeSingle().then(({ data }) => { if (data && (!data.expires_at || new Date(data.expires_at) > new Date())) setTier(data.tier) }) }, [profile])
  const perks = [{ i: Palette, t: 'Profile themes', d: 'Custom accent colors and banners for your profile.' }, { i: BadgeCheck, t: 'Premium badge', d: 'A crown next to your name across the app.' }, { i: Wand2, t: 'Extra customization', d: 'Enhanced profile layouts and more.' }]
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Premium" sub="Optional extras. Core chat, communities and safety tools are always free." />
      <Notice kind="info"><b>Preview only.</b> Payments are not set up yet, so nothing can be purchased or charged. These perks are not active.</Notice>
      <div className="grid gap-3 sm:grid-cols-3">{perks.map((p) => <div key={p.t} className="card p-4"><p.i className="mb-2 h-6 w-6 text-amber-300" /><h2 className="font-semibold text-white">{p.t}</h2><p className="text-sm text-slate-400">{p.d}</p></div>)}</div>
      <div className="card flex items-center justify-between p-4"><span className="flex items-center gap-2 text-sm"><Crown className="h-4 w-4 text-amber-300" />Your plan: <b className="capitalize text-white">{tier}</b></span><button className="btn-ghost" disabled>Coming soon</button></div>
      <p className="text-xs text-slate-500">Entitlements are stored server-side and can only be granted by the backend once a payment provider is configured.</p>
    </div>
  )
}
