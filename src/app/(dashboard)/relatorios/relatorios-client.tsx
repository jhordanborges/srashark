'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, Users, Calendar, DollarSign, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

export default function RelatoriosClient() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [mesAtual, setMesAtual] = useState(new Date().getMonth().toString())
  const [anoAtual, setAnoAtual] = useState(new Date().getFullYear().toString())
  
  const [stats, setStats] = useState<any>({
    mensal: { realizadas: 0, faltou: 0, taxa: 0, receita_recebida: 0, receita_pendente: 0 },
    pacientes: { ativas: 0, pausadas: 0, encerradas: 0, renovacoes: 0 }
  })
  const [ranking, setRanking] = useState<any[]>([])
  const [pacientesVencendo, setPacientesVencendo] = useState<any[]>([])
  const [pacientesAtrasadas, setPacientesAtrasadas] = useState<any[]>([])
  const [graficos, setGraficos] = useState<any>({ sessoesPorSemana: [], receita6Meses: [], formasPagamento: [], sessoesPorMes: [] })

  useEffect(() => {
    fetchData()
  }, [mesAtual, anoAtual])

  const fetchData = async () => {
    setLoading(true)
    
    // Filtros de data
    const startOfMonth = new Date(parseInt(anoAtual), parseInt(mesAtual), 1).toISOString().split('T')[0]
    const endOfMonth = new Date(parseInt(anoAtual), parseInt(mesAtual) + 1, 0).toISOString().split('T')[0]

    // Sessões do Mês
    const { data: sessoesMes } = await supabase.from('sessions').select('*, patients(nome)')
      .gte('data', startOfMonth).lte('data', endOfMonth)
    
    let realizadas = 0, faltou = 0
    let rankMap: Record<string, any> = {}

    if (sessoesMes) {
      sessoesMes.forEach(s => {
        if (s.status === 'realizada') realizadas++
        if (s.status === 'faltou') faltou++
        
        if (s.status === 'realizada' || s.status === 'faltou') {
          const nome = s.patients?.nome || 'Desconhecido'
          if (!rankMap[nome]) rankMap[nome] = { nome, realizadas: 0, faltou: 0 }
          if (s.status === 'realizada') rankMap[nome].realizadas++
          if (s.status === 'faltou') rankMap[nome].faltou++
        }
      })
    }

    const taxa = realizadas + faltou > 0 ? Math.round((realizadas / (realizadas + faltou)) * 100) : 0
    
    const rankingArray = Object.values(rankMap).map(r => ({
      ...r,
      taxa: r.realizadas + r.faltou > 0 ? Math.round((r.realizadas / (r.realizadas + r.faltou)) * 100) : 0
    })).sort((a, b) => b.taxa - a.taxa)

    // Financeiro do Mês
    const { data: pagamentosMes } = await supabase.from('payments').select('*')
      .gte('data_pagamento', startOfMonth).lte('data_pagamento', endOfMonth)

    let recRecebida = 0, recPendente = 0
    let formPagMap: Record<string, number> = {}

    if (pagamentosMes) {
      pagamentosMes.forEach(p => {
        if (p.status === 'pago') {
          recRecebida += p.valor
          formPagMap[p.forma_pagamento] = (formPagMap[p.forma_pagamento] || 0) + p.valor
        }
        else if (p.status === 'pendente' || p.status === 'atrasado') recPendente += p.valor
      })
    }

    const formasGrafico = Object.entries(formPagMap).map(([name, value]) => ({ name, value }))

    // Pacientes
    const { data: pacientes } = await supabase.from('patients').select('*')
    let ativas = 0, pausadas = 0, encerradas = 0
    let vencendo: any[] = []
    
    if (pacientes) {
      pacientes.forEach(p => {
        if (p.status === 'ativa') ativas++
        else if (p.status === 'pausada') pausadas++
        else if (p.status === 'encerrada') encerradas++

        const rest = p.sessoes_contratadas - p.sessoes_realizadas
        if (p.status === 'ativa' && rest <= 2) {
          vencendo.push({ nome: p.nome, restantes: rest })
        }
      })
    }

    // Atrasadas
    const { data: atrasadas } = await supabase.from('payments').select('*, patients(nome)')
      .eq('status', 'atrasado')
    
    // Update States
    setStats({
      mensal: { realizadas, faltou, taxa, receita_recebida: recRecebida, receita_pendente: recPendente },
      pacientes: { ativas, pausadas, encerradas, renovacoes: 0 }
    })
    setRanking(rankingArray)
    setPacientesVencendo(vencendo)
    setPacientesAtrasadas(atrasadas || [])
    
    // Mock Gráficos por enquanto
    setGraficos({
      sessoesPorSemana: [{ name: 'Sem 1', realizadas: 10, faltou: 2 }, { name: 'Sem 2', realizadas: 12, faltou: 1 }],
      receita6Meses: [{ name: 'Jan', valor: 4000 }, { name: 'Fev', valor: 5500 }, { name: 'Mar', valor: 6200 }],
      formasPagamento: formasGrafico,
      sessoesPorMes: [{ name: 'Jan', realizadas: 45 }, { name: 'Fev', realizadas: 50 }, { name: 'Mar', realizadas: 60 }]
    })

    setLoading(false)
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(20)
    doc.text(`Relatório TamaraOS - ${parseInt(mesAtual)+1}/${anoAtual}`, 14, 22)
    
    doc.setFontSize(14)
    doc.text('Visão Geral', 14, 35)
    
    autoTable(doc, {
      startY: 40,
      head: [['Métrica', 'Valor']],
      body: [
        ['Sessões Realizadas', stats.mensal.realizadas],
        ['Faltas', stats.mensal.faltou],
        ['Taxa de Presença', `${stats.mensal.taxa}%`],
        ['Receita Recebida', `R$ ${stats.mensal.receita_recebida.toFixed(2)}`],
        ['Receita Pendente/Atrasada', `R$ ${stats.mensal.receita_pendente.toFixed(2)}`]
      ]
    })

    const finalY = (doc as any).lastAutoTable.finalY || 40

    doc.text('Ranking de Presença', 14, finalY + 15)
    autoTable(doc, {
      startY: finalY + 20,
      head: [['Paciente', 'Realizadas', 'Faltou', 'Taxa %']],
      body: ranking.map(r => [r.nome, r.realizadas, r.faltou, `${r.taxa}%`])
    })

    doc.save(`Relatorio_${parseInt(mesAtual)+1}_${anoAtual}.pdf`)
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Relatórios Gerenciais</h2>
          <p className="text-muted-foreground">Métricas de performance clínica e financeira.</p>
        </div>
        <div className="flex gap-4 items-center">
          <Select value={mesAtual} onValueChange={(val) => setMesAtual(val || new Date().getMonth().toString())}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
                <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anoAtual} onValueChange={(val) => setAnoAtual(val || new Date().getFullYear().toString())}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((a) => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={exportPDF} variant="default"><Download className="w-4 h-4 mr-2" /> Exportar PDF</Button>
        </div>
      </div>

      <Tabs defaultValue="mensal" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="mensal">Relatório Mensal</TabsTrigger>
          <TabsTrigger value="pacientes">Saúde dos Pacientes</TabsTrigger>
          <TabsTrigger value="graficos">Gráficos Consolidados</TabsTrigger>
        </TabsList>

        <TabsContent value="mensal" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Realizadas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.mensal.realizadas}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Faltou</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.mensal.faltou}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Taxa Presença</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{stats.mensal.taxa}%</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Rec. Recebida</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">R$ {stats.mensal.receita_recebida.toFixed(2)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Rec. Pendente</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-orange-500">R$ {stats.mensal.receita_pendente.toFixed(2)}</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Ranking de Presença</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-muted-foreground"><th>Paciente</th><th>Real.</th><th>Faltou</th><th>Taxa</th></tr></thead>
                  <tbody>
                    {ranking.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{r.nome}</td><td>{r.realizadas}</td><td>{r.faltou}</td>
                        <td className={r.taxa >= 80 ? 'text-green-600' : 'text-red-500'}>{r.taxa}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Sessões por Semana</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graficos.sessoesPorSemana}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="realizadas" fill="#10b981" name="Realizadas" />
                    <Bar dataKey="faltou" fill="#ef4444" name="Faltou" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pacientes" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ativas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{stats.pacientes.ativas}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pausadas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-yellow-500">{stats.pacientes.pausadas}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Encerradas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-gray-500">{stats.pacientes.encerradas}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Atrasadas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-500">{pacientesAtrasadas.length}</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Pacotes Vencendo</CardTitle><CardDescription>Pacientes com 2 ou menos sessões restantes.</CardDescription></CardHeader>
              <CardContent>
                {pacientesVencendo.length === 0 ? <p className="text-muted-foreground">Nenhum pacote vencendo.</p> : (
                  <ul className="space-y-2">
                    {pacientesVencendo.map((p, i) => (
                      <li key={i} className="flex justify-between items-center p-2 border rounded">
                        <span>{p.nome}</span>
                        <Badge variant="destructive">{p.restantes} restante(s)</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Cobranças Atrasadas</CardTitle></CardHeader>
              <CardContent>
                {pacientesAtrasadas.length === 0 ? <p className="text-muted-foreground">Nenhum atraso.</p> : (
                  <ul className="space-y-2">
                    {pacientesAtrasadas.map((p, i) => (
                      <li key={i} className="flex justify-between items-center p-2 border rounded">
                        <span>{p.patients?.nome}</span>
                        <span className="text-red-500 font-bold">R$ {p.valor.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="graficos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Receita Consolidada (Últimos 6 meses)</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graficos.receita6Meses}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => `R$ ${value}`} />
                    <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Formas de Pagamento</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={graficos.formasPagamento} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {graficos.formasPagamento.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `R$ ${value}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Curva de Engajamento (Sessões/Mês)</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graficos.sessoesPorMes}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="realizadas" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
