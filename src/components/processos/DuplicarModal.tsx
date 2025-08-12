import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check, User, Briefcase, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

// Local enums (mantêm consistência com o resto do app)
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

type Option = { id: string; label: string; subtitle?: string };

export type ProcessoBase = {
  id: string;
  titulo: string;
  cliente_id: string | null;
  responsavel_id: string;
  setor: string;
  prioridade: string;
  prazo: string | null; // yyyy-MM-dd
  descricao: string | null;
  etiquetas: string[];
};

export default function DuplicarModal({
  open,
  onOpenChange,
  original,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  original: ProcessoBase | null;
  onSuccess?: (newId: string) => void;
}) {
  const { profile } = useAuth();

  const [clientes, setClientes] = useState<Option[]>([]);
  const [responsaveis, setResponsaveis] = useState<Option[]>([]);

  const [titulo, setTitulo] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<string>("media");
  const [prazo, setPrazo] = useState<string>(""); // yyyy-MM-dd

  useEffect(() => {
    if (!open || !original) return;
    setTitulo(`Cópia de ${original.titulo}`);
    setClienteId(original.cliente_id);
    setResponsavelId(profile?.id || original.responsavel_id);
    setPrioridade(original.prioridade || "media");
    setPrazo(original.prazo || "");
  }, [open, original, profile?.id]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        const [{ data: cli }, { data: prof }] = await Promise.all([
          supabase.from("clients").select("id, nome_empresarial, nome_fantasia, cnpj").order("nome_empresarial", { ascending: true }),
          supabase.from("profiles").select("id, nome, email, status").eq("status", "ativo").order("nome", { ascending: true }),
        ]);
        if (!active) return;
        setClientes((cli || []).map((c: any) => ({ id: c.id, label: c.nome_fantasia || c.nome_empresarial, subtitle: c.cnpj })));
        setResponsaveis((prof || []).map((p: any) => ({ id: p.id, label: p.nome, subtitle: p.email })));
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { active = false };
  }, [open]);

  const clienteById = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes]);
  const respById = useMemo(() => Object.fromEntries(responsaveis.map((r) => [r.id, r])), [responsaveis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!original) return;
    if (!responsavelId) {
      toast.error("Defina o responsável");
      return;
    }
    try {
      const payload: any = {
        titulo: titulo.trim() || original.titulo,
        cliente_id: clienteId,
        responsavel_id: responsavelId,
        setor: original.setor,
        prioridade: prioridade,
        status: "aberto",
        prazo: prazo || null,
        descricao: original.descricao,
        etiquetas: original.etiquetas || [],
      };
      const { data, error } = await supabase
        .from("processos")
        .insert(payload)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      toast.success("Processo duplicado");
      if (data?.id) onSuccess?.(data.id);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao duplicar processo");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Duplicar Processo</DialogTitle>
        </DialogHeader>
        {original ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Título */}
            <div>
              <label className="text-sm">Título</label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do novo processo" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cliente */}
              <div>
                <label className="text-sm">Cliente</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-between mt-1", !clienteId && "text-muted-foreground")}
                      type="button">
                      {clienteId ? clienteById[clienteId!]?.label : "Selecionar cliente"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setClienteId(null)}>Limpar</CommandItem>
                          {clientes.map((c) => (
                            <CommandItem key={c.id} onSelect={() => setClienteId(c.id)}>
                              <Check className={cn("mr-2 h-4 w-4", clienteId === c.id ? "opacity-100" : "opacity-0")} />
                              {c.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Responsável */}
              <div>
                <label className="text-sm">Responsável</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-between mt-1", !responsavelId && "text-muted-foreground")} type="button">
                      {responsavelId ? respById[responsavelId!]?.label : "Selecionar responsável"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar responsável..." />
                      <CommandList>
                        <CommandEmpty>Nenhum colaborador</CommandEmpty>
                        <CommandGroup>
                          {responsaveis.map((r) => (
                            <CommandItem key={r.id} onSelect={() => setResponsavelId(r.id)}>
                              <Check className={cn("mr-2 h-4 w-4", responsavelId === r.id ? "opacity-100" : "opacity-0")} />
                              {r.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <div className="text-xs text-muted-foreground mt-1">Padrão: você</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Prioridade */}
              <div>
                <label className="text-sm">Prioridade</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between mt-1" type="button">
                      {PRIORIDADES.find((p) => p.value === prioridade)?.label}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                    <Command>
                      <CommandList>
                        <CommandGroup>
                          {PRIORIDADES.map((p) => (
                            <CommandItem key={p.value} onSelect={() => setPrioridade(p.value)}>
                              <Check className={cn("mr-2 h-4 w-4", prioridade === p.value ? "opacity-100" : "opacity-0")} />
                              {p.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Prazo */}
              <div>
                <label className="text-sm">Prazo</label>
                <div className="relative mt-1">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="date" className="pl-9" value={prazo || ""} onChange={(e) => setPrazo(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">Duplicar</Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
