import { createClient } from '@supabase/supabase-js'

export async function logSystemError(message: string, stack?: string, source: 'backend' | 'frontend' = 'backend', userId?: string) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabaseAdmin.from('error_logs').insert({
      message,
      stack: stack || null,
      source,
      user_id: userId || null
    })
    
    console.error(`[TamaraOS Error] ${message}\n${stack}`)
  } catch (e) {
    console.error('Falha catastrófica ao tentar logar um erro no banco', e)
  }
}
