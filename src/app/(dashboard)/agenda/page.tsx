import { createClient } from '@/lib/supabase/server'
import AgendaClient from './agenda-client'

export const dynamic = 'force-dynamic'

export default async function AgendaPage() {
  const supabase = await createClient()
  
  const { data: initialSessions } = await supabase
    .from('sessions')
    .select(`*, patient:patients(*)`)
    .limit(100)

  return (
    <div className="flex-1 p-4 md:p-8 pt-6 h-full">
      <AgendaClient initialSessions={initialSessions || []} />
    </div>
  )
}
