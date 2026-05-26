'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Calendar as CalendarIcon, CheckSquare, DollarSign, Clock, AlertTriangle, CheckCircle, Check } from 'lucide-react'
import { isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, format, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function DashboardClient({ patientsCount, sessions, alerts: initialAlerts, payments }: { patientsCount: number, sessions: any[], alerts: any[], payments: any[] }) {
  const supabase = createClient()
  const [localSessions, setLocalSessions] = useState(sessions)
  const [localAlerts, setLocalAlerts] = useState(initialAlerts)

  // Datas Base
  const hoje = new Date()
  const inicioSemana = startOfWeek(hoje, { weekStartsOn: 0 })
  const fimSemana = endOfWeek(hoje, { weekStartsOn: 0 })
  const inicioMes = startOfMonth(hoje)
  const fimMes = endOfMonth(hoje)
  const seteDiasFrente = addDays(hoje, 7)

  // Metricas
  const sessoesDaSemana = localSessions.filter(s => s.data && isWithinInterval(new Date(s.data + 'T12:00:00'), { start: inicioSemana, end: fimSemana }))
  const sessoesRealizadasEstaSemana = sessoesDaSemana.filter(s => s.status === 'realizada')

  const receitaMes = payments.filter((p: any) => p.status === 'pago' && p.data_pagamento && isWithinInterval(new Date(p.data_pagamento + 'T12:00:00'), { start: inicioMes, end: fimMes })).reduce((acc, p) => acc + Number(p.valor), 0)
  
  const vencendoEm7Dias = payments.filter((p: any) => p.status === 'pendente' && p.data_pagamento && new Date(p.data_pagamento + 'T12:00:00') <= seteDiasFrente && new Date(p.data_pagamento + 'T12:00:00') >= hoje)
  
  const atrasadas = payments.filter((p: any) => p.status === 'atrasado')

  // Mini Agenda (Seg a Sex da semana atual)
  const diasUteis = []
  for (let i = 1; i <= 5; i++) {
    const d = addDays(inicioSemana, i)
    const dSess = sessoesDaSemana.filter(s => s.data && isSameDay(new Date(s.data + 'T12:00:00'), d)).sort((a,b) => a.horario.localeCompare(b.horario))
    diasUteis.push({ data: d, sessoes: dSess })
  }

  const markSessionRealizada = async (session: any) => {
    try {
      const { error } = await supabase.from('sessions').update({ status: 'realizada' }).eq('id', session.id)
      if (error) throw error

      const { data: patient, error: pError } = await supabase.from('patients').select('sessoes_realizadas').eq('id', session.patient_id).single()
      if (!pError && patient) {
        await supabase.from('patients').update({ sessoes_realizadas: patient.sessoes_realizadas + 1 }).eq('id', session.patient_id)
      }

      setLocalSessions(localSessions.map(s => s.id === session.id ? { ...s, status: 'realizada' } : s))
      toast.success('Sessão marcada como realizada e debitada do pacote!')
    } catch {
      toast.error('Erro ao marcar sessão.')
    }
  }

  const unmarkSessionRealizada = async (session: any) => {
    try {
      const { error } = await supabase.from('sessions').update({ status: 'agendada' }).eq('id', session.id)
      if (error) throw error

      const { data: patient, error: pError } = await supabase.from('patients').select('sessoes_realizadas').eq('id', session.patient_id).single()
      if (!pError && patient) {
        const novasRealizadas = Math.max(0, patient.sessoes_realizadas - 1)
        await supabase.from('patients').update({ sessoes_realizadas: novasRealizadas }).eq('id', session.patient_id)
      }

      setLocalSessions(localSessions.map(s => s.id === session.id ? { ...s, status: 'agendada' } : s))
      toast.success('Sessão devolvida ao pacote.')
    } catch {
      toast.error('Erro ao restaurar sessão.')
    }
  }

  const markAllAlertsRead = async () => {
    try {
      const ids = localAlerts.map(a => a.id)
      if (ids.length === 0) return
      const { error } = await supabase.from('alerts').update({ lido: true }).in('id', ids)
      if (error) throw error
      setLocalAlerts([])
      toast.success('Alertas limpos.')
    } catch {
      toast.error('Erro ao limpar alertas.')
    }
  }

  return (
    <div className="space-y-6">
      {/* 6 Cards Superiores */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pacientes Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{patientsCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessões na Semana</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessoesDaSemana.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Realizadas (Semana)</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessoesRealizadasEstaSemana.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitaMes)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencendo em 7 dias</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{vencendoEm7Dias.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Cobranças Atrasadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{atrasadas.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Mini Agenda */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Mini Agenda (Semana Atual)</CardTitle>
            <CardDescription>Confira e valide as sessões diretamente daqui.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {diasUteis.map((dia, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold border-b pb-1">
                    {format(dia.data, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </h4>
                  {dia.sessoes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhuma sessão prevista.</p>
                  ) : (
                    <div className="space-y-2">
                      {dia.sessoes.map((sess: any) => (
                        <div key={sess.id} className="flex items-center justify-between bg-muted/30 p-2 rounded-md border">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{sess.patients?.nome || 'Desconhecido'}</span>
                            <span className="text-xs text-muted-foreground">{sess.horario?.substring(0,5)} • {sess.status}</span>
                          </div>
                          {sess.status !== 'realizada' ? (
                            <Button size="icon" variant="outline" onClick={() => markSessionRealizada(sess)} title="Marcar como Realizada">
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => unmarkSessionRealizada(sess)} title="Desmarcar e devolver ao pacote" className="mr-1">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Painel de Alertas */}
        <Card className="col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Painel de Alertas</CardTitle>
              <CardDescription>Avisos do sistema</CardDescription>
            </div>
            {localAlerts.length > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAlertsRead}>Limpar</Button>
            )}
          </CardHeader>
          <CardContent>
            {localAlerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum alerta no momento.</div>
            ) : (
              <div className="space-y-4">
                {localAlerts.map((alerta: any) => (
                  <div key={alerta.id} className="flex items-start gap-3 p-3 border-l-4 border-l-yellow-500 bg-muted/20 rounded-r-md">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">{alerta.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-1">{alerta.mensagem}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
