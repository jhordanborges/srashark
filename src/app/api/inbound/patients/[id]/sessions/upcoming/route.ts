import { NextResponse } from 'next/server'
import { validateInboundAuth, logInbound, getAdminClient } from '@/lib/inbound-auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await validateInboundAuth(req)
  if (!auth.valid) return NextResponse.json({ error: auth.error, message: auth.message }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '5') || 5
  const statuses = searchParams.get('status') || 'agendada,remarcada'
  
  const endpoint = `/api/inbound/patients/${params.id}/sessions/upcoming`
  const supabase = getAdminClient()

  const { data: patient } = await supabase.from('patients').select('*').eq('id', params.id).single()
  if (!patient) {
    const res = { error: 'patient_not_found', message: 'Paciente não encontrada' }
    await logInbound(endpoint, 'GET', null, res, 404, null, params.id)
    return NextResponse.json(res, { status: 404 })
  }

  const { data: sessions, error } = await supabase.from('sessions')
    .select('id, data, horario, status')
    .eq('patient_id', params.id)
    .in('status', statuses.split(','))
    .gte('data', new Date().toISOString().split('T')[0])
    .order('data', { ascending: true })
    .order('horario', { ascending: true })
    .limit(limit)

  if (error) {
    const res = { error: 'internal_error', message: error.message }
    await logInbound(endpoint, 'GET', null, res, 500, error.message, params.id)
    return NextResponse.json(res, { status: 500 })
  }

  const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

  const successRes = {
    success: true,
    data: {
      patient: {
        id: patient.id,
        nome: patient.nome,
        telefone: patient.telefone,
        sessoes_restantes: patient.sessoes_contratadas - patient.sessoes_realizadas
      },
      sessions: sessions.map((s: any) => ({
        ...s,
        dia_semana: diasSemana[new Date(s.data + 'T12:00:00').getDay()]
      })),
      total: sessions.length
    }
  }

  await logInbound(endpoint, 'GET', null, successRes, 200, null, params.id)
  return NextResponse.json(successRes)
}
