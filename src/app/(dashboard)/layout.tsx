'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  CreditCard, 
  BarChart, 
  Webhook, 
  Settings,
  LogOut,
  Menu,
  Bell,
  Plus,
  Link as LinkIcon,
  Bug
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Agenda', href: '/agenda', icon: Calendar },
  { name: 'Pacientes', href: '/pacientes', icon: Users },
  { name: 'Financeiro', href: '/financeiro', icon: CreditCard },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart },
  { name: 'Integrações', href: '/integracoes', icon: LinkIcon },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
  { name: 'Logs de Erro', href: '/logs', icon: Bug },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [alerts, setAlerts] = useState<any[]>([])
  
  const fetchAlerts = async () => {
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('lido', false)
      .order('created_at', { ascending: false })
      .limit(30)
    
    if (data) setAlerts(data)
  }

  useEffect(() => {
    fetchAlerts()

    const channel = supabase.channel('alerts-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        setAlerts((prev) => [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alerts' }, (payload) => {
        if (payload.new.lido) {
          setAlerts((prev) => prev.filter(a => a.id !== payload.new.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const markAsRead = async (alerta: any) => {
    await supabase.from('alerts').update({ lido: true }).eq('id', alerta.id)
    if (alerta.link) {
      router.push(alerta.link)
    }
  }

  const markAllAsRead = async () => {
    const ids = alerts.map(a => a.id)
    if (ids.length > 0) {
      await supabase.from('alerts').update({ lido: true }).in('id', ids)
    }
  }

  const unreadAlerts = alerts.length

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Erro ao sair da conta.')
    } else {
      router.push('/login')
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      {/* Sidebar Desktop */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="text-xl">TamaraOS</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-auto py-4 px-2">
          <div className="grid gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary ${
                  pathname === item.href ? 'bg-muted text-primary font-medium' : 'text-muted-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </div>
        </nav>
        <div className="mt-auto p-4">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-64 w-full">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <Button
            size="icon"
            variant="outline"
            className="sm:hidden"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
          
          <div className="flex w-full items-center justify-between">
            <h1 className="text-xl font-semibold sm:text-2xl">
              {NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.name || 'Dashboard'}
            </h1>

            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden md:flex gap-2">
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="h-4 w-4" /> Nova paciente
                </Button>
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="h-4 w-4" /> Nova sessão
                </Button>
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="h-4 w-4" /> Novo pagamento
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadAlerts > 0 && (
                      <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full">
                        {unreadAlerts}
                      </Badge>
                    )}
                    <span className="sr-only">Alertas</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notificações</span>
                    {unreadAlerts > 0 && (
                      <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-xs text-muted-foreground hover:text-primary">
                        Marcar todas como lidas
                      </Button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-80 overflow-auto">
                    {alerts.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação no momento.</div>
                    ) : (
                      alerts.slice(0, 5).map((alerta) => (
                        <DropdownMenuItem key={alerta.id} onClick={() => markAsRead(alerta)} className="flex flex-col items-start gap-1 p-3 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: alerta.cor || '#3b82f6' }} />
                            <span className="text-sm font-medium">{alerta.titulo}</span>
                          </div>
                          <span className="text-xs text-muted-foreground line-clamp-2">{alerta.mensagem}</span>
                          <span className="text-[10px] text-muted-foreground/80">{formatDistanceToNow(new Date(alerta.created_at), { addSuffix: true, locale: ptBR })}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <Link href="/alertas">
                    <DropdownMenuItem className="w-full justify-center text-sm cursor-pointer text-primary">
                      Ver todos os alertas
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm sm:hidden" onClick={() => setIsSidebarOpen(false)}>
            <div 
              className="fixed inset-y-0 left-0 z-50 w-3/4 max-w-sm bg-background border-r p-6 shadow-lg transition-transform"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <span className="text-xl font-semibold">TamaraOS</span>
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
                  <Menu className="h-5 w-5" />
                </Button>
              </div>
              <nav className="grid gap-2">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary ${
                      pathname === item.href ? 'bg-muted text-primary font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                ))}
                <div className="mt-4 pt-4 border-t">
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                    Sair
                  </Button>
                </div>
              </nav>
            </div>
          </div>
        )}

        <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          {children}
        </main>
      </div>
    </div>
  )
}
