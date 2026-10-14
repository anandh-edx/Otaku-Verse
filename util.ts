export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d`
  return new Date(iso).toLocaleDateString()
}
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
export const errMsg = (e: unknown): string => {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Something went wrong. Please try again.'
}
export const normUsername = (u: string) => u.trim()
export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/
export function stripHtml(s: string | null | undefined): string {
  return (s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
}
export function mentions(body: string): string[] {
  return Array.from(new Set((body.match(/@([A-Za-z0-9_]{3,20})/g) ?? []).map((m) => m.slice(1))))
}
export const ALLOWED_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
// Downscale + re-encode image client-side to constrain upload size.
export async function compressImage(file: File, maxDim: number, quality = 0.85): Promise<Blob> {
  if (!ALLOWED_IMG.includes(file.type)) throw new Error('Only JPG, PNG, WebP or GIF images are allowed.')
  if (file.type === 'image/gif') return file
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process image.'))), 'image/webp', quality))
}
