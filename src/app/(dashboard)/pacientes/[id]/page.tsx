import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PacienteProfileClient from './paciente-profile-client'

export const dynamic = 'force-dynamic'

export default async function PacientePerfilPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  
  const { data: patient, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !patient) {
    notFound()
  }

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('patient_id', params.id)
    .order('data', { ascending: false })

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('patient_id', params.id)
    .order('data_pagamento', { ascending: false })

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PacienteProfileClient 
        patient={patient} 
        sessions={sessions || []} 
        payments={payments || []} 
      />
    </div>
  )
}
