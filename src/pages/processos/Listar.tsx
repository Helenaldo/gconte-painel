import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { format, parse, isBefore, differenceInCalendarDays } from "date-fns";
import InputMask from "react-input-mask";
import { ChevronsUpDown, Check, Search, Eye, Pencil, CheckCircle2, XCircle, Copy, FileSpreadsheet, Download, Building2, Settings, ExternalLink, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { cn, buildProcessoLink } from "@/lib/utils";
import { getSla } from "@/lib/sla";
import DuplicarModal, { ProcessoBase } from "@/components/processos/DuplicarModal";
import ImportarProcessosModal from "@/components/processos/ImportarProcessosModal";

// Types
interface Processo {
  id: string;
  titulo: string;
  cliente_id: string | null;
  responsavel_id: string;
  setor: string;
  prioridade: string;
  status: string;
  prazo: string | null; // date
  created_at: string;
  orgao_id: string | null;
  processo_numero: string | null;
}

interface Option { id: string; label: string; subtitle?: string; avatar_url?: string; link_dinamico?: string | null }

const SETORES = [
  { label: "Contábil", value: "contabil" },
  { label: "Fiscal", value: "fiscal" },
  { label: "Pessoal", value: "pessoal" },
  { label: "Societário", value: "societario" },
  { label: "Financeiro", value: "financeiro" },
  { label: "Outro", value: "outro" },
] as const;

type Setor = typeof SETORES[number]["value"];

const PRIORIDADES = [
  { label: "Baixa", value: "baixa" },
  { label: "Média", value: "media" },
  { label: "Alta", value: "alta" },
  { label: "Crítica", value: "critica" },
] as const;

type Prioridade = typeof PRIORIDADES[number]["value"];

const STATUS = [
  { label: "Aberto", value: "aberto" },
  { label: "Em Andamento", value: "em_andamento" },
  { label: "Aguardando Terceiros", value: "aguardando_terceiros" },
  { label: "Em Revisão", value: "em_revisao" },
  { label: "Concluído", value: "concluido" },
  { label: "Cancelado", value: "cancelado" },
] as const;

type Status = typeof STATUS[number]["value"];

const storageKey = "processosListFilters";

type Filters = {
  clienteId?: string | null;
  responsavelId?: string | null;
  setor?: Setor | null;
  status?: Status | null;
  prioridade?: Prioridade | null;
  prazoDe?: string | null; // dd/MM/yyyy
  prazoAte?: string | null; // dd/MM/yyyy
  orgaoId?: string | null;
  q?: string;
};

const columnsStorageKey = "processosListColumns";

type VisibleColumns = {
  cliente: boolean;
  responsavel: boolean;
  setor: boolean;
  prioridade: boolean;
  status: boolean;
  prazo: boolean;
  atraso: boolean;
  orgao: boolean;
  processo_numero: boolean;
};

function toISODate(str?: string | null) {
  if (!str) return undefined;
  try {
    const d = parse(str, "dd/MM/yyyy", new Date());
    return format(d, "yyyy-MM-dd");
  } catch {
    return undefined;
  }
}

function prazoBadgeVariant(prazo?: Date | null, status?: string) {
  if (!prazo) return "secondary" as const;
  const today = new Date();
  const atMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (status === "concluido") return "secondary" as const;
  if (isBefore(prazo, atMidnight)) return "destructive" as const;
  if (differenceInCalendarDays(prazo, atMidnight) === 0) return "warning" as const;
  return "info" as const;
}

function prioridadeVariant(v: string) {
  switch (v) {
    case "baixa":
      return "secondary" as const;
    case "media":
      return "info" as const;
    case "alta":
      return "warning" as const;
    case "critica":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function statusVariant(v: string) {
  switch (v) {
    case "concluido":
      return "success" as const;
    case "cancelado":
      return "destructive" as const;
    case "em_andamento":
      return "info" as const;
    case "aguardando_terceiros":
      return "warning" as const;
    case "em_revisao":
      return "secondary" as const;
    default:
      return "default" as const;
  }
}

export default function ProcessosListar() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [filters, setFilters] = useState<Filters>({});

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>(() => {
    const saved = localStorage.getItem(columnsStorageKey);
    return saved ? JSON.parse(saved) : {
      cliente: true,
      responsavel: true,
      setor: true,
      prioridade: true,
      status: true,
      prazo: true,
      atraso: true,
      orgao: true,
      processo_numero: true,
    };
  });

  const [clientes, setClientes] = useState<Option[]>([]);
  const [responsaveis, setResponsaveis] = useState<Option[]>([]);
  const [orgaos, setOrgaos] = useState<Option[]>([]);

  const [rows, setRows] = useState<Processo[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Duplicar
  const [dupOpen, setDupOpen] = useState(false);
  const [dupOriginal, setDupOriginal] = useState<ProcessoBase | null>(null);

  // Importar
  const [importOpen, setImportOpen] = useState(false);

  // Excluir
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [processoToDelete, setProcessoToDelete] = useState<Processo | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    document.title = "Processos | GConte";
  }, []);

  // Read deep-link params (?q, ?search, ?cliente_id, ?responsavel_id)
  // Commented out to ensure filters always start clean
  // const location = useLocation();
  // useEffect(() => {
  //   const sp = new URLSearchParams(location.search);
  //   const qParam = sp.get("q") || sp.get("search");
  //   const clienteId = sp.get("cliente_id");
  //   const responsavelId = sp.get("responsavel_id");
  //   if (qParam || clienteId || responsavelId) {
  //     setFilters((f) => ({ ...f, q: qParam || f.q, clienteId: clienteId || f.clienteId || null, responsavelId: responsavelId || f.responsavelId || null }));
  //   }
  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  // Load options
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{ data: cli }, { data: prof }, { data: org }] = await Promise.all([
          supabase.from("clients").select("id, nome_empresarial, nome_fantasia, cnpj").order("nome_empresarial", { ascending: true }),
          supabase.from("profiles").select("id, nome, email, avatar_url, status").eq("status", "ativo").order("nome", { ascending: true }),
          supabase.from("orgaos_instituicoes").select("id, nome, email, telefone, link_dinamico").order("nome", { ascending: true }),
        ]);
        if (!active) return;
        setClientes(
          (cli ?? []).map((c) => ({ id: c.id as string, label: (c.nome_fantasia || c.nome_empresarial) as string, subtitle: c.cnpj as string }))
        );
        setResponsaveis(
          (prof ?? []).map((p) => ({ id: p.id as string, label: p.nome as string, subtitle: p.email as string, avatar_url: p.avatar_url as string | undefined }))
        );
        setOrgaos(
          (org ?? []).map((o: any) => ({ id: o.id as string, label: o.nome as string, subtitle: o.email || o.telefone || undefined, link_dinamico: o.link_dinamico }))
        );
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { active = false };
  }, []);

  // Persist filters
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(filters));
  }, [filters]);

  // Persist column visibility
  useEffect(() => {
    localStorage.setItem(columnsStorageKey, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Fetch data
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("processos")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false });

        if (filters.setor) query = query.eq("setor", filters.setor);
        if (filters.status) query = query.eq("status", filters.status);
        if (filters.prioridade) query = query.eq("prioridade", filters.prioridade);
        if (filters.clienteId) query = query.eq("cliente_id", filters.clienteId);
        if (filters.responsavelId) query = query.eq("responsavel_id", filters.responsavelId);
        if (filters.orgaoId) query = query.eq("orgao_id", filters.orgaoId);

        const de = toISODate(filters.prazoDe);
        const ate = toISODate(filters.prazoAte);
        if (de) query = query.gte("prazo", de);
        if (ate) query = query.lte("prazo", ate);

        if (filters.q && filters.q.trim()) {
          const q = filters.q.trim();
          query = query.or(`titulo.ilike.%${q}%,descricao.ilike.%${q}%`);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, error, count } = await query.range(from, to);
        if (error) throw error;

        if (!active) return;
        setRows((data as any as Processo[]) || []);
        setCount(count || 0);
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Erro ao carregar processos");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false };
  }, [filters, page, pageSize]);

  // Helpers
  const clientById = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes]);
  const respById = useMemo(() => Object.fromEntries(responsaveis.map((r) => [r.id, r])), [responsaveis]);
  const orgaoById = useMemo(() => Object.fromEntries(orgaos.map((o) => [o.id, o])), [orgaos]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const changeStatus = async (id: string, status: Status) => {
    try {
      const { error } = await supabase.from("processos").update({ status }).eq("id", id);
      if (error) throw error;
      toast.success("Status atualizado");
      // refresh
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)) as any);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao atualizar");
    }
  };

  const handleDeleteProcess = async () => {
    if (!processoToDelete || deleteConfirmText !== "Excluir") {
      toast.error("Digite 'Excluir' para confirmar");
      return;
    }

    setDeleting(true);
    try {
      // Primeiro exclui os movimentos relacionados
      const { error: movimentosError } = await supabase
        .from("movimentos")
        .delete()
        .eq("processo_id", processoToDelete.id);

      if (movimentosError) throw movimentosError;

      // Depois exclui o processo
      const { error: processoError } = await supabase
        .from("processos")
        .delete()
        .eq("id", processoToDelete.id);

      if (processoError) throw processoError;

      toast.success("Processo excluído com sucesso");
      
      // Remove da lista local
      setRows((prev) => prev.filter((r) => r.id !== processoToDelete.id));
      setCount((prev) => prev - 1);
      
      // Fecha o diálogo
      setDeleteOpen(false);
      setProcessoToDelete(null);
      setDeleteConfirmText("");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao excluir processo");
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteDialog = (processo: Processo) => {
    setProcessoToDelete(processo);
    setDeleteConfirmText("");
    setDeleteOpen(true);
  };

  // Verificar se usuário pode excluir (admin/operador ou responsável pelo processo)
  const canDelete = (processo: Processo) => {
    return profile?.role === 'administrador' || 
           profile?.role === 'operador' || 
           processo.responsavel_id === profile?.id;
  };

  return (
    <TooltipProvider>
      <main className="p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Processos</h1>
      </header>

      {/* Filtros */}
      <section className="mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Cliente */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between min-w-[200px]">
                {filters.clienteId ? clientById[filters.clienteId!]?.label : "Cliente"}
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[240px]" align="start">
              <Command>
                <CommandInput placeholder="Buscar cliente..." />
                <CommandList>
                  <CommandEmpty>Nenhum cliente</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => setFilters((f) => ({ ...f, clienteId: null }))}>
                      Limpar
                    </CommandItem>
                    {clientes.map((c) => (
                      <CommandItem key={c.id} onSelect={() => setFilters((f) => ({ ...f, clienteId: c.id }))}>
                        <Check className={cn("mr-2 h-4 w-4", filters.clienteId === c.id ? "opacity-100" : "opacity-0")} />
                        {c.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Responsável */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between min-w-[200px]">
                {filters.responsavelId ? respById[filters.responsavelId!]?.label : "Responsável"}
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[240px]" align="start">
              <Command>
                <CommandInput placeholder="Buscar responsável..." />
                <CommandList>
                  <CommandEmpty>Nenhum colaborador</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => setFilters((f) => ({ ...f, responsavelId: null }))}>
                      Limpar
                    </CommandItem>
                    {responsaveis.map((r) => (
                      <CommandItem key={r.id} onSelect={() => setFilters((f) => ({ ...f, responsavelId: r.id }))}>
                        <Check className={cn("mr-2 h-4 w-4", filters.responsavelId === r.id ? "opacity-100" : "opacity-0")} />
                        {r.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Órgão/Instituição */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between min-w-[200px]">
                {filters.orgaoId ? orgaoById[filters.orgaoId!]?.label : "Órgão/Instituição"}
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[240px]" align="start">
              <Command>
                <CommandInput placeholder="Buscar órgão..." />
                <CommandList>
                  <CommandEmpty>Nenhum órgão</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => setFilters((f) => ({ ...f, orgaoId: null }))}>
                      Limpar
                    </CommandItem>
                    {orgaos.map((o) => (
                      <CommandItem key={o.id} onSelect={() => setFilters((f) => ({ ...f, orgaoId: o.id }))}>
                        <Check className={cn("mr-2 h-4 w-4", filters.orgaoId === o.id ? "opacity-100" : "opacity-0")} />
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          <div className="flex flex-col">
                            <span>{o.label}</span>
                            {o.subtitle && (
                              <span className="text-xs text-muted-foreground">{o.subtitle}</span>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Setor */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between min-w-[160px]">
                {SETORES.find((s) => s.value === filters.setor)?.label || "Setor"}
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[220px]" align="start">
              <Command>
                <CommandInput placeholder="Buscar setor..." />
                <CommandList>
                  <CommandGroup>
                    <CommandItem onSelect={() => setFilters((f) => ({ ...f, setor: null }))}>Limpar</CommandItem>
                    {SETORES.map((s) => (
                      <CommandItem key={s.value} onSelect={() => setFilters((f) => ({ ...f, setor: s.value }))}>
                        <Check className={cn("mr-2 h-4 w-4", filters.setor === s.value ? "opacity-100" : "opacity-0")} />
                        {s.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Status */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between min-w-[170px]">
                {STATUS.find((s) => s.value === filters.status)?.label || "Status"}
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[220px]" align="start">
              <Command>
                <CommandInput placeholder="Buscar status..." />
                <CommandList>
                  <CommandGroup>
                    <CommandItem onSelect={() => setFilters((f) => ({ ...f, status: null }))}>Limpar</CommandItem>
                    {STATUS.map((s) => (
                      <CommandItem key={s.value} onSelect={() => setFilters((f) => ({ ...f, status: s.value }))}>
                        <Check className={cn("mr-2 h-4 w-4", filters.status === s.value ? "opacity-100" : "opacity-0")} />
                        {s.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Prioridade */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-between min-w-[170px]">
                {PRIORIDADES.find((p) => p.value === filters.prioridade)?.label || "Prioridade"}
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[220px]" align="start">
              <Command>
                <CommandInput placeholder="Buscar prioridade..." />
                <CommandList>
                  <CommandGroup>
                    <CommandItem onSelect={() => setFilters((f) => ({ ...f, prioridade: null }))}>Limpar</CommandItem>
                    {PRIORIDADES.map((p) => (
                      <CommandItem key={p.value} onSelect={() => setFilters((f) => ({ ...f, prioridade: p.value }))}>
                        <Check className={cn("mr-2 h-4 w-4", filters.prioridade === p.value ? "opacity-100" : "opacity-0")} />
                        {p.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Período de prazo */}
          <div className="flex items-center gap-2">
            <InputMask
              mask="99/99/9999"
              value={filters.prazoDe || ""}
              onChange={(e) => setFilters((f) => ({ ...f, prazoDe: e.target.value || null }))}
            >
              {(props: any) => <Input placeholder="Prazo de" className="w-[120px]" {...props} />}
            </InputMask>
            <span className="text-muted-foreground">—</span>
            <InputMask
              mask="99/99/9999"
              value={filters.prazoAte || ""}
              onChange={(e) => setFilters((f) => ({ ...f, prazoAte: e.target.value || null }))}
            >
              {(props: any) => <Input placeholder="Prazo até" className="w-[120px]" {...props} />}
            </InputMask>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
            <Input
              placeholder="Buscar..."
              className="pl-7 w-[220px]"
              value={filters.q || ""}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Seletor de colunas */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[150px]">
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.cliente}
                  onCheckedChange={(checked) => setVisibleColumns(v => ({ ...v, cliente: checked }))}
                >
                  Cliente
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.responsavel}
                  onCheckedChange={(checked) => setVisibleColumns(v => ({ ...v, responsavel: checked }))}
                >
                  Responsável
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.setor}
                  onCheckedChange={(checked) => setVisibleColumns(v => ({ ...v, setor: checked }))}
                >
                  Setor
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.prioridade}
                  onCheckedChange={(checked) => setVisibleColumns(v => ({ ...v, prioridade: checked }))}
                >
                  Prioridade
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.status}
                  onCheckedChange={(checked) => setVisibleColumns(v => ({ ...v, status: checked }))}
                >
                  Status
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.prazo}
                  onCheckedChange={(checked) => setVisibleColumns(v => ({ ...v, prazo: checked }))}
                >
                  Prazo
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.atraso}
                  onCheckedChange={(checked) => setVisibleColumns(v => ({ ...v, atraso: checked }))}
                >
                  Atraso
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.orgao}
                  onCheckedChange={(checked) => setVisibleColumns(v => ({ ...v, orgao: checked }))}
                >
                  Órgão/Instituição
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.processo_numero}
                  onCheckedChange={(checked) => setVisibleColumns(v => ({ ...v, processo_numero: checked }))}
                >
                  Processo n.
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" onClick={() => setFilters({})}>Limpar</Button>
            <Button onClick={() => navigate("/processos/novo")}>Novo</Button>
          </div>
        </div>
      </section>

      {/* Tabela */}
      <section className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Título</TableHead>
              {visibleColumns.cliente && <TableHead>Cliente</TableHead>}
              {visibleColumns.responsavel && <TableHead>Responsável</TableHead>}
              {visibleColumns.setor && <TableHead>Setor</TableHead>}
              {visibleColumns.prioridade && <TableHead>Prioridade</TableHead>}
              {visibleColumns.status && <TableHead>Status</TableHead>}
              {visibleColumns.prazo && <TableHead>Prazo</TableHead>}
              {visibleColumns.atraso && <TableHead>Atraso</TableHead>}
              {visibleColumns.orgao && <TableHead>Órgão/Instituição</TableHead>}
              {visibleColumns.processo_numero && <TableHead>Processo n.</TableHead>}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p, idx) => {
              const num = (page - 1) * pageSize + idx + 1;
              const cli = p.cliente_id ? clientById[p.cliente_id] : undefined;
              const resp = respById[p.responsavel_id];
              const orgao = p.orgao_id ? orgaoById[p.orgao_id] : undefined;
              const prazoDate = p.prazo ? new Date(p.prazo) : null;
              const today = new Date();
              const atMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const overdue = prazoDate && isBefore(prazoDate, atMidnight) && p.status !== "concluido";
              const daysTo = prazoDate ? differenceInCalendarDays(prazoDate, atMidnight) : undefined;
              const sla = getSla(prazoDate || undefined, p.status);

              return (
                <TableRow key={p.id}>
                  <TableCell>{num}</TableCell>
                  <TableCell className="font-medium">{p.titulo}</TableCell>
                  {visibleColumns.cliente && <TableCell>{cli?.label || "—"}</TableCell>}
                  {visibleColumns.responsavel && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={resp?.avatar_url} />
                          <AvatarFallback>{resp?.label?.charAt(0) ?? "?"}</AvatarFallback>
                        </Avatar>
                        <span>{resp?.label || "—"}</span>
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.setor && <TableCell>{SETORES.find((s) => s.value === p.setor)?.label || p.setor}</TableCell>}
                  {visibleColumns.prioridade && (
                    <TableCell>
                      <Badge variant={prioridadeVariant(p.prioridade)}>
                        {PRIORIDADES.find((x) => x.value === p.prioridade)?.label || p.prioridade}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell>
                      <Badge variant={statusVariant(p.status)}>
                        {STATUS.find((x) => x.value === p.status)?.label || p.status}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.prazo && (
                    <TableCell>
                      {prazoDate ? (
                        <div className="flex items-center gap-2">
                          <Badge variant={sla.variant}>{sla.label}</Badge>
                          <span className="text-sm text-muted-foreground">{format(prazoDate, "dd/MM/yyyy")}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.atraso && (
                    <TableCell>
                      {overdue ? (
                        <Badge variant="destructive">Atrasado +{Math.abs(daysTo!)} </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                   {visibleColumns.orgao && (
                     <TableCell>
                       {orgao ? (
                         <div className="flex items-center gap-1">
                           <Building2 className="h-3 w-3 text-muted-foreground" />
                           <span className="text-sm">{orgao.label}</span>
                         </div>
                       ) : (
                         "—"
                       )}
                     </TableCell>
                   )}
                   {visibleColumns.processo_numero && (
                     <TableCell>
                       {p.processo_numero ? (
                         (() => {
                           const portalLink = orgao?.link_dinamico ? buildProcessoLink(orgao.link_dinamico, p.processo_numero) : null;
                           return portalLink ? (
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <Button
                                   variant="link"
                                   size="sm"
                                   className="h-auto p-0 font-mono text-sm"
                                   onClick={() => window.open(portalLink, '_blank', 'noopener')}
                                 >
                                   <ExternalLink className="h-3 w-3 mr-1" />
                                   {p.processo_numero}
                                 </Button>
                               </TooltipTrigger>
                               <TooltipContent>
                                 <p>Abrir no portal do órgão</p>
                               </TooltipContent>
                             </Tooltip>
                           ) : (
                             <span className="text-sm font-mono">{p.processo_numero}</span>
                           );
                         })()
                       ) : (
                         "—"
                       )}
                     </TableCell>
                   )}
                   <TableCell className="text-right">
                     <div className="flex justify-end gap-2">
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <Button size="sm" variant="ghost" onClick={() => navigate(`/processos/${p.id}`)}>
                             <Eye className="h-4 w-4" />
                           </Button>
                         </TooltipTrigger>
                         <TooltipContent>
                           <p>Visualizar processo</p>
                         </TooltipContent>
                       </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/processos/editar/${p.id}`)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Editar processo</p>
                          </TooltipContent>
                        </Tooltip>
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <Button size="sm" variant="ghost" onClick={() => changeStatus(p.id, "concluido")}>
                             <CheckCircle2 className="h-4 w-4" />
                           </Button>
                         </TooltipTrigger>
                         <TooltipContent>
                           <p>Marcar como concluído</p>
                         </TooltipContent>
                       </Tooltip>
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <Button size="sm" variant="ghost" onClick={() => changeStatus(p.id, "cancelado")}>
                             <XCircle className="h-4 w-4" />
                           </Button>
                         </TooltipTrigger>
                         <TooltipContent>
                           <p>Cancelar processo</p>
                         </TooltipContent>
                       </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                try {
                                  const { data, error } = await supabase
                                    .from("processos")
                                    .select("id,titulo,cliente_id,responsavel_id,setor,prioridade,prazo,descricao,etiquetas")
                                    .eq("id", p.id)
                                    .maybeSingle();
                                  if (error) throw error;
                                  if (!data) return toast.error("Não encontrado");
                                  setDupOriginal({
                                    id: data.id,
                                    titulo: data.titulo,
                                    cliente_id: data.cliente_id,
                                    responsavel_id: data.responsavel_id,
                                    setor: data.setor,
                                    prioridade: data.prioridade,
                                    prazo: data.prazo,
                                    descricao: (data as any).descricao || null,
                                    etiquetas: ((data as any).etiquetas as string[]) || [],
                                  });
                                  setDupOpen(true);
                                } catch (e: any) {
                                  console.error(e);
                                  toast.error(e?.message || "Falha ao preparar duplicação");
                                }
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Duplicar processo</p>
                          </TooltipContent>
                        </Tooltip>
                        {canDelete(p) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openDeleteDialog(p)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Excluir processo</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                     </div>
                   </TableCell>
                </TableRow>
              );
            })}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3 + 
                  (visibleColumns.cliente ? 1 : 0) +
                  (visibleColumns.responsavel ? 1 : 0) +
                  (visibleColumns.setor ? 1 : 0) +
                  (visibleColumns.prioridade ? 1 : 0) +
                  (visibleColumns.status ? 1 : 0) +
                  (visibleColumns.prazo ? 1 : 0) +
                  (visibleColumns.atraso ? 1 : 0) +
                  (visibleColumns.orgao ? 1 : 0) +
                  (visibleColumns.processo_numero ? 1 : 0)} className="text-center text-muted-foreground py-8">
                  Nenhum processo encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {/* Paginação */}
      <div className="mt-4">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }} />
            </PaginationItem>
            {Array.from({ length: totalPages }).slice(0, 5).map((_, i) => {
              const p = i + 1;
              return (
                <PaginationItem key={p}>
                  <PaginationLink href="#" isActive={p === page} onClick={(e) => { e.preventDefault(); setPage(p); }}>
                    {p}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      <DuplicarModal
        open={dupOpen}
        onOpenChange={setDupOpen}
        original={dupOriginal}
        onSuccess={(newId) => {
          toast.success("Processo duplicado. Abrindo...");
          window.open(`/processos/${newId}`, "_blank");
          setDupOpen(false);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Processo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o processo
              <strong> "{processoToDelete?.titulo}"</strong> e todos os seus movimentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="confirm-delete">
              Digite <strong>Excluir</strong> para confirmar:
            </Label>
            <Input
              id="confirm-delete"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Digite 'Excluir' para confirmar"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setDeleteOpen(false);
                setProcessoToDelete(null);
                setDeleteConfirmText("");
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProcess}
              disabled={deleteConfirmText !== "Excluir" || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir Processo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
    </TooltipProvider>
  );
}
