import { createClient } from '@/lib/supabase/server'
import PacientesClient from './pacientes-client'

export const dynamic = 'force-dynamic'

export default async function PacientesPage() {
  const supabase = await createClient()
  
  const { data: patients } = await supabase
    .from('patients')
    .select('*')
    .order('nome')

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Pacientes</h2>
      </div>
      <PacientesClient initialData={patients || []} />
    </div>
  )
}
