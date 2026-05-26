'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { dispatchInternalWebhook } from '@/actions/webhooks'
import { IMaskInput } from 'react-imask'
import { NumericFormat } from 'react-number-format'

const formSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  telefone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  observacoes: z.string().optional(),
  sessoes_contratadas: z.coerce.number().min(1, 'No mínimo 1 sessão contratada'),
  sessoes_realizadas: z.coerce.number().min(0).default(0),
  cadencia: z.string(),
  cadencia_dias_intervalo: z.coerce.number().optional(),
  dia_semana: z.string().optional(),
  horario: z.string().optional(),
  valor: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  forma_pagamento: z.string(),
  data_pagamento: z.string().optional(),
  status_financeiro: z.string(),
  status: z.string(),
  motivo_pausa: z.string().optional(),
})

export default function PacienteFormModal({ 
  isOpen, 
  onClose,
  onSuccess
}: { 
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('dados')
  const supabase = createClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      nome: '',
      telefone: '',
      email: '',
      observacoes: '',
      sessoes_contratadas: 4,
      sessoes_realizadas: 0,
      cadencia: 'semanal',
      cadencia_dias_intervalo: 7,
      dia_semana: 'segunda',
      horario: '09:00',
      valor: 0,
      forma_pagamento: 'pix',
      data_pagamento: new Date().toISOString().split('T')[0],
      status_financeiro: 'pago',
      status: 'ativa',
      motivo_pausa: '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({
          nome: values.nome,
          telefone: values.telefone,
          email: values.email || null,
          observacoes: values.observacoes,
          cadencia: values.cadencia,
          cadencia_dias_intervalo: values.cadencia === 'personalizado' ? values.cadencia_dias_intervalo : 7,
          dia_semana: values.dia_semana,
          horario: values.horario,
          sessoes_contratadas: values.sessoes_contratadas,
          sessoes_realizadas: values.sessoes_realizadas,
          status: values.status,
          motivo_pausa: values.status === 'pausada' ? values.motivo_pausa : null,
        })
        .select()
        .single()

      if (patientError) throw patientError

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          patient_id: patient.id,
          valor: values.valor,
          forma_pagamento: values.forma_pagamento,
          data_pagamento: values.data_pagamento || null,
          status: values.status_financeiro,
          numero_sessoes_pacote: values.sessoes_contratadas,
        })

      if (paymentError) throw paymentError

      toast.success('Paciente cadastrada com sucesso!')
      
      dispatchInternalWebhook('patient.created', { patient: patient })
      if (onSuccess) onSuccess()
      form.reset()
      onClose()
      setActiveTab('dados')
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Erro ao salvar paciente')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Nova Paciente</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para cadastrar uma nova paciente.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
              <TabsList className="flex w-full overflow-x-auto h-auto p-1 mb-4 bg-muted rounded-md no-scrollbar">
                <TabsTrigger className="flex-1 whitespace-nowrap" value="dados">Dados</TabsTrigger>
                <TabsTrigger className="flex-1 whitespace-nowrap" value="sessoes">Sessões</TabsTrigger>
                <TabsTrigger className="flex-1 whitespace-nowrap" value="financeiro">Financeiro</TabsTrigger>
                <TabsTrigger className="flex-1 whitespace-nowrap" value="status">Status</TabsTrigger>
              </TabsList>
              
              <div className="flex flex-col md:flex-row gap-6">
                {/* Coluna da Imagem */}
                <div className="w-full md:w-[240px] shrink-0">
                  <div className="w-full h-[160px] md:h-auto md:aspect-square bg-muted/50 rounded-xl flex items-center justify-center border border-muted-foreground/10">
                    <span className="text-muted-foreground/50 text-sm">Sem foto</span>
                  </div>
                </div>

                {/* Coluna do Formulário */}
                <div className="flex-1 min-w-0">
                  <TabsContent value="dados" className="mt-0 space-y-4">
                    <FormField
                      control={form.control}
                      name="nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo *</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome da paciente" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="telefone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <IMaskInput
                                mask="(00) 00000-0000"
                                placeholder="(00) 00000-0000"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={field.value}
                                unmask={false}
                                onAccept={(val) => field.onChange(val)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="E-mail" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="observacoes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Anotações sobre a paciente..." className="resize-none min-h-[100px]" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end pt-2">
                      <Button type="button" onClick={() => setActiveTab('sessoes')}>Próximo</Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="sessoes" className="mt-0 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="sessoes_contratadas"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sessões Contratadas *</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sessoes_realizadas"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sessões já realizadas</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="cadencia"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cadência</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="semanal">Semanal</SelectItem>
                                <SelectItem value="quinzenal">Quinzenal</SelectItem>
                                <SelectItem value="mensal">Mensal</SelectItem>
                                <SelectItem value="personalizado">Personalizado</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {form.watch('cadencia') === 'personalizado' && (
                        <FormField
                          control={form.control}
                          name="cadencia_dias_intervalo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Intervalo em dias</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="dia_semana"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dia da semana preferencial</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="segunda">Segunda</SelectItem>
                                <SelectItem value="terca">Terça</SelectItem>
                                <SelectItem value="quarta">Quarta</SelectItem>
                                <SelectItem value="quinta">Quinta</SelectItem>
                                <SelectItem value="sexta">Sexta</SelectItem>
                                <SelectItem value="sabado">Sábado</SelectItem>
                                <SelectItem value="domingo">Domingo</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="horario"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Horário Fixo</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-between pt-2">
                      <Button type="button" variant="outline" onClick={() => setActiveTab('dados')}>Anterior</Button>
                      <Button type="button" onClick={() => setActiveTab('financeiro')}>Próximo</Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="financeiro" className="mt-0 space-y-4">
                    <FormField
                      control={form.control}
                      name="valor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor do Pacote (R$) *</FormLabel>
                          <FormControl>
                            <NumericFormat
                              value={field.value}
                              onValueChange={(values) => field.onChange(values.floatValue)}
                              thousandSeparator="."
                              decimalSeparator=","
                              prefix="R$ "
                              decimalScale={2}
                              fixedDecimalScale
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="forma_pagamento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Forma de Pagamento</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="pix">Pix</SelectItem>
                                <SelectItem value="cartao">Cartão</SelectItem>
                                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                <SelectItem value="transferencia">Transferência</SelectItem>
                                <SelectItem value="outro">Outro</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="status_financeiro"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status Financeiro</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="pago">Pago</SelectItem>
                                <SelectItem value="pendente">Pendente</SelectItem>
                                <SelectItem value="atrasado">Atrasado</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="data_pagamento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data do Pagamento</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-between pt-2">
                      <Button type="button" variant="outline" onClick={() => setActiveTab('sessoes')}>Anterior</Button>
                      <Button type="button" onClick={() => setActiveTab('status')}>Próximo</Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="status" className="mt-0 space-y-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status da Paciente</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ativa">Ativa</SelectItem>
                              <SelectItem value="pausada">Pausada</SelectItem>
                              <SelectItem value="encerrada">Encerrada</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {form.watch('status') === 'pausada' && (
                      <FormField
                        control={form.control}
                        name="motivo_pausa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Motivo da Pausa</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Qual o motivo?" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <div className="flex justify-between pt-4 mt-8 border-t">
                      <Button type="button" variant="outline" onClick={() => setActiveTab('financeiro')}>Anterior</Button>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Paciente
                      </Button>
                    </div>
                  </TabsContent>
                </div>
              </div>
            </Tabs>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
