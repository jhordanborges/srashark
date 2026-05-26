'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertCircle, CheckCircle2, Clock, Trash2, Bug } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

export default function LogsPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<any | null>(null)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (data) setLogs(data)
    setLoading(false)
  }

  const markAsResolved = async (id: string) => {
    const { error } = await supabase.from('error_logs').update({ resolved: true }).eq('id', id)
    if (!error) {
      setLogs(logs.map(l => l.id === id ? { ...l, resolved: true } : l))
      toast.success('Erro marcado como resolvido.')
    }
  }

  const markAllAsResolved = async () => {
    const ids = logs.filter(l => !l.resolved).map(l => l.id)
    if (ids.length > 0) {
      await supabase.from('error_logs').update({ resolved: true }).in('id', ids)
      setLogs(logs.map(l => ({ ...l, resolved: true })))
      toast.success('Todos os erros foram resolvidos.')
    }
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Bug className="w-8 h-8 text-red-500"/> Logs do Sistema</h2>
          <p className="text-muted-foreground">Monitoramento de falhas e bugs capturados no front/backend.</p>
        </div>
        <Button variant="outline" onClick={markAllAsResolved}>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Resolver Todos
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos 100 Erros</CardTitle>
          <CardDescription>Clique no erro para ver a Stack Trace (Rastro de Código).</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">Carregando logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 opacity-50 mb-4" />
              Nenhum erro registrado no sistema! Você está seguro.
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Origem</th>
                    <th className="px-4 py-3 font-medium">Mensagem</th>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className={`hover:bg-muted/50 transition-colors ${log.resolved ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <Badge variant={log.source === 'backend' ? 'default' : 'secondary'}>{log.source}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium cursor-pointer max-w-xs truncate" onClick={() => setSelectedLog(log)}>
                        {log.message}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                      </td>
                      <td className="px-4 py-3">
                        {log.resolved ? (
                          <span className="flex items-center text-green-600 text-xs gap-1"><CheckCircle2 className="w-3 h-3"/> Resolvido</span>
                        ) : (
                          <span className="flex items-center text-red-500 text-xs gap-1"><AlertCircle className="w-3 h-3"/> Pendente</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!log.resolved && (
                          <Button variant="ghost" size="sm" onClick={() => markAsResolved(log.id)}>
                            Resolver
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(v) => !v && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Erro</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="font-semibold text-sm">Mensagem</h4>
                <div className="bg-red-50 text-red-600 p-3 rounded mt-1 font-mono text-sm">
                  {selectedLog.message}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm">Stack Trace</h4>
                <div className="bg-slate-950 text-slate-300 p-4 rounded mt-1 font-mono text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                  {selectedLog.stack || 'Stack trace indisponível.'}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedLog(null)}>Fechar</Button>
                {!selectedLog.resolved && (
                  <Button onClick={() => { markAsResolved(selectedLog.id); setSelectedLog(null) }}>
                    Marcar como Resolvido
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
