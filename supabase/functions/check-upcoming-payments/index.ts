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

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const limite = new Date(hoje)
    limite.setDate(limite.getDate() + 7)
    
    const hojeStr = hoje.toISOString().split('T')[0]
    const limiteStr = limite.toISOString().split('T')[0]
    
    // Pagamentos vencendo (pendentes) nos próximos 7 dias
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('*, patients(nome)')
      .eq('status', 'pendente')
      .gte('data_pagamento', hojeStr)
      .lte('data_pagamento', limiteStr)

    if (paymentsError) throw paymentsError

    let count = 0
    if (payments && payments.length > 0) {
      for (const payment of payments) {
        
        // Evitar duplicar alerta pro mesmo pagamento não lido
        const { data: existingAlerts } = await supabaseAdmin
          .from('alerts')
          .select('id')
          .eq('paciente_id', payment.patient_id)
          .eq('tipo', 'cobranca_vencendo')
          .eq('lido', false)
          .limit(1)

        if (!existingAlerts || existingAlerts.length === 0) {
          await supabaseAdmin.from('alerts').insert({
            paciente_id: payment.patient_id,
            tipo: 'cobranca_vencendo',
            titulo: 'Cobrança Vencendo',
            mensagem: `Cobrança de ${payment.patients?.nome || 'Desconhecido'} vence em breve — R$ ${payment.valor}`,
            cor: 'yellow',
            lido: false,
            link: '/financeiro'
          })

          await supabaseAdmin.from('webhook_logs').insert({
            event_type: 'payment.upcoming',
            payload: payment
          })
          count++
        }
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
