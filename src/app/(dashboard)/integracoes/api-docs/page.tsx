'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function ApiDocsPage() {
  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">API Inbound & Outbound</h1>
        <p className="text-muted-foreground mt-2">Documentação técnica para conectar o TamaraOS ao n8n.</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">Autenticação (Inbound)</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="mb-2">Todas as chamadas para a API Inbound requerem o Header:</p>
            <pre className="bg-muted p-3 rounded text-sm">Authorization: Bearer TAMARAOS_API_KEY</pre>
            <p className="mt-2 text-sm text-muted-foreground">Você pode obter esta chave na aba "Configuração" de Integrações.</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">Endpoints Inbound (n8n → TamaraOS)</h2>
        
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <Badge className="bg-blue-600">POST</Badge>
                <span className="font-mono text-lg">/api/inbound/sessions/reschedule</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">Remarca uma sessão existente para nova data/horário.</p>
              <h4 className="font-medium text-sm mb-2">Body (JSON)</h4>
              <pre className="bg-slate-950 text-slate-50 p-4 rounded text-xs overflow-auto">
{`{
  "session_id": "uuid-da-sessao",
  "nova_data": "2025-07-16",
  "novo_horario": "13:00",
  "motivo": "Confirmado via WhatsApp"
}`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <Badge className="bg-blue-600">POST</Badge>
                <span className="font-mono text-lg">/api/inbound/sessions/schedule</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">Cria uma nova sessão (avulsa ou extra) consumindo o pacote.</p>
              <pre className="bg-slate-950 text-slate-50 p-4 rounded text-xs overflow-auto">
{`{
  "patient_id": "uuid-da-paciente",
  "data": "2025-07-16",
  "horario": "13:00"
}`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <Badge className="bg-blue-600">POST</Badge>
                <span className="font-mono text-lg">/api/inbound/payments/confirm</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">Confirma o recebimento de um pagamento (baixa automática).</p>
              <pre className="bg-slate-950 text-slate-50 p-4 rounded text-xs overflow-auto">
{`{
  "patient_id": "uuid-da-paciente", // ou payment_id
  "valor_recebido": 350.00,
  "forma_pagamento": "pix",
  "data_pagamento": "2025-07-14",
  "referencia": "E123456789"
}`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <Badge className="bg-green-600">GET</Badge>
                <span className="font-mono text-lg">/api/inbound/patients/lookup?telefone=...</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">Busca a paciente pelo telefone (ótimo para identificar no WhatsApp).</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">Eventos Outbound (TamaraOS → n8n)</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm mb-4">Sempre que algo importante acontece no TamaraOS, nós fazemos um POST na URL do seu n8n com o payload padronizado:</p>
            <pre className="bg-slate-950 text-slate-50 p-4 rounded text-xs overflow-auto">
{`{
  "event": "session.reminder_24h", // ou payment.received, etc
  "timestamp": "2025-07-14T13:00:00.000Z",
  "source": "tamaraos",
  "data": {
    "patient": { "id": "...", "nome": "Amanda", "telefone": "34999..." },
    "session": { "id": "...", "data": "2025-07-15", "horario": "13:00" }
  }
}`}
            </pre>
          </CardContent>
        </Card>
      </section>

    </div>
  )
}
