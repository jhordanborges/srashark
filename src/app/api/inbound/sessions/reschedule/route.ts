import { NextResponse } from 'next/server'
import { validateInboundAuth, logInbound, getAdminClient } from '@/lib/inbound-auth'

export async function POST(req: Request) {
  const auth = await validateInboundAuth(req)
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error, message: auth.message }, { status: 401 })
  }

  let body
  try { body = await req.json() } catch { body = {} }
  const endpoint = '/api/inbound/sessions/reschedule'

  const { session_id, nova_data, novo_horario, motivo } = body

  if (!session_id || !nova_data || !novo_horario) {
    const res = { error: 'validation_error', message: 'Campos obrigatórios ausentes', fields: { session_id: !session_id, nova_data: !nova_data, novo_horario: !novo_horario } }
    await logInbound(endpoint, 'POST', body, res, 422)
    return NextResponse.json(res, { status: 422 })
  }

  const supabase = getAdminClient()

  // Buscar sessão
  const { data: session } = await supabase.from('sessions').select('*, patients(nome)').eq('id', session_id).single()
  if (!session) {
    const res = { error: 'session_not_found', message: 'Sessão não encontrada' }
    await logInbound(endpoint, 'POST', body, res, 404)
    return NextResponse.json(res, { status: 404 })
  }

  if (session.status !== 'agendada' && session.status !== 'remarcada') {
    const res = { error: 'session_already_completed', message: 'Não é possível remarcar sessão já realizada ou cancelada' }
    await logInbound(endpoint, 'POST', body, res, 409, null, session.patient_id)
    return NextResponse.json(res, { status: 409 })
  }

  // Atualizar sessão
  const obs = session.observacoes ? `${session.observacoes}\nRemarcada. Data original: ${session.data} ${session.horario}. Motivo: ${motivo || 'N/A'}` : `Remarcada. Data original: ${session.data} ${session.horario}. Motivo: ${motivo || 'N/A'}`
  
  const { error: updateError } = await supabase.from('sessions').update({
    data: nova_data,
    horario: novo_horario,
    status: 'remarcada',
    observacoes: obs
  }).eq('id', session_id)

  if (updateError) {
    const res = { error: 'internal_error', message: updateError.message }
    await logInbound(endpoint, 'POST', body, res, 500, updateError.message, session.patient_id)
    return NextResponse.json(res, { status: 500 })
  }

  // Criar alerta interno
  await supabase.from('alerts').insert({
    paciente_id: session.patient_id,
    tipo: 'sessao_remarcada',
    titulo: 'Sessão Remarcada',
    mensagem: `Sessão de ${session.patients?.nome} remarcada para ${nova_data} às ${novo_horario}.`,
    cor: 'gray',
    link: '/agenda'
  })

  // Disparar Webhook Outbound
  // Para evitar chamadas circulares se o webhook for n8n, a gente manda um fetch local
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.WEBHOOK_SECRET}` },
    body: JSON.stringify({
      event: 'session.rescheduled',
      timestamp: new Date().toISOString(),
      source: 'tamaraos',
      version: '1.0',
      data: { session: { ...session, data: nova_data, horario: novo_horario, status: 'remarcada' } }
    })
  }).catch(() => {})

  const successRes = {
    success: true,
    message: 'Sessão reagendada com sucesso',
    data: {
      session_id,
      patient_nome: session.patients?.nome,
      data_original: session.data,
      horario_original: session.horario,
      nova_data,
      novo_horario,
      motivo
    }
  }

  await logInbound(endpoint, 'POST', body, successRes, 200, null, session.patient_id)
  return NextResponse.json(successRes)
}
