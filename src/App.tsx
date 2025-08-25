import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { MainLayout } from "@/components/layout/main-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";
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
import { Indicadores } from "@/pages/indicadores/Indicadores";
import { Dashboards } from "@/pages/indicadores/Dashboards";

import NotFound from "./pages/NotFound";
import NovoProcessoModal from "@/pages/processos/Novo";
import ProcessoDetalhes from "@/pages/processos/Detalhes";
import ProcessosListar from "@/pages/processos/Listar";
import VisaoGeral from "@/pages/processos/VisaoGeral";
import Tipos from "@/pages/processos/Tipos";
import RelatoriosProcessos from "@/pages/processos/Relatorios";
import { OrgaosInstituicoes } from "@/pages/processos/OrgaosInstituicoes";
import EditarProcesso from "@/pages/processos/Editar";
import Obrigacoes from "@/pages/Obrigacoes";

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
        path="/indicadores/indicadores"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Indicadores />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/indicadores/dashboards"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Dashboards />
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
        path="/obrigacoes"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Obrigacoes />
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
      <Route
        path="/processos/novo"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <NovoProcessoModal />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/processos/visao-geral"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <VisaoGeral />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/processos/listar"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <ProcessosListar />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/processos/tipos"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <Tipos />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/processos/orgaos-instituicoes"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <OrgaosInstituicoes />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/processos/relatorios"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <RelatoriosProcessos />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/processos/editar/:id"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <EditarProcesso />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/processos/:id"
        element={
          <ProtectedRoute>
            <MainLayout user={userForLayout} onLogout={logout}>
              <ProcessoDetalhes />
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
      <ErrorBoundary>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
