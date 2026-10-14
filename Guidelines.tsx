import { Link } from 'react-router-dom'

export default function Guidelines() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="text-sm text-cyan-300">← Back</Link>
      <h1 className="mt-3 font-display text-3xl font-bold text-white">Community guidelines</h1>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-300">
        <p><b>Be kind.</b> No harassment, hate speech, threats or doxxing. Disagree with ideas, not people.</p>
        <p><b>Tag spoilers.</b> Use the spoiler toggle and add the anime or episode. Deliberately misleading spoiler tags may be removed.</p>
        <p><b>No spam or piracy.</b> Don't post unauthorized streaming links or host copyrighted episodes. Link to lawful sources.</p>
        <p><b>Keep it safe.</b> No sexual content involving minors, no graphic NSFW in public spaces.</p>
        <p><b>Moderation.</b> Moderators can hide content and warn, suspend or ban accounts. You can appeal from Settings. Actions are logged.</p>
      </div>
    </div>
  )
}
