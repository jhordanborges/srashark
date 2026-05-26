import { NextResponse } from 'next/server'
import { validateInboundAuth, logInbound, getAdminClient } from '@/lib/inbound-auth'

export async function POST(req: Request) {
  const auth = await validateInboundAuth(req)
  if (!auth.valid) return NextResponse.json({ error: auth.error, message: auth.message }, { status: 401 })

  let body
  try { body = await req.json() } catch { body = {} }
  const endpoint = '/api/inbound/sessions/cancel'

  const { session_id, motivo } = body

  if (!session_id) {
    const res = { error: 'validation_error', message: 'Campos obrigatórios ausentes' }
    await logInbound(endpoint, 'POST', body, res, 422)
    return NextResponse.json(res, { status: 422 })
  }

  const supabase = getAdminClient()

  const { data: session } = await supabase.from('sessions').select('*, patients(nome)').eq('id', session_id).single()
  if (!session) {
    const res = { error: 'session_not_found', message: 'Sessão não encontrada' }
    await logInbound(endpoint, 'POST', body, res, 404)
    return NextResponse.json(res, { status: 404 })
  }

  if (session.status !== 'agendada' && session.status !== 'remarcada') {
    const res = { error: 'session_already_completed', message: 'Não é possível cancelar sessão já realizada ou cancelada' }
    await logInbound(endpoint, 'POST', body, res, 409, null, session.patient_id)
    return NextResponse.json(res, { status: 409 })
  }

  const { error: updateError } = await supabase.from('sessions').update({
    status: 'cancelada',
    observacoes: (session.observacoes || '') + `\nCancelada. Motivo: ${motivo || 'N/A'}`
  }).eq('id', session_id)

  if (updateError) {
    const res = { error: 'internal_error', message: updateError.message }
    await logInbound(endpoint, 'POST', body, res, 500, updateError.message, session.patient_id)
    return NextResponse.json(res, { status: 500 })
  }

  await supabase.from('alerts').insert({
    paciente_id: session.patient_id,
    tipo: 'sessao_remarcada',
    titulo: 'Sessão Cancelada',
    mensagem: `Sessão de ${session.patients?.nome} do dia ${session.data} foi cancelada.`,
    cor: 'gray',
    link: '/agenda'
  })

  const successRes = {
    success: true,
    message: 'Sessão cancelada',
    data: {
      session_id,
      patient_nome: session.patients?.nome,
      data: session.data,
      horario: session.horario,
      motivo
    }
  }

  await logInbound(endpoint, 'POST', body, successRes, 200, null, session.patient_id)
  return NextResponse.json(successRes)
}
