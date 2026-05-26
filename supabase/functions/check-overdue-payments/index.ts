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
    const hojeStr = hoje.toISOString().split('T')[0]
    
    // Pagamentos vencidos
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('*, patients(nome)')
      .lt('data_pagamento', hojeStr)
      .neq('status', 'pago')
      .neq('status', 'atrasado')

    if (paymentsError) throw paymentsError

    let count = 0
    if (payments && payments.length > 0) {
      for (const payment of payments) {
        await supabaseAdmin.from('payments').update({ status: 'atrasado' }).eq('id', payment.id)
        
        await supabaseAdmin.from('alerts').insert({
          paciente_id: payment.patient_id,
          tipo: 'cobranca_atrasada',
          titulo: 'Cobrança Atrasada',
          mensagem: `Cobrança de ${payment.patients?.nome || 'Desconhecido'} está atrasada — R$ ${payment.valor}`,
          cor: 'red',
          lido: false,
          link: '/financeiro'
        })

        await supabaseAdmin.from('webhook_logs').insert({
          event_type: 'payment.overdue',
          payload: payment
        })
        count++
      }
    }

    return new Response(JSON.stringify({ success: true, updated: count }), {
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
