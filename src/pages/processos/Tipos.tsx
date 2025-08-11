import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Check, Plus, Pencil, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SETORES = [
  { label: "Contábil", value: "contabil" },
  { label: "Fiscal", value: "fiscal" },
  { label: "Pessoal", value: "pessoal" },
  { label: "Societário", value: "societario" },
  { label: "Financeiro", value: "financeiro" },
  { label: "Outro", value: "outro" },
] as const;

type Tipo = {
  id: string;
  nome: string;
  prefixo: string | null;
  setor_default: string;
  prazo_default: number;
  checklist_model: string[];
  created_at: string;
};

export default function Tipos() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tipo | null>(null);

  const [rows, setRows] = useState<Tipo[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [nome, setNome] = useState("");
  const [prefixo, setPrefixo] = useState("");
  const [setor, setSetor] = useState<string>("contabil");
  const [prazo, setPrazo] = useState<number>(0);
  const [checkInput, setCheckInput] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);

  useEffect(() => {
    document.title = "Tipos de Processo | GConte";
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("process_types").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setRows((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setNome("");
    setPrefixo("");
    setSetor("contabil");
    setPrazo(0);
    setChecklist([]);
    setCheckInput("");
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (t: Tipo) => {
    setEditing(t);
    setNome(t.nome);
    setPrefixo(t.prefixo || "");
    setSetor(t.setor_default);
    setPrazo(t.prazo_default);
    setChecklist(t.checklist_model || []);
    setCheckInput("");
    setOpen(true);
  };

  const save = async () => {
    if (!nome.trim()) return toast.error("Informe o nome");
    const payload = {
      nome: nome.trim(),
      prefixo: prefixo.trim() || null,
      setor_default: setor,
      prazo_default: prazo || 0,
      checklist_model: checklist,
    } as any;

    if (!editing) {
      const { data, error } = await supabase.from("process_types").insert(payload).select("*").maybeSingle();
      if (error) return toast.error(error.message);
      setRows((prev) => [data as any, ...prev]);
      toast.success("Tipo criado");
    } else {
      const { error } = await supabase.from("process_types").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      setRows((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...payload } : r)));
      toast.success("Tipo atualizado");
    }
    setOpen(false);
    setEditing(null);
    resetForm();
  };

  const del = async (t: Tipo) => {
    const ok = window.confirm(`Excluir o tipo "${t.nome}"?`);
    if (!ok) return;
    const { error } = await supabase.from("process_types").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((r) => r.id !== t.id));
    toast.success("Tipo excluído");
  };

  const addChecklistItem = () => {
    const v = checkInput.trim();
    if (!v) return;
    if (!checklist.includes(v)) setChecklist((prev) => [...prev, v]);
    setCheckInput("");
  };

  const removeChecklistItem = (i: number) => {
    setChecklist((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Tipos de Processo</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Tipo</Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Prefixo</TableHead>
              <TableHead>Setor padrão</TableHead>
              <TableHead>Prazo padrão</TableHead>
              <TableHead>Checklist modelo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.prefixo || "—"}</TableCell>
                <TableCell>{SETORES.find((s) => s.value === r.setor_default)?.label || r.setor_default}</TableCell>
                <TableCell>{r.prazo_default} dia(s)</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {r.checklist_model?.slice(0, 4).map((c) => (
                      <Badge key={c} variant="secondary">{c}</Badge>
                    ))}
                    {(r.checklist_model?.length || 0) > 4 && (
                      <span className="text-xs text-muted-foreground">+{r.checklist_model.length - 4}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => del(r)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum tipo cadastrado.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Tipo" : "Novo Tipo"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm">Nome *</label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Abertura de empresa" />
            </div>
            <div>
              <label className="text-sm">Prefixo (opcional)</label>
              <Input value={prefixo} onChange={(e) => setPrefixo(e.target.value)} placeholder="Ex.: SOC-" />
            </div>
            <div>
              <label className="text-sm">Setor padrão</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {SETORES.find((s) => s.value === setor)?.label}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar setor..." />
                    <CommandList>
                      <CommandEmpty>Nenhum setor</CommandEmpty>
                      <CommandGroup>
                        {SETORES.map((s) => (
                          <CommandItem key={s.value} onSelect={() => setSetor(s.value)}>
                            <Check className={cn("mr-2 h-4 w-4", setor === s.value ? "opacity-100" : "opacity-0")} />
                            {s.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm">Prazo padrão (dias)</label>
              <Input type="number" value={prazo} onChange={(e) => setPrazo(parseInt(e.target.value || "0"))} min={0} />
            </div>
            <div>
              <label className="text-sm">Checklist modelo</label>
              <div className="flex items-center gap-2">
                <Input value={checkInput} onChange={(e) => setCheckInput(e.target.value)} placeholder="Digite um item e Enter" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }} />
                <Button variant="secondary" onClick={addChecklistItem}>Adicionar</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {checklist.map((c, idx) => (
                  <Badge key={`${c}-${idx}`} variant="secondary" className="gap-1">
                    {c}
                    <button type="button" onClick={() => removeChecklistItem(idx)} aria-label="remover">
                      ×
                    </button>
                  </Badge>
                ))}
                {checklist.length === 0 && (
                  <div className="text-sm text-muted-foreground">Nenhum item.</div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
