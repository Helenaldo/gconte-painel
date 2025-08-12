import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarIcon, Filter, KanbanSquare, Plus, Search, User } from "lucide-react";
import { format, isBefore, parse } from "date-fns";

interface ProcessoLite {
  id: string;
  titulo: string;
  responsavel_id: string;
  setor: string;
  prioridade: string;
  status: string;
  prazo: string | null;
}

interface Option { id: string; label: string; subtitle?: string }

interface Props {
  clienteId: string;
  clienteNome: string;
}

const STATUS: { label: string; value: string }[] = [
  { label: "Aberto", value: "aberto" },
  { label: "Em Andamento", value: "em_andamento" },
  { label: "Aguardando Terceiros", value: "aguardando_terceiros" },
  { label: "Em Revisão", value: "em_revisao" },
  { label: "Concluído", value: "concluido" },
  { label: "Cancelado", value: "cancelado" },
];

const PRIORIDADES = [
  { label: "Baixa", value: "baixa" },
  { label: "Média", value: "media" },
  { label: "Alta", value: "alta" },
  { label: "Crítica", value: "critica" },
];

const SETORES = [
  { label: "Contábil", value: "contabil" },
  { label: "Fiscal", value: "fiscal" },
  { label: "Pessoal", value: "pessoal" },
  { label: "Societário", value: "societario" },
  { label: "Financeiro", value: "financeiro" },
  { label: "Outro", value: "outro" },
];

export default function ClientProcessosTab({ clienteId, clienteNome }: Props) {
  const { profile } = useAuth();
  const storageKey = `cliProcFilters:${profile?.id}:${clienteId}`;

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProcessoLite[]>([]);
  const [total, setTotal] = useState(0);

  const [responsaveis, setResponsaveis] = useState<Option[]>([]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  const [prioridade, setPrioridade] = useState<string | null>(null);
  const [setor, setSetor] = useState<string | null>(null);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [prazoIni, setPrazoIni] = useState<string>("");
  const [prazoFim, setPrazoFim] = useState<string>("");

  // KPIs
  const [kpi, setKpi] = useState({ total: 0, andamento: 0, atrasados: 0, concluidos: 0 });

  // Load combos
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, email, status")
        .eq("status", "ativo")
        .order("nome", { ascending: true });
      setResponsaveis((data || []).map((p: any) => ({ id: p.id, label: p.nome, subtitle: p.email })));
    })();
  }, []);

  // Load saved filters
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const v = JSON.parse(saved);
        setQ(v.q || "");
        setStatus(v.status || []);
        setPrioridade(v.prioridade || null);
        setSetor(v.setor || null);
        setResponsavelId(v.responsavelId || null);
        setPrazoIni(v.prazoIni || "");
        setPrazoFim(v.prazoFim || "");
        setPage(v.page || 1);
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist filters
  useEffect(() => {
    const payload = { q, status, prioridade, setor, responsavelId, prazoIni, prazoFim, page };
    const id = setTimeout(() => localStorage.setItem(storageKey, JSON.stringify(payload)), 300);
    return () => clearTimeout(id);
  }, [q, status, prioridade, setor, responsavelId, prazoIni, prazoFim, page, storageKey]);

  // Fetch KPIs and table (debounced)
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        // KPI counts
        const [t1, t2, t3, t4] = await Promise.all([
          supabase.from("processos").select("*", { count: "exact", head: true }).eq("cliente_id", clienteId),
          supabase.from("processos").select("*", { count: "exact", head: true }).eq("cliente_id", clienteId).neq("status", "concluido"),
          supabase.from("processos").select("*", { count: "exact", head: true }).eq("cliente_id", clienteId).lt("prazo", format(new Date(), "yyyy-MM-dd")).neq("status", "concluido"),
          supabase.from("processos").select("*", { count: "exact", head: true }).eq("cliente_id", clienteId).eq("status", "concluido"),
        ]);
        if (!active) return;
        setKpi({ total: t1.count || 0, andamento: t2.count || 0, atrasados: t3.count || 0, concluidos: t4.count || 0 });

        // Build filtered query
        let query = supabase
          .from("processos")
          .select("id, titulo, responsavel_id, setor, prioridade, status, prazo", { count: "exact" })
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .range((page - 1) * pageSize, page * pageSize - 1);

        if (q) query = query.ilike("titulo", `%${q}%`);
        if (status.length) query = query.in("status", status as any);
        if (prioridade) query = query.eq("prioridade", prioridade as any);
        if (setor) query = query.eq("setor", setor as any);
        if (responsavelId) query = query.eq("responsavel_id", responsavelId);
        if (prazoIni) query = query.gte("prazo", format(parse(prazoIni, "dd/MM/yyyy", new Date()), "yyyy-MM-dd"));
        if (prazoFim) query = query.lte("prazo", format(parse(prazoFim, "dd/MM/yyyy", new Date()), "yyyy-MM-dd"));

        const { data, count, error } = await query;
        if (error) throw error;
        if (!active) return;
        setRows((data || []) as any);
        setTotal(count || 0);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [clienteId, q, status, prioridade, setor, responsavelId, prazoIni, prazoFim, page, pageSize]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const badgeVariant = (p: ProcessoLite) => {
    if (!p.prazo || p.status === "concluido") return "secondary" as const;
    const prazo = parse(p.prazo, "yyyy-MM-dd", new Date());
    const today = new Date();
    const atMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (isBefore(prazo, atMidnight)) return "destructive" as const;
    return "info" as const;
  };

  const onKpiClick = (type: keyof typeof kpi) => {
    // telemetry
    console.log("kpi_click", { type, from: "cliente", clienteId });
    if (type === "total") setStatus([]);
    if (type === "andamento") setStatus(["aberto", "em_andamento", "aguardando_terceiros", "em_revisao"]);
    if (type === "atrasados") { setStatus(["aberto", "em_andamento", "aguardando_terceiros", "em_revisao"]); setPrazoFim(format(new Date(), "dd/MM/yyyy")); }
    if (type === "concluidos") setStatus(["concluido"]);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Header ações */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full md:w-auto">
          <Card onClick={() => onKpiClick("total")} className="cursor-pointer">
            <CardHeader className="py-2">
              <CardTitle className="text-sm">Total</CardTitle>
            </CardHeader>
            <CardContent className="py-2 text-2xl font-semibold">{kpi.total}</CardContent>
          </Card>
          <Card onClick={() => onKpiClick("andamento")} className="cursor-pointer">
            <CardHeader className="py-2">
              <CardTitle className="text-sm">Em andamento</CardTitle>
            </CardHeader>
            <CardContent className="py-2 text-2xl font-semibold">{kpi.andamento}</CardContent>
          </Card>
          <Card onClick={() => onKpiClick("atrasados")} className="cursor-pointer">
            <CardHeader className="py-2">
              <CardTitle className="text-sm">Atrasados</CardTitle>
            </CardHeader>
            <CardContent className="py-2 text-2xl font-semibold">{kpi.atrasados}</CardContent>
          </Card>
          <Card onClick={() => onKpiClick("concluidos")} className="cursor-pointer">
            <CardHeader className="py-2">
              <CardTitle className="text-sm">Concluídos</CardTitle>
            </CardHeader>
            <CardContent className="py-2 text-2xl font-semibold">{kpi.concluidos}</CardContent>
          </Card>
        </div>
        <div className="flex gap-2 ml-4">
          <Button onClick={() => { console.log("new_process_click", { from: "cliente", clienteId }); window.open(`/processos/novo?cliente_id=${clienteId}`, "_blank"); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo Processo
          </Button>
          <Button variant="outline" onClick={() => window.open(`/processos/visao-geral?cliente_id=${clienteId}`, "_blank") }>
            <KanbanSquare className="h-4 w-4 mr-2" /> Ver Kanban
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Busca livre" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-9 w-64" />
            </div>

            {/* Status multi via quick buttons */}
            <div className="flex flex-wrap gap-1">
              {STATUS.map((s) => (
                <Button key={s.value} size="sm" variant={status.includes(s.value) ? "secondary" : "outline"}
                  onClick={() => {
                    setStatus((prev) => prev.includes(s.value) ? prev.filter((v) => v !== s.value) : [...prev, s.value]);
                    setPage(1);
                  }}>
                  {s.label}
                </Button>
              ))}
            </div>

            {/* Prioridade */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-2" /> Prioridade</Button>
              </PopoverTrigger>
              <PopoverContent className="p-0">
                <Command>
                  <CommandInput placeholder="Buscar prioridade" />
                  <CommandList>
                    <CommandEmpty>Nada</CommandEmpty>
                    <CommandGroup>
                      <CommandItem onSelect={() => setPrioridade(null)}>Limpar</CommandItem>
                      {PRIORIDADES.map((p) => (
                        <CommandItem key={p.value} onSelect={() => setPrioridade(p.value)}>{p.label}</CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Setor */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-2" /> Setor</Button>
              </PopoverTrigger>
              <PopoverContent className="p-0">
                <Command>
                  <CommandInput placeholder="Buscar setor" />
                  <CommandList>
                    <CommandEmpty>Nada</CommandEmpty>
                    <CommandGroup>
                      <CommandItem onSelect={() => setSetor(null)}>Limpar</CommandItem>
                      {SETORES.map((s) => (
                        <CommandItem key={s.value} onSelect={() => setSetor(s.value)}>{s.label}</CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Responsável */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><User className="h-4 w-4 mr-2" /> Responsável</Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-64">
                <Command>
                  <CommandInput placeholder="Buscar responsavel" />
                  <CommandList>
                    <CommandEmpty>Nenhum</CommandEmpty>
                    <CommandGroup>
                      <CommandItem onSelect={() => setResponsavelId(null)}>Limpar</CommandItem>
                      {responsaveis.map((r) => (
                        <CommandItem key={r.id} onSelect={() => setResponsavelId(r.id)}>
                          {r.label}
                          <span className="ml-auto text-xs text-muted-foreground">{r.subtitle}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Período de prazo */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Início (dd/mm/aaaa)" value={prazoIni} onChange={(e) => setPrazoIni(e.target.value)} className="pl-9 w-44" />
              </div>
              <span className="text-sm text-muted-foreground">a</span>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Fim (dd/mm/aaaa)" value={prazoFim} onChange={(e) => setPrazoFim(e.target.value)} className="pl-9 w-44" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p, idx) => (
                <TableRow key={p.id}>
                  <TableCell>{(page - 1) * pageSize + idx + 1}</TableCell>
                  <TableCell className="font-medium">{p.titulo}</TableCell>
                  <TableCell>{responsaveis.find((r) => r.id === p.responsavel_id)?.label || "—"}</TableCell>
                  <TableCell>{SETORES.find((s) => s.value === p.setor)?.label}</TableCell>
                  <TableCell>
                    <Badge variant={p.prioridade === "alta" ? "warning" : p.prioridade === "critica" ? "destructive" : p.prioridade === "media" ? "info" : "secondary"}>
                      {PRIORIDADES.find((x) => x.value === p.prioridade)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "concluido" ? "success" : p.status === "cancelado" ? "destructive" : p.status === "em_andamento" ? "info" : p.status === "aguardando_terceiros" ? "warning" : p.status === "em_revisao" ? "secondary" : "default"}>
                      {STATUS.find((x) => x.value === p.status)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.prazo ? (
                      <Badge variant={badgeVariant(p)}>
                        {(() => {
                          const d = parse(p.prazo!, "yyyy-MM-dd", new Date());
                          const diff = Math.ceil((d.getTime() - new Date().setHours(0,0,0,0)) / (1000*60*60*24));
                          return diff < 0 ? `D+${Math.abs(diff)}` : `D-${diff}`;
                        })()}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => window.open(`/processos/${p.id}`, "_blank")}>Ver</Button>
                    {/* As permissões já são garantidas pelo RLS; aqui só escondemos ações de edição para não admins/não responsáveis */}
                    {profile?.role === "administrador" || profile?.id === p.responsavel_id ? (
                      <Button size="sm" variant="secondary" onClick={async () => {
                        console.log("quick_conclude_click", { from: "cliente", clienteId, processo: p.id });
                        await supabase.from("processos").update({ status: "concluido" }).eq("id", p.id);
                        setRows((prev) => prev.map((x) => x.id === p.id ? { ...x, status: "concluido" } : x));
                      }}>Concluir</Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum processo para este cliente. <Button variant="link" className="ml-1 px-1" onClick={() => window.open(`/processos/novo?cliente_id=${clienteId}`, "_blank")}>Criar primeiro processo</Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* paginação simples */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">{total} registros</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}>Anterior</Button>
              <span className="text-sm">Página {page} de {pages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages || loading}>Próxima</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
