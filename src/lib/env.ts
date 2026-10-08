type PublicConfig = { url: string; publishableKey: string }

export function readPublicConfig(
  env: Record<string, unknown>,
): PublicConfig | null {
  const url = env.VITE_SUPABASE_URL
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (
    typeof url !== 'string' ||
    typeof publishableKey !== 'string' ||
    !publishableKey.trim()
  )
    return null
  try {
    const parsed = new URL(url)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:'))
      return null
    return { url: parsed.origin, publishableKey }
  } catch {
    return null
  }
}
