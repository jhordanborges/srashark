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
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const formSchema = z.object({
  nova_data: z.string().min(1, 'Data é obrigatória'),
  novo_horario: z.string().min(1, 'Horário é obrigatório'),
  observacao: z.string().optional(),
})

export default function RemarcacaoModal({ 
  isOpen, onClose, onSuccess, session 
}: { 
  isOpen: boolean, onClose: () => void, onSuccess: () => void, session: any 
}) {
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nova_data: '',
      novo_horario: '',
      observacao: '',
    },
  })

  useEffect(() => {
    if (isOpen && session) {
      form.setValue('nova_data', session.data || '')
      form.setValue('novo_horario', session.horario || '')
      form.setValue('observacao', '')
    }
  }, [isOpen, session, form])

  if (!session) return null

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const observacaoOriginal = session.observacoes ? session.observacoes + '\n' : ''
      const novaObservacao = `${observacaoOriginal}[Remarcada] Original: ${session.data} às ${session.horario}. ${values.observacao || ''}`

      const { error } = await supabase.from('sessions').update({
        data: values.nova_data,
        horario: values.novo_horario,
        status: 'remarcada',
        observacoes: novaObservacao
      }).eq('id', session.id)

      if (error) throw error

      toast.success('Sessão remarcada com sucesso!')
      form.reset()
      onSuccess()
      onClose()
    } catch {
      toast.error('Erro ao remarcar sessão')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remarcar Sessão</DialogTitle>
          <DialogDescription>
            Sessão original: {session.data} às {session.horario?.substring(0,5)}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="nova_data" render={({ field }) => (
                <FormItem><FormLabel>Nova Data</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="novo_horario" render={({ field }) => (
                <FormItem><FormLabel>Novo Horário</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="observacao" render={({ field }) => (
              <FormItem><FormLabel>Motivo da remarcação</FormLabel><FormControl><Textarea placeholder="Ex: Paciente teve um imprevisto" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Remarcar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
