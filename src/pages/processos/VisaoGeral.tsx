import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { format, differenceInCalendarDays, isBefore } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Processo {
  id: string;
  titulo: string;
  cliente_id: string | null;
  responsavel_id: string;
  setor: string;
  prioridade: string;
  status: string;
  prazo: string | null; // ISO date
  created_at: string;
}

interface Option { id: string; label: string; subtitle?: string; avatar_url?: string }

const STATUS = [
  { label: "Aberto", value: "aberto" },
  { label: "Em Andamento", value: "em_andamento" },
  { label: "Aguardando Terceiros", value: "aguardando_terceiros" },
  { label: "Em Revisão", value: "em_revisao" },
  { label: "Concluído", value: "concluido" },
  { label: "Cancelado", value: "cancelado" },
] as const;

type Status = typeof STATUS[number]["value"];

const PRIORIDADES = [
  { label: "Baixa", value: "baixa" },
  { label: "Média", value: "media" },
  { label: "Alta", value: "alta" },
  { label: "Crítica", value: "critica" },
] as const;

type Prioridade = typeof PRIORIDADES[number]["value"];

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

function prazoBadgeVariant(prazo?: Date | null, status?: string) {
  if (!prazo) return "secondary" as const;
  const today = new Date();
  const atMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (status === "concluido") return "secondary" as const;
  if (isBefore(prazo, atMidnight)) return "destructive" as const;
  if (differenceInCalendarDays(prazo, atMidnight) === 0) return "warning" as const;
  return "info" as const;
}

export default function VisaoGeral() {
  const { profile } = useAuth();

  const [clientes, setClientes] = useState<Option[]>([]);
  const [responsaveis, setResponsaveis] = useState<Option[]>([]);
  const [columns, setColumns] = useState<Record<Status, Processo[]>>({
    aberto: [],
    em_andamento: [],
    aguardando_terceiros: [],
    em_revisao: [],
    concluido: [],
    cancelado: [],
  });
  const [loading, setLoading] = useState(true);

  const clientById = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes]);
  const respById = useMemo(() => Object.fromEntries(responsaveis.map((r) => [r.id, r])), [responsaveis]);

  useEffect(() => {
    document.title = "Processos | Visão geral";
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{ data: cli }, { data: prof }] = await Promise.all([
          supabase.from("clients").select("id, nome_empresarial, nome_fantasia").order("nome_empresarial", { ascending: true }),
          supabase.from("profiles").select("id, nome, email, avatar_url, status").eq("status", "ativo").order("nome", { ascending: true }),
        ]);
        if (!active) return;
        setClientes((cli ?? []).map((c) => ({ id: c.id as string, label: (c.nome_fantasia || c.nome_empresarial) as string })));
        setResponsaveis((prof ?? []).map((p) => ({ id: p.id as string, label: p.nome as string, subtitle: p.email as string, avatar_url: p.avatar_url as string | undefined })));
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { active = false };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from("processos").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        if (!active) return;
        const grouped: Record<Status, Processo[]> = {
          aberto: [], em_andamento: [], aguardando_terceiros: [], em_revisao: [], concluido: [], cancelado: []
        };
        (data as any as Processo[]).forEach((p) => {
          const st = (p.status as Status) || "aberto";
          if (!grouped[st]) grouped[st] = [] as any;
          grouped[st].push(p);
        });
        setColumns(grouped);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Erro ao carregar processos");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false };
  }, []);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    const srcCol = source.droppableId as Status;
    const dstCol = destination.droppableId as Status;
    if (srcCol === dstCol && source.index === destination.index) return;

    // optimistic update
    const srcItems = Array.from(columns[srcCol]);
    const dstItems = Array.from(columns[dstCol]);
    const [moved] = srcItems.splice(source.index, 1);
    const updated: Processo = { ...moved, status: dstCol };
    dstItems.splice(destination.index, 0, updated);

    setColumns((prev) => ({ ...prev, [srcCol]: srcItems, [dstCol]: dstItems }));

    try {
      const { error } = await supabase.from("processos").update({ status: dstCol }).eq("id", draggableId);
      if (error) throw error;
      toast.success("Status atualizado");
    } catch (e: any) {
      // revert
      setColumns((prev) => {
        const curDst = Array.from(prev[dstCol]);
        const idx = curDst.findIndex((x) => x.id === draggableId);
        if (idx >= 0) curDst.splice(idx, 1);
        const curSrc = Array.from(prev[srcCol]);
        curSrc.splice(source.index, 0, moved);
        return { ...prev, [srcCol]: curSrc, [dstCol]: curDst };
      });
      console.error(e);
      toast.error(e?.message || "Falha ao mover card");
    }
  };

  return (
    <main className="p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Visão geral</h1>
        <Button onClick={() => location.assign("/processos/novo")}>Novo</Button>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {STATUS.map(({ label, value }) => {
            const items = columns[value];
            return (
              <Droppable droppableId={value} key={value}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "rounded-md border bg-card p-3 flex flex-col min-h-[200px]",
                      snapshot.isDraggingOver && "ring-2 ring-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-medium">{label}</h2>
                      <Badge variant="secondary">{items?.length || 0}</Badge>
                    </div>
                    <div className="space-y-2">
                      {items?.map((p, idx) => (
                        <Draggable draggableId={p.id} index={idx} key={p.id}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={cn(
                                "rounded-md border bg-background p-3 shadow-sm",
                                dragSnapshot.isDragging && "shadow-md"
                              )}
                            >
                              <div className="text-sm font-medium line-clamp-2">{p.titulo}</div>
                              <div className="text-xs text-muted-foreground">{p.cliente_id ? clientById[p.cliente_id]?.label : "—"}</div>
                              <div className="flex items-center gap-2 mt-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={respById[p.responsavel_id]?.avatar_url} alt={respById[p.responsavel_id]?.label} />
                                  <AvatarFallback>{respById[p.responsavel_id]?.label?.charAt(0) ?? "?"}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs">{respById[p.responsavel_id]?.label || "—"}</span>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <Badge variant={prioridadeVariant(p.prioridade)}>
                                  {PRIORIDADES.find((x) => x.value === p.prioridade)?.label || p.prioridade}
                                </Badge>
                                <PrazoBadge status={p.status as Status} dateISO={p.prazo} />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </section>
      </DragDropContext>
    </main>
  );
}

function PrazoBadge({ dateISO, status }: { dateISO: string | null; status: Status }) {
  if (!dateISO) return <Badge variant="secondary">-</Badge>;
  const d = new Date(dateISO);
  const today = new Date();
  const atMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysTo = differenceInCalendarDays(d, atMidnight);
  const dLabel = daysTo < 0 ? `D+${Math.abs(daysTo)}` : `D-${daysTo}`;
  return (
    <Badge variant={prazoBadgeVariant(d, status)}>{dLabel}</Badge>
  );
}
