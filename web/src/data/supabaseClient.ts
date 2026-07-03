// Supabase 客户端：env 缺失时返回 null → App 落入本地演示模式（D25）。

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function makeSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !anonKey) return null
  return createClient(url, anonKey)
}

export function isCloudConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}
