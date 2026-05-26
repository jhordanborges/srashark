import { createClient } from '@/lib/supabase/server'
import DashboardClient from './dashboard-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Buscar Pacientes Ativas
  const { data: patients } = await supabase
    .from('patients')
    .select('id')
    .eq('status', 'ativa')

  // Buscar Sessões da semana
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*, patients(nome)')

  // Buscar Alertas (seguro contra falhas de tabela inexistente pois retorna error sem quebrar)
  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('lido', false)
    .order('created_at', { ascending: false })
    .limit(10)

  // Buscar Pagamentos
  const { data: payments } = await supabase
    .from('payments')
    .select('*')

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>
      <DashboardClient 
        patientsCount={patients?.length || 0}
        sessions={sessions || []}
        alerts={alerts || []}
        payments={payments || []}
      />
    </div>
  )
}
