import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import { Pie, Bar, Line } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Download, Filter, RefreshCw, Save, Table as TableIcon, Printer, PieChart, BarChart2, LineChart } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { cn } from "@/lib/utils";

ChartJS.register(
  ArcElement,
  ChartTooltip,
  ChartLegend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler
);

const TZ = "America/Fortaleza";

type Processo = {
  id: string;
  titulo: string;
  cliente_id: string | null;
  responsavel_id: string;
  setor: string;
  prioridade: string;
  status: string;
  data_abertura: string; // iso
  prazo: string | null; // date (YYYY-MM-DD) in DB, but supabase returns string
  data_conclusao: string | null;
};

type Client = { id: string; nome_empresarial: string };
type Profile = { id: string; nome: string; avatar_url: string | null };

type DateRange = { from?: Date; to?: Date };

type Filters = {
  abertura: DateRange;
  conclusao: DateRange;
  clienteId?: string;
  responsavelId?: string;
  setor?: string;
  status: string[];
  prioridade?: string;
  tipoId?: string; // ainda não aplicado (depende de coluna)
  sla: ("no_prazo" | "d3" | "hoje" | "atrasado")[];
  vinculadoCliente: "ambos" | "sim" | "nao";
  page: number;
  pageSize: number;
  sortBy?: keyof Processo;
  sortDir?: "asc" | "desc";
};

const statusOptions = [
  { label: "Aberto", value: "aberto" },
  { label: "Em Andamento", value: "em_andamento" },
  { label: "Aguardando Terceiros", value: "aguardando_terceiros" },
  { label: "Em Revisão", value: "em_revisao" },
  { label: "Concluído", value: "concluido" },
  { label: "Cancelado", value: "cancelado" },
];

const prioridadeOptions = [
  { label: "Baixa", value: "baixa" },
  { label: "Média", value: "media" },
  { label: "Alta", value: "alta" },
  { label: "Crítica", value: "critica" },
];

const setorOptions = [
  "Contábil",
  "Fiscal",
  "Pessoal",
  "Societário",
  "Financeiro",
  "Outro",
];

const slaChips = [
  { key: "no_prazo", label: "No prazo" },
  { key: "d3", label: "D-3" },
  { key: "hoje", label: "Hoje" },
  { key: "atrasado", label: "Atrasado" },
] as const;

function zonedToday(): Date {
  return toZonedTime(new Date(), TZ);
}

function daysBetween(a: Date, b: Date) {
  return differenceInCalendarDays(a, b);
}

function formatDate(d?: Date | null) {
  if (!d) return "-";
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

function parseDbDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  // If it's a full ISO, parseISO; if it's YYYY-MM-DD, append T00:00:00Z (leave as local then toZoned?)
  try {
    if (dateStr.length > 10) return parseISO(dateStr);
    return parseISO(dateStr + "T00:00:00.000Z");
  } catch {
    return null;
  }
}

function useClientsProfiles() {
  return {
    clients: useQuery({
      queryKey: ["clients"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("clients")
          .select("id,nome_empresarial")
          .order("nome_empresarial", { ascending: true });
        if (error) throw error;
        return (data || []) as Client[];
      },
      staleTime: 5 * 60 * 1000,
    }),
    profiles: useQuery({
      queryKey: ["profiles"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("id,nome,avatar_url")
          .order("nome", { ascending: true });
        if (error) throw error;
        return (data || []) as Profile[];
      },
      staleTime: 5 * 60 * 1000,
    }),
    tipos: useQuery({
      queryKey: ["process_types"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("process_types")
          .select("id,nome,prefixo")
          .order("nome", { ascending: true });
        if (error) throw error;
        return data as { id: string; nome: string; prefixo: string | null }[];
      },
      staleTime: 5 * 60 * 1000,
    }),
  };
}

function buildQuery(base: any, f: Filters) {
  let q = base;

  // Cliente vinculado
  if (f.vinculadoCliente === "sim") q = q.not("cliente_id", "is", null);
  if (f.vinculadoCliente === "nao") q = q.is("cliente_id", null);

  if (f.clienteId) q = q.eq("cliente_id", f.clienteId);
  if (f.responsavelId) q = q.eq("responsavel_id", f.responsavelId);
  if (f.setor) q = q.eq("setor", f.setor);
  if (f.prioridade) q = q.eq("prioridade", f.prioridade);
  if (f.status.length > 0) q = q.in("status", f.status);

  // Períodos
  if (f.abertura.from) q = q.gte("data_abertura", f.abertura.from.toISOString());
  if (f.abertura.to) q = q.lte("data_abertura", new Date(f.abertura.to.getTime() + 24*60*60*1000 - 1).toISOString());
  if (f.conclusao.from) q = q.gte("data_conclusao", f.conclusao.from.toISOString());
  if (f.conclusao.to) q = q.lte("data_conclusao", new Date(f.conclusao.to.getTime() + 24*60*60*1000 - 1).toISOString());

  // Tipo (apenas se existir coluna)
  if (f.tipoId) {
    // @ts-expect-error coluna pode não existir ainda
    q = q.eq("tipo_id", f.tipoId);
  }

  // Ordenação
  if (f.sortBy) {
    q = q.order(f.sortBy as string, { ascending: f.sortDir !== "desc" });
  } else {
    q = q.order("data_abertura", { ascending: false });
  }

  return q;
}

function applySlaClientSide(rows: Processo[], f: Filters): Processo[] {
  if (!f.sla.length) return rows;
  const today = zonedToday();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return rows.filter((p) => {
    const prazo = parseDbDate(p.prazo);
    const concluido = p.status === "concluido";
    const dataConclusao = parseDbDate(p.data_conclusao);
    if (!prazo) return false;

    const diffDays = Math.ceil(
      (new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate()).getTime() - todayMid.getTime()) / (1000*60*60*24)
    );

    const isHoje = diffDays === 0;
    const isD3 = diffDays >= 1 && diffDays <= 3 && !concluido;
    const isAtrasado = concluido
      ? (dataConclusao && dataConclusao.getTime() > prazo.getTime())
      : (todayMid.getTime() > new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate()).getTime());

    const isNoPrazo = concluido
      ? (dataConclusao && prazo && dataConclusao.getTime() <= prazo.getTime())
      : (diffDays > 3);

    return (
      (f.sla.includes("hoje") && isHoje) ||
      (f.sla.includes("d3") && isD3) ||
      (f.sla.includes("atrasado") && isAtrasado) ||
      (f.sla.includes("no_prazo") && isNoPrazo)
    );
  });
}

function useProcessosData(filters: Filters) {
  // Paginated list for table
  const list = useQuery({
    queryKey: ["processos-list", filters],
    queryFn: async () => {
      const from = (filters.page - 1) * filters.pageSize;
      const to = from + filters.pageSize - 1;
      let q = buildQuery(supabase.from("processos").select("*", { count: "exact" }), filters);
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      const rows = (data || []) as Processo[];
      const filtered = applySlaClientSide(rows, filters);
      return { rows: filtered, total: count || 0 };
    },
    keepPreviousData: true,
  });

  // Aggregations: fetch a larger slice for charts (cap at 5000)
  const aggs = useQuery({
    queryKey: ["processos-aggs", { ...filters, page: 1, pageSize: 5000 }],
    queryFn: async () => {
      let q = buildQuery(supabase.from("processos").select("*", { count: "exact" }), { ...filters, page: 1, pageSize: 5000 });
      const { data, error, count } = await q.limit(5000);
      if (error) throw error;
      const rows = applySlaClientSide((data || []) as Processo[], filters);
      return { rows, total: count || rows.length };
    },
    staleTime: 5 * 60 * 1000,
  });

  return { list, aggs };
}

function kpisFrom(rows: Processo[]) {
  const today = zonedToday();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const abertos = rows.filter(r => r.status !== "concluido" && r.status !== "cancelado");
  const vencemD3 = abertos.filter(r => {
    const prazo = parseDbDate(r.prazo);
    if (!prazo) return false;
    const diffDays = Math.ceil((new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate()).getTime() - todayMid.getTime())/(1000*60*60*24));
    return diffDays >= 1 && diffDays <= 3;
  });
  const atrasados = abertos.filter(r => {
    const prazo = parseDbDate(r.prazo);
    if (!prazo) return false;
    return todayMid.getTime() > new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate()).getTime();
  });
  const concluidos = rows.filter(r => r.status === "concluido");
  const leadTimes = concluidos.map(r => {
    const a = parseISO(r.data_abertura);
    const c = parseDbDate(r.data_conclusao);
    if (!c) return 0;
    return Math.max(0, daysBetween(c, a));
  });
  const leadTimeMedio = leadTimes.length ? Math.round(leadTimes.reduce((s,n)=>s+n,0)/leadTimes.length) : 0;

  const concluidosNoPrazo = concluidos.filter(r => {
    const c = parseDbDate(r.data_conclusao);
    const p = parseDbDate(r.prazo);
    if (!c || !p) return false;
    return c.getTime() <= p.getTime();
  });
  const pctConcluidosNoPrazo = concluidos.length ? Math.round((concluidosNoPrazo.length / concluidos.length) * 100) : 0;

  const thirtyAgo = new Date(todayMid.getTime() - 29*24*60*60*1000);
  const throughput30 = concluidos.filter(r => {
    const c = parseDbDate(r.data_conclusao);
    return !!c && c >= thirtyAgo && c <= todayMid;
  }).length;

  return { abertos: abertos.length, vencemD3: vencemD3.length, atrasados: atrasados.length, leadTimeMedio, pctConcluidosNoPrazo, throughput30 };
}

function groupBy<T extends Record<string, any>>(rows: T[], key: (r:T)=>string) {
  return rows.reduce<Record<string, T[]>>((acc, r) => {
    const k = key(r) || "-";
    acc[k] = acc[k] || [];
    acc[k].push(r);
    return acc;
  }, {});
}

function RelatoriosProcessos() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [filters, setFilters] = useState<Filters>({
    abertura: { from: undefined, to: undefined },
    conclusao: { from: undefined, to: undefined },
    clienteId: undefined,
    responsavelId: undefined,
    setor: undefined,
    status: ["aberto", "em_andamento"],
    prioridade: undefined,
    tipoId: undefined,
    sla: [],
    vinculadoCliente: "ambos",
    page: 1,
    pageSize: 20,
    sortBy: "data_abertura",
    sortDir: "desc",
  });

  // Load/save preset per user
  const presetKey = `relatorios_processos_preset_${profile?.id || 'anon'}`;
  useEffect(() => {
    const raw = localStorage.getItem(presetKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setFilters((f) => ({ ...f, ...parsed, page: 1 }));
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { clients, profiles, tipos } = useClientsProfiles();
  const { list, aggs } = useProcessosData(filters);

  useEffect(() => {
    document.title = "Relatórios de Processos | GConTE";
  }, []);

  useEffect(() => {
    if ((aggs.data?.total || 0) > 50000) {
      toast({ title: "Muitos dados", description: "Mais de 50k linhas. Refine os filtros para visualizar a tabela completa. Exporte apenas agregados se necessário." });
    }
  }, [aggs.data?.total, toast]);

  const kpi = useMemo(() => kpisFrom(aggs.data?.rows || []), [aggs.data?.rows]);

  const clientsMap = useMemo(() => new Map((clients.data||[]).map(c => [c.id, c.nome_empresarial])), [clients.data]);
  const profilesMap = useMemo(() => new Map((profiles.data||[]).map(p => [p.id, p])), [profiles.data]);

  // Charts data
  const statusCounts = useMemo(() => {
    const grouped = groupBy(aggs.data?.rows || [], r => r.status);
    const labels = statusOptions.map(s => s.label);
    const mapLabelToValue = (label: string) => statusOptions.find(s => s.label===label)?.value;
    const dataArr = labels.map(lbl => grouped[mapLabelToValue(lbl) || ""]?.length || 0);
    return { labels, data: dataArr };
  }, [aggs.data?.rows]);

  const prioridadeStatus = useMemo(() => {
    const prioridades = prioridadeOptions.map(p => p.value);
    const statuses = statusOptions.map(s => s.value);
    const matrix = prioridades.map(() => statuses.map(()=>0));
    (aggs.data?.rows||[]).forEach(r => {
      const pi = prioridades.indexOf(r.prioridade);
      const si = statuses.indexOf(r.status);
      if (pi>=0 && si>=0) matrix[pi][si]++;
    });
    return { prioridades: prioridadeOptions.map(p=>p.label), statuses: statusOptions.map(s=>s.label), matrix };
  }, [aggs.data?.rows]);

  const leadTimePorMes = useMemo(() => {
    const map: Record<string, number[]> = {};
    (aggs.data?.rows||[]).forEach(r => {
      if (r.status !== "concluido") return;
      const a = parseISO(r.data_abertura);
      const c = parseDbDate(r.data_conclusao);
      if (!c) return;
      const key = format(c, "yyyy-MM");
      const dur = Math.max(0, daysBetween(c, a));
      map[key] = map[key] || [];
      map[key].push(dur);
    });
    const labels = Object.keys(map).sort();
    const values = labels.map(k => {
      const arr = map[k];
      return Math.round(arr.reduce((s,n)=>s+n,0)/arr.length);
    });
    return { labels, values };
  }, [aggs.data?.rows]);

  const tableRows = list.data?.rows || [];
  const total = list.data?.total || 0;

  const applyFilters = () => setFilters(f => ({ ...f, page: 1 }));
  const resetFilters = () => setFilters({
    abertura: { from: undefined, to: undefined },
    conclusao: { from: undefined, to: undefined },
    clienteId: undefined,
    responsavelId: undefined,
    setor: undefined,
    status: [],
    prioridade: undefined,
    tipoId: undefined,
    sla: [],
    vinculadoCliente: "ambos",
    page: 1,
    pageSize: 20,
    sortBy: "data_abertura",
    sortDir: "desc",
  });
  const savePreset = () => {
    localStorage.setItem(presetKey, JSON.stringify({ ...filters, page: 1 }));
    toast({ title: "Predefinição salva" });
  };

  const exportCSV = () => {
    const header = ["ID","Título","Cliente","Responsável","Setor","Tipo","Prioridade","Status","Data abertura","Prazo","Data conclusão","Duração (dias)","Atraso (dias)","No prazo?"];
    const rows = (aggs.data?.rows||[]).map(r => {
      const cliente = clientsMap.get(r.cliente_id || "") || "-";
      const resp = profilesMap.get(r.responsavel_id)?.nome || r.responsavel_id;
      const a = parseISO(r.data_abertura);
      const p = parseDbDate(r.prazo);
      const c = parseDbDate(r.data_conclusao);
      const today = zonedToday();
      const dur = c ? Math.max(0, daysBetween(c,a)) : Math.max(0, daysBetween(today,a));
      const atraso = c && p ? Math.max(0, daysBetween(c, p)) : (p ? Math.max(0, daysBetween(today, p)) : 0);
      const onTime = c && p ? c.getTime() <= p.getTime() : false;
      return [
        r.id,
        r.titulo,
        cliente,
        resp,
        r.setor,
        "-",
        r.prioridade,
        r.status,
        format(a, "yyyy-MM-dd"),
        p ? format(p, "yyyy-MM-dd") : "",
        c ? format(c, "yyyy-MM-dd") : "",
        String(dur),
        String(atraso),
        onTime ? "S" : "N",
      ];
    });
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const aEl = document.createElement("a");
    aEl.href = url;
    aEl.download = `relatorios-processos_${format(new Date(),"yyyy-MM-dd_HH-mm")}.csv`;
    aEl.click();
    URL.revokeObjectURL(url);
  };

  const exportXLSX = () => {
    const data = (aggs.data?.rows||[]).map(r => {
      const cliente = clientsMap.get(r.cliente_id || "") || "-";
      const resp = profilesMap.get(r.responsavel_id)?.nome || r.responsavel_id;
      const a = parseISO(r.data_abertura);
      const p = parseDbDate(r.prazo);
      const c = parseDbDate(r.data_conclusao);
      const today = zonedToday();
      const dur = c ? Math.max(0, daysBetween(c,a)) : Math.max(0, daysBetween(today,a));
      const atraso = c && p ? Math.max(0, daysBetween(c, p)) : (p ? Math.max(0, daysBetween(today, p)) : 0);
      const onTime = c && p ? c.getTime() <= p.getTime() : false;
      return {
        ID: r.id,
        Título: r.titulo,
        Cliente: cliente,
        Responsável: resp,
        Setor: r.setor,
        Tipo: "-",
        Prioridade: r.prioridade,
        Status: r.status,
        "Data abertura": format(a, "yyyy-MM-dd"),
        Prazo: p ? format(p, "yyyy-MM-dd") : "",
        "Data conclusão": c ? format(c, "yyyy-MM-dd") : "",
        "Duração (dias)": dur,
        "Atraso (dias)": atraso,
        "No prazo?": onTime ? "S" : "N",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `relatorios-processos_${format(new Date(),"yyyy-MM-dd_HH-mm")}.xlsx`);
  };

  const exportPDF = async () => {
    const el = document.getElementById("report-root");
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: getComputedStyle(document.body).getPropertyValue('--background') || '#fff' });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 40;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.setFontSize(14);
    pdf.text(`Relatório Gerencial de Processos - ${format(new Date(), "yyyy-MM-dd HH:mm")}`, 20, 24);
    pdf.addImage(imgData, "PNG", 20, 40, imgWidth, Math.min(imgHeight, pageHeight-60));
    pdf.save(`relatorios-processos_${format(new Date(),"yyyy-MM-dd_HH-mm")}.pdf`);
  };

  const resultsLabel = `${total.toLocaleString()} resultados`;

  return (
    <div id="report-root" className="space-y-6">
      {/* SEO basic */}
      <header className="sr-only">
        <h1>Relatórios de Processos</h1>
        <link rel="canonical" href="/processos/relatorios" />
        <meta name="description" content="Relatórios gerenciais de processos: KPIs, gráficos e tabela com exportações." />
      </header>

      {/* A) Filtros */}
      <Card className="shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Período abertura - de */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  {filters.abertura.from ? `Abertura de: ${formatDate(filters.abertura.from)}` : "Abertura de"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.abertura.from}
                  onSelect={(d)=>setFilters(f=>({ ...f, abertura: { ...f.abertura, from: d||undefined } }))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {/* Período abertura - até */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  {filters.abertura.to ? `Abertura até: ${formatDate(filters.abertura.to)}` : "Abertura até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.abertura.to}
                  onSelect={(d)=>setFilters(f=>({ ...f, abertura: { ...f.abertura, to: d||undefined } }))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {/* Conclusão de */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  {filters.conclusao.from ? `Conclusão de: ${formatDate(filters.conclusao.from)}` : "Conclusão de"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.conclusao.from}
                  onSelect={(d)=>setFilters(f=>({ ...f, conclusao: { ...f.conclusao, from: d||undefined } }))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {/* Conclusão até */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  {filters.conclusao.to ? `Conclusão até: ${formatDate(filters.conclusao.to)}` : "Conclusão até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.conclusao.to}
                  onSelect={(d)=>setFilters(f=>({ ...f, conclusao: { ...f.conclusao, to: d||undefined } }))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            {/* Cliente autocomplete */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  {filters.clienteId ? (clientsMap.get(filters.clienteId) || "Cliente") : "Cliente"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandEmpty>Nenhum cliente.</CommandEmpty>
                  <CommandGroup>
                    {(clients.data||[]).map(c => (
                      <CommandItem key={c.id} onSelect={()=>setFilters(f=>({ ...f, clienteId: c.id }))}>
                        {c.nome_empresarial}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Responsável autocomplete com avatar */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  {filters.responsavelId ? (profilesMap.get(filters.responsavelId)?.nome || "Responsável") : "Responsável"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar responsável..." />
                  <CommandEmpty>Nenhum colaborador.</CommandEmpty>
                  <CommandGroup>
                    {(profiles.data||[]).map(p => (
                      <CommandItem key={p.id} onSelect={()=>setFilters(f=>({ ...f, responsavelId: p.id }))}>
                        <Avatar className="h-5 w-5 mr-2">
                          <AvatarImage src={p.avatar_url || undefined} />
                          <AvatarFallback>{p.nome?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        {p.nome}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Setor */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  {filters.setor || "Setor"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="grid grid-cols-1 gap-1">
                  {setorOptions.map(s => (
                    <Button key={s} variant={filters.setor===s?"secondary":"ghost"} onClick={()=>setFilters(f=>({ ...f, setor: s }))}>
                      {s}
                    </Button>
                  ))}
                  <Button variant="ghost" onClick={()=>setFilters(f=>({ ...f, setor: undefined }))}>Limpar</Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Status multi */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  {filters.status.length ? `${filters.status.length} status` : "Status"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-1">
                  {statusOptions.map(s => {
                    const active = filters.status.includes(s.value);
                    return (
                      <Button key={s.value} variant={active?"secondary":"ghost"} className="w-full justify-start"
                        onClick={()=>setFilters(f=>({ ...f, status: active ? f.status.filter(v=>v!==s.value) : [...f.status, s.value] }))}
                      >{s.label}</Button>
                    );
                  })}
                  <Button variant="ghost" onClick={()=>setFilters(f=>({ ...f, status: [] }))}>Limpar</Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Prioridade */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  {prioridadeOptions.find(p=>p.value===filters.prioridade)?.label || "Prioridade"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="space-y-1">
                  {prioridadeOptions.map(p => (
                    <Button key={p.value} variant={filters.prioridade===p.value?"secondary":"ghost"} className="w-full justify-start"
                      onClick={()=>setFilters(f=>({ ...f, prioridade: p.value }))}>{p.label}</Button>
                  ))}
                  <Button variant="ghost" onClick={()=>setFilters(f=>({ ...f, prioridade: undefined }))}>Limpar</Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Tipo de processo (se disponível) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  {filters.tipoId ? (tipos.data?.find(t=>t.id===filters.tipoId)?.nome || "Tipo") : "Tipo de processo"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar tipo..." />
                  <CommandEmpty>Nenhum tipo.</CommandEmpty>
                  <CommandGroup>
                    {(tipos.data||[]).map(t => (
                      <CommandItem key={t.id} onSelect={()=>setFilters(f=>({ ...f, tipoId: t.id }))}>{t.nome}</CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>

            {/* SLA chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {slaChips.map(c => {
                const active = filters.sla.includes(c.key);
                return (
                  <Badge key={c.key} variant={active?"success":"secondary"} onClick={()=>setFilters(f=>({ ...f, sla: active ? f.sla.filter(k=>k!==c.key) : [...f.sla, c.key] }))} className="cursor-pointer select-none">
                    {c.label}
                  </Badge>
                );
              })}
            </div>

            {/* Vinculado a cliente */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  {filters.vinculadoCliente === 'ambos' ? 'Vinculado a cliente? (Ambos)' : filters.vinculadoCliente === 'sim' ? 'Vinculado: Sim' : 'Vinculado: Não'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="space-y-1">
                  {(["ambos","sim","nao"] as const).map(v => (
                    <Button key={v} variant={filters.vinculadoCliente===v?"secondary":"ghost"} className="w-full justify-start"
                      onClick={()=>setFilters(f=>({ ...f, vinculadoCliente: v }))}>{v==='ambos'? 'Ambos' : v==='sim' ? 'Sim' : 'Não'}</Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button onClick={applyFilters}><RefreshCw className="h-4 w-4 mr-2"/>Aplicar</Button>
            <Button variant="secondary" onClick={resetFilters}><Filter className="h-4 w-4 mr-2"/>Limpar</Button>
            <Button variant="outline" onClick={savePreset}><Save className="h-4 w-4 mr-2"/>Salvar predefinição</Button>
            <div className="ml-auto text-sm text-muted-foreground">{resultsLabel}</div>
          </div>
        </CardContent>
      </Card>

      {/* B1) KPIs */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4">
          <Card className="shadow-md hover:shadow-lg transition" onClick={()=>setFilters(f=>({ ...f, status: ["aberto","em_andamento"], page:1 }))}>
            <CardHeader className="pb-2"><CardTitle className="text-base">Processos em aberto</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{aggs.isLoading ? <Skeleton className="h-8 w-24"/> : kpi.abertos}</CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition" onClick={()=>setFilters(f=>({ ...f, sla: Array.from(new Set([...(f.sla||[]), 'd3'] as const)), page:1 }))}>
            <CardHeader className="pb-2"><CardTitle className="text-base">Vencem em até D-3 <Badge variant="warning" className="ml-2">Âmbar</Badge></CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{aggs.isLoading ? <Skeleton className="h-8 w-24"/> : kpi.vencemD3}</CardContent>
          </Card>
          <Card className="shadow-md hover:shadow-lg transition" onClick={()=>setFilters(f=>({ ...f, sla: Array.from(new Set([...(f.sla||[]), 'atrasado'] as const)), page:1 }))}>
            <CardHeader className="pb-2"><CardTitle className="text-base">Atrasados <Badge variant="destructive" className="ml-2">Crítico</Badge></CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{aggs.isLoading ? <Skeleton className="h-8 w-24"/> : kpi.atrasados}</CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-4 mt-4">
          <Card className="shadow-md">
            <CardHeader className="pb-2"><CardTitle className="text-base">Lead time médio (dias)</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{aggs.isLoading ? <Skeleton className="h-8 w-24"/> : kpi.leadTimeMedio}</CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader className="pb-2"><CardTitle className="text-base">% Concluídos no prazo</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{aggs.isLoading ? <Skeleton className="h-8 w-24"/> : `${kpi.pctConcluidosNoPrazo}%`}</CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader className="pb-2"><CardTitle className="text-base">Throughput (30 dias)</CardTitle></CardHeader>
            <CardContent className="text-3xl font-bold">{aggs.isLoading ? <Skeleton className="h-8 w-24"/> : kpi.throughput30}</CardContent>
          </Card>
        </div>
      </section>

      {/* B2) Gráficos */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Pizza */}
        <Card className="shadow-md">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><PieChart className="h-4 w-4"/>Processos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {aggs.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <Pie
                data={{
                  labels: statusCounts.labels,
                  datasets: [{
                    label: "Processos",
                    data: statusCounts.data,
                  }],
                }}
                options={{
                  plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.parsed} (${((ctx.parsed / (statusCounts.data.reduce((s,n)=>s+n,0) || 1)) * 100).toFixed(1)}%)`,
                      },
                    },
                  },
                  onClick: (_, elements) => {
                    if (elements.length) {
                      const idx = elements[0].index;
                      const value = statusOptions[idx]?.value;
                      if (value) setFilters(f => ({ ...f, status: [value], page: 1 }));
                    }
                  },
                  maintainAspectRatio: false,
                }}
                height={260}
              />
            )}
          </CardContent>
        </Card>

        {/* Barras empilhadas */}
        <Card className="shadow-md xl:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart2 className="h-4 w-4"/>Prioridade × Status</CardTitle></CardHeader>
          <CardContent>
            {aggs.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <Bar
                data={{
                  labels: prioridadeStatus.prioridades,
                  datasets: prioridadeStatus.statuses.map((sLbl, idx) => ({
                    label: sLbl,
                    data: prioridadeStatus.matrix.map(row => row[idx]),
                    stack: "stack1",
                  })),
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { position: "bottom" } },
                  scales: {
                    x: { stacked: true },
                    y: { stacked: true },
                  },
                  maintainAspectRatio: false,
                }}
                height={260}
              />
            )}
          </CardContent>
        </Card>

        {/* Linha Lead time por mês */}
        <Card className="shadow-md xl:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><LineChart className="h-4 w-4"/>Lead time por mês</CardTitle></CardHeader>
          <CardContent>
            {aggs.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <Line
                data={{
                  labels: leadTimePorMes.labels,
                  datasets: [{
                    label: "Lead time médio (dias)",
                    data: leadTimePorMes.values,
                    fill: true,
                  }],
                }}
                options={{
                  plugins: { legend: { position: "bottom" } },
                  maintainAspectRatio: false,
                }}
                height={260}
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* B3) Tabela analítica */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2"/>CSV</Button>
          <Button variant="outline" onClick={exportXLSX}><Download className="h-4 w-4 mr-2"/>XLSX</Button>
          <Button variant="outline" onClick={exportPDF}><Printer className="h-4 w-4 mr-2"/>Imprimir</Button>
        </div>
        <Card className="shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TableIcon className="h-4 w-4"/>Tabela analítica</CardTitle></CardHeader>
          <CardContent>
            {list.isLoading ? (
              <>
                <Skeleton className="h-8 w-full mb-2"/>
                <Skeleton className="h-8 w-full mb-2"/>
                <Skeleton className="h-8 w-full"/>
              </>
            ) : tableRows.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Sem dados para os filtros atuais.</p>
                <Button variant="secondary" className="mt-2" onClick={resetFilters}>Ajustar filtros</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data abertura</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Data conclusão</TableHead>
                      <TableHead>Duração (dias)</TableHead>
                      <TableHead>Atraso (dias)</TableHead>
                      <TableHead>No prazo?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map(r => {
                      const cliente = clientsMap.get(r.cliente_id || "") || "-";
                      const resp = profilesMap.get(r.responsavel_id);
                      const a = parseISO(r.data_abertura);
                      const p = parseDbDate(r.prazo);
                      const c = parseDbDate(r.data_conclusao);
                      const today = zonedToday();
                      const dur = c ? Math.max(0, daysBetween(c,a)) : Math.max(0, daysBetween(today,a));
                      const atraso = c && p ? Math.max(0, daysBetween(c, p)) : (p ? Math.max(0, daysBetween(today, p)) : 0);
                      const onTime = c && p ? c.getTime() <= p.getTime() : false;
                      return (
                        <TableRow key={r.id} className="hover:bg-muted/40">
                          <TableCell className="font-mono text-xs">{r.id.slice(0,8)}</TableCell>
                          <TableCell className="max-w-[280px] truncate">{r.titulo}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{cliente}</TableCell>
                          <TableCell className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={resp?.avatar_url || undefined} />
                              <AvatarFallback>{resp?.nome?.[0] || "?"}</AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[160px]">{resp?.nome || r.responsavel_id}</span>
                          </TableCell>
                          <TableCell>{r.setor}</TableCell>
                          <TableCell><Badge variant="secondary">{r.prioridade}</Badge></TableCell>
                          <TableCell><Badge>{r.status}</Badge></TableCell>
                          <TableCell>{format(a, "dd/MM/yyyy")}</TableCell>
                          <TableCell>{p ? format(p, "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>{c ? format(c, "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>{dur}</TableCell>
                          <TableCell>{atraso}</TableCell>
                          <TableCell>{onTime ? "S" : "N"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">Página {filters.page}</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={filters.page===1} onClick={()=>setFilters(f=>({ ...f, page: Math.max(1, f.page-1) }))}>Anterior</Button>
                <Button variant="outline" disabled={(filters.page*filters.pageSize) >= total} onClick={()=>setFilters(f=>({ ...f, page: f.page+1 }))}>Próxima</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default RelatoriosProcessos;
