import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { format, isBefore, differenceInCalendarDays, parseISO } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { getSla } from "@/lib/sla";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

import {
  Calendar as CalendarIcon,
  FileText,
  Send,
  Reply,
  AlertCircle,
  Upload as UploadIcon,
  StickyNote,
  BadgeCheck,
  X,
  Edit3,
  CheckCircle2,
  Plus,
  Paperclip,
  Download,
  MoreVertical,
  ChevronsUpDown,
  Check,
  Trash2,
} from "lucide-react";

// Mapeamentos
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

const SETORES = [
  { label: "Contábil", value: "contabil" },
  { label: "Fiscal", value: "fiscal" },
  { label: "Pessoal", value: "pessoal" },
  { label: "Societário", value: "societario" },
  { label: "Financeiro", value: "financeiro" },
  { label: "Outro", value: "outro" },
] as const;

type Setor = typeof SETORES[number]["value"];

type StatusMov = "pendente" | "feito" | "cancelado";

type MovTipo = "anotacao" | "protocolo" | "solicitacao" | "retorno_orgao" | "exigencia" | "envio_cliente" | "upload";

function prioridadeVariant(v?: string) {
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

function statusVariant(v?: string) {
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

function prazoBadgeVariant(prazo?: Date | null, status?: string) {
  if (!prazo) return "secondary" as const;
  const today = new Date();
  const atMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (status === "concluido") return "secondary" as const;
  if (isBefore(prazo, atMidnight)) return "destructive" as const;
  if (differenceInCalendarDays(prazo, atMidnight) === 0) return "warning" as const;
  return "info" as const;
}

function tipoIcon(tipo?: string) {
  switch (tipo) {
    case "anotacao":
      return <StickyNote className="h-4 w-4" />;
    case "protocolo":
      return <FileText className="h-4 w-4" />;
    case "solicitacao":
      return <Send className="h-4 w-4" />;
    case "retorno_orgao":
      return <Reply className="h-4 w-4" />;
    case "exigencia":
      return <AlertCircle className="h-4 w-4" />;
    case "envio_cliente":
      return <Send className="h-4 w-4" />;
    case "upload":
      return <UploadIcon className="h-4 w-4" />;
    default:
      return <Paperclip className="h-4 w-4" />;
  }
}

interface Processo {
  id: string;
  titulo: string;
  cliente_id: string | null;
  responsavel_id: string;
  setor: Setor;
  prioridade: Prioridade;
  status: Status;
  prazo: string | null; // date
  descricao: string | null;
  etiquetas: string[];
  created_at: string;
  updated_at: string;
}

interface Movimento {
  id: string;
  processo_id: string;
  tipo: string;
  descricao: string | null;
  responsavel_id: string;
  data_mov: string; // ts
  prazo_mov: string | null; // ts
  status_mov: StatusMov;
}

interface Anexo { id: string; movimento_id: string; nome_arquivo: string; mime: string; tamanho: number; url: string }

interface Profile { id: string; nome: string; email: string; avatar_url?: string }
interface Client { id: string; nome_empresarial: string; nome_fantasia: string | null }

type Option = { id: string; label: string; subtitle?: string; avatar_url?: string };

export default function ProcessoDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [proc, setProc] = useState<Processo | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [allProfiles, setAllProfiles] = useState<Option[]>([]);
  const [movs, setMovs] = useState<Movimento[]>([]);
  const [anexosByMov, setAnexosByMov] = useState<Record<string, Anexo[]>>({});
  const [loading, setLoading] = useState(true);

  // Checklist (local)
  const [checklist, setChecklist] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [newItem, setNewItem] = useState("");

  // Etiquetas edição
  const [tagInput, setTagInput] = useState("");
  const etiquetas = proc?.etiquetas || [];

  // Movimentos modal (create/edit)
  const [openMov, setOpenMov] = useState(false);
  const [editingMov, setEditingMov] = useState<Movimento | null>(null);

  // Upload state
  const [dropActive, setDropActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);

  const movForm = useForm<{ tipo: string; descricao: string; prazo_mov?: string | null; responsavel_id: string; status_mov: StatusMov }>();

  useEffect(() => {
    document.title = `Detalhes do Processo | ${id}`;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        // Processo
        const { data: p, error: e1 } = await supabase.from("processos").select("*").eq("id", id).maybeSingle();
        if (e1) throw e1;
        if (!p) {
          toast.error("Processo não encontrado");
          navigate("/processos");
          return;
        }
        if (!active) return;
        setProc(p as any);

        // Cliente
        if (p.cliente_id) {
          const { data: c } = await supabase
            .from("clients")
            .select("id, nome_empresarial, nome_fantasia")
            .eq("id", p.cliente_id)
            .maybeSingle();
          if (c) setClient(c as any);
        }

        // Movimentos (mais recente no topo)
        const { data: mList, error: e2 } = await supabase
          .from("movimentos")
          .select("*")
          .eq("processo_id", id)
          .order("data_mov", { ascending: false });
        if (e2) throw e2;
        const movList = (mList || []) as any as Movimento[];
        setMovs(movList);

        // Anexos por movimento
        if (movList.length) {
          const movIds = movList.map((m) => m.id);
          const { data: anexos } = await supabase
            .from("anexos")
            .select("id, movimento_id, nome_arquivo, mime, tamanho, url")
            .in("movimento_id", movIds);
          const grouped: Record<string, Anexo[]> = {};
          (anexos || []).forEach((a) => {
            grouped[a.movimento_id] = grouped[a.movimento_id] || [];
            grouped[a.movimento_id].push(a as any);
          });
          setAnexosByMov(grouped);
        }

        // Perfis envolvidos
        const ids = new Set<string>();
        ids.add(p.responsavel_id as string);
        (mList || []).forEach((m: any) => ids.add(m.responsavel_id));
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome, email, avatar_url")
          .in("id", Array.from(ids));
        const map: Record<string, Profile> = {};
        (profs || []).forEach((pr: any) => (map[pr.id] = pr));
        setProfiles(map);

        // Perfis (todos) para combobox
        const { data: all } = await supabase
          .from("profiles")
          .select("id, nome, email, avatar_url, status")
          .eq("status", "ativo")
          .order("nome", { ascending: true });
        setAllProfiles((all || []).map((p: any) => ({ id: p.id, label: p.nome, subtitle: p.email, avatar_url: p.avatar_url })));
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Falha ao carregar");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, navigate]);

  useEffect(() => {
    // Reset form when opening for create/edit
    if (!openMov) return;
    const defaults = editingMov
      ? {
          tipo: editingMov.tipo,
          descricao: editingMov.descricao || "",
          prazo_mov: editingMov.prazo_mov ? editingMov.prazo_mov.substring(0, 16) : null,
          responsavel_id: editingMov.responsavel_id,
          status_mov: editingMov.status_mov,
        }
      : {
          tipo: "anotacao",
          descricao: "",
          prazo_mov: null,
          responsavel_id: proc?.responsavel_id || profile?.id || "",
          status_mov: "pendente" as StatusMov,
        };
    movForm.reset(defaults as any);
    setFiles([]);
    setUploadProgress({});
  }, [openMov, editingMov, proc, profile]);

  const slaBadge = useMemo(() => {
    const prazo = proc?.prazo ? parseISO(proc.prazo) : null;
    return getSla(prazo, proc?.status as string, null);
  }, [proc]);

  const checklistProgress = useMemo(() => {
    if (!checklist.length) return 0;
    const done = checklist.filter((i) => i.done).length;
    return Math.round((done / checklist.length) * 100);
  }, [checklist]);

  const addChecklistItem = () => {
    const v = newItem.trim();
    if (!v) return;
    setChecklist((prev) => [...prev, { id: crypto.randomUUID(), text: v, done: false }]);
    setNewItem("");
  };

  const toggleItem = (id: string) => {
    setChecklist((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  };

  const removeItem = (id: string) => setChecklist((prev) => prev.filter((i) => i.id !== id));

  const addTag = async () => {
    const v = tagInput.trim();
    if (!v || !proc) return;
    if (etiquetas.includes(v)) return setTagInput("");
    const next = [...etiquetas, v];
    try {
      const { error } = await supabase.from("processos").update({ etiquetas: next }).eq("id", proc.id);
      if (error) throw error;
      setProc({ ...proc, etiquetas: next });
      setTagInput("");
      toast.success("Etiqueta adicionada");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar etiqueta");
    }
  };

  const removeTag = async (t: string) => {
    if (!proc) return;
    const next = etiquetas.filter((x) => x !== t);
    try {
      const { error } = await supabase.from("processos").update({ etiquetas: next }).eq("id", proc.id);
      if (error) throw error;
      setProc({ ...proc, etiquetas: next });
      toast.success("Etiqueta removida");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao remover etiqueta");
    }
  };

  const concluirProcesso = async () => {
    if (!proc) return;
    try {
      const { error } = await supabase.from("processos").update({ status: "concluido" }).eq("id", proc.id);
      if (error) throw error;
      setProc({ ...proc, status: "concluido" });
      toast.success("Processo concluído");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao concluir");
    }
  };

  function storagePathFromPublicUrl(url: string): string | null {
    const marker = "/storage/v1/object/public/anexos/";
    const i = url.indexOf(marker);
    if (i === -1) return null;
    return url.substring(i + marker.length);
  }

  const onDropFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const accepted = arr.filter((f) => {
      const okMime = ["application/pdf", "image/png", "image/jpeg", "image/jpg"].includes(f.type);
      const okSize = f.size <= 10 * 1024 * 1024;
      return okMime && okSize;
    });
    const rejected = arr.length - accepted.length;
    if (rejected > 0) toast.warning(`${rejected} arquivo(s) ignorado(s)`);
    setFiles((prev) => [...prev, ...accepted]);
  };

  const salvarMovimento = async (vals: { tipo: MovTipo; descricao: string; prazo_mov?: string | null; responsavel_id: string; status_mov: StatusMov }) => {
    if (!proc?.id) {
      toast.error("Processo ausente");
      return;
    }
    if (!vals.tipo || !vals.descricao) {
      toast.error("Preencha Tipo e Descrição");
      return;
    }
    try {
      let saved: Movimento | null = null;
      if (!editingMov) {
        const payload: any = {
          processo_id: proc.id,
          tipo: vals.tipo,
          descricao: vals.descricao || null,
          responsavel_id: vals.responsavel_id || proc.responsavel_id,
          status_mov: vals.status_mov || "pendente",
        };
        if (vals.prazo_mov) payload.prazo_mov = vals.prazo_mov;
        const { data, error } = await supabase
          .from("movimentos")
          .insert(payload)
          .select("*")
          .maybeSingle();
        if (error) throw error;
        saved = data as any;
        setMovs((prev) => [saved as any, ...prev]);
      } else {
        const { error } = await supabase
          .from("movimentos")
          .update({
            tipo: vals.tipo,
            descricao: vals.descricao || null,
            responsavel_id: vals.responsavel_id || proc.responsavel_id,
            status_mov: vals.status_mov,
            prazo_mov: vals.prazo_mov || null,
          })
          .eq("id", editingMov.id)
          .eq("processo_id", proc.id);
        if (error) throw error;
        setMovs((prev) => prev.map((m) => (
          m.id === editingMov!.id
            ? {
                ...m,
                tipo: vals.tipo,
                descricao: vals.descricao || null,
                responsavel_id: vals.responsavel_id || proc.responsavel_id,
                status_mov: vals.status_mov,
                prazo_mov: vals.prazo_mov || null,
              }
            : m
        )));
        saved = movs.find((m) => m.id === editingMov!.id) || null;
      }

      // Upload anexos (sequencial com barra simulada)
      if (files.length && saved) {
        for (const file of files) {
          const key = `${file.name}-${file.size}-${file.lastModified}`;
          // progresso simulado até 90%
          setUploadProgress((p) => ({ ...p, [key]: 5 }));
          let pct = 5;
          const timer = setInterval(() => {
            pct = Math.min(90, pct + 5);
            setUploadProgress((p) => ({ ...p, [key]: pct }));
          }, 120);
          const path = `${proc.id}/${saved!.id}/${Date.now()}_${file.name}`;
          const { error: upErr } = await supabase.storage.from("anexos").upload(path, file, { upsert: false });
          clearInterval(timer);
          if (upErr) {
            setUploadProgress((p) => ({ ...p, [key]: 0 }));
            toast.error(`Falha ao subir ${file.name}`);
            continue;
          }
          const { data: pub } = supabase.storage.from("anexos").getPublicUrl(path);
          setUploadProgress((p) => ({ ...p, [key]: 100 }));
          const meta = {
            movimento_id: saved!.id,
            nome_arquivo: file.name,
            mime: file.type,
            tamanho: file.size,
            url: pub.publicUrl,
          };
          const { data: anexData, error: anexErr } = await supabase
            .from("anexos")
            .insert(meta)
            .select("*")
            .maybeSingle();
          if (anexErr) {
            toast.error(`Falha ao salvar metadados de ${file.name}`);
          } else {
            setAnexosByMov((prev) => {
              const list = prev[saved!.id] ? [...prev[saved!.id]] : [];
              list.unshift(anexData as any);
              return { ...prev, [saved!.id]: list };
            });
          }
        }
      }

      setOpenMov(false);
      setEditingMov(null);
      setFiles([]);
      setUploadProgress({});
      toast.success(editingMov ? "Movimento atualizado" : "Movimento criado");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao salvar movimento");
    }
  };

  const onEditMov = (m: Movimento) => {
    setEditingMov(m);
    setOpenMov(true);
  };

  const onDeleteMov = async (m: Movimento) => {
    const ok = window.confirm("Excluir este movimento? Esta ação não pode ser desfeita.");
    if (!ok) return;
    try {
      // Delete anexos rows and storage files
      const anexos = anexosByMov[m.id] || [];
      if (anexos.length) {
        const paths = anexos
          .map((a) => storagePathFromPublicUrl(a.url))
          .filter((p): p is string => !!p);
        if (paths.length) {
          await supabase.storage.from("anexos").remove(paths);
        }
        await supabase.from("anexos").delete().in("id", anexos.map((a) => a.id));
      }
      const { error } = await supabase.from("movimentos").delete().eq("id", m.id).eq("processo_id", proc!.id);
      if (error) throw error;
      setMovs((prev) => prev.filter((x) => x.id !== m.id));
      setAnexosByMov((prev) => {
        const clone = { ...prev } as any;
        delete clone[m.id];
        return clone;
      });
      toast.success("Movimento excluído");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao excluir");
    }
  };

  if (!proc) {
    return (
      <main className="p-6">
        <div className="text-muted-foreground">Carregando...</div>
      </main>
    );
  }

  const resp = profiles[proc.responsavel_id];

  return (
    <main className="p-4 md:p-6">
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-semibold">{proc.titulo}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(proc.status)}>{STATUS.find((s) => s.value === proc.status)?.label}</Badge>
                    <Badge variant={prioridadeVariant(proc.prioridade)}>{PRIORIDADES.find((p) => p.value === proc.prioridade)?.label}</Badge>
                    <Badge variant="secondary">{SETORES.find((s) => s.value === proc.setor)?.label}</Badge>
                    {client ? (
                      <Link to="/escritorio/clientes" className="story-link text-sm">
                        {client.nome_fantasia || client.nome_empresarial}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sem cliente</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={slaBadge.variant as any}>{slaBadge.label}</Badge>
                  <Button variant="outline" onClick={() => navigate(`/processos/${proc.id}/editar`)}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={resp?.avatar_url} alt={resp?.nome} />
                  <AvatarFallback>{resp?.nome?.charAt(0) ?? "?"}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm">Responsável</div>
                  <div className="text-sm font-medium">{resp?.nome || "—"}</div>
                </div>
                <Separator orientation="vertical" className="mx-2 h-8" />
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4" />
                  Prazo: {proc.prazo ? format(parseISO(proc.prazo), "dd/MM/yyyy") : "—"}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Timeline Movimentos */}
          <Card>
            <CardHeader>
              <CardTitle>Movimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative border-s pl-6">
                {movs.map((m) => {
                  const pr = profiles[m.responsavel_id];
                  const prazo = m.prazo_mov ? new Date(m.prazo_mov) : null;
                  const created = m.data_mov ? new Date(m.data_mov) : null;
                  return (
                    <li key={m.id} className="mb-6 ms-4">
                      <span className="absolute -start-2.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background">
                        {tipoIcon(m.tipo)}
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium capitalize">{(m.tipo || "").split("_").join(" ")}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant={m.status_mov === "feito" ? "success" : m.status_mov === "cancelado" ? "destructive" : "secondary"}>
                            {m.status_mov}
                          </Badge>
                          {prazo && (
                            <Badge variant={prazoBadgeVariant(prazo, proc.status)}>
                              {differenceInCalendarDays(prazo, new Date()) < 0
                                ? `D+${Math.abs(differenceInCalendarDays(prazo, new Date()))}`
                                : `D-${differenceInCalendarDays(prazo, new Date())}`}
                            </Badge>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => onEditMov(m)}>Editar</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => onDeleteMov(m)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      {m.descricao && (
                        <div className="mt-2 prose prose-sm max-w-none dark:prose-invert">
                          {/* eslint-disable-next-line react/no-danger */}
                          <div dangerouslySetInnerHTML={{ __html: m.descricao }} />
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={pr?.avatar_url} alt={pr?.nome} />
                          <AvatarFallback>{pr?.nome?.charAt(0) ?? "?"}</AvatarFallback>
                        </Avatar>
                        <span>{pr?.nome || "—"}</span>
                        {created && <span>• {format(created, "dd/MM/yyyy HH:mm")}</span>}
                      </div>
                      {/* Anexos */}
                      {!!anexosByMov[m.id]?.length && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {anexosByMov[m.id].map((a) => (
                            <div key={a.id} className="rounded-md border p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium line-clamp-1">{a.nome_arquivo}</div>
                                <a href={a.url} target="_blank" rel="noreferrer" className="text-sm inline-flex items-center gap-1">
                                  <Download className="h-4 w-4" />
                                </a>
                              </div>
                              <div className="mt-2">
                                {a.mime?.startsWith("image/") ? (
                                  <img src={a.url} alt={a.nome_arquivo} className="h-32 w-full object-cover rounded" />
                                ) : a.mime === "application/pdf" ? (
                                  <embed src={a.url} className="h-32 w-full rounded" />
                                ) : (
                                  <div className="text-xs text-muted-foreground">{a.mime}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
                {movs.length === 0 && (
                  <div className="text-sm text-muted-foreground">Nenhum movimento ainda.</div>
                )}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Checklist ({checklistProgress}%)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Input placeholder="Novo item" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addChecklistItem(); }} />
                <Button onClick={addChecklistItem}><Plus className="h-4 w-4" /></Button>
              </div>
              <ul className="space-y-2">
                {checklist.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                    <button className={cn("flex items-center gap-2", i.done && "text-muted-foreground line-through")}
                      onClick={() => toggleItem(i.id)}>
                      <BadgeCheck className={cn("h-4 w-4", i.done ? "text-success" : "opacity-50")} />
                      <span className="text-sm">{i.text}</span>
                    </button>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(i.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
                {checklist.length === 0 && (
                  <div className="text-sm text-muted-foreground">Sem itens.</div>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Etiquetas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input placeholder="Adicionar etiqueta" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTag(); }} />
                <Button variant="secondary" onClick={addTag}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {etiquetas.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button type="button" onClick={() => removeTag(t)} aria-label={`Remover ${t}`}>
                      <X className="h-3 w-3 opacity-70" />
                    </button>
                  </Badge>
                ))}
                {etiquetas.length === 0 && (
                  <div className="text-sm text-muted-foreground">Sem etiquetas.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2">
                <li>
                  <span className="text-muted-foreground">Criado em</span> {format(new Date(proc.created_at), "dd/MM/yyyy HH:mm")}
                </li>
                <li>
                  <span className="text-muted-foreground">Atualizado em</span> {format(new Date(proc.updated_at), "dd/MM/yyyy HH:mm")}
                </li>
                {movs.slice(0, 5).map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    {tipoIcon(m.tipo)} <span className="capitalize">{(m.tipo || "").split("_").join(" ")}</span> • {format(new Date(m.data_mov), "dd/MM/yyyy HH:mm")}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SLA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={slaBadge.variant as any}>{slaBadge.label}</Badge>
                <span className="text-sm text-muted-foreground">{proc.prazo ? format(parseISO(proc.prazo), "dd/MM/yyyy") : "Sem prazo"}</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>

      {/* Botões flutuantes */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        <Button size="lg" onClick={() => { setEditingMov(null); setOpenMov(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Movimento
        </Button>
        <Button size="lg" variant="secondary" onClick={concluirProcesso}>
          <CheckCircle2 className="h-4 w-4 mr-2" /> Concluir Processo
        </Button>
      </div>

      {/* Modal Novo/Editar Movimento */}
      <Dialog open={openMov} onOpenChange={setOpenMov}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMov ? "Editar Movimento" : "Novo Movimento"}</DialogTitle>
          </DialogHeader>
          <Form {...(movForm as any)}>
            <form onSubmit={movForm.handleSubmit((vals) => salvarMovimento(vals))} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tipo *</Label>
                  <select
                    className="w-full mt-1 rounded-md border bg-background p-2"
                    {...movForm.register("tipo", { required: true })}
                  >
                    <option value="anotacao">Anotação</option>
                    <option value="protocolo">Protocolo</option>
                    <option value="solicitacao">Solicitação</option>
                    <option value="retorno_orgao">Retorno Órgão</option>
                    <option value="exigencia">Exigência</option>
                    <option value="envio_cliente">Envio Cliente</option>
                    <option value="upload">Upload</option>
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <select className="w-full mt-1 rounded-md border bg-background p-2" {...movForm.register("status_mov")}>
                    <option value="pendente">Pendente</option>
                    <option value="feito">Feito</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Responsável</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-between", !movForm.watch("responsavel_id") && "text-muted-foreground")}
                        type="button">
                        {movForm.watch("responsavel_id") ? allProfiles.find((r) => r.id === movForm.watch("responsavel_id"))?.label : "Selecionar responsável"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar responsável..." />
                        <CommandList>
                          <CommandEmpty>Nenhum colaborador</CommandEmpty>
                          <CommandGroup>
                            {allProfiles.map((r) => (
                              <CommandItem key={r.id} onSelect={() => movForm.setValue("responsavel_id", r.id)}>
                                <Check className={cn("mr-2 h-4 w-4", movForm.watch("responsavel_id") === r.id ? "opacity-100" : "opacity-0")} />
                                {r.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Prazo do movimento (opcional)</Label>
                  <input
                    type="datetime-local"
                    className="w-full mt-1 rounded-md border bg-background p-2"
                    {...movForm.register("prazo_mov")}
                  />
                </div>
              </div>

              <div>
                <Label>Descrição *</Label>
                <div className="border rounded-md mt-1">
                  <ReactQuill theme="snow" value={movForm.watch("descricao") || ""} onChange={(v) => movForm.setValue("descricao", v)} />
                </div>
              </div>

              {/* Upload múltiplo */}
              <div
                className={cn(
                  "mt-2 border-2 border-dashed rounded-md p-4 text-sm",
                  dropActive ? "bg-muted/40" : "bg-background"
                )}
                onDragOver={(e) => { e.preventDefault(); setDropActive(true); }}
                onDragLeave={() => setDropActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropActive(false);
                  onDropFiles(e.dataTransfer.files);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    Arraste arquivos aqui ou
                    <Button variant="link" type="button" onClick={() => inputRef.current?.click()} className="px-1">selecione</Button>
                    (pdf, jpg, png até 10MB)
                  </div>
                  <UploadIcon className="h-4 w-4" />
                </div>
                <input ref={inputRef} type="file" multiple accept="application/pdf,image/png,image/jpeg" className="hidden"
                  onChange={(e) => e.target.files && onDropFiles(e.target.files)} />
                {!!files.length && (
                  <div className="mt-3 space-y-2">
                    {files.map((f) => {
                      const key = `${f.name}-${f.size}-${f.lastModified}`;
                      const pct = uploadProgress[key] ?? 0;
                      return (
                        <div key={key} className="rounded-md border p-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="line-clamp-1">{f.name}</span>
                            <span className="text-muted-foreground">{Math.round(f.size / 1024)} KB</span>
                          </div>
                          <div className="mt-2 h-2 w-full rounded bg-muted">
                            <div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpenMov(false)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
