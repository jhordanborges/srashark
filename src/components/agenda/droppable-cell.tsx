'use client'

import { useDroppable } from '@dnd-kit/core'

export default function DroppableCell({ id, children }: { id: string, children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  
  return (
    <div 
      ref={setNodeRef} 
      className={`border-r border-b p-1 min-h-[80px] transition-colors ${isOver ? 'bg-primary/10' : ''}`}
    >
      {children}
    </div>
  )
}
