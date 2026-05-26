import { NextResponse } from 'next/server'
import { validateInboundAuth, logInbound, getAdminClient } from '@/lib/inbound-auth'

export async function POST(req: Request) {
  const auth = await validateInboundAuth(req)
  if (!auth.valid) return NextResponse.json({ error: auth.error, message: auth.message }, { status: 401 })

  let body
  try { body = await req.json() } catch { body = {} }
  const endpoint = '/api/inbound/payments/confirm'

  const { payment_id, patient_id, valor_recebido, forma_pagamento, data_pagamento, referencia, observacoes } = body

  if ((!payment_id && !patient_id) || !valor_recebido || !forma_pagamento || !data_pagamento) {
    const res = { error: 'validation_error', message: 'Campos obrigatórios ausentes' }
    await logInbound(endpoint, 'POST', body, res, 422)
    return NextResponse.json(res, { status: 422 })
  }

  const supabase = getAdminClient()
  let targetPayment: any = null
  let pid = patient_id

  if (payment_id) {
    const { data } = await supabase.from('payments').select('*, patients(nome)').eq('id', payment_id).single()
    targetPayment = data
    if (data) pid = data.patient_id
  } else if (patient_id) {
    // Buscar o mais recente não pago
    const { data } = await supabase.from('payments')
      .select('*, patients(nome)')
      .eq('patient_id', patient_id)
      .neq('status', 'pago')
      .order('data_pagamento', { ascending: true })
      .limit(1)
      .single()
    targetPayment = data
  }

  if (!targetPayment) {
    const res = { error: 'payment_not_found', message: 'Nenhuma cobrança pendente encontrada' }
    await logInbound(endpoint, 'POST', body, res, 404, null, pid)
    return NextResponse.json(res, { status: 404 })
  }

  if (targetPayment.status === 'pago') {
    const res = { error: 'payment_already_paid', message: 'Este pagamento já foi registrado como pago' }
    await logInbound(endpoint, 'POST', body, res, 409, null, pid)
    return NextResponse.json(res, { status: 409 })
  }

  const { error: updateError } = await supabase.from('payments').update({
    status: 'pago',
    data_pagamento,
    forma_pagamento,
    observacoes: (targetPayment.observacoes || '') + `\nConfirmação API: ${referencia || ''} ${observacoes || ''}`
  }).eq('id', targetPayment.id)

  if (updateError) {
    const res = { error: 'internal_error', message: updateError.message }
    await logInbound(endpoint, 'POST', body, res, 500, updateError.message, pid)
    return NextResponse.json(res, { status: 500 })
  }

  // Limpar alertas de atraso
  await supabase.from('alerts').update({ lido: true }).eq('paciente_id', pid).eq('tipo', 'cobranca_atrasada')

  fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.WEBHOOK_SECRET}` },
    body: JSON.stringify({
      event: 'payment.received',
      timestamp: new Date().toISOString(),
      source: 'tamaraos',
      version: '1.0',
      data: { payment: { ...targetPayment, status: 'pago', data_pagamento, forma_pagamento } }
    })
  }).catch(() => {})

  const successRes = {
    success: true,
    message: 'Pagamento confirmado com sucesso',
    data: {
      payment_id: targetPayment.id,
      patient_nome: targetPayment.patients?.nome,
      valor_recebido,
      forma_pagamento,
      data_pagamento,
      status: 'pago'
    }
  }

  await logInbound(endpoint, 'POST', body, successRes, 200, null, pid)
  return NextResponse.json(successRes)
}
