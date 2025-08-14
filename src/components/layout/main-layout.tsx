import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { Header } from "./header"

interface MainLayoutProps {
  children: React.ReactNode
  user?: {
    name: string
    email: string
    avatar?: string
  }
  onLogout?: () => void
}

export function MainLayout({ children, user, onLogout }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header user={user} onLogout={onLogout} />
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-[1920px] w-full mx-auto" style={{ paddingInline: 'var(--nobleui-gap)' }}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}