import { useState } from "react"
import { NavLink, useLocation, useSearchParams } from "react-router-dom"
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Contact, 
  Calendar, 
  Calculator, 
  Settings, 
  TrendingUp, 
  Upload, 
  Sliders, 
  Database, 
  BarChart3, 
  TestTube, 
  DollarSign,
  FileText,
  ChevronDown,
  Briefcase,
  List,
  PlusCircle,
  Tags,
  BarChart2,
  Shield
} from "lucide-react"

import { useAuth } from "@/context/auth-context"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface MenuItem {
  title: string
  url?: string
  icon: any
  items?: MenuItem[]
  disabled?: boolean
  adminOnly?: boolean
}

const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Escritório",
    icon: Building2,
    items: [
      {
        title: "Clientes",
        url: "/escritorio/clientes",
        icon: Users,
      },
      {
        title: "Colaboradores",
        url: "/escritorio/colaboradores",
        icon: Contact,
      },
      {
        title: "Contatos",
        url: "/escritorio/contatos",
        icon: Contact,
      },
      {
        title: "Eventos",
        url: "/escritorio/eventos",
        icon: Calendar,
      },
      {
        title: "Tributação",
        url: "/escritorio/tributacao",
        icon: Calculator,
      },
      {
        title: "Certificados Digitais",
        url: "/escritorio/certificados-digitais",
        icon: Shield,
      },
      {
        title: "Configurações",
        url: "/escritorio/configuracoes",
        icon: Settings,
      },
    ],
  },
  {
    title: "Processos",
    icon: Briefcase,
    items: [
      { title: "Visão geral", url: "/processos/visao-geral", icon: LayoutDashboard },
      { title: "Listar", url: "/processos/listar", icon: List },
      { title: "Novo", url: "/processos/novo", icon: PlusCircle },
      { title: "Tipos", url: "/processos/tipos", icon: Tags },
      { title: "Órgão/Instituição", url: "/processos/orgaos-instituicoes", icon: Building2 },
      { title: "Relatórios", url: "/processos/relatorios", icon: BarChart2 },
    ],
  },
  {
    title: "Indicadores",
    icon: TrendingUp,
    items: [
      {
        title: "Importar",
        url: "/indicadores/importar",
        icon: Upload,
      },
      {
        title: "Parametrização",
        url: "/indicadores/parametrizacao",
        icon: Sliders,
      },
      {
        title: "Dados",
        url: "/indicadores/dados",
        icon: Database,
      },
      {
        title: "Indicadores",
        url: "/indicadores/indicadores",
        icon: BarChart3,
      },
      {
        title: "Dashboard",
        url: "/indicadores/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Testes",
        url: "/indicadores/testes",
        icon: TestTube,
      },
    ],
  },
  {
    title: "Obrigações",
    url: "/obrigacoes",
    icon: FileText,
    adminOnly: true,
  },
  {
    title: "Honorários",
    url: "/honorarios",
    icon: DollarSign,
    disabled: true,
  },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const { profile } = useAuth()

  const isCollapsed = state === "collapsed"
  const currentPath = location.pathname
  const balanceteId = searchParams.get('balancete_id')

  const isActive = (url: string) => currentPath === url
  const isGroupActive = (items: any[]) => items?.some(item => isActive(item.url))

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => 
      prev.includes(title) 
        ? prev.filter(group => group !== title)
        : [title] // Abre apenas o grupo clicado, fecha todos os outros
    )
  }

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs font-semibold uppercase tracking-wider">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                // Verificar se é admin-only e se o usuário é admin
                if (item.adminOnly && profile?.role !== 'administrador') {
                  return null
                }
                
                if (item.items) {
                  const isGroupOpen = openGroups.includes(item.title)
                  const hasActiveItem = isGroupActive(item.items)
                  
                  return (
                    <Collapsible
                      key={item.title}
                      open={isGroupOpen}
                      onOpenChange={() => toggleGroup(item.title)}
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className={`w-full ${hasActiveItem ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''}`}
                          >
                            <item.icon className={`${isCollapsed ? 'mx-auto' : 'mr-2'} h-4 w-4`} />
                            {!isCollapsed && (
                              <>
                                <span className="flex-1 text-left">{item.title}</span>
                                <ChevronDown className={`h-4 w-4 transition-transform ${isGroupOpen ? 'rotate-180' : ''}`} />
                              </>
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        {!isCollapsed && (
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.items.map((subItem) => {
                                // Para Parametrização, só mostrar se houver balancete_id na URL ou se estivermos na página
                                if (subItem.title === "Parametrização" && 
                                    !balanceteId && 
                                    !currentPath.includes('/indicadores/parametrizacao')) {
                                  return null
                                }
                                
                                return (
                                  <SidebarMenuSubItem key={subItem.title}>
                                    <SidebarMenuSubButton asChild>
                                      <NavLink
                                        to={subItem.url}
                                        className={({ isActive }) =>
                                          `flex items-center gap-2 ${
                                            isActive
                                              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                                          }`
                                        }
                                      >
                                        <subItem.icon className="h-4 w-4" />
                                        <span>{subItem.title}</span>
                                      </NavLink>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                )
                              }).filter(Boolean)}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      disabled={item.disabled}
                      className={item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      {item.disabled ? (
                        <div className="flex items-center gap-2">
                          <item.icon className={`${isCollapsed ? 'mx-auto' : 'mr-2'} h-4 w-4`} />
                          {!isCollapsed && <span>{item.title}</span>}
                        </div>
                      ) : (
                        <NavLink
                          to={item.url}
                          className={({ isActive }) =>
                            `flex items-center gap-2 ${
                              isActive
                                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                            }`
                          }
                        >
                          <item.icon className={`${isCollapsed ? 'mx-auto' : 'mr-2'} h-4 w-4`} />
                          {!isCollapsed && <span>{item.title}</span>}
                        </NavLink>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
