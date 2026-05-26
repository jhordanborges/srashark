import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const agoraIso = new Date().toISOString()

    const { data: webhooks, error } = await supabaseAdmin
      .from('webhook_logs')
      .select('*')
      .eq('status', 'erro')
      .lt('tentativas', 4)
      .lte('proximo_retry', agoraIso)

    if (error) throw error

    let count = 0
    if (webhooks && webhooks.length > 0) {
      for (const hook of webhooks) {
        await supabaseAdmin.from('webhook_logs').update({
          status: 'reprocessando'
        }).eq('id', hook.id)
        count++
      }
    }

    // Nota: O dispatcher principal (Fase 6) lerá os pendentes e reprocessando.

    return new Response(JSON.stringify({ success: true, requeued: count }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})
