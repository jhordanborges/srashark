'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Eye, EyeOff, Key, Copy, Link as LinkIcon, RefreshCw, Send, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function IntegracoesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [showToken, setShowToken] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)

  const [n8n, setN8n] = useState({ ativo: false, url: '', token: '' })
  const [inbound, setInbound] = useState({ ativo: false, api_key: '' })

  const [logsOutbound, setLogsOutbound] = useState<any[]>([])
  const [logsInbound, setLogsInbound] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: ints } = await supabase.from('integrations').select('*')
    if (ints) {
      const n = ints.find(i => i.tipo === 'n8n')
      if (n) setN8n({ ativo: n.ativo, url: n.config.url || '', token: n.config.token || '' })
      
      const ib = ints.find(i => i.tipo === 'api_inbound')
      if (ib) setInbound({ ativo: ib.ativo, api_key: ib.config.api_key || '' })
    }

    const { data: out } = await supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(20)
    if (out) setLogsOutbound(out)

    const { data: inb } = await supabase.from('api_inbound_logs').select('*').order('created_at', { ascending: false }).limit(20)
    if (inb) setLogsInbound(inb)

    setLoading(false)
  }

  const saveN8n = async () => {
    await supabase.from('integrations').update({
      ativo: n8n.ativo,
      config: { url: n8n.url, token: n8n.token }
    }).eq('tipo', 'n8n')
    toast.success('Configurações do n8n salvas!')
  }

  const saveInbound = async () => {
    await supabase.from('integrations').update({
      ativo: inbound.ativo,
      config: { api_key: inbound.api_key }
    }).eq('tipo', 'api_inbound')
    toast.success('Configurações da API Inbound salvas!')
  }

  const gerarNovaApiKey = async () => {
    if (!confirm('Gerar nova chave invalidará todas as integrações atuais. Continuar?')) return
    const novaChave = 'tamaraos_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    setInbound({ ...inbound, api_key: novaChave })
    toast.info('Nova chave gerada. Não esqueça de salvar.')
  }

  const testConnection = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/webhooks/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'system.test',
          timestamp: new Date().toISOString(),
          source: 'tamaraos',
          version: '1.0',
          data: { message: 'Hello from TamaraOS' }
        })
      })
      if (res.ok) {
        toast.success('Teste enviado para a fila (ou n8n). Verifique os logs Outbound.')
        fetchData()
      } else {
        toast.error('Erro no dispatcher.')
      }
    } catch {
      toast.error('Erro de conexão ao testar.')
    }
    setTesting(false)
  }

  if (loading) return <div className="p-8">Carregando integrações...</div>

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Integrações & Webhooks</h2>
          <p className="text-muted-foreground">Conecte o TamaraOS ao n8n, WhatsApp e Google Calendar.</p>
        </div>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="outbound">Logs Outbound</TabsTrigger>
          <TabsTrigger value="inbound">Logs Inbound</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* n8n Webhooks */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">n8n Webhooks <Badge variant={n8n.ativo ? "default" : "secondary"}>{n8n.ativo ? 'Conectado' : 'Desconectado'}</Badge></CardTitle>
                    <CardDescription>Envie eventos (Outbound) para o n8n ou Zapier.</CardDescription>
                  </div>
                  <Switch checked={n8n.ativo} onCheckedChange={(v) => setN8n({...n8n, ativo: v})} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL do Webhook (POST)</Label>
                  <Input placeholder="https://seu-n8n.com/webhook/..." value={n8n.url} onChange={(e) => setN8n({...n8n, url: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Token Bearer (Opcional)</Label>
                  <div className="relative">
                    <Input type={showToken ? "text" : "password"} value={n8n.token} onChange={(e) => setN8n({...n8n, token: e.target.value})} />
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => setShowToken(!showToken)}>
                      {showToken ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={testConnection} disabled={testing || !n8n.url}>
                  <Send className="w-4 h-4 mr-2" /> Testar Conexão
                </Button>
                <Button onClick={saveN8n}>Salvar</Button>
              </CardFooter>
            </Card>

            {/* API Inbound */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">API Inbound <Badge variant={inbound.ativo ? "default" : "secondary"}>{inbound.ativo ? 'Ativa' : 'Inativa'}</Badge></CardTitle>
                    <CardDescription>Receba comandos externos (ex: do WhatsApp via n8n).</CardDescription>
                  </div>
                  <Switch checked={inbound.ativo} onCheckedChange={(v) => setInbound({...inbound, ativo: v})} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>API Key (Header: Authorization: Bearer)</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input type={showApiKey ? "text" : "password"} value={inbound.api_key} readOnly />
                      <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => setShowApiKey(!showApiKey)}>
                        {showApiKey ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                      </Button>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(inbound.api_key); toast('Copiado') }}><Copy className="w-4 h-4"/></Button>
                    <Button variant="outline" size="icon" onClick={gerarNovaApiKey} title="Regenerar chave"><RefreshCw className="w-4 h-4"/></Button>
                  </div>
                </div>
                <div className="p-4 bg-muted/50 rounded-md">
                  <p className="text-sm">Consulte a documentação para ver todos os endpoints disponíveis e formatos de payload.</p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Link href="/integracoes/api-docs">
                  <Button variant="link" className="px-0">Ver documentação da API</Button>
                </Link>
                <Button onClick={saveInbound}>Salvar</Button>
              </CardFooter>
            </Card>

            {/* Google Calendar (Stub) */}
            <Card className="opacity-75">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">Google Calendar <Badge variant="secondary" className="bg-purple-100 text-purple-700">Em breve</Badge></CardTitle>
                <CardDescription>Sincronize sessões automaticamente com sua agenda Google.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-4">
                  <li>Criar evento ao agendar sessão</li>
                  <li>Atualizar evento ao remarcar</li>
                  <li>Excluir evento ao cancelar</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button disabled variant="outline">Conectar com Google</Button>
              </CardFooter>
            </Card>

          </div>
        </TabsContent>

        <TabsContent value="outbound">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Webhooks Enviados (Outbound)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                    <tr>
                      <th className="px-4 py-2">Data/Hora</th>
                      <th className="px-4 py-2">Evento</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Tentativas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsOutbound.map(log => (
                      <tr key={log.id} className="border-b">
                        <td className="px-4 py-2">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-2 font-medium">{log.event_type}</td>
                        <td className="px-4 py-2">
                          <Badge variant={log.status === 'enviado' ? 'default' : log.status === 'erro' ? 'destructive' : 'secondary'}>{log.status}</Badge>
                        </td>
                        <td className="px-4 py-2">{log.tentativas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbound">
          <Card>
            <CardHeader>
              <CardTitle>Logs da API Recebida (Inbound)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                    <tr>
                      <th className="px-4 py-2">Data/Hora</th>
                      <th className="px-4 py-2">Método</th>
                      <th className="px-4 py-2">Endpoint</th>
                      <th className="px-4 py-2">HTTP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsInbound.map(log => (
                      <tr key={log.id} className="border-b">
                        <td className="px-4 py-2">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-2 font-bold text-muted-foreground">{log.method}</td>
                        <td className="px-4 py-2 truncate max-w-[200px]">{log.endpoint}</td>
                        <td className="px-4 py-2">
                          <Badge variant={log.status_code === 200 ? 'default' : 'destructive'}>{log.status_code}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
