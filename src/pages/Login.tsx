import { useEffect, useMemo, useRef, useState } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, EyeOff, AlertCircle, UserPlus, LogIn, CalendarDays, Newspaper } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/context/auth-context"
import { Calendar } from "@/components/ui/calendar"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import ReCAPTCHA from "react-google-recaptcha"
import { supabase } from "@/integrations/supabase/client"

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

  // SEO
  useEffect(() => {
    document.title = "Entrar | GCONTE Painel"
    const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    if (metaDesc) metaDesc.content = "Acesse sua conta no GCONTE Painel. Login seguro com reCAPTCHA."
  }, [])

  // Office data (nome e logomarca)
  const [office, setOffice] = useState<{ nome?: string; logomarca_url?: string | null } | null>(null)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await supabase.from('office').select('nome, logomarca_url').single()
        if (mounted) setOffice(data)
      } catch (_) {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [])

  // Holidays (BrasilAPI)
  const [holidays, setHolidays] = useState<{ date: string; name: string }[]>([])
  useEffect(() => {
    const year = new Date().getFullYear()
    fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`)
      .then(r => r.ok ? r.json() : [])
      .then((list) => setHolidays(Array.isArray(list) ? list : []))
      .catch(() => setHolidays([]))
  }, [])

  const holidayDates = useMemo(() => holidays.map(h => new Date(h.date + 'T00:00:00')), [holidays])

  // News (opcional via API key no navegador)
  type NewsItem = { title: string; url: string; source?: string; publishedAt?: string }
  const [news, setNews] = useState<NewsItem[]>([])
  useEffect(() => {
    const gnewsKey = localStorage.getItem('gnews_key')
    if (!gnewsKey) return
    const url = `https://gnews.io/api/v4/search?q=economia%20OR%20pol%C3%ADtica&lang=pt&country=br&max=6&token=${gnewsKey}`
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && Array.isArray(data.articles)) {
          setNews(
            data.articles.map((a: any) => ({ title: a.title, url: a.url, source: a.source?.name, publishedAt: a.publishedAt }))
          )
        }
      })
      .catch(() => {})
  }, [])

  // reCAPTCHA
  const recaptchaRef = useRef<ReCAPTCHA | null>(null)
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)
  const RECAPTCHA_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" // Test key by Google (dev only)

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
      if (!recaptchaToken) {
        setLoginError("Valide o reCAPTCHA antes de continuar.")
        setIsLoginLoading(false)
        return
      }
      const { error } = await signIn(loginEmail, loginPassword)
      if (error) {
        setLoginError(error.message || "Erro ao fazer login. Verifique suas credenciais.")
      } else {
        toast({ title: "Login realizado com sucesso!", description: "Bem-vindo ao GCONTE PAINEL." })
      }
    } catch (err: any) {
      setLoginError("Erro interno do sistema. Tente novamente mais tarde.")
    } finally {
      setIsLoginLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!loginEmail) {
      toast({ title: "Informe seu e-mail", description: "Preencha o e-mail para receber o link de redefinição.", variant: "destructive" })
      return
    }
    try {
      const redirectUrl = `${window.location.origin}/`
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, { redirectTo: redirectUrl })
      if (error) throw error
      toast({ title: "Verifique seu e-mail", description: "Enviamos um link para redefinição de senha." })
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao solicitar redefinição.", variant: "destructive" })
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
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="absolute inset-0 bg-grid-pattern opacity-5" aria-hidden="true"></div>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coluna: Formulário */}
        <Card className="shadow-lg border-0 bg-card/95 backdrop-blur">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">GC</span>
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-foreground">{office?.nome || 'GCONTE PAINEL'}</CardTitle>
                <CardDescription className="text-muted-foreground">Acesse sua conta</CardDescription>
              </div>
            </div>
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
                      autoComplete="username"
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
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        disabled={isLoginLoading}
                        aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showLoginPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={handleForgotPassword} className="text-sm text-primary hover:underline">
                        Esqueceu a senha?
                      </button>
                    </div>
                  </div>

                  <div className="pt-1">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={RECAPTCHA_SITE_KEY}
                      onChange={(token) => setRecaptchaToken(token)}
                      onExpired={() => setRecaptchaToken(null)}
                      theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity"
                    disabled={isLoginLoading || !recaptchaToken}
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
                        aria-label={showSignupPassword ? 'Ocultar senha' : 'Mostrar senha'}
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

        {/* Coluna: Painel Informativo */}
        <Card className="shadow-lg border-0 bg-card/95 backdrop-blur overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={office?.logomarca_url || ''} alt={office?.nome || 'Logomarca'} className="object-contain" />
                <AvatarFallback>GC</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg font-semibold">{office?.nome || 'Seu Escritório'}</CardTitle>
                <CardDescription className="text-muted-foreground">Informações e utilidades</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Calendário com feriados */}
            <section aria-labelledby="cal-feriados">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="h-4 w-4" />
                <h3 id="cal-feriados" className="text-sm font-medium">Calendário com Feriados Nacionais</h3>
              </div>
              <div className="rounded-md border p-2">
                <Calendar
                  mode="single"
                  className="pointer-events-auto"
                  modifiers={{ holiday: holidayDates }}
                  modifiersClassNames={{ holiday: "bg-accent text-accent-foreground" }}
                />
              </div>
              {holidays.length > 0 && (
                <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  {holidays.slice(0,6).map((h) => (
                    <li key={h.date} className="flex justify-between">
                      <span>{new Date(h.date).toLocaleDateString('pt-BR')}</span>
                      <span className="truncate ml-2">{h.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator />

            {/* Notícias */}
            <section aria-labelledby="news-br">
              <div className="flex items-center gap-2 mb-2">
                <Newspaper className="h-4 w-4" />
                <h3 id="news-br" className="text-sm font-medium">Notícias de Economia e Política</h3>
              </div>
              {news.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Configure uma API gratuita (ex.: GNews) para exibir o feed. Adicione sua chave em localStorage como <code>gnews_key</code> e recarregue a página.
                </div>
              ) : (
                <ul className="space-y-2">
                  {news.map((n, idx) => (
                    <li key={idx} className="text-sm">
                      <a href={n.url} target="_blank" rel="noreferrer" className="story-link text-foreground">
                        {n.title}
                      </a>
                      {n.source && <span className="ml-2 text-muted-foreground">— {n.source}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator />

            {/* Dicas úteis */}
            <section aria-labelledby="dicas-contabeis" className="space-y-2">
              <h3 id="dicas-contabeis" className="text-sm font-medium">Dicas Úteis para Contadores</h3>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>Prazos para entrega de obrigações acessórias no mês</li>
                <li>Últimas atualizações do SPED</li>
                <li>Alterações tributárias recentes</li>
              </ul>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}