'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { dispatchInternalWebhook } from '@/actions/webhooks'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { NumericFormat } from 'react-number-format'
import { format } from 'date-fns'

const formSchema = z.object({
  novas_sessoes: z.coerce.number().min(1, 'Mínimo de 1 sessão'),
  valor: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  forma_pagamento: z.string(),
  data_pagamento: z.string().optional(),
})

export default function RenovacaoModal({ 
  isOpen, onClose, onSuccess, patientId, currentContratadas 
}: { 
  isOpen: boolean, onClose: () => void, onSuccess: () => void, patientId: string, currentContratadas: number 
}) {
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      novas_sessoes: 4,
      valor: 0,
      forma_pagamento: 'pix',
      data_pagamento: new Date().toISOString().split('T')[0],
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const novoTotalContratadas = currentContratadas + values.novas_sessoes
      const { data: paciente, error: patientError } = await supabase.from('patients')
        .update({ sessoes_contratadas: novoTotalContratadas })
        .eq('id', patientId)
        .select()
        .single()

      if (patientError) throw patientError

      const { error: paymentError } = await supabase.from('payments').insert({
        patient_id: patientId,
        valor: values.valor,
        forma_pagamento: values.forma_pagamento,
        data_pagamento: values.data_pagamento || null,
        status: 'pago',
        numero_sessoes_pacote: values.novas_sessoes,
      })

      if (paymentError) throw paymentError

      toast.success('Pacote renovado com sucesso!')
      
      dispatchInternalWebhook('payment.renewal_needed', { 
        patient: { ...paciente, sessoes_contratadas: novoTotalContratadas }, 
        payment: { id: Date.now().toString(), valor: values.valor, status: 'pendente', data_pagamento: format(new Date(), 'yyyy-MM-dd') } 
      })
      
      form.reset()
      if (onSuccess) onSuccess()
      onClose()
    } catch {
      toast.error('Erro ao renovar pacote')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renovar Pacote</DialogTitle>
          <DialogDescription>O pacote de sessões acabou. Adicione um novo pagamento para continuar.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="novas_sessoes" render={({ field }) => (
                <FormItem><FormLabel>Novas Sessões</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="valor" render={({ field }) => (
                <FormItem><FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <NumericFormat value={field.value} onValueChange={(v) => field.onChange(v.floatValue || 0)} thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="forma_pagamento" render={({ field }) => (
                <FormItem><FormLabel>Forma de Pgto</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val as string)} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="pix">Pix</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="data_pagamento" render={({ field }) => (
                <FormItem><FormLabel>Data Pagamento</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Renovar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
