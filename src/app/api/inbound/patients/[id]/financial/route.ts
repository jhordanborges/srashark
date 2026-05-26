import { NextResponse } from 'next/server'
import { validateInboundAuth, logInbound, getAdminClient } from '@/lib/inbound-auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await validateInboundAuth(req)
  if (!auth.valid) return NextResponse.json({ error: auth.error, message: auth.message }, { status: 401 })

  const endpoint = `/api/inbound/patients/${params.id}/financial`
  const supabase = getAdminClient()

  const { data: patient } = await supabase.from('patients').select('*').eq('id', params.id).single()
  if (!patient) {
    const res = { error: 'patient_not_found', message: 'Paciente não encontrada' }
    await logInbound(endpoint, 'GET', null, res, 404, null, params.id)
    return NextResponse.json(res, { status: 404 })
  }

  // Ultimo pagamento pago
  const { data: ultimoPago } = await supabase.from('payments')
    .select('*')
    .eq('patient_id', params.id)
    .eq('status', 'pago')
    .order('data_pagamento', { ascending: false })
    .limit(1)
    .single()

  // Cobranca atual (a mais proxima de vencer ou já atrasada)
  const { data: cobrancaAtual } = await supabase.from('payments')
    .select('*')
    .eq('patient_id', params.id)
    .neq('status', 'pago')
    .order('data_pagamento', { ascending: true })
    .limit(1)
    .single()

  let statusGeral = 'ok'
  if (cobrancaAtual) {
    statusGeral = cobrancaAtual.status
  }

  const successRes = {
    success: true,
    data: {
      patient: {
        id: patient.id,
        nome: patient.nome,
        telefone: patient.telefone
      },
      financial: {
        ultimo_pagamento: ultimoPago ? {
          valor: ultimoPago.valor,
          data: ultimoPago.data_pagamento,
          status: 'pago'
        } : null,
        cobranca_atual: cobrancaAtual ? {
          id: cobrancaAtual.id,
          valor: cobrancaAtual.valor,
          vencimento: cobrancaAtual.data_pagamento,
          status: cobrancaAtual.status,
          dias_para_vencer: Math.max(0, Math.floor((new Date(cobrancaAtual.data_pagamento).getTime() - new Date().getTime()) / (1000 * 3600 * 24))),
          dias_em_atraso: Math.max(0, Math.floor((new Date().getTime() - new Date(cobrancaAtual.data_pagamento).getTime()) / (1000 * 3600 * 24)))
        } : null,
        status_geral: statusGeral
      }
    }
  }

  await logInbound(endpoint, 'GET', null, successRes, 200, null, params.id)
  return NextResponse.json(successRes)
}
