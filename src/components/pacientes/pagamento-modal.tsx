'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { NumericFormat } from 'react-number-format'

const formSchema = z.object({
  patient_id: z.string().optional(),
  valor: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  forma_pagamento: z.string(),
  data_pagamento: z.string().optional(),
  status: z.string()
})

export default function PagamentoModal({ 
  isOpen, onClose, onSuccess, patientId 
}: { 
  isOpen: boolean, onClose: () => void, onSuccess: () => void, patientId?: string 
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [patients, setPatients] = useState<any[]>([])
  const supabase = createClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      patient_id: '',
      valor: 0,
      forma_pagamento: 'pix',
      data_pagamento: new Date().toISOString().split('T')[0],
      status: 'pago'
    },
  })

  useEffect(() => {
    if (isOpen) {
      if (!patientId) {
        supabase.from('patients').select('id, nome').eq('status', 'ativa').order('nome')
          .then(({ data }) => setPatients(data || []))
      }
      form.reset({
        patient_id: patientId || '',
        valor: 0,
        forma_pagamento: 'pix',
        data_pagamento: new Date().toISOString().split('T')[0],
        status: 'pago'
      })
    }
  }, [isOpen, patientId, form, supabase])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const targetPatientId = patientId || values.patient_id
    if (!targetPatientId) {
      toast.error('Selecione uma paciente')
      return
    }

    setIsLoading(true)
    try {
      const { error: paymentError } = await supabase.from('payments').insert({
        patient_id: targetPatientId,
        valor: values.valor,
        forma_pagamento: values.forma_pagamento,
        data_pagamento: values.data_pagamento || null,
        status: values.status,
      })

      if (paymentError) throw paymentError

      toast.success('Pagamento registrado com sucesso!')
      form.reset()
      onSuccess()
      onClose()
    } catch {
      toast.error('Erro ao registrar pagamento')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pagamento Avulso</DialogTitle>
          <DialogDescription>Adicione um pagamento ou cobrança sem alterar as sessões.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!patientId && (
              <FormField
                control={form.control}
                name="patient_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paciente</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val as string)} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione a paciente" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {patients.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="valor" render={({ field }) => (
                <FormItem><FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <NumericFormat value={field.value} onValueChange={(v) => field.onChange(v.floatValue || 0)} thousandSeparator="." decimalSeparator="," prefix="R$ " decimalScale={2} fixedDecimalScale className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val as string)} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="atrasado">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
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
                <FormItem><FormLabel>Data Venc/Pgto</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
