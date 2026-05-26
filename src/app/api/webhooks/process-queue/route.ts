import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Endpoint chamado por um Cron Job ou Edge Function para esvaziar a fila
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Pegar integração ativa
    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('tipo', 'n8n')
      .single()

    if (!integration || !integration.ativo || !integration.config.url) {
      // Marcar tudo como ignorado se inativo
      await supabaseAdmin.from('webhook_logs').update({ status: 'ignorado' }).in('status', ['pendente', 'reprocessando'])
      return NextResponse.json({ success: true, message: 'Integração inativa' })
    }

    const { data: logs } = await supabaseAdmin
      .from('webhook_logs')
      .select('*')
      .in('status', ['pendente', 'reprocessando'])
      .limit(50)

    if (!logs || logs.length === 0) return NextResponse.json({ success: true, processed: 0 })

    let processed = 0
    for (const log of logs) {
      try {
        const res = await fetch(integration.config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(integration.config.token ? { 'Authorization': `Bearer ${integration.config.token}` } : {})
          },
          body: JSON.stringify(log.payload)
        })

        if (!res.ok) throw new Error(`HTTP Error ${res.status}`)

        await supabaseAdmin.from('webhook_logs').update({
          status: 'enviado',
          tentativas: log.tentativas + 1
        }).eq('id', log.id)
        
      } catch (err) {
        const t = log.tentativas + 1
        const next = new Date()
        if (t === 1) next.setMinutes(next.getMinutes() + 5)
        else if (t === 2) next.setMinutes(next.getMinutes() + 30)
        else if (t === 3) next.setHours(next.getHours() + 2)
        else next.setHours(next.getHours() + 24)

        await supabaseAdmin.from('webhook_logs').update({
          status: 'erro',
          tentativas: t,
          proximo_retry: next.toISOString()
        }).eq('id', log.id)
      }
      processed++
    }

    return NextResponse.json({ success: true, processed })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
