import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { startOfWeek, addDays, format, addWeeks, subWeeks } from 'date-fns'

export async function POST(request: Request) {
  const { startDate } = await request.json()
  const supabase = await createClient()

  const requestedStart = new Date(startDate + 'T12:00:00')

  // Generate sessions for a window: 2 weeks back + current + 2 weeks ahead
  const weeksToProcess = [
    subWeeks(requestedStart, 2),
    subWeeks(requestedStart, 1),
    requestedStart,
    addWeeks(requestedStart, 1),
    addWeeks(requestedStart, 2),
  ]

  const { data: activePatients } = await supabase
    .from('patients')
    .select('*')
    .eq('status', 'ativa')

  if (!activePatients) return NextResponse.json({ success: true })

  const daysMap: Record<string, number> = {
    'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6
  }

  // Reference epoch for quinzenal/mensal cadence calculation
  const EPOCH = new Date('2024-01-01T12:00:00')

  for (const weekStart of weeksToProcess) {
    const currentWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 })

    for (const patient of activePatients) {
      if (!patient.dia_semana || !patient.horario) continue

      // Calculate week number since epoch for cadence logic
      const weeksSinceEpoch = Math.floor((currentWeekStart.getTime() - EPOCH.getTime()) / (7 * 24 * 60 * 60 * 1000))

      let shouldHaveSession = false
      if (patient.cadencia === 'semanal') {
        shouldHaveSession = true
      } else if (patient.cadencia === 'quinzenal') {
        shouldHaveSession = weeksSinceEpoch % 2 === 0
      } else if (patient.cadencia === 'mensal') {
        shouldHaveSession = weeksSinceEpoch % 4 === 0
      } else if (patient.cadencia === 'personalizado') {
        shouldHaveSession = true
      }

      if (!shouldHaveSession) continue

      const targetDay = daysMap[patient.dia_semana.toLowerCase()]
      if (targetDay === undefined) continue

      // Find the correct day in this week
      let sessionDate = currentWeekStart
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
  }

  return NextResponse.json({ success: true })
}
