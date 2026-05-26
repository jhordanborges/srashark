// ============================================================
// TamaraOS — Google Calendar Integration (estrutura preparada)
// ============================================================
// Status: NÃO IMPLEMENTADO — estrutura reservada para versão futura
//
// Para implementar:
// 1. Criar projeto no Google Cloud Console
// 2. Habilitar Google Calendar API
// 3. Criar credenciais OAuth2
// 4. Configurar GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env
// 5. Implementar fluxo OAuth2 em /api/auth/google e /api/auth/google/callback
// 6. Salvar access_token e refresh_token em integrations WHERE tipo='google_calendar'
// 7. Substituir os throws abaixo pela implementação real
//
// Documentação: https://developers.google.com/calendar/api/v3/reference
// Escopos necessários: https://www.googleapis.com/auth/calendar.events
// ============================================================

export interface CalendarEvent {
  summary: string        // ex: "Sessão — Amanda"
  description: string    // ex: "Sessão de mentoria | Cadência: semanal"
  startDateTime: string  // ISO 8601
  endDateTime: string    // ISO 8601 (padrão: 1h após início)
  location?: string
  reminders?: { method: 'email' | 'popup'; minutes: number }[]
}

export async function createCalendarEvent(event: CalendarEvent): Promise<string> {
  // Retorna o google_calendar_event_id para salvar em sessions
  throw new Error('Google Calendar: não configurado. Configure em /integracoes.')
}

export async function updateCalendarEvent(eventId: string, event: Partial<CalendarEvent>): Promise<void> {
  throw new Error('Google Calendar: não configurado.')
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  throw new Error('Google Calendar: não configurado.')
}

export async function getAuthUrl(): Promise<string> {
  // Retorna URL de autorização OAuth2 do Google
  throw new Error('Google Calendar: credenciais não configuradas.')
}

export async function exchangeCodeForTokens(code: string): Promise<{ access_token: string; refresh_token: string }> {
  throw new Error('Google Calendar: credenciais não configuradas.')
}
