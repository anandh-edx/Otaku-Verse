import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import Layout from './components/Layout'
import { Spinner, ErrorBox } from './components/ui'
import { AppealBox } from './pages/Settings'

const Landing = lazy(() => import('./pages/Landing'))
const SignIn = lazy(() => import('./pages/Auth').then((m) => ({ default: m.SignIn })))
const SignUp = lazy(() => import('./pages/Auth').then((m) => ({ default: m.SignUp })))
const Forgot = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Forgot })))
const Reset = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Reset })))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Home = lazy(() => import('./pages/Home'))
const Chat = lazy(() => import('./pages/Chat'))
const Messages = lazy(() => import('./pages/Messages'))
const Communities = lazy(() => import('./pages/Communities'))
const CommunityDetail = lazy(() => import('./pages/CommunityDetail'))
const Anime = lazy(() => import('./pages/Anime'))
const AnimeDetail = lazy(() => import('./pages/AnimeDetail'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const PostPage = lazy(() => import('./pages/PostPage'))
const Notifications = lazy(() => import('./pages/Notifications'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const Admin = lazy(() => import('./pages/Admin'))
const Premium = lazy(() => import('./pages/Premium'))
const Search = lazy(() => import('./pages/Search'))
const Guidelines = lazy(() => import('./pages/Guidelines'))

function Protected({ children, staff }: { children: ReactNode; staff?: boolean }) {
  const { session, profile, loading, isStaff } = useAuth()
  const loc = useLocation()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/signin" replace state={{ from: loc.pathname + loc.search }} />
  if (!profile) return <div className="p-6"><ErrorBox message="We couldn't load your profile. Refresh to retry." onRetry={() => location.reload()} /></div>
  if (profile.status === 'banned') return <BannedScreen />
  if (staff && !isStaff) return <Navigate to="/home" replace />
  return <>{children}</>
}
function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <Spinner />
  return session ? <Navigate to="/home" replace /> : <>{children}</>
}
function BannedScreen() {
  const { signOut } = useAuth()
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="font-display text-2xl font-bold text-white">Account banned</h1>
      <p className="mt-2 text-sm text-slate-400">This account has been banned for violating the community guidelines.</p>
      <div className="mt-5"><AppealBox /></div>
      <button className="btn-ghost mt-4" onClick={signOut}>Sign out</button>
    </div>
  )
}

export default function App() {
  if (!isConfigured) {
    return <div className="mx-auto max-w-lg p-8"><ErrorBox message="Supabase is not configured. Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY." /></div>
  }
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<GuestOnly><SignIn /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><SignUp /></GuestOnly>} />
        <Route path="/forgot-password" element={<Forgot />} />
        <Route path="/reset-password" element={<Reset />} />
        <Route path="/guidelines" element={<Guidelines />} />
        <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/home" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:slug" element={<Chat />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:id" element={<Messages />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/c/:slug" element={<CommunityDetail />} />
          <Route path="/anime" element={<Anime />} />
          <Route path="/anime/:id" element={<AnimeDetail />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/post/:id" element={<PostPage />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/search" element={<Search />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/admin" element={<Protected staff><Admin /></Protected>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
