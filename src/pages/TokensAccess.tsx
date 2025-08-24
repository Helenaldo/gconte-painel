import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Plus, RotateCcw, Trash2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AccessToken {
  id: string;
  jti: string;
  nome: string;
  scopes: string[];
  expires_at: string;
  created_at: string;
  last_used_at?: string;
  status: string;
  expired: boolean;
}

export default function TokensAccess() {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [generatedToken, setGeneratedToken] = useState('');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    expira_em: 24, // hours
    scopes: [] as string[]
  });

  const availableScopes = [
    { id: 'obrigacoes.read', label: 'Leitura de Obrigações' },
    { id: 'obrigacoes.write', label: 'Upload de Obrigações' },
    { id: 'obrigacoes.delete', label: 'Exclusão de Obrigações' },
    { id: 'admin', label: 'Administrador' }
  ];

  const loadTokens = async () => {
    try {
      const { data } = await supabase.functions.invoke('api-auth-tokens');
      if (data?.data) {
        setTokens(data.data);
      }
    } catch (error) {
      toast({
        title: "Erro ao carregar tokens",
        description: "Não foi possível carregar a lista de tokens.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('api-auth-token', {
        body: formData
      });

      if (error) throw error;

      if (data?.token) {
        setGeneratedToken(data.token);
        setShowTokenModal(true);
        setShowCreateModal(false);
        await loadTokens();
        
        setFormData({ nome: '', expira_em: 24, scopes: [] });
        
        toast({
          title: "Token criado com sucesso",
          description: "O token foi criado e será exibido apenas uma vez.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao criar token",
        description: "Não foi possível criar o token.",
        variant: "destructive",
      });
    }
  };

  const revokeToken = async (jti: string) => {
    try {
      await supabase.functions.invoke(`api-auth-token-revoke/${jti}`, {
        method: 'DELETE'
      });
      
      await loadTokens();
      toast({
        title: "Token revogado",
        description: "O token foi revogado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao revogar token",
        description: "Não foi possível revogar o token.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Token copiado para a área de transferência.",
    });
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const handleScopeChange = (scopeId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      scopes: checked 
        ? [...prev.scopes, scopeId]
        : prev.scopes.filter(s => s !== scopeId)
    }));
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tokens de Acesso</h1>
          <p className="text-muted-foreground">Gerencie tokens de API para sistemas externos</p>
        </div>
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Token
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Token</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome do Token</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Sistema Externo API"
                />
              </div>
              <div>
                <Label htmlFor="expira_em">Expira em (horas)</Label>
                <Input
                  id="expira_em"
                  type="number"
                  value={formData.expira_em}
                  onChange={(e) => setFormData(prev => ({ ...prev, expira_em: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Escopos de Acesso</Label>
                <div className="space-y-2">
                  {availableScopes.map((scope) => (
                    <div key={scope.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={scope.id}
                        checked={formData.scopes.includes(scope.id)}
                        onCheckedChange={(checked) => handleScopeChange(scope.id, checked as boolean)}
                      />
                      <Label htmlFor={scope.id}>{scope.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={createToken} className="w-full">
                Criar Token
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Generated Token Modal */}
      <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Token Gerado - Atenção!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive font-medium">
                ⚠️ Este token será exibido apenas uma vez. Copie e guarde em local seguro!
              </p>
            </div>
            <div className="space-y-2">
              <Label>Seu Token de Acesso:</Label>
              <div className="flex gap-2">
                <Input 
                  value={generatedToken} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button 
                  size="sm" 
                  onClick={() => copyToClipboard(generatedToken)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Tokens Ativos</CardTitle>
          <CardDescription>
            Lista de todos os tokens de acesso criados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Escopos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Último uso</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => (
                <TableRow key={token.id}>
                  <TableCell className="font-medium">{token.nome}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {token.scopes.map(scope => (
                        <Badge key={scope} variant="secondary" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      token.status === 'revoked' ? 'destructive' : 
                      token.expired ? 'secondary' : 'default'
                    }>
                      {token.status === 'revoked' ? 'Revogado' : 
                       token.expired ? 'Expirado' : 'Ativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(token.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>
                    {token.last_used_at 
                      ? new Date(token.last_used_at).toLocaleDateString('pt-BR')
                      : 'Nunca usado'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {token.status === 'active' && !token.expired && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => revokeToken(token.jti)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {tokens.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum token encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}