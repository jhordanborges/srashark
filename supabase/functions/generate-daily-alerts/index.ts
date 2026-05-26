import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const hojeStr = new Date().toISOString().split('T')[0]
    let alertsCreated = 0

    // 1. Alertas de Sessão Hoje
    const { data: sessoesHoje } = await supabaseAdmin
      .from('sessions')
      .select('*, patients(nome)')
      .eq('data', hojeStr)
      .eq('status', 'agendada')

    if (sessoesHoje && sessoesHoje.length > 0) {
      for (const sessao of sessoesHoje) {
        await supabaseAdmin.from('alerts').insert({
          paciente_id: sessao.patient_id,
          tipo: 'sessao_hoje',
          titulo: 'Sessão Hoje',
          mensagem: `Sessão com ${sessao.patients?.nome} às ${sessao.horario?.substring(0,5)} hoje`,
          cor: 'blue',
          lido: false,
          link: '/agenda'
        })
        alertsCreated++
      }
    }

    // 2. Alertas Pacote Near End / Completo
    const { data: pacientes } = await supabaseAdmin
      .from('patients')
      .select('id, nome, sessoes_contratadas, sessoes_realizadas')
      .eq('status', 'ativa')

    if (pacientes && pacientes.length > 0) {
      for (const paciente of pacientes) {
        const restantes = paciente.sessoes_contratadas - paciente.sessoes_realizadas
        
        if (restantes <= 2 && restantes > 0) {
          // Checar duplicidade (não gerar se já tem um não lido para esta fase)
          const { data: ex } = await supabaseAdmin.from('alerts').select('id').eq('paciente_id', paciente.id).eq('tipo', 'pacote_near_end').eq('lido', false).limit(1)
          if (!ex || ex.length === 0) {
            await supabaseAdmin.from('alerts').insert({
              paciente_id: paciente.id,
              tipo: 'pacote_near_end',
              titulo: 'Pacote Quase no Fim',
              mensagem: `${paciente.nome} tem apenas ${restantes} sessões restantes no pacote`,
              cor: 'orange',
              lido: false,
              link: `/pacientes/${paciente.id}`
            })
            alertsCreated++
          }
        } else if (restantes <= 0) {
          const { data: ex } = await supabaseAdmin.from('alerts').select('id').eq('paciente_id', paciente.id).eq('tipo', 'pacote_completo').eq('lido', false).limit(1)
          if (!ex || ex.length === 0) {
            await supabaseAdmin.from('alerts').insert({
              paciente_id: paciente.id,
              tipo: 'pacote_completo',
              titulo: 'Pacote Concluído',
              mensagem: `Pacote de ${paciente.nome} foi concluído. Aguardando renovação.`,
              cor: 'purple',
              lido: false,
              link: `/pacientes/${paciente.id}`
            })
            alertsCreated++
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, alertsCreated }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})
