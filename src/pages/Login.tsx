import { useState } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, EyeOff, AlertCircle, UserPlus, LogIn } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/context/auth-context"

export function Login() {
  const { isAuthenticated, signIn, signUp, loading } = useAuth()
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [signupNome, setSignupNome] = useState("")
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [isSignupLoading, setIsSignupLoading] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [signupError, setSignupError] = useState("")
  const { toast } = useToast()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    setIsLoginLoading(true)

    try {
      console.log('Attempting login with:', loginEmail)
      const { error } = await signIn(loginEmail, loginPassword)
      if (error) {
        console.error('Login error:', error)
        setLoginError(error.message || "Erro ao fazer login. Verifique suas credenciais.")
      } else {
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo ao GCONTE PAINEL.",
        })
      }
    } catch (err: any) {
      console.error('Login exception:', err)
      setLoginError("Erro interno do sistema. Tente novamente mais tarde.")
    } finally {
      setIsLoginLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignupError("")
    setIsSignupLoading(true)

    try {
      console.log('Attempting signup with:', signupEmail, signupNome)
      const { error } = await signUp(signupEmail, signupPassword, { 
        nome: signupNome,
        role: 'administrador' // First user will be admin
      })
      
      if (error) {
        console.error('Signup error:', error)
        setSignupError(error.message || "Erro ao criar conta.")
      } else {
        toast({
          title: "Conta criada com sucesso!",
          description: "Verifique seu e-mail para confirmar a conta.",
        })
        // Clear form
        setSignupEmail("")
        setSignupPassword("")
        setSignupNome("")
      }
    } catch (err: any) {
      console.error('Signup exception:', err)
      setSignupError("Erro interno do sistema. Tente novamente mais tarde.")
    } finally {
      setIsSignupLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <Card className="w-full max-w-md shadow-lg border-0 bg-card/95 backdrop-blur">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">GC</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">GCONTE PAINEL</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sistema de Gestão Contábil
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                Entrar
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Cadastrar
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4 mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{loginError}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    disabled={isLoginLoading}
                    className="h-11"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={isLoginLoading}
                      className="h-11 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      disabled={isLoginLoading}
                    >
                      {showLoginPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity"
                  disabled={isLoginLoading}
                >
                  {isLoginLoading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4 mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                {signupError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{signupError}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="signup-nome">Nome Completo</Label>
                  <Input
                    id="signup-nome"
                    type="text"
                    placeholder="Seu nome completo"
                    value={signupNome}
                    onChange={(e) => setSignupNome(e.target.value)}
                    required
                    disabled={isSignupLoading}
                    className="h-11"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-mail</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    disabled={isSignupLoading}
                    className="h-11"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                      disabled={isSignupLoading}
                      className="h-11 pr-10"
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      disabled={isSignupLoading}
                    >
                      {showSignupPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity"
                  disabled={isSignupLoading}
                >
                  {isSignupLoading ? "Criando conta..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}