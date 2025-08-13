import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import GlobalSearch from "@/components/search/global-search"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { LogOut, Settings, User, Search } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"

interface HeaderProps {
  user?: {
    name: string
    email: string
    avatar?: string
  }
  onLogout?: () => void
}

export function Header({ user, onLogout }: HeaderProps) {
  const [officeLogoUrl, setOfficeLogoUrl] = useState<string | null>(null)
  
  const currentUser = user || {
    name: "Admin",
    email: "admin@gconte.com.br",
  }

  useEffect(() => {
    const loadOfficeLogo = async () => {
      try {
        const { data, error } = await supabase
          .from('office')
          .select('logomarca_url')
          .single()
        
        if (data?.logomarca_url) {
          setOfficeLogoUrl(data.logomarca_url)
        }
      } catch (error) {
        // Silently fail - will use fallback
      }
    }

    loadOfficeLogo()
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-header-border bg-header-background/95 backdrop-blur supports-[backdrop-filter]:bg-header-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="h-8 w-8" />
          
          <div className="flex items-center gap-2">
            {officeLogoUrl ? (
              <Avatar className="h-8 w-8">
                <AvatarImage src={officeLogoUrl} alt="Logo do Escritório" className="object-contain" />
                <AvatarFallback className="bg-gradient-primary">
                  <span className="text-primary-foreground font-bold text-sm">GC</span>
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-8 w-8 rounded bg-gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">GC</span>
              </div>
            )}
            <span className="font-semibold text-header-foreground">GCONTE PAINEL</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <GlobalSearch />
          <ThemeToggle />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{currentUser.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {currentUser.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}