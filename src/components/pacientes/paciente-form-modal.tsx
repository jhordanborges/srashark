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
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl max-h-[90vh] min-h-[75vh] overflow-y-auto p-6 sm:p-10 flex flex-col">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl">Nova Paciente</DialogTitle>
          <DialogDescription className="text-base">
            Preencha os dados abaixo para cadastrar uma nova paciente.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 flex-1 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0 flex-1 flex flex-col">
              <TabsList className="flex w-full overflow-x-auto h-14 p-1.5 mb-8 bg-muted rounded-lg no-scrollbar">
                <TabsTrigger className="flex-1 whitespace-nowrap text-base h-full" value="dados">Dados</TabsTrigger>
                <TabsTrigger className="flex-1 whitespace-nowrap text-base h-full" value="sessoes">Sessões</TabsTrigger>
                <TabsTrigger className="flex-1 whitespace-nowrap text-base h-full" value="financeiro">Financeiro</TabsTrigger>
                <TabsTrigger className="flex-1 whitespace-nowrap text-base h-full" value="status">Status</TabsTrigger>
              </TabsList>
              
              <div className="flex flex-col lg:flex-row gap-10 flex-1">
                {/* Coluna da Imagem */}
                <div className="w-full lg:w-[320px] shrink-0">
                  <div className="w-full h-[200px] lg:h-auto lg:aspect-square bg-muted/50 rounded-2xl flex items-center justify-center border border-muted-foreground/10 shadow-sm">
                    <span className="text-muted-foreground/50 text-base">Sem foto</span>
                  </div>
                </div>

                {/* Coluna do Formulário */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <TabsContent value="dados" className="mt-0 space-y-6 flex-1">
                    <FormField
                      control={form.control}
                      name="nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">Nome Completo *</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome da paciente" className="h-12 text-base" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="telefone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Telefone</FormLabel>
                            <FormControl>
                              <IMaskInput
                                mask="(00) 00000-0000"
                                placeholder="(00) 00000-0000"
                                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                            <FormLabel className="text-base">E-mail</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="E-mail" className="h-12 text-base" {...field} />
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
                          <FormLabel className="text-base">Observações</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Anotações sobre a paciente..." className="resize-none min-h-[140px] text-base" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end pt-6 mt-auto">
                      <Button type="button" size="lg" className="px-8 text-base" onClick={() => setActiveTab('sessoes')}>Próximo</Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="sessoes" className="mt-0 space-y-6 flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="sessoes_contratadas"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Sessões Contratadas *</FormLabel>
                            <FormControl>
                              <Input type="number" className="h-12 text-base" {...field} />
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
                            <FormLabel className="text-base">Sessões já realizadas</FormLabel>
                            <FormControl>
                              <Input type="number" className="h-12 text-base" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="cadencia"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Cadência</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 text-base">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="semanal" className="text-base">Semanal</SelectItem>
                                <SelectItem value="quinzenal" className="text-base">Quinzenal</SelectItem>
                                <SelectItem value="mensal" className="text-base">Mensal</SelectItem>
                                <SelectItem value="personalizado" className="text-base">Personalizado</SelectItem>
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
                              <FormLabel className="text-base">Intervalo em dias</FormLabel>
                              <FormControl>
                                <Input type="number" className="h-12 text-base" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="dia_semana"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Dia da semana preferencial</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 text-base">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="segunda" className="text-base">Segunda</SelectItem>
                                <SelectItem value="terca" className="text-base">Terça</SelectItem>
                                <SelectItem value="quarta" className="text-base">Quarta</SelectItem>
                                <SelectItem value="quinta" className="text-base">Quinta</SelectItem>
                                <SelectItem value="sexta" className="text-base">Sexta</SelectItem>
                                <SelectItem value="sabado" className="text-base">Sábado</SelectItem>
                                <SelectItem value="domingo" className="text-base">Domingo</SelectItem>
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
                            <FormLabel className="text-base">Horário Fixo</FormLabel>
                            <FormControl>
                              <Input type="time" className="h-12 text-base" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-between pt-6 mt-auto">
                      <Button type="button" variant="outline" size="lg" className="px-8 text-base" onClick={() => setActiveTab('dados')}>Anterior</Button>
                      <Button type="button" size="lg" className="px-8 text-base" onClick={() => setActiveTab('financeiro')}>Próximo</Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="financeiro" className="mt-0 space-y-6 flex-1">
                    <FormField
                      control={form.control}
                      name="valor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">Valor do Pacote (R$) *</FormLabel>
                          <FormControl>
                            <NumericFormat
                              value={field.value}
                              onValueChange={(values) => field.onChange(values.floatValue)}
                              thousandSeparator="."
                              decimalSeparator=","
                              prefix="R$ "
                              decimalScale={2}
                              fixedDecimalScale
                              className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="forma_pagamento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Forma de Pagamento</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 text-base">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="pix" className="text-base">Pix</SelectItem>
                                <SelectItem value="cartao" className="text-base">Cartão</SelectItem>
                                <SelectItem value="dinheiro" className="text-base">Dinheiro</SelectItem>
                                <SelectItem value="transferencia" className="text-base">Transferência</SelectItem>
                                <SelectItem value="outro" className="text-base">Outro</SelectItem>
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
                            <FormLabel className="text-base">Status Financeiro</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 text-base">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="pago" className="text-base">Pago</SelectItem>
                                <SelectItem value="pendente" className="text-base">Pendente</SelectItem>
                                <SelectItem value="atrasado" className="text-base">Atrasado</SelectItem>
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
                          <FormLabel className="text-base">Data do Pagamento</FormLabel>
                          <FormControl>
                            <Input type="date" className="h-12 text-base" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-between pt-6 mt-auto">
                      <Button type="button" variant="outline" size="lg" className="px-8 text-base" onClick={() => setActiveTab('sessoes')}>Anterior</Button>
                      <Button type="button" size="lg" className="px-8 text-base" onClick={() => setActiveTab('status')}>Próximo</Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="status" className="mt-0 space-y-6 flex-1 flex flex-col">
                    <div className="space-y-6 flex-1">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Status da Paciente</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 text-base">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ativa" className="text-base">Ativa</SelectItem>
                                <SelectItem value="pausada" className="text-base">Pausada</SelectItem>
                                <SelectItem value="encerrada" className="text-base">Encerrada</SelectItem>
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
                              <FormLabel className="text-base">Motivo da Pausa</FormLabel>
                              <FormControl>
                                <Textarea placeholder="Qual o motivo?" className="h-32 text-base resize-none" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <div className="flex justify-between pt-6 mt-auto border-t">
                      <Button type="button" variant="outline" size="lg" className="px-8 text-base" onClick={() => setActiveTab('financeiro')}>Anterior</Button>
                      <Button type="submit" size="lg" className="px-8 text-base" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
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
