import { describe, it, expect } from 'vitest'
import { readPublicConfig } from './env'

describe('public configuration', () => {
  it.each([
    {},
    { VITE_SUPABASE_URL: 'broken', VITE_SUPABASE_PUBLISHABLE_KEY: 'key' },
    {
      VITE_SUPABASE_URL: 'http://remote.example',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'key',
    },
    {
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: ' ',
    },
  ])('rejects missing or invalid configuration', (env) => {
    expect(readPublicConfig(env)).toBeNull()
  })
  it.each(['https://example.supabase.co', 'http://127.0.0.1:54321'])(
    'accepts hosted or local Supabase',
    (url) => {
      expect(
        readPublicConfig({
          VITE_SUPABASE_URL: url,
          VITE_SUPABASE_PUBLISHABLE_KEY: 'key',
        }),
      ).toEqual({ url, publishableKey: 'key' })
    },
  )
})
