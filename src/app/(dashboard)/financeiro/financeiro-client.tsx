'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowDown, ArrowUp, Download, Search, CheckCircle, Clock, AlertCircle, DollarSign } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, addDays, format, isSameDay, startOfWeek, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export default function FinanceiroClient({ initialPayments, activePatients }: { initialPayments: any[], activePatients: any[] }) {
  const [payments, setPayments] = useState(initialPayments)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [periodoFilter, setPeriodoFilter] = useState('todos')
  const supabase = createClient()

  // MÉTricas
  const hoje = new Date()
  const inicioMesAtual = startOfMonth(hoje)
  const fimMesAtual = endOfMonth(hoje)
  const inicioMesPassado = startOfMonth(subMonths(hoje, 1))
  const fimMesPassado = endOfMonth(subMonths(hoje, 1))

  const pagamentosEsteMes = payments.filter((p: any) => p.status === 'pago' && p.data_pagamento && isWithinInterval(new Date(p.data_pagamento), { start: inicioMesAtual, end: fimMesAtual }))
  const receitaEsteMes = pagamentosEsteMes.reduce((acc, p) => acc + Number(p.valor), 0)

  const pagamentosMesPassado = payments.filter((p: any) => p.status === 'pago' && p.data_pagamento && isWithinInterval(new Date(p.data_pagamento), { start: inicioMesPassado, end: fimMesPassado }))
  const receitaMesPassado = pagamentosMesPassado.reduce((acc, p) => acc + Number(p.valor), 0)

  const diffReceita = receitaMesPassado === 0 ? 100 : ((receitaEsteMes - receitaMesPassado) / receitaMesPassado) * 100
  const mediaPorPaciente = activePatients.length > 0 ? receitaEsteMes / activePatients.length : 0

  const totalEmAberto = payments.filter((p: any) => p.status === 'pendente' || p.status === 'atrasado').reduce((acc, p) => acc + Number(p.valor), 0)
  
  const trintaDias = addDays(hoje, 30)
  const previsto30Dias = payments.filter((p: any) => p.status === 'pendente' && p.data_pagamento && new Date(p.data_pagamento) <= trintaDias).reduce((acc, p) => acc + Number(p.valor), 0)

  const cobrancasAtrasadas = payments.filter((p: any) => p.status === 'atrasado')

  // Gráficos
  const chartData = useMemo(() => {
    const data = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(hoje, i)
      const start = startOfMonth(d)
      const end = endOfMonth(d)
      const val = payments.filter((p: any) => p.status === 'pago' && p.data_pagamento && isWithinInterval(new Date(p.data_pagamento), { start, end })).reduce((acc, p) => acc + Number(p.valor), 0)
      data.push({ name: format(d, 'MMM/yy', { locale: ptBR }), valor: val })
    }
    return data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments])

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {}
    pagamentosEsteMes.forEach((p: any) => {
      counts[p.forma_pagamento] = (counts[p.forma_pagamento] || 0) + 1
    })
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }))
  }, [pagamentosEsteMes])

  // Filtragem
  const filteredPayments = payments.filter((p: any) => {
    if (statusFilter !== 'todos' && p.status !== statusFilter) return false
    if (searchTerm && !p.patients?.nome.toLowerCase().includes(searchTerm.toLowerCase())) return false
    
    if (periodoFilter === 'este_mes' && p.data_pagamento) {
      if (!isWithinInterval(new Date(p.data_pagamento), { start: inicioMesAtual, end: fimMesAtual })) return false
    } else if (periodoFilter === 'mes_passado' && p.data_pagamento) {
      if (!isWithinInterval(new Date(p.data_pagamento), { start: inicioMesPassado, end: fimMesPassado })) return false
    } else if (periodoFilter === 'proximos_30' && p.data_pagamento) {
      if (new Date(p.data_pagamento) > trintaDias || new Date(p.data_pagamento) < hoje) return false
    }

    return true
  })

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF()
    doc.text(`TamaraOS — Relatório Financeiro — ${format(hoje, 'MMMM/yyyy', { locale: ptBR })}`, 14, 15)
    
    const pagospdf = payments.filter(p => p.status === 'pago')
    const pendentespdf = payments.filter(p => p.status !== 'pago')
    
    ;(doc as any).autoTable({
      startY: 25,
      head: [['Paciente', 'Valor', 'Data', 'Forma', 'Status']],
      body: pagospdf.map(p => [p.patients?.nome, `R$ ${p.valor}`, p.data_pagamento, p.forma_pagamento, p.status]),
    })

    ;(doc as any).autoTable({
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Cobranças Pendentes/Atrasadas', 'Valor', 'Vencimento', 'Status']],
      body: pendentespdf.map(p => [p.patients?.nome, `R$ ${p.valor}`, p.data_pagamento, p.status]),
    })

    doc.save('relatorio_financeiro.pdf')
  }

  // Export CSV
  const exportCSV = () => {
    const header = ['Paciente', 'Valor', 'Vencimento', 'Data Pagamento', 'Forma', 'Status']
    const rows = filteredPayments.map(p => [
      p.patients?.nome, p.valor, p.data_pagamento, p.data_pagamento, p.forma_pagamento, p.status
    ])
    const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].map(e => e.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "cobrancas.csv")
    document.body.appendChild(link)
    link.click()
  }

  const markAsPaid = async (id: string) => {
    try {
      const { error } = await supabase.from('payments').update({ status: 'pago' }).eq('id', id)
      if (error) throw error
      toast.success('Cobrança marcada como paga!')
      setPayments(payments.map(p => p.id === id ? { ...p, status: 'pago' } : p))
    } catch {
      toast.error('Erro ao atualizar status.')
    }
  }

  // Calendario
  const [currentMonth, setCurrentMonth] = useState(hoje)
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)
  const dateFormat = "d"
  const rows = []
  let days = []
  let day = startDate
  let formattedDate = ""
  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat)
      const cloneDay = day
      
      const dayPayments = payments.filter((p: any) => p.data_pagamento && isSameDay(new Date(p.data_pagamento + 'T12:00:00'), cloneDay))
      const hasPago = dayPayments.some(p => p.status === 'pago')
      const hasAtrasado = dayPayments.some(p => p.status === 'atrasado')
      const hasPendente = dayPayments.some(p => p.status === 'pendente')

      days.push(
        <div key={day.toString()} className={`p-2 border min-h-[80px] ${!isWithinInterval(day, {start: monthStart, end: monthEnd}) ? 'bg-muted/50 text-muted-foreground' : ''}`}>
          <span className="text-sm font-semibold">{formattedDate}</span>
          <div className="flex gap-1 mt-1 flex-wrap">
            {hasPago && <div className="w-2 h-2 rounded-full bg-green-500" title="Pagamento recebido" />}
            {hasPendente && <div className="w-2 h-2 rounded-full bg-blue-500" title="Cobrança prevista" />}
            {hasAtrasado && <div className="w-2 h-2 rounded-full bg-red-500" title="Cobrança atrasada" />}
          </div>
        </div>
      )
      day = addDays(day, 1)
    }
    rows.push(<div className="grid grid-cols-7" key={day.toString()}>{days}</div>)
    days = []
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
         <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" /> Exportar CSV</Button>
         <Button variant="outline" onClick={exportPDF}><Download className="w-4 h-4 mr-2" /> Exportar PDF</Button>
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto h-14 p-1.5 bg-muted rounded-lg no-scrollbar">
          <TabsTrigger value="resumo" className="flex-1 whitespace-nowrap text-base h-full">Resumo e Métricas</TabsTrigger>
          <TabsTrigger value="cobrancas" className="flex-1 whitespace-nowrap text-base h-full">Lista de Cobranças</TabsTrigger>
          <TabsTrigger value="fluxo" className="flex-1 whitespace-nowrap text-base h-full">Fluxo de Caixa</TabsTrigger>
        </TabsList>
        
        <TabsContent value="resumo" className="space-y-4">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita (Mês Atual)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitaEsteMes)}</div>
                <p className="text-xs text-muted-foreground flex items-center">
                  {diffReceita >= 0 ? <ArrowUp className="w-3 h-3 text-green-500 mr-1"/> : <ArrowDown className="w-3 h-3 text-red-500 mr-1"/>}
                  {Math.abs(diffReceita).toFixed(1)}% em relação ao mês passado
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita (Mês Passado)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitaMesPassado)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Média por Paciente (Ativa)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mediaPorPaciente)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total em Aberto</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalEmAberto)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Previsto 30 Dias</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(previsto30Dias)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-destructive">Cobranças Atrasadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive flex items-center">
                  {cobrancasAtrasadas.length} <Badge variant="destructive" className="ml-2">Atrasadas</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Receita Mensal (Últimos 6 meses)</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                    <Tooltip formatter={(value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))} />
                    <Bar dataKey="valor" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Formas de Pagamento (Mês Atual)</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem pagamentos este mês</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cobrancas" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar paciente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
            </div>
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || "todos")}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={periodoFilter} onValueChange={(val) => setPeriodoFilter(val || "todos")}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="este_mes">Este mês</SelectItem>
                <SelectItem value="mes_passado">Mês passado</SelectItem>
                <SelectItem value="proximos_30">Próximos 30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="border rounded-md bg-card">
            {filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhuma cobrança encontrada.</div>
            ) : (
              <div className="divide-y">
                {filteredPayments.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-4">
                    <div>
                      <p className="font-medium">{p.patients?.nome || 'Paciente Desconhecido'}</p>
                      <p className="text-sm text-muted-foreground">Venc/Data: {p.data_pagamento ? format(new Date(p.data_pagamento + 'T12:00:00'), 'dd/MM/yyyy') : 'Não def.'} | {p.forma_pagamento}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.valor)}</span>
                      <Badge className={p.status === 'pago' ? 'bg-green-500' : p.status === 'atrasado' ? 'bg-red-500' : 'bg-yellow-500'}>
                        {p.status}
                      </Badge>
                      {p.status !== 'pago' && (
                        <Button variant="ghost" size="sm" onClick={() => markAsPaid(p.id)}><CheckCircle className="w-4 h-4 text-green-600" /></Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="fluxo" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                Fluxo de Caixa - {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>Anterior</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Hoje</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addDays(currentMonth, 30))}>Próximo</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 text-center font-bold mb-2">
                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
              </div>
              <div className="border rounded-md flex flex-col">
                {rows}
              </div>
              <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-green-500 mr-2"/> Pagamento recebido</span>
                <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-blue-500 mr-2"/> Cobrança prevista</span>
                <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-red-500 mr-2"/> Cobrança atrasada</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
