import { createClient } from '@supabase/supabase-js'

export async function validateInboundAuth(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'unauthorized', message: 'API key ausente' }
  }

  const token = authHeader.split(' ')[1]
  
  // Se bater com .env (segurança base)
  if (process.env.TAMARAOS_API_KEY && token === process.env.TAMARAOS_API_KEY) {
    return { valid: true }
  }

  // Ou bater com banco
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

  const { data: integration } = await supabaseAdmin
    .from('integrations')
    .select('config, ativo')
    .eq('tipo', 'api_inbound')
    .single()

  if (integration?.ativo && integration.config?.api_key === token) {
    return { valid: true, config: integration.config }
  }

  return { valid: false, error: 'unauthorized', message: 'API key inválida ou integração inativa' }
}

export async function logInbound(endpoint: string, method: string, body: any, response: any, statusCode: number, errorMsg?: string, patientId?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

  await supabaseAdmin.from('api_inbound_logs').insert({
    endpoint,
    method,
    body,
    patient_id: patientId || null,
    status_code: statusCode,
    response,
    erro: errorMsg || null,
    processado: true
  })
}

export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
