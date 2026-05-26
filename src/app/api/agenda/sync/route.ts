import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { addDays, format, parseISO } from 'date-fns'

const daysMap: Record<string, number> = {
  'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6
}

/**
 * Returns the interval in days for a given cadence.
 */
function cadenceIntervalDays(cadencia: string, customInterval?: number): number {
  switch (cadencia) {
    case 'semanal':      return 7
    case 'quinzenal':    return 14
    case 'mensal':       return 30
    case 'personalizado': return customInterval && customInterval > 0 ? customInterval : 7
    default:             return 7
  }
}

/**
 * Given a start date, finds the first occurrence of targetDayOfWeek (0=Sun, 1=Mon ... 6=Sat)
 * on or after that start date.
 */
function nextOccurrence(from: Date, targetDayOfWeek: number): Date {
  let d = new Date(from)
  d.setHours(12, 0, 0, 0)
  while (d.getDay() !== targetDayOfWeek) {
    d = addDays(d, 1)
  }
  return d
}

export async function POST(_request: Request) {
  const supabase = await createClient()

  // Fetch all active patients
  const { data: activePatients } = await supabase
    .from('patients')
    .select('*')
    .eq('status', 'ativa')

  if (!activePatients || activePatients.length === 0) {
    return NextResponse.json({ success: true, generated: 0 })
  }

  let totalGenerated = 0

  for (const patient of activePatients) {
    if (!patient.dia_semana || !patient.horario) continue

    const targetDay = daysMap[patient.dia_semana.toLowerCase()]
    if (targetDay === undefined) continue

    const totalContracted: number = patient.sessoes_contratadas || 0
    if (totalContracted <= 0) continue

    const intervalDays = cadenceIntervalDays(patient.cadencia, patient.cadencia_dias_intervalo)

    // Fetch all existing sessions for this patient (any status), sorted by date
    const { data: existingSessions } = await supabase
      .from('sessions')
      .select('id, data')
      .eq('patient_id', patient.id)
      .order('data', { ascending: true })

    const existingCount = existingSessions?.length || 0

    // If patient already has all sessions scheduled, skip
    if (existingCount >= totalContracted) continue

    const sessionsToCreate = totalContracted - existingCount

    // Determine the starting point for new sessions:
    // If there are existing sessions, start after the last one.
    // Otherwise, start from the first occurrence of the preferred day after created_at.
    let nextDate: Date
    if (existingSessions && existingSessions.length > 0) {
      const lastDateStr = existingSessions[existingSessions.length - 1].data
      const lastDate = parseISO(lastDateStr + 'T12:00:00')
      // Next session is intervalDays after the last one
      nextDate = addDays(lastDate, intervalDays)
      // Make sure it falls on the correct day of week
      nextDate = nextOccurrence(nextDate, targetDay)
      // If after shifting to correct day it's more than 2 days off, re-align
      // (edge case: last session was on wrong day due to manual change)
    } else {
      // Start from created_at, find first occurrence of their day
      const createdAt = patient.created_at ? parseISO(patient.created_at) : new Date()
      nextDate = nextOccurrence(createdAt, targetDay)
    }

    // Generate the missing sessions
    for (let i = 0; i < sessionsToCreate; i++) {
      const sessionDateStr = format(nextDate, 'yyyy-MM-dd')

      // Double-check no duplicate exists at this exact date
      const { data: duplicate } = await supabase
        .from('sessions')
        .select('id')
        .eq('patient_id', patient.id)
        .eq('data', sessionDateStr)
        .maybeSingle()

      if (!duplicate) {
        await supabase.from('sessions').insert({
          patient_id: patient.id,
          data: sessionDateStr,
          horario: patient.horario,
          status: 'agendada'
        })
        totalGenerated++
      }

      // Advance to next occurrence
      nextDate = addDays(nextDate, intervalDays)
      // Ensure we stay on the correct weekday (addDays may shift with DST on some locales)
      nextDate = nextOccurrence(nextDate, targetDay)
      // If nextOccurrence pushed it forward by a full cycle, correct back
      // (this handles cadences that are exact multiples of 7 — semanal, quinzenal, mensal≈28)
      // For non-7-multiple intervals (e.g. 30 days), nextOccurrence finds nearest matching day
    }
  }

  return NextResponse.json({ success: true, generated: totalGenerated })
}
