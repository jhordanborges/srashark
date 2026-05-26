'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react'
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import SessionCard from '@/components/agenda/session-card'
import DroppableCell from '@/components/agenda/droppable-cell'
import { Loader2 } from 'lucide-react'

export default function AgendaClient({ initialSessions }: { initialSessions: any[] }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [sessions, setSessions] = useState(initialSessions)
  const [isSyncing, setIsSyncing] = useState(false)
  const supabase = createClient()

  const startWeek = startOfWeek(currentDate, { weekStartsOn: 1 })
  const endWeek = endOfWeek(currentDate, { weekStartsOn: 1 })

  useEffect(() => {
    const syncWeek = async () => {
      setIsSyncing(true)
      await fetch('/api/agenda/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: format(startWeek, 'yyyy-MM-dd') })
      })
      const { data } = await supabase
        .from('sessions')
        .select(`*, patient:patients(*)`)
        .gte('data', format(startWeek, 'yyyy-MM-dd'))
        .lte('data', format(endWeek, 'yyyy-MM-dd'))
      
      if (data) setSessions(data)
      setIsSyncing(false)
    }
    syncWeek()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const sessionId = active.id as string
    const [newDate, newTime] = (over.id as string).split('|')

    const session = sessions.find(s => s.id === sessionId)
    if (!session) return

    if (confirm(`Deseja remarcar para ${newDate} às ${newTime}?`)) {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, data: newDate, horario: newTime } : s))
      await supabase.from('sessions').update({ data: newDate, horario: newTime }).eq('id', sessionId)
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s))
    await supabase.from('sessions').update({ status: newStatus }).eq('id', id)
  }

  const hours = Array.from({ length: 15 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`)
  const days = Array.from({ length: 5 }, (_, i) => addDays(startWeek, i))

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold tracking-tight">Agenda</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>Anterior</Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          <Button variant="outline" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>Próxima</Button>
        </div>
      </div>
      <p className="text-muted-foreground mb-4">
        Semana de {format(startWeek, 'dd/MM')} a {format(endWeek, 'dd/MM')}
        {isSyncing && <Loader2 className="inline ml-2 h-4 w-4 animate-spin" />}
      </p>

      <div className="flex-1 flex gap-4 overflow-hidden">
        <div className="flex-1 overflow-auto border rounded-md bg-card relative">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] min-w-[800px]">
              <div className="sticky top-0 bg-muted p-2 border-b border-r z-20">Hora</div>
              {days.map(day => (
                <div key={day.toISOString()} className="sticky top-0 bg-muted p-2 border-b border-r text-center font-semibold z-20">
                  <span className="capitalize">{format(day, 'EEEE', { locale: ptBR })}</span> <br/>
                  <span className="text-sm font-normal text-muted-foreground">{format(day, 'dd/MM')}</span>
                </div>
              ))}

              {hours.map(hour => (
                <div key={hour} className="contents">
                  <div className="p-2 border-r border-b text-sm text-center text-muted-foreground sticky left-0 bg-card z-10">
                    {hour}
                  </div>
                  {days.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const cellId = `${dateStr}|${hour}:00`
                    const cellSessions = sessions.filter(s => s.data === dateStr && s.horario.startsWith(hour.substring(0,2)))

                    return (
                      <DroppableCell key={cellId} id={cellId}>
                        {cellSessions.map(session => (
                          <SessionCard 
                            key={session.id} 
                            session={session} 
                            onUpdateStatus={handleUpdateStatus} 
                          />
                        ))}
                      </DroppableCell>
                    )
                  })}
                </div>
              ))}
            </div>
          </DndContext>
        </div>

        <div className="w-80 hidden xl:flex flex-col gap-4 overflow-y-auto">
          <div className="bg-card border rounded-md p-4">
            <h3 className="font-bold mb-4">Sessões de Hoje</h3>
            <div className="space-y-4">
              {sessions.filter(s => s.data === format(new Date(), 'yyyy-MM-dd')).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma sessão hoje.</p>
              ) : (
                sessions
                  .filter(s => s.data === format(new Date(), 'yyyy-MM-dd'))
                  .sort((a,b) => a.horario.localeCompare(b.horario))
                  .map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div>
                        <p className="font-medium text-sm">{s.patient?.nome || 'Paciente'}</p>
                        <p className="text-xs text-muted-foreground">{s.horario.substring(0,5)}</p>
                      </div>
                      {s.status === 'agendada' && (
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(s.id, 'realizada')}>✓</Button>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
