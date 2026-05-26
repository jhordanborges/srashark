-- TABELA: patients
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  nome text NOT NULL,
  telefone text,
  email text,
  observacoes text,
  cadencia text CHECK (cadencia IN ('semanal','quinzenal','mensal','personalizado')),
  cadencia_dias_intervalo integer DEFAULT 7,
  dia_semana text CHECK (dia_semana IN ('segunda','terca','quarta','quinta','sexta','sabado','domingo')),
  horario time,
  sessoes_contratadas integer DEFAULT 0,
  sessoes_realizadas integer DEFAULT 0,
  sessoes_restantes integer GENERATED ALWAYS AS (sessoes_contratadas - sessoes_realizadas) STORED,
  status text DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','encerrada')),
  motivo_pausa text,
  google_calendar_event_id text,
  google_calendar_synced boolean DEFAULT false
);

-- TABELA: sessions
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  data date NOT NULL,
  horario time NOT NULL,
  status text DEFAULT 'agendada' CHECK (status IN ('agendada','realizada','faltou','remarcada','cancelada')),
  observacoes text,
  remarcada_para date,
  remarcada_para_horario time,
  google_calendar_event_id text,
  notificacao_enviada boolean DEFAULT false,
  webhook_disparado boolean DEFAULT false
);

-- TABELA: payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  valor numeric(10,2) NOT NULL,
  forma_pagamento text CHECK (forma_pagamento IN ('pix','cartao','dinheiro','transferencia','outro')),
  data_pagamento date,
  proxima_cobranca date,
  status text DEFAULT 'pendente' CHECK (status IN ('pago','pendente','atrasado','cancelado')),
  observacoes text,
  referencia_mes text,
  numero_sessoes_pacote integer,
  webhook_disparado boolean DEFAULT false
);

-- TABELA: webhook_logs
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','erro','reprocessando')),
  response_status integer,
  response_body text,
  tentativas integer DEFAULT 0,
  proximo_retry timestamptz
);

-- TABELA: alerts
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id),
  tipo text NOT NULL,
  mensagem text,
  data_alerta date,
  lido boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- TABELA: integrations
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  ativo boolean DEFAULT false,
  config jsonb,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- Inserir registro padrão de integração n8n e google_calendar se não existirem
INSERT INTO integrations (tipo, ativo, config) 
SELECT 'n8n', false, '{"url":"","token":"","eventos":{"sessoes":true,"pagamentos":true,"pacientes":true}}'
WHERE NOT EXISTS (SELECT 1 FROM integrations WHERE tipo = 'n8n');

INSERT INTO integrations (tipo, ativo, config) 
SELECT 'google_calendar', false, '{"client_id":"","access_token":"","refresh_token":"","email":""}'
WHERE NOT EXISTS (SELECT 1 FROM integrations WHERE tipo = 'google_calendar');


-- Habilitar Row Level Security em todas as tabelas
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Remover políticas se já existirem para evitar erro
DROP POLICY IF EXISTS "auth_all" ON patients;
DROP POLICY IF EXISTS "auth_all" ON sessions;
DROP POLICY IF EXISTS "auth_all" ON payments;
DROP POLICY IF EXISTS "auth_all" ON webhook_logs;
DROP POLICY IF EXISTS "auth_all" ON alerts;
DROP POLICY IF EXISTS "auth_all" ON integrations;

-- Políticas RLS (usuário autenticado acessa tudo)
CREATE POLICY "auth_all" ON patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON webhook_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON integrations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger para atualizar updated_at em patients
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS patients_updated_at ON patients;
CREATE TRIGGER patients_updated_at
BEFORE UPDATE ON patients
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
