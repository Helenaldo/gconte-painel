import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
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
  ChevronDown
} from "lucide-react"

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

const menuItems = [
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
        title: "Configurações",
        url: "/escritorio/configuracoes",
        icon: Settings,
      },
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
    title: "Honorários",
    url: "/honorarios",
    icon: DollarSign,
    disabled: true,
  },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const [openGroups, setOpenGroups] = useState<string[]>(["Escritório", "Indicadores"])

  const isCollapsed = state === "collapsed"
  const currentPath = location.pathname

  const isActive = (url: string) => currentPath === url
  const isGroupActive = (items: any[]) => items?.some(item => isActive(item.url))

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => 
      prev.includes(title) 
        ? prev.filter(group => group !== title)
        : [...prev, title]
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
                              {item.items.map((subItem) => (
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
                              ))}
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