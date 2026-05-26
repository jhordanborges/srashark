import { createClient } from '@/lib/supabase/server'
import FinanceiroClient from './financeiro-client'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage() {
  const supabase = await createClient()

  const { data: payments } = await supabase
    .from('payments')
    .select('*, patients(nome, status)')
    .order('data_pagamento', { ascending: false })

  const { data: patients } = await supabase
    .from('patients')
    .select('id, nome, status')
    .eq('status', 'ativa')

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Financeiro</h2>
      </div>
      <FinanceiroClient initialPayments={payments || []} activePatients={patients || []} />
    </div>
  )
}
