import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const SETORES = [
  { label: "Contábil", value: "contabil" },
  { label: "Fiscal", value: "fiscal" },
  { label: "Pessoal", value: "pessoal" },
  { label: "Societário", value: "societario" },
  { label: "Financeiro", value: "financeiro" },
  { label: "Outro", value: "outro" },
] as const;

const PRIORIDADES = [
  { label: "Baixa", value: "baixa" },
  { label: "Média", value: "media" },
  { label: "Alta", value: "alta" },
  { label: "Crítica", value: "critica" },
] as const;

const STATUS = [
  { label: "Aberto", value: "aberto" },
  { label: "Em Andamento", value: "em_andamento" },
  { label: "Aguardando Terceiros", value: "aguardando_terceiros" },
  { label: "Em Revisão", value: "em_revisao" },
  { label: "Concluído", value: "concluido" },
  { label: "Cancelado", value: "cancelado" },
] as const;

type Setor = typeof SETORES[number]["value"];
type Prioridade = typeof PRIORIDADES[number]["value"];
type Status = typeof STATUS[number]["value"];

interface Cliente {
  id: string;
  nome_empresarial: string;
  nome_fantasia?: string;
  cnpj: string;
}

interface Responsavel {
  id: string;
  nome: string;
  email: string;
}

interface OrgaoInstituicao {
  id: string;
  nome: string;
}

export default function EditarProcesso() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form data
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [setor, setSetor] = useState<Setor>("contabil");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [status, setStatus] = useState<Status>("aberto");
  const [prazo, setPrazo] = useState("");
  const [orgaoId, setOrgaoId] = useState("");
  const [processoNumero, setProcessoNumero] = useState("");
  const [origem, setOrigem] = useState("");
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [novaEtiqueta, setNovaEtiqueta] = useState("");

  // Options
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [orgaos, setOrgaos] = useState<OrgaoInstituicao[]>([]);

  useEffect(() => {
    document.title = "Editar Processo | GConte";
  }, []);

  // Load options and process data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load options
        const [clientesRes, responsaveisRes, orgaosRes] = await Promise.all([
          supabase
            .from("clients")
            .select("id, nome_empresarial, nome_fantasia, cnpj")
            .order("nome_empresarial"),
          supabase
            .from("profiles")
            .select("id, nome, email")
            .eq("status", "ativo")
            .order("nome"),
          supabase
            .from("orgaos_instituicoes")
            .select("id, nome")
            .order("nome"),
        ]);

        if (clientesRes.data) setClientes(clientesRes.data);
        if (responsaveisRes.data) setResponsaveis(responsaveisRes.data);
        if (orgaosRes.data) setOrgaos(orgaosRes.data);

        // Load process data
        if (id) {
          const { data: processo, error } = await supabase
            .from("processos")
            .select("*")
            .eq("id", id)
            .single();

          if (error) throw error;

          if (processo) {
            setTitulo(processo.titulo);
            setDescricao(processo.descricao || "");
            setClienteId(processo.cliente_id || "");
            setResponsavelId(processo.responsavel_id);
            setSetor(processo.setor as Setor);
            setPrioridade(processo.prioridade as Prioridade);
            setStatus(processo.status as Status);
            setPrazo(processo.prazo ? format(new Date(processo.prazo), "yyyy-MM-dd") : "");
            setOrgaoId(processo.orgao_id || "");
            setProcessoNumero(processo.processo_numero || "");
            setOrigem(processo.origem || "");
            setEtiquetas(processo.etiquetas || []);
          }
        }
      } catch (error: any) {
        console.error("Erro ao carregar dados:", error);
        toast.error("Erro ao carregar dados do processo");
        navigate("/processos/listar");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, navigate]);

  const adicionarEtiqueta = () => {
    if (novaEtiqueta.trim() && !etiquetas.includes(novaEtiqueta.trim())) {
      setEtiquetas([...etiquetas, novaEtiqueta.trim()]);
      setNovaEtiqueta("");
    }
  };

  const removerEtiqueta = (etiqueta: string) => {
    setEtiquetas(etiquetas.filter((e) => e !== etiqueta));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !responsavelId || !setor) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        cliente_id: clienteId || null,
        responsavel_id: responsavelId,
        setor,
        prioridade,
        status,
        prazo: prazo || null,
        orgao_id: orgaoId || null,
        processo_numero: processoNumero.trim() || null,
        origem: origem.trim() || null,
        etiquetas,
      };

      const { error } = await supabase
        .from("processos")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      toast.success("Processo atualizado com sucesso!");
      navigate(`/processos/${id}`);
    } catch (error: any) {
      console.error("Erro ao atualizar processo:", error);
      toast.error("Erro ao atualizar processo");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <main className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Editar Processo</h1>
      </header>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Dados do Processo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Digite o título do processo"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva o processo"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="cliente">Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum cliente</SelectItem>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome_fantasia || cliente.nome_empresarial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="responsavel">Responsável *</Label>
                <Select value={responsavelId} onValueChange={setResponsavelId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {responsaveis.map((responsavel) => (
                      <SelectItem key={responsavel.id} value={responsavel.id}>
                        {responsavel.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="setor">Setor *</Label>
                <Select value={setor} onValueChange={(value) => setSetor(value as Setor)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {SETORES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select value={prioridade} onValueChange={(value) => setPrioridade(value as Prioridade)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as Status)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="prazo">Prazo</Label>
                <Input
                  id="prazo"
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="orgao">Órgão/Instituição</Label>
                <Select value={orgaoId} onValueChange={setOrgaoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um órgão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum órgão</SelectItem>
                    {orgaos.map((orgao) => (
                      <SelectItem key={orgao.id} value={orgao.id}>
                        {orgao.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="processoNumero">Número do Processo</Label>
                <Input
                  id="processoNumero"
                  value={processoNumero}
                  onChange={(e) => setProcessoNumero(e.target.value)}
                  placeholder="Ex: 1234567-89.2023.4.01.1234"
                />
              </div>

              <div>
                <Label htmlFor="origem">Origem</Label>
                <Input
                  id="origem"
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  placeholder="Ex: Email, Telefone, Presencial"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Etiquetas</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={novaEtiqueta}
                      onChange={(e) => setNovaEtiqueta(e.target.value)}
                      placeholder="Digite uma etiqueta"
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), adicionarEtiqueta())}
                    />
                    <Button type="button" onClick={adicionarEtiqueta} variant="outline">
                      Adicionar
                    </Button>
                  </div>
                  {etiquetas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {etiquetas.map((etiqueta) => (
                        <Badge key={etiqueta} variant="secondary" className="flex items-center gap-1">
                          {etiqueta}
                          <button
                            type="button"
                            onClick={() => removerEtiqueta(etiqueta)}
                            className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/processos/listar")}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}