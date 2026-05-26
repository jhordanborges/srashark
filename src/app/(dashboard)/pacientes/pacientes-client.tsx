'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import { Plus, Search, Edit, Calendar, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRouter } from 'next/navigation'
import PacienteFormModal from '@/components/pacientes/paciente-form-modal'
import NovaSessaoModal from '@/components/agenda/nova-sessao-modal'
import PagamentoModal from '@/components/pacientes/pagamento-modal'

export default function PacientesClient({ initialData }: { initialData: any[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todas')
  const [diaFilter, setDiaFilter] = useState('todos')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSessaoModalOpen, setIsSessaoModalOpen] = useState(false)
  const [isPagamentoModalOpen, setIsPagamentoModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<any>(null)

  const filteredData = initialData.filter((p) => {
    const matchName = p.nome.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todas' || p.status === statusFilter
    const matchDia = diaFilter === 'todos' || p.dia_semana === diaFilter
    return matchName && matchStatus && matchDia
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativa': return 'bg-green-500'
      case 'pausada': return 'bg-yellow-500'
      case 'encerrada': return 'bg-gray-500'
      default: return 'bg-primary'
    }
  }

  return (
    <>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 items-center space-x-2 w-full">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as string)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os status</SelectItem>
              <SelectItem value="ativa">Ativa</SelectItem>
              <SelectItem value="pausada">Pausada</SelectItem>
              <SelectItem value="encerrada">Encerrada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={diaFilter} onValueChange={(val) => setDiaFilter(val as string)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Dia da semana" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os dias</SelectItem>
              <SelectItem value="segunda">Segunda</SelectItem>
              <SelectItem value="terca">Terça</SelectItem>
              <SelectItem value="quarta">Quarta</SelectItem>
              <SelectItem value="quinta">Quinta</SelectItem>
              <SelectItem value="sexta">Sexta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nova paciente
        </Button>
      </div>

      <div className="rounded-md border bg-card mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Dia / Horário</TableHead>
              <TableHead>Cadência</TableHead>
              <TableHead>Sessões (Real./Contr.)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhuma paciente encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((paciente) => (
                <TableRow 
                  key={paciente.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/pacientes/${paciente.id}`)}
                >
                  <TableCell className="font-medium">{paciente.nome}</TableCell>
                  <TableCell className="capitalize">{paciente.dia_semana || '-'} às {paciente.horario?.substring(0,5) || '-'}</TableCell>
                  <TableCell className="capitalize">{paciente.cadencia}</TableCell>
                  <TableCell>
                    {paciente.sessoes_realizadas} / {paciente.sessoes_contratadas}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(paciente.status)}>
                      {paciente.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="Editar"
                        onClick={() => {
                          setSelectedPatient(paciente)
                          setIsEditModalOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="Registrar Sessão"
                        onClick={() => {
                          setSelectedPatient(paciente)
                          setIsSessaoModalOpen(true)
                        }}
                      >
                        <Calendar className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="Registrar Pagamento"
                        onClick={() => {
                          setSelectedPatient(paciente)
                          setIsPagamentoModalOpen(true)
                        }}
                      >
                        <DollarSign className="h-4 w-4 text-green-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PacienteFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => router.refresh()} 
      />

      <PacienteFormModal 
        isOpen={isEditModalOpen} 
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedPatient(null)
        }} 
        onSuccess={() => router.refresh()} 
        patient={selectedPatient}
      />

      <NovaSessaoModal 
        isOpen={isSessaoModalOpen} 
        onClose={() => {
          setIsSessaoModalOpen(false)
          setSelectedPatient(null)
        }} 
        onSuccess={() => router.refresh()} 
        preselectedPatientId={selectedPatient?.id} 
      />

      <PagamentoModal 
        isOpen={isPagamentoModalOpen}
        onClose={() => {
          setIsPagamentoModalOpen(false)
          setSelectedPatient(null)
        }} 
        onSuccess={() => router.refresh()} 
        patientId={selectedPatient?.id} 
      />
    </>
  )
}
