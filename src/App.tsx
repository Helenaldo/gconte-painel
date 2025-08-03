import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { MainLayout } from "@/components/layout/main-layout";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Clientes } from "@/pages/escritorio/Clientes";
import { Colaboradores } from "@/pages/escritorio/Colaboradores";
import { Contatos } from "@/pages/escritorio/Contatos";
import { Eventos } from "@/pages/escritorio/Eventos";
import { Tributacao } from "@/pages/escritorio/Tributacao";
import { Configuracoes } from "@/pages/escritorio/Configuracoes";
import { Importar } from "@/pages/indicadores/Importar";
import { Parametrizacao } from "@/pages/indicadores/Parametrizacao";
import { Dados } from "@/pages/indicadores/Dados";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, login, logout, profile } = useAuth();

  const userForLayout = profile ? {
    name: profile.nome,
    email: profile.email,
    avatar: profile.avatar_url
  } : undefined;

  return (
    <Routes>
      <Route 
        path="/login" 
        element={<Login />} 
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Dashboard />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/escritorio/clientes"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Clientes />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/escritorio/colaboradores"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Colaboradores />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/escritorio/contatos"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Contatos />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/escritorio/eventos"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Eventos />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/escritorio/tributacao"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Tributacao />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/escritorio/configuracoes"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Configuracoes />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/indicadores/importar"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Importar />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/indicadores/parametrizacao"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Parametrizacao />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/indicadores/dados"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Dados />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/indicadores/*"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Em Desenvolvimento</h2>
                  <p className="text-muted-foreground">Esta seção está sendo desenvolvida</p>
                </div>
              </div>
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/honorarios"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">Em Desenvolvimento</h2>
                  <p className="text-muted-foreground">Seção reservada para futuras implementações</p>
                </div>
              </div>
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="gconte-ui-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
