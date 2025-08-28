import { useEffect, useMemo, useRef, useState } from "react"
import { Navigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff, AlertCircle, LogIn, CalendarDays, Newspaper, Building2, Target, Lightbulb, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/context/auth-context"
import { Calendar } from "@/components/ui/calendar"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import ReCAPTCHA from "react-google-recaptcha"
import { supabase } from "@/integrations/supabase/client"

// Corporate Professional Login Page - NobleUI Theme
// Forçando rebuild para aplicar mudanças

export function Login() {
  const { isAuthenticated, signIn, loading } = useAuth()
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [isRecaptchaLoading, setIsRecaptchaLoading] = useState(false)
  const [recaptchaAttempts, setRecaptchaAttempts] = useState(0)
  const { toast } = useToast()

  // SEO
  useEffect(() => {
    document.title = "Entrar | GCONTE Painel"
    const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
    if (metaDesc) metaDesc.content = "Acesse sua conta no GCONTE Painel. Login seguro com reCAPTCHA."
  }, [])

  // Office data - buscar todos os campos incluindo reCAPTCHA
  const [office, setOffice] = useState<{
    nome?: string;
    cnpj?: string;
    logomarca_url?: string | null;
    telefone?: string;
    email?: string;
    instagram?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cep?: string;
    municipio?: string;
    uf?: string;
    recaptcha_site_key?: string | null;
  } | null>(null)
  const [officeLoaded, setOfficeLoaded] = useState(false)
  
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('office')
          .select('nome, cnpj, logomarca_url, telefone, email, instagram, logradouro, numero, complemento, bairro, cep, municipio, uf, recaptcha_site_key')
          .maybeSingle()
        
        if (mounted) {
          setOffice(data)
          setOfficeLoaded(true)
        }
      } catch (err) {
        console.error('Erro ao buscar dados do escritório:', err)
        if (mounted) {
          setOfficeLoaded(true)
        }
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

  // reCAPTCHA - prioriza configuração do banco, depois localStorage, depois chave de teste
  const recaptchaRef = useRef<ReCAPTCHA | null>(null)
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)
  const RECAPTCHA_SITE_KEY = office?.recaptcha_site_key || localStorage.getItem('recaptcha_site_key') || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"

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
    setIsRecaptchaLoading(true)

    try {
      // reCAPTCHA validation is now mandatory
      if (!recaptchaToken) {
        setLoginError("Complete o reCAPTCHA antes de continuar.")
        setIsLoginLoading(false)
        setIsRecaptchaLoading(false)
        return
      }

      // Validar reCAPTCHA no backend
      try {
        const { data, error: functionError } = await supabase.functions.invoke('verify-recaptcha', {
          body: { 
            recaptchaToken,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        });

        if (functionError) {
          console.error('Erro na função de verificação:', functionError);
          setLoginError("Erro na validação de segurança. Tente novamente.");
          setIsLoginLoading(false)
          setIsRecaptchaLoading(false)
          return;
        }

        if (!data?.success) {
          const errorMsg = data?.error || 'Erro na validação do reCAPTCHA';
          console.error('reCAPTCHA validation failed:', data);
          
          // Increment attempts for better UX feedback
          setRecaptchaAttempts(prev => prev + 1);
          
          // Handle rate limiting
          if (data?.retryAfter) {
            setLoginError(`${errorMsg} Tente novamente em ${data.retryAfter} segundos.`);
          } else if (data?.canRetry === false) {
            setLoginError(`${errorMsg} Entre em contato com o administrador.`);
          } else {
            setLoginError(`${errorMsg} ${recaptchaAttempts > 0 ? 'Complete o reCAPTCHA novamente.' : ''}`);
          }
          
          // Reset reCAPTCHA for another attempt
          if (recaptchaRef.current && data?.canRetry !== false) {
            recaptchaRef.current.reset();
            setRecaptchaToken(null);
          }
          
          setIsLoginLoading(false)
          setIsRecaptchaLoading(false)
          return;
        }

        // Log successful reCAPTCHA validation
        console.log('reCAPTCHA validation successful:', {
          hostname: data.hostname,
          score: data.score
        });

      } catch (recaptchaError) {
        console.error('Erro na validação do reCAPTCHA:', recaptchaError);
        setLoginError("Erro na validação de segurança. Verifique sua conexão e tente novamente.");
        setIsLoginLoading(false)
        setIsRecaptchaLoading(false)
        return;
      }

      setIsRecaptchaLoading(false)

      // Proceed with login
      const { error } = await signIn(loginEmail, loginPassword)
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setLoginError("E-mail ou senha incorretos. Verifique suas credenciais.")
        } else if (error.message.includes('Email not confirmed')) {
          setLoginError("E-mail não confirmado. Verifique sua caixa de entrada.")
        } else {
          setLoginError(error.message || "Erro ao fazer login. Tente novamente.")
        }
      } else {
        // Create audit log entry for successful login
        try {
          await supabase.functions.invoke('create-login-audit', {
            body: {
              action: 'login_success',
              ip_address: 'client_side', // Will be replaced by edge function
              user_agent: navigator.userAgent,
              timestamp: new Date().toISOString()
            }
          });
        } catch (auditError) {
          // Don't block login if audit fails
          console.warn('Falha ao criar log de auditoria:', auditError);
        }

        toast({ 
          title: "Login realizado com sucesso!", 
          description: "Bem-vindo ao GCONTE PAINEL.",
          duration: 3000
        })
      }
    } catch (err: any) {
      console.error('Erro interno no login:', err);
      setLoginError("Erro interno do sistema. Tente novamente mais tarde.")
    } finally {
      setIsLoginLoading(false)
      setIsRecaptchaLoading(false)
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

  return (
    <main className="min-h-screen bg-background border-t-4 border-primary">
      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="min-h-screen flex">
        {/* Left Panel - Brand & Information */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-grid-pattern opacity-5" aria-hidden="true"></div>
          
          <div className="relative z-10 flex flex-col justify-between p-12 w-full">
            {/* Header with Logo */}
            <header className="flex flex-col items-start">
              <div className="flex items-center gap-4 mb-8">
                {office?.logomarca_url ? (
                  <Avatar className="h-16 w-16 border-2 border-primary/20">
                    <AvatarImage src={office.logomarca_url} alt="Logo do Escritório" className="object-contain" />
                    <AvatarFallback className="bg-gradient-to-r from-primary to-primary-hover text-primary-foreground">
                      <Building2 className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-16 w-16 rounded-full bg-gradient-to-r from-primary to-primary-hover flex items-center justify-center border-2 border-primary/20">
                    <Building2 className="h-8 w-8 text-primary-foreground" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{office?.nome || 'GCONTE PAINEL'}</h1>
                  <p className="text-muted-foreground">Sistema de Gestão Contábil</p>
                </div>
              </div>

              {/* Corporate Features */}
              <div className="space-y-6 max-w-xl">
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Missão</h3>
                    <p className="text-sm text-muted-foreground">Oferecer soluções contábeis inteligentes e consultivas, com agilidade, precisão e proximidade no atendimento, ajudando empresas a se adaptarem às exigências legais e do mercado, enquanto potencializam seus resultados e alcançam seus objetivos estratégicos.</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Lightbulb className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Visão</h3>
                    <p className="text-sm text-muted-foreground">Ser referência em ética, inovação e excelência contábil, reconhecida pela confiança dos clientes e pelo impacto positivo na gestão empresarial.</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm">
                  <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Políticas da Empresa</h3>
                    <p className="text-sm text-muted-foreground">
                      • Foco no Cliente: superar expectativas por meio de um atendimento consultivo, ágil e transparente.<br/>
                      • Conformidade Legal: assegurar rigoroso cumprimento das normas contábeis, fiscais e regulatórias.<br/>
                      • Qualidade e Inovação: manter processos de gestão da qualidade em constante aprimoramento, incorporando tecnologia e boas práticas do mercado.<br/>
                      • Melhoria Contínua: buscar evolução permanente nos serviços prestados, visando eficiência, segurança da informação e excelência no relacionamento com clientes e parceiros.
                    </p>
                  </div>
                </div>
              </div>
            </header>

            {/* Office Contact Information */}
            {office && (
              <footer className="space-y-4 mt-6">
                <Separator className="opacity-50" />
                {(office.logradouro || office.telefone || office.email) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Informações de Contato</h4>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      {office.logradouro && (
                        <p className="text-muted-foreground">
                          📍 {[office.logradouro, office.numero].filter(Boolean).join(", ")}
                          {office.complemento && `, ${office.complemento}`}
                          {office.bairro && `, ${office.bairro}`}
                          {office.municipio && `, ${office.municipio}`}
                          {office.uf && ` - ${office.uf}`}
                          {office.cep && `, CEP: ${office.cep}`}
                        </p>
                      )}
                      {office.telefone && <p className="text-muted-foreground">📞 {office.telefone}</p>}
                      {office.email && <p className="text-muted-foreground">✉️ {office.email}</p>}
                    </div>
                  </div>
                )}
              </footer>
            )}
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            {/* Mobile Header */}
            <div className="lg:hidden mb-8 text-center">
              <div className="flex justify-center mb-4">
                {office?.logomarca_url ? (
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={office.logomarca_url} alt="Logo do Escritório" className="object-contain" />
                    <AvatarFallback className="bg-gradient-to-r from-primary to-primary-hover text-primary-foreground">
                      <Building2 className="h-10 w-10" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gradient-to-r from-primary to-primary-hover flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-primary-foreground" />
                  </div>
                )}
              </div>
              <h1 className="text-2xl font-bold text-foreground">{office?.nome || 'GCONTE PAINEL'}</h1>
              <p className="text-muted-foreground">Sistema de Gestão Contábil</p>
            </div>

            {/* Login Form */}
            <Card className="border-border/50 shadow-lg">
              <CardHeader className="space-y-1 text-center pb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <LogIn className="h-5 w-5 text-primary" />
                  <CardTitle className="text-xl">Acesse sua conta</CardTitle>
                </div>
                <CardDescription>
                  Entre com suas credenciais para acessar o painel
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleLogin} className="space-y-6">
                  {loginError && (
                    <Alert variant="destructive" className="animate-in slide-in-from-top-1 duration-300">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{loginError}</AlertDescription>
                    </Alert>
                  )}

                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium">
                      Endereço de e-mail
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      disabled={isLoginLoading}
                      className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                      autoComplete="username"
                      aria-describedby="email-description"
                    />
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm font-medium">
                      Senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        placeholder="Digite sua senha"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        disabled={isLoginLoading}
                        className="h-11 pr-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                        autoComplete="current-password"
                        aria-describedby="password-description"
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
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember-me"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                        disabled={isLoginLoading}
                      />
                      <Label
                        htmlFor="remember-me"
                        className="text-sm font-normal text-muted-foreground cursor-pointer"
                      >
                        Lembrar-me
                      </Label>
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={handleForgotPassword}
                      disabled={isLoginLoading}
                      className="px-0 h-auto text-sm text-primary hover:text-primary-hover"
                    >
                      Esqueceu a senha?
                    </Button>
                  </div>

                    {/* reCAPTCHA */}
                    {officeLoaded && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Verificação de Segurança
                        </Label>
                        <div className="flex justify-center">
                          <ReCAPTCHA
                            ref={recaptchaRef}
                            sitekey={RECAPTCHA_SITE_KEY}
                            onChange={setRecaptchaToken}
                            theme="light"
                            size="normal"
                            className="recaptcha-container"
                          />
                        </div>
                        {isRecaptchaLoading && (
                          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                            <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
                            Validando segurança...
                          </div>
                        )}
                        {!recaptchaToken && !isRecaptchaLoading && (
                          <p className="text-xs text-muted-foreground text-center">
                            Complete a verificação acima para continuar
                          </p>
                        )}
                        {recaptchaAttempts > 0 && (
                          <p className="text-xs text-warning text-center">
                            Tentativa {recaptchaAttempts + 1} - Complete novamente se necessário
                          </p>
                        )}
                      </div>
                    )}

                    {/* Login Button */}
                    <Button 
                      type="submit" 
                      disabled={isLoginLoading || !recaptchaToken || isRecaptchaLoading} 
                      className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-all duration-200"
                    >
                      {isLoginLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {isRecaptchaLoading ? 'Validando segurança...' : 'Entrando...'}
                        </>
                      ) : (
                        <>
                          <LogIn className="mr-2 h-4 w-4" />
                          Entrar com Segurança
                        </>
                      )}
                    </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}