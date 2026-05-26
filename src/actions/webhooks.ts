'use server'

export async function dispatchInternalWebhook(event: string, data: any) {
  try {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      source: 'tamaraos',
      version: '1.0',
      data
    }
    
    // Como estamos rodando no server, usamos localhost ou a URL do Vercel
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    await fetch(`${baseUrl}/api/webhooks/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WEBHOOK_SECRET}`
      },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    console.error('Failed to dispatch internal webhook', err)
  }
}
