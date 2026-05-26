'use server'

import { logSystemError } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

export async function logClientError(message: string, stack?: string) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  
  await logSystemError(message, stack, 'frontend', data?.user?.id)
}
