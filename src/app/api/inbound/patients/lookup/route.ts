import { NextResponse } from 'next/server'
import { validateInboundAuth, logInbound, getAdminClient } from '@/lib/inbound-auth'

export async function GET(req: Request) {
  const auth = await validateInboundAuth(req)
  if (!auth.valid) return NextResponse.json({ error: auth.error, message: auth.message }, { status: 401 })

  const { searchParams } = new URL(req.url)
  let telefone = searchParams.get('telefone')
  
  const endpoint = '/api/inbound/patients/lookup'
  
  if (!telefone) {
    const res = { error: 'validation_error', message: 'Telefone obrigatório' }
    await logInbound(endpoint, 'GET', null, res, 422)
    return NextResponse.json(res, { status: 422 })
  }

  // Normalizar telefone: remover não numéricos e o 55 inicial se existir (muito comum no n8n mandar +55)
  telefone = telefone.replace(/\D/g, '')
  if (telefone.startsWith('55') && telefone.length > 11) {
    telefone = telefone.substring(2)
  }

  const supabase = getAdminClient()

  // Como o telefone pode estar armazenado com formatação no DB (ex: (34) 99999-9999), o ideal seria LIKE ou unaccent.
  // Para simplificar vamos buscar todos e filtrar no TS se não houver um campo normalizado.
  // Em produção, uma trigger criaria um `telefone_normalizado`.
  const { data: patients } = await supabase.from('patients').select('*')
  
  const patient = patients?.find(p => p.telefone && p.telefone.replace(/\D/g, '').includes(telefone as string))

  if (!patient) {
    const res = { success: true, data: { found: false, patient: null } }
    await logInbound(endpoint, 'GET', null, res, 200)
    return NextResponse.json(res)
  }

  // Buscar prox sessão
  const { data: proxSessao } = await supabase.from('sessions')
    .select('data, horario')
    .eq('patient_id', patient.id)
    .in('status', ['agendada', 'remarcada'])
    .gte('data', new Date().toISOString().split('T')[0])
    .order('data', { ascending: true })
    .limit(1)
    .single()

  // Buscar cobrança pendente
  const { data: cobranca } = await supabase.from('payments')
    .select('id')
    .eq('patient_id', patient.id)
    .neq('status', 'pago')
    .limit(1)
    .single()

  const successRes = {
    success: true,
    data: {
      found: true,
      patient: {
        id: patient.id,
        nome: patient.nome,
        telefone: patient.telefone,
        status: patient.status,
        sessoes_restantes: patient.sessoes_contratadas - patient.sessoes_realizadas,
        proxima_sessao: proxSessao || null,
        cobranca_pendente: !!cobranca
      }
    }
  }

  await logInbound(endpoint, 'GET', null, successRes, 200, null, patient.id)
  return NextResponse.json(successRes)
}
