import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventClickArg, EventContentArg, EventDropArg } from "@fullcalendar/core";

import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";

import "@fullcalendar/daygrid/main.css";
import "@fullcalendar/timegrid/main.css";
import "@fullcalendar/list/main.css";

import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getSla } from "@/lib/sla";
import { Calendar as CalendarIcon, ClipboardList, GitBranch, ExternalLink, Edit, CheckCircle } from "lucide-react";
import ConcluirModal, { type ProcessoForClose, type MovimentoLite, type AnexoLite } from "@/components/processos/ConcluirModal";

// Local types (mirror of what we need)
interface Processo {
  id: string;
  titulo: string;
  cliente_id: string | null;
  responsavel_id: string;
  setor: string;
  prioridade: "baixa" | "media" | "alta" | "critica";
  status: string; // aberto | em_andamento | ... | concluido
  prazo: string | null; // yyyy-MM-dd
  created_at: string;
  descricao?: string | null;
  etiquetas?: string[];
  data_abertura?: string;
}

interface Movimento {
  id: string;
  processo_id: string;
  tipo: string;
  status_mov: string; // pendente | feito | ...
  prazo_mov: string | null; // ISO datetime
  data_mov: string;
  responsavel_id: string;
}

export type Option = { id: string; label: string; subtitle?: string; avatar_url?: string };

const PRIORIDADE_TO_CLASS: Record<string, string> = {
  baixa: "bg-secondary text-secondary-foreground",
  media: "bg-info/10 text-info-foreground border border-info/30",
  alta: "bg-warning/10 text-warning-foreground border border-warning/30",
  critica: "bg-destructive/10 text-destructive-foreground border border-destructive/30",
};

const TIPO_OPTIONS = [
  { label: "Ambos", value: "ambos" },
  { label: "Processos", value: "processos" },
  { label: "Movimentos", value: "movimentos" },
] as const;

export default function CalendarioTab({ clientes, responsaveis }: { clientes: Option[]; responsaveis: Option[] }) {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);

  const [processos, setProcessos] = useState<Processo[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);

  // Filters
  const [responsavelId, setResponsavelId] = useState<string | "">("");
  const [clienteId, setClienteId] = useState<string | "">("");
  const [setor, setSetor] = useState<string | "">("");
  const [tipo, setTipo] = useState<(typeof TIPO_OPTIONS)[number]["value"]>("ambos");
  const [status, setStatus] = useState<string | "">("");

  // For quick actions modal
  const [selected, setSelected] = useState<{ kind: "proc" | "mov"; id: string } | null>(null);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closePayload, setClosePayload] = useState<{
    proc: ProcessoForClose;
    movs: MovimentoLite[];
    anexosByMov: Record<string, AnexoLite[]>;
    checklist: { id: string; text: string; done: boolean }[];
    clientName: string | null;
    officeLogoUrl?: string | null;
  } | null>(null);

  const setores = useMemo(() => {
    const s = new Set(processos.map((p) => p.setor).filter(Boolean));
    return Array.from(s);
  }, [processos]);

  const clientById = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes]);
  const respById = useMemo(() => Object.fromEntries(responsaveis.map((r) => [r.id, r])), [responsaveis]);
  const procById = useMemo(() => Object.fromEntries(processos.map((p) => [p.id, p])), [processos]);

  async function fetchAll() {
    setLoading(true);
    try {
      // Processos (apply simple filters server-side where possible)
      let pq = supabase.from("processos").select("*").order("created_at", { ascending: false });
      if (clienteId) pq = pq.eq("cliente_id", clienteId);
      if (responsavelId) pq = pq.eq("responsavel_id", responsavelId);
      if (setor) pq = pq.eq("setor", setor as any);
      if (status) pq = pq.eq("status", status as any);
      const [{ data: pData, error: pErr }, { data: mData, error: mErr }] = await Promise.all([
        pq,
        supabase.from("movimentos").select("*").order("data_mov", { ascending: false }),
      ]);
      if (pErr) throw pErr;
      if (mErr) throw mErr;

      setProcessos((pData || []) as any);
      setMovimentos((mData || []) as any);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao carregar calendário");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // Realtime updates
    const channel = supabase
      .channel("calendario-processos-movimentos")
      .on("postgres_changes", { event: "*", schema: "public", table: "processos" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentos" }, () => fetchAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, responsavelId, setor, status]);

  const events = useMemo(() => {
    const list: any[] = [];
    const includeProc = tipo === "ambos" || tipo === "processos";
    const includeMov = tipo === "ambos" || tipo === "movimentos";

    if (includeProc) {
      processos.forEach((p) => {
        if (!p.prazo) return;
        list.push({
          id: `proc-${p.id}`,
          title: p.titulo,
          start: p.prazo,
          allDay: true,
          extendedProps: {
            kind: "proc",
            prioridade: p.prioridade,
            status: p.status,
            cliente_id: p.cliente_id,
            responsavel_id: p.responsavel_id,
            setor: p.setor,
          },
        });
      });
    }

    if (includeMov) {
      movimentos.forEach((m) => {
        if (!m.prazo_mov) return;
        const parent = procById[m.processo_id];
        list.push({
          id: `mov-${m.id}`,
          title: parent ? `${parent.titulo} • ${m.tipo}` : m.tipo,
          start: m.prazo_mov,
          allDay: true,
          extendedProps: {
            kind: "mov",
            processo_id: m.processo_id,
            prioridade: parent?.prioridade,
            status: m.status_mov,
            cliente_id: parent?.cliente_id,
            responsavel_id: m.responsavel_id,
            setor: parent?.setor,
          },
        });
      });
    }

    return list;
  }, [processos, movimentos, procById, tipo]);

  function renderEventContent(arg: EventContentArg) {
    const p = arg.event.extendedProps as any;
    const isProc = p.kind === "proc";
    const prioridadeCls = PRIORIDADE_TO_CLASS[p.prioridade || "baixa"] || PRIORIDADE_TO_CLASS.baixa;

    const prazoDate = arg.event.start ? new Date(arg.event.start) : undefined;
    const sla = isProc ? getSla(prazoDate as any, p.status) : getSla(prazoDate as any, undefined);

    const Icon = isProc ? ClipboardList : GitBranch;
    const resp = p.responsavel_id ? respById[p.responsavel_id] : undefined;
    const cliente = p.cliente_id ? clientById[p.cliente_id] : undefined;

    return (
      <div className={cn("px-2 py-1 rounded-md border text-xs", prioridadeCls)}>
        <div className="flex items-center gap-1">
          <Icon className="h-3.5 w-3.5" />
          <span className="font-medium truncate" title={arg.event.title}>{arg.event.title}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 opacity-90">
          {cliente && <span className="truncate">{cliente.label}</span>}
          {resp && <span className="truncate">{resp.label}</span>}
          {p.status && <span className="truncate uppercase">{String(p.status).split("_").join(" ")}</span>}
          {sla && <span className={cn("rounded px-1", 
            sla.variant === "destructive" && "bg-destructive text-destructive-foreground",
            sla.variant === "warning" && "bg-warning text-warning-foreground",
            sla.variant === "info" && "bg-info text-info-foreground",
            sla.variant === "success" && "bg-success text-success-foreground",
            sla.variant === "secondary" && "bg-secondary text-secondary-foreground",
          )}>{sla.label}</span>}
        </div>
      </div>
    );
  }

  const onEventClick = (clickInfo: EventClickArg) => {
    const isProc = (clickInfo.event.extendedProps as any).kind === "proc";
    const rawId = clickInfo.event.id.replace(/^(proc|mov)-/, "");
    setSelected({ kind: isProc ? "proc" : "mov", id: rawId });
  };

  const onEventDrop = async (dropInfo: EventDropArg) => {
    const isProc = (dropInfo.event.extendedProps as any).kind === "proc";
    const rawId = dropInfo.event.id.replace(/^(proc|mov)-/, "");
    const newDate = dropInfo.event.start;
    if (!newDate) return;
    const ok = window.confirm("Deseja alterar o prazo para " + newDate.toLocaleDateString() + "?");
    if (!ok) {
      dropInfo.revert();
      return;
    }
    try {
      if (isProc) {
        const d = newDate.toISOString().slice(0, 10);
        const { error } = await supabase.from("processos").update({ prazo: d }).eq("id", rawId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("movimentos").update({ prazo_mov: newDate.toISOString() }).eq("id", rawId);
        if (error) throw error;
      }
      toast.success("Prazo atualizado");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao atualizar prazo");
      dropInfo.revert();
    }
  };

  // Quick actions modal
  const [quickOpen, setQuickOpen] = useState(false);
  useEffect(() => {
    if (!selected) return;
    setQuickOpen(true);
  }, [selected]);

  const navigateTo = (id: string) => {
    window.location.assign(`/processos/${id}`);
  };

  async function openConcluirForProcess(processId: string) {
    try {
      // Load needed data for ConcluirModal
      const [{ data: procData }, { data: movsData }, { data: anexosData }, { data: checklistData }, { data: cliData }, { data: officeData }] = await Promise.all([
        supabase.from("processos").select("*").eq("id", processId).maybeSingle(),
        supabase.from("movimentos").select("id, tipo, status_mov, data_mov, prazo_mov").eq("processo_id", processId).order("data_mov", { ascending: false }),
        supabase.from("anexos").select("id, movimento_id, nome_arquivo, mime, tamanho, url"),
        supabase.from("process_checklist_items").select("id, text, done, process_id").eq("process_id", processId),
        supabase.from("clients").select("id, nome_empresarial, nome_fantasia").maybeSingle(),
        supabase.from("office").select("logomarca_url").limit(1).maybeSingle(),
      ]);

      const proc = (procData || null) as any as ProcessoForClose | null;
      if (!proc) throw new Error("Processo não encontrado");

      const movs = (movsData || []).map((m) => ({ ...m })) as unknown as MovimentoLite[];
      const anexosByMov: Record<string, AnexoLite[]> = {};
      (anexosData || []).forEach((a: any) => {
        if (!anexosByMov[a.movimento_id]) anexosByMov[a.movimento_id] = [];
        anexosByMov[a.movimento_id].push(a as AnexoLite);
      });
      const checklist = (checklistData || []).map((c: any) => ({ id: c.id, text: c.text, done: c.done }));
      const clientName = proc.cliente_id ? (clientById[proc.cliente_id]?.label || cliData?.nome_fantasia || cliData?.nome_empresarial || null) : null;

      setClosePayload({
        proc: {
          ...proc,
          etiquetas: (proc.etiquetas || []) as any,
        } as any,
        movs,
        anexosByMov,
        checklist,
        clientName,
        officeLogoUrl: (officeData as any)?.logomarca_url || null,
      });
      setCloseModalOpen(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao abrir modal de conclusão");
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" />
          <span className="text-sm font-medium">Calendário</span>
        </div>
        <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            {TIPO_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os clientes</SelectItem>
            {clientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={responsavelId} onValueChange={setResponsavelId}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os responsáveis</SelectItem>
            {responsaveis.map((r) => (<SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={setor} onValueChange={setSetor}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os setores</SelectItem>
            {setores.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="aguardando_terceiros">Aguardando Terceiros</SelectItem>
            <SelectItem value="em_revisao">Em Revisão</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Calendar */}
      <div className="rounded-md border bg-card p-2">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listWeek" }}
          initialView={isMobile ? "listWeek" : "dayGridMonth"}
          events={events}
          eventContent={renderEventContent}
          editable
          droppable={false}
          eventDrop={onEventDrop}
          selectable={false}
          height="auto"
          weekends
          dayMaxEvents={3}
        />
      </div>

      {/* Quick actions modal */}
      <Dialog open={quickOpen} onOpenChange={(o) => { setQuickOpen(o); if (!o) setSelected(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do evento</DialogTitle>
          </DialogHeader>
          {selected && (() => {
            const isProc = selected.kind === "proc";
            const p = isProc ? procById[selected.id] : procById[movimentos.find((m) => m.id === selected.id)?.processo_id || ""];
            if (!p) return <div className="text-sm">Carregando...</div>;
            const cliente = p.cliente_id ? clientById[p.cliente_id] : undefined;
            const resp = p.responsavel_id ? respById[p.responsavel_id] : undefined;
            const prazoDate = p.prazo ? new Date(p.prazo) : undefined;
            const sla = getSla(prazoDate as any, p.status);
            return (
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium">{p.titulo}</div>
                  <div className="text-xs text-muted-foreground">{cliente?.label || "—"} • {resp?.label || "—"}</div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary">{String(p.status).split("_").join(" ")}</Badge>
                  {p.prioridade && <Badge className={PRIORIDADE_TO_CLASS[p.prioridade] || ""}>{p.prioridade}</Badge>}
                  {sla && <Badge variant={sla.variant}>{sla.label}</Badge>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigateTo(p.id)}>
                    <ExternalLink className="h-4 w-4 mr-1" /> Ver
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigateTo(p.id)}>
                    <Edit className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  {isProc && p.status !== "concluido" && (
                    <Button size="sm" onClick={() => openConcluirForProcess(p.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Concluir
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Concluir processo modal */}
      {closePayload && (
        <ConcluirModal
          open={closeModalOpen}
          onOpenChange={setCloseModalOpen}
          proc={closePayload.proc}
          movs={closePayload.movs}
          anexosByMov={closePayload.anexosByMov}
          checklist={closePayload.checklist}
          clientName={closePayload.clientName}
          officeLogoUrl={closePayload.officeLogoUrl}
          onConcluded={() => { setCloseModalOpen(false); setClosePayload(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
