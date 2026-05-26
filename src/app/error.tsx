'use client'

import { useEffect } from 'react'
import { logClientError } from '@/actions/logger'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to our database
    logClientError(error.message, error.stack)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white border rounded-lg shadow-sm p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Ops! Algo deu errado.</h2>
          <p className="text-slate-500 mt-2">
            Ocorreu um erro inesperado no sistema. A nossa equipe já foi notificada silenciosamente.
          </p>
        </div>
        
        <div className="bg-slate-100 p-4 rounded text-left overflow-auto text-xs font-mono text-slate-600 max-h-32">
          {error.message}
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={() => reset()} className="w-full">
            Tentar Novamente
          </Button>
          <Link href="/dashboard" className="w-full">
            <Button variant="outline" className="w-full">
              Voltar ao Início
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
