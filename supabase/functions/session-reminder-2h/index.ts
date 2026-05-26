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

    const agora = new Date()
    // Ajustar fuso horário se necessário, assumindo UTC/BRT
    // Vamos pegar o horário daqui a 1h50m e 2h10m
    const inicio = new Date(agora.getTime() + (1 * 60 + 50) * 60000)
    const fim = new Date(agora.getTime() + (2 * 60 + 10) * 60000)

    const hojeStr = agora.toISOString().split('T')[0]
    
    const inicioStr = inicio.toISOString().substring(11, 16) // HH:mm
    const fimStr = fim.toISOString().substring(11, 16)

    const { data: sessoes, error } = await supabaseAdmin
      .from('sessions')
      .select('*, patients(*)')
      .eq('data', hojeStr)
      .eq('status', 'agendada')
      .eq('notificacao_enviada', false)
      .gte('horario', inicioStr)
      .lte('horario', fimStr)

    if (error) throw error

    let count = 0
    if (sessoes && sessoes.length > 0) {
      for (const sessao of sessoes) {
        await supabaseAdmin.from('webhook_logs').insert({
          event_type: 'session.reminder_2h',
          payload: sessao
        })

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
