import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { startOfWeek, addDays, format, differenceInWeeks } from 'date-fns'

export async function POST(request: Request) {
  const { startDate } = await request.json()
  const supabase = await createClient()

  const start = new Date(startDate)
  
  const { data: activePatients } = await supabase
    .from('patients')
    .select('*')
    .eq('status', 'ativa')

  if (!activePatients) return NextResponse.json({ success: true })

  for (const patient of activePatients) {
    if (!patient.dia_semana || !patient.horario) continue

    const diffWeeks = differenceInWeeks(start, new Date(patient.created_at))
    let shouldHaveSession = false

    if (patient.cadencia === 'semanal') {
      shouldHaveSession = true
    } else if (patient.cadencia === 'quinzenal') {
      shouldHaveSession = diffWeeks % 2 === 0
    } else if (patient.cadencia === 'mensal') {
      shouldHaveSession = diffWeeks % 4 === 0
    } else if (patient.cadencia === 'personalizado') {
      shouldHaveSession = true 
    }

    if (!shouldHaveSession) continue

    const daysMap: Record<string, number> = {
      'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6
    }
    const targetDay = daysMap[patient.dia_semana.toLowerCase()]
    
    let sessionDate = startOfWeek(start, { weekStartsOn: 1 })
    while (sessionDate.getDay() !== targetDay) {
      sessionDate = addDays(sessionDate, 1)
    }

    const sessionDateStr = format(sessionDate, 'yyyy-MM-dd')

    const { data: existing } = await supabase
      .from('sessions')
      .select('id')
      .eq('patient_id', patient.id)
      .eq('data', sessionDateStr)
      .maybeSingle()

    if (!existing) {
      await supabase.from('sessions').insert({
        patient_id: patient.id,
        data: sessionDateStr,
        horario: patient.horario,
        status: 'agendada'
      })
    }
  }

  return NextResponse.json({ success: true })
}
