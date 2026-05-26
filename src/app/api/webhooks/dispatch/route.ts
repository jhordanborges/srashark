import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized', message: 'Token inválido' }, { status: 401 })
    }

    const payload = await req.json()
    const eventType = payload.event

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('tipo', 'n8n')
      .single()

    if (!integration || !integration.ativo || !integration.config.url) {
      await supabaseAdmin.from('webhook_logs').insert({
        event_type: eventType,
        payload: payload,
        status: 'ignorado',
        tentativas: 0
      })
      return NextResponse.json({ success: true, status: 'ignorado' })
    }

    try {
      const res = await fetch(integration.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(integration.config.token ? { 'Authorization': `Bearer ${integration.config.token}` } : {})
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`)

      await supabaseAdmin.from('webhook_logs').insert({
        event_type: eventType,
        payload: payload,
        status: 'enviado',
        tentativas: 1
      })

      return NextResponse.json({ success: true, status: 'enviado' })
    } catch (error: any) {
      const proximoRetry = new Date()
      proximoRetry.setMinutes(proximoRetry.getMinutes() + 5)

      await supabaseAdmin.from('webhook_logs').insert({
        event_type: eventType,
        payload: payload,
        status: 'erro',
        tentativas: 1,
        proximo_retry: proximoRetry.toISOString()
      })

      return NextResponse.json({ success: false, status: 'erro', message: error.message }, { status: 500 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'internal_error', message: err.message }, { status: 500 })
  }
}
