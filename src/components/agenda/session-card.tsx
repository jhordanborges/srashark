'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical } from 'lucide-react'

export default function SessionCard({ session, onUpdateStatus }: any) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: session.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  const getBgColor = (status: string) => {
    switch(status) {
      case 'agendada': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'realizada': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'faltou': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'cancelada': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      className={`p-2 rounded-md shadow-sm border text-xs mb-1 group relative cursor-grab active:cursor-grabbing ${getBgColor(session.status)}`}
    >
      <div className="font-semibold truncate pr-6">{session.patient?.nome || 'Desconhecido'}</div>
      <div className="opacity-80 mt-1">{session.horario?.substring(0,5)} • {session.patient?.cadencia?.[0]?.toUpperCase() || 'S'}</div>
      
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" onPointerDown={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger className="p-1 rounded-md hover:bg-black/10">
            <MoreVertical className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onUpdateStatus(session.id, 'realizada')}>Realizada</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUpdateStatus(session.id, 'faltou')}>Faltou</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUpdateStatus(session.id, 'cancelada')}>Cancelar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
