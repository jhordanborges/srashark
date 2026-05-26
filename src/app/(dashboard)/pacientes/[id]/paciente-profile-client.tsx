'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, DollarSign, Edit, MoreVertical } from 'lucide-react'
import { dispatchInternalWebhook } from '@/actions/webhooks'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import NovaSessaoModal from '@/components/agenda/nova-sessao-modal'
import RemarcacaoModal from '@/components/agenda/remarcacao-modal'
import RenovacaoModal from '@/components/pacientes/renovacao-modal'
import PagamentoModal from '@/components/pacientes/pagamento-modal'
import PacienteFormModal from '@/components/pacientes/paciente-form-modal'
import { CheckCircle } from 'lucide-react'

export default function PacienteProfileClient({ patient, sessions, payments }: any) {
  const supabase = createClient()
  
  const [patientData, setPatientData] = useState(patient)
  const [sessionsList, setSessionsList] = useState(sessions)
  const [paymentsList, setPaymentsList] = useState(payments)

  const [isNovaSessaoOpen, setIsNovaSessaoOpen] = useState(false)
  const [isRemarcacaoOpen, setIsRemarcacaoOpen] = useState(false)
  const [isRenovacaoOpen, setIsRenovacaoOpen] = useState(false)
  const [isPagamentoOpen, setIsPagamentoOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<any>(null)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativa': return 'bg-green-500 text-white'
      case 'pausada': return 'bg-yellow-500 text-white'
      case 'encerrada': return 'bg-gray-500 text-white'
      default: return 'bg-primary text-white'
    }
  }

  const getSessionColor = (status: string) => {
    switch(status) {
      case 'agendada': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'realizada': return 'bg-green-100 text-green-800 border-green-200'
      case 'faltou': return 'bg-red-100 text-red-800 border-red-200'
      case 'cancelada': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'remarcada': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-secondary'
    }
  }

  const refreshData = async () => {
    const { data: pData } = await supabase.from('patients').select('*').eq('id', patient.id).single()
    const { data: sData } = await supabase.from('sessions').select('*').eq('patient_id', patient.id).order('data', { ascending: false })
    const { data: payData } = await supabase.from('payments').select('*').eq('patient_id', patient.id).order('data_pagamento', { ascending: false })
    
    if (pData) setPatientData(pData)
    if (sData) setSessionsList(sData)
    if (payData) setPaymentsList(payData)
  }

  const handleSessionAction = async (session: any, action: string) => {
    try {
      if (action === 'realizada') {
        const { error: sErr } = await supabase.from('sessions').update({ status: 'realizada' }).eq('id', session.id)
        if (sErr) throw sErr

        const novasRealizadas = patientData.sessoes_realizadas + 1
        const { error: pErr } = await supabase.from('patients').update({ sessoes_realizadas: novasRealizadas }).eq('id', patientData.id)
        if (pErr) throw pErr

        const restantes = patientData.sessoes_contratadas - novasRealizadas

        dispatchInternalWebhook('session.completed', { session: { ...session, status: 'realizada' }, patient: patientData })

        if (restantes === 2) {
          toast.warning(`Atenção: restam apenas 2 sessões no pacote de ${patientData.nome}`, { duration: 5000 })
        } else if (restantes <= 0) {
          toast.error("Pacote encerrado. Renove para continuar.", { duration: 5000 })
          setIsRenovacaoOpen(true)
        } else {
          toast.success("Sessão marcada como realizada!")
        }
        await refreshData()
      } 
      else if (action === 'faltou') {
        const { error } = await supabase.from('sessions').update({ status: 'faltou' }).eq('id', session.id)
        if (error) throw error
        
        dispatchInternalWebhook('session.missed', { session: { ...session, status: 'faltou' }, patient: patientData })
        
        toast('Paciente faltou', {
          action: {
            label: 'Remarcar',
            onClick: () => {
              setSelectedSession(session)
              setIsRemarcacaoOpen(true)
            }
          }
        })
        await refreshData()
      }
      else if (action === 'cancelada') {
        const { error } = await supabase.from('sessions').update({ status: 'cancelada' }).eq('id', session.id)
        if (error) throw error
        
        dispatchInternalWebhook('session.cancelled', { session: { ...session, status: 'cancelada' }, patient: patientData })
        
        toast.success("Sessão cancelada.")
        await refreshData()
      }
      else if (action === 'remarcar') {
        setSelectedSession(session)
        setIsRemarcacaoOpen(true)
      }
    } catch {
      toast.error('Ocorreu um erro ao atualizar a sessão.')
    }
  }

  const markPaymentAsPaid = async (id: string) => {
    try {
      const { error } = await supabase.from('payments').update({ status: 'pago' }).eq('id', id)
      if (error) throw error
      toast.success('Cobrança marcada como paga!')
      await refreshData()
    } catch {
      toast.error('Erro ao atualizar status do pagamento.')
    }
  }

  const sessoesRestantes = patientData.sessoes_contratadas - patientData.sessoes_realizadas
  const totalPago = paymentsList.filter((p: any) => p.status === 'pago').reduce((acc: number, p: any) => acc + Number(p.valor), 0)
  const statusFinanceiro = paymentsList.length > 0 ? paymentsList[0].status : 'desconhecido'

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            {patientData.nome}
            <Badge className={getStatusColor(patientData.status)}>{patientData.status}</Badge>
          </h2>
          <p className="text-muted-foreground mt-1">
            Cadência: <span className="capitalize">{patientData.cadencia}</span> | {patientData.dia_semana || 'Sem dia'} {patientData.horario?.substring(0,5)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIsEditOpen(true)}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
          <Button variant="secondary" onClick={() => setIsNovaSessaoOpen(true)}><Calendar className="mr-2 h-4 w-4" /> Nova Sessão</Button>
          <Button onClick={() => setIsRenovacaoOpen(true)}><DollarSign className="mr-2 h-4 w-4" /> Renovar Pacote</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessões Realizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{patientData.sessoes_realizadas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessões Restantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${sessoesRestantes <= 2 ? 'text-destructive' : ''}`}>{sessoesRestantes}</div>
            <p className="text-xs text-muted-foreground">de {patientData.sessoes_contratadas} contratadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPago)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Financeiro (Último)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold capitalize ${statusFinanceiro === 'pago' ? 'text-green-600' : 'text-red-600'}`}>{statusFinanceiro}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sessoes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessoes">Histórico de Sessões</TabsTrigger>
          <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="observacoes">Observações</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sessoes" className="space-y-4">
          <div className="border rounded-md bg-card">
            {sessionsList.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhuma sessão registrada.</div>
            ) : (
              <div className="divide-y">
                {sessionsList.map((session: any) => (
                  <div key={session.id} className="flex justify-between items-center p-4 hover:bg-muted/50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{format(new Date(session.data + 'T' + session.horario), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                        <Badge variant="outline" className={`capitalize border ${getSessionColor(session.status)}`}>{session.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground max-w-xl truncate">{session.observacoes || 'Sem observações'}</p>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground h-10 w-10">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleSessionAction(session, 'realizada')}>Marcar como Realizada</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSessionAction(session, 'faltou')}>Marcar como Faltou</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSessionAction(session, 'remarcar')}>Remarcar Sessão</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSessionAction(session, 'cancelada')} className="text-destructive">Cancelar Sessão</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dados" className="space-y-4 border rounded-md p-4 bg-card">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">E-mail</p>
              <p className="font-medium">{patientData.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefone</p>
              <p className="font-medium">{patientData.telefone || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cadastrado em</p>
              <p className="font-medium">{format(new Date(patientData.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
            </div>
            {patientData.motivo_pausa && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Motivo da Pausa</p>
                <p className="font-medium text-destructive">{patientData.motivo_pausa}</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="pagamentos" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsPagamentoOpen(true)}><DollarSign className="w-4 h-4 mr-2" /> Registrar Pagamento</Button>
          </div>
          <div className="border rounded-md bg-card">
            {paymentsList.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhum pagamento registrado.</div>
            ) : (
              <div className="divide-y">
                {paymentsList.map((payment: any) => (
                  <div key={payment.id} className="flex justify-between items-center p-4">
                    <div>
                      <p className="font-medium">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.valor)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.data_pagamento ? format(new Date(payment.data_pagamento), 'dd/MM/yyyy') : 'Sem data'} - {payment.forma_pagamento}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className={`capitalize ${payment.status === 'pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{payment.status}</Badge>
                      {payment.status !== 'pago' && (
                        <Button variant="ghost" size="sm" onClick={() => markPaymentAsPaid(payment.id)}><CheckCircle className="w-4 h-4 text-green-600" /></Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="observacoes" className="space-y-4">
           <div className="border rounded-md p-4 bg-card min-h-[200px] whitespace-pre-wrap">
             {patientData.observacoes || 'Nenhuma observação registrada.'}
           </div>
        </TabsContent>
      </Tabs>

      <NovaSessaoModal 
        isOpen={isNovaSessaoOpen} 
        onClose={() => setIsNovaSessaoOpen(false)} 
        onSuccess={refreshData} 
        preselectedPatientId={patientData.id} 
      />

      <RemarcacaoModal 
        isOpen={isRemarcacaoOpen} 
        onClose={() => setIsRemarcacaoOpen(false)} 
        onSuccess={refreshData} 
        session={selectedSession} 
      />

      <RenovacaoModal 
        isOpen={isRenovacaoOpen} 
        onClose={() => setIsRenovacaoOpen(false)} 
        onSuccess={refreshData} 
        patientId={patientData.id} 
        currentContratadas={patientData.sessoes_contratadas} 
      />

      <PagamentoModal
        isOpen={isPagamentoOpen}
        onClose={() => setIsPagamentoOpen(false)}
        onSuccess={refreshData}
        patientId={patientData.id}
      />

      <PacienteFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={refreshData}
        patient={patientData}
      />
    </div>
  )
}
