'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, Clock, Calendar, CheckSquare } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import Link from 'next/link'

export default function AlertasPage() {
  const supabase = createClient()
  const [alertas, setAlertas] = useState<any[]>([])

  useEffect(() => {
    fetchAlerts()
  }, [])

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (data) setAlertas(data)
  }

  const markAllAsRead = async () => {
    const ids = alertas.filter(a => !a.lido).map(a => a.id)
    if (ids.length > 0) {
      const { error } = await supabase.from('alerts').update({ lido: true }).in('id', ids)
      if (!error) {
        setAlertas(alertas.map(a => ({ ...a, lido: true })))
        toast.success('Todos os alertas marcados como lidos.')
      }
    }
  }

  const markAsRead = async (id: string) => {
    const { error } = await supabase.from('alerts').update({ lido: true }).eq('id', id)
    if (!error) {
      setAlertas(alertas.map(a => a.id === id ? { ...a, lido: true } : a))
    }
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Centro de Alertas</h2>
          <p className="text-muted-foreground">Histórico completo de notificações e avisos automáticos.</p>
        </div>
        <Button variant="outline" onClick={markAllAsRead}>
          <CheckSquare className="w-4 h-4 mr-2" />
          Marcar todos como lidos
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos 100 Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          {alertas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500 opacity-50" />
              Nenhum alerta encontrado.
            </div>
          ) : (
            <div className="space-y-4">
              {alertas.map((alerta) => (
                <div key={alerta.id} className={`flex items-start justify-between p-4 border rounded-lg transition-colors ${alerta.lido ? 'bg-background' : 'bg-muted/30 border-primary/20'}`}>
                  <div className="flex gap-4">
                    <div className="mt-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: alerta.cor || '#3b82f6' }} />
                    </div>
                    <div>
                      <h4 className="font-semibold flex items-center gap-2">
                        {alerta.titulo}
                        {!alerta.lido && <Badge variant="secondary" className="text-[10px] h-4">Novo</Badge>}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">{alerta.mensagem}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {format(new Date(alerta.created_at), "HH:mm")}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {format(new Date(alerta.created_at), "dd 'de' MMMM", { locale: ptBR })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    {alerta.link && (
                      <Link href={alerta.link}>
                        <Button variant="outline" size="sm" onClick={() => markAsRead(alerta.id)}>Acessar</Button>
                      </Link>
                    )}
                    {!alerta.lido && !alerta.link && (
                      <Button variant="ghost" size="sm" onClick={() => markAsRead(alerta.id)}>Marcar como lido</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
