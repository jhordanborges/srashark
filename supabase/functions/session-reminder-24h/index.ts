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

    const amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    const amanhaStr = amanha.toISOString().split('T')[0]

    const { data: sessoes, error } = await supabaseAdmin
      .from('sessions')
      .select('*, patients(*)')
      .eq('data', amanhaStr)
      .eq('status', 'agendada')
      .eq('notificacao_enviada', false)

    if (error) throw error

    let count = 0
    if (sessoes && sessoes.length > 0) {
      for (const sessao of sessoes) {
        // Enfileirar webhook
        await supabaseAdmin.from('webhook_logs').insert({
          event_type: 'session.reminder_24h',
          payload: sessao
        })

        // Marcar como enviada para não repetir
        await supabaseAdmin.from('sessions').update({ notificacao_enviada: true }).eq('id', sessao.id)
        count++
      }
    }

    return new Response(JSON.stringify({ success: true, processed: count }), {
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
