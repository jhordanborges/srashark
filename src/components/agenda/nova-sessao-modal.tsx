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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const formSchema = z.object({
  patient_id: z.string().min(1, 'Selecione a paciente'),
  data: z.string().min(1, 'Data é obrigatória'),
  horario: z.string().min(1, 'Horário é obrigatório'),
  observacoes: z.string().optional(),
})

export default function NovaSessaoModal({ 
  isOpen, onClose, onSuccess, preselectedPatientId 
}: { 
  isOpen: boolean, onClose: () => void, onSuccess: () => void, preselectedPatientId?: string 
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [patients, setPatients] = useState<any[]>([])
  const supabase = createClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      patient_id: preselectedPatientId || '',
      data: new Date().toISOString().split('T')[0],
      horario: '09:00',
      observacoes: '',
    },
  })

  useEffect(() => {
    if (isOpen) {
      if (preselectedPatientId) {
        form.setValue('patient_id', preselectedPatientId)
      }
      supabase.from('patients').select('id, nome').eq('status', 'ativa').order('nome')
        .then(({ data }) => setPatients(data || []))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preselectedPatientId, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const { error } = await supabase.from('sessions').insert({
        patient_id: values.patient_id,
        data: values.data,
        horario: values.horario,
        observacoes: values.observacoes,
        status: 'agendada'
      })
      if (error) throw error

      toast.success('Sessão agendada com sucesso!')
      form.reset()
      onSuccess()
      onClose()
    } catch {
      toast.error('Erro ao agendar sessão')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Sessão Avulsa</DialogTitle>
          <DialogDescription>Crie um agendamento individual.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paciente</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val as string)} value={field.value} disabled={!!preselectedPatientId}>
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
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="data" render={({ field }) => (
                <FormItem><FormLabel>Data</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="horario" render={({ field }) => (
                <FormItem><FormLabel>Horário</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea placeholder="Ex: Sessão extra de reposição..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Agendar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
