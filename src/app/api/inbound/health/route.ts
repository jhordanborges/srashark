import { NextResponse } from 'next/server'
import { logInbound } from '@/lib/inbound-auth'

export async function GET(req: Request) {
  const response = {
    status: 'ok',
    version: '1.0',
    timestamp: new Date().toISOString(),
    service: 'tamaraos-api'
  }
  
  await logInbound('/api/inbound/health', 'GET', null, response, 200)
  
  return NextResponse.json(response)
}
