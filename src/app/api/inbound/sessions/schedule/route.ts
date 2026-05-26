import { NextResponse } from 'next/server'
import { validateInboundAuth, logInbound, getAdminClient } from '@/lib/inbound-auth'

export async function POST(req: Request) {
  const auth = await validateInboundAuth(req)
  if (!auth.valid) return NextResponse.json({ error: auth.error, message: auth.message }, { status: 401 })

  let body
  try { body = await req.json() } catch { body = {} }
  const endpoint = '/api/inbound/sessions/schedule'

  const { patient_id, data, horario, observacoes } = body

  if (!patient_id || !data || !horario) {
    const res = { error: 'validation_error', message: 'Campos obrigatórios ausentes', fields: { patient_id: !patient_id, data: !data, horario: !horario } }
    await logInbound(endpoint, 'POST', body, res, 422)
    return NextResponse.json(res, { status: 422 })
  }

  const supabase = getAdminClient()

  const { data: patient } = await supabase.from('patients').select('*').eq('id', patient_id).single()
  if (!patient) {
    const res = { error: 'patient_not_found', message: 'Paciente não encontrada' }
    await logInbound(endpoint, 'POST', body, res, 404)
    return NextResponse.json(res, { status: 404 })
  }

  if (patient.sessoes_contratadas - patient.sessoes_realizadas <= 0) {
    const res = { error: 'no_sessions_available', message: 'Paciente sem sessões disponíveis. Renovar pacote primeiro.' }
    await logInbound(endpoint, 'POST', body, res, 422, null, patient_id)
    return NextResponse.json(res, { status: 422 })
  }

  const { data: session, error } = await supabase.from('sessions').insert({
    patient_id,
    data,
    horario,
    observacoes,
    status: 'agendada'
  }).select().single()

  if (error) {
    const res = { error: 'internal_error', message: error.message }
    await logInbound(endpoint, 'POST', body, res, 500, error.message, patient_id)
    return NextResponse.json(res, { status: 500 })
  }

  const hojeStr = new Date().toISOString().split('T')[0]
  if (data === hojeStr) {
    await supabase.from('alerts').insert({
      patient_id,
      tipo: 'sessao_hoje',
      titulo: 'Sessão Hoje',
      mensagem: `Sessão extra com ${patient.nome} às ${horario} hoje`,
      cor: 'blue',
      link: '/agenda'
    })
  }

  fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.WEBHOOK_SECRET}` },
    body: JSON.stringify({
      event: 'session.scheduled',
      timestamp: new Date().toISOString(),
      source: 'tamaraos',
      version: '1.0',
      data: { session }
    })
  }).catch(() => {})

  const successRes = {
    success: true,
    message: 'Sessão agendada com sucesso',
    data: {
      session_id: session.id,
      patient_nome: patient.nome,
      patient_telefone: patient.telefone,
      data,
      horario,
      sessoes_restantes: patient.sessoes_contratadas - patient.sessoes_realizadas
    }
  }

  await logInbound(endpoint, 'POST', body, successRes, 200, null, patient_id)
  return NextResponse.json(successRes)
}
