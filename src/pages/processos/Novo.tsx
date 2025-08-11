import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Calendar as CalendarIcon, ChevronsUpDown, Check, X, User, Briefcase, Tags, CirclePlus } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import InputMask from "react-input-mask";
import { format, isAfter, isBefore, parse } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";

// Enums mapeados para os valores do banco
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

const FormSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  clienteId: z.string().uuid().optional().nullable(),
  responsavelId: z.string().uuid().optional(),
  setor: z.enum(SETORES.map((s) => s.value) as [string, ...string[]]),
  prioridade: z.enum(PRIORIDADES.map((p) => p.value) as [string, ...string[]]),
  status: z.enum(STATUS.map((s) => s.value) as [string, ...string[]]).default("aberto"),
  prazo: z.string().min(10, "Informe a data"), // máscara dd/MM/yyyy
  descricao: z.string().optional(),
  etiquetas: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof FormSchema>;

type Option = { id: string; label: string; subtitle?: string };

export default function NovoProcessoModal() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [open, setOpen] = useState(true);
  const [clientes, setClientes] = useState<Option[]>([]);
  const [responsaveis, setResponsaveis] = useState<Option[]>([]);
  const [loadingCombos, setLoadingCombos] = useState(true);

  useEffect(() => {
    document.title = "Novo Processo | GConte";
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      titulo: "",
      clienteId: undefined,
      responsavelId: profile?.id, // padrão: usuário atual
      setor: "contabil",
      prioridade: "media",
      status: "aberto",
      prazo: "",
      descricao: "",
      etiquetas: [],
    },
    mode: "onBlur",
  });

  // Carrega clientes e responsáveis
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{ data: cli }, { data: prof } ] = await Promise.all([
          supabase.from("clients").select("id, nome_empresarial, nome_fantasia, cnpj").order("nome_empresarial", { ascending: true }),
          supabase.from("profiles").select("id, nome, email, status").eq("status", "ativo").order("nome", { ascending: true }),
        ]);
        if (!active) return;
        setClientes(
          (cli ?? []).map((c) => ({
            id: c.id as string,
            label: (c.nome_fantasia || c.nome_empresarial) as string,
            subtitle: c.cnpj as string,
          }))
        );
        setResponsaveis(
          (prof ?? []).map((p) => ({ id: p.id as string, label: p.nome as string, subtitle: p.email as string }))
        );
      } catch (e) {
        console.error(e);
        toast.error("Falha ao carregar dados");
      } finally {
        setLoadingCombos(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Helper: parse data dd/MM/yyyy -> Date
  const parsePrazo = (value: string) => parse(value, "dd/MM/yyyy", new Date());

  const onClose = () => {
    setOpen(false);
    setTimeout(() => navigate(-1), 200);
  };

  const onSubmit = async (values: FormValues) => {
    // valida data >= hoje
    const parsed = parsePrazo(values.prazo);
    const today = new Date();
    const atMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (isBefore(parsed, atMidnight)) {
      form.setError("prazo", { message: "Prazo não pode ser no passado" });
      toast.error("Ajuste o prazo");
      return;
    }

    const etiquetas = values.etiquetas.filter(Boolean);

    try {
      const payload = {
        titulo: values.titulo,
        cliente_id: values.clienteId ?? null,
        responsavel_id: values.responsavelId || profile?.id || null,
        setor: values.setor,
        prioridade: values.prioridade,
        status: values.status || "aberto",
        prazo: format(parsed, "yyyy-MM-dd"),
        descricao: values.descricao ?? null,
        etiquetas: etiquetas as any,
      } as any;

      // Garantir responsavel_id
      if (!payload.responsavel_id) {
        toast.error("Defina um responsável");
        return;
      }

      const { data, error } = await supabase
        .from("processos")
        .insert(payload)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      toast.success("Processo criado com sucesso");
      if (data?.id) {
        navigate(`/processos/${data.id}`);
      } else {
        navigate(-1);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao salvar processo");
    }
  };

  const [tagInput, setTagInput] = useState("");
  const addTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    const current = form.getValues("etiquetas");
    if (!current.includes(value)) {
      form.setValue("etiquetas", [...current, value], { shouldDirty: true });
    }
    setTagInput("");
  };
  const removeTag = (tag: string) => {
    const current = form.getValues("etiquetas");
    form.setValue(
      "etiquetas",
      current.filter((t) => t !== tag),
      { shouldDirty: true }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : setOpen(o))}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novo Processo</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Título */}
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input placeholder="Informe o título" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cliente (combobox pesquisável) */}
              <FormField
                control={form.control}
                name="clienteId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Cliente</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn("justify-between", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? clientes.find((c) => c.id === field.value)?.label : "Selecionar cliente"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar cliente..." />
                          <CommandList>
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem onSelect={() => field.onChange(null)}>
                                <X className="mr-2 h-4 w-4" />
                                Limpar seleção
                              </CommandItem>
                              {(clientes || []).map((client) => (
                                <CommandItem
                                  key={client.id}
                                  onSelect={() => field.onChange(client.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      client.id === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{client.label}</span>
                                    {client.subtitle && (
                                      <span className="text-xs text-muted-foreground">{client.subtitle}</span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormDescription>Opcional</FormDescription>
                  </FormItem>
                )}
              />

              {/* Responsável (combobox pesquisável) */}
              <FormField
                control={form.control}
                name="responsavelId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Responsável</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn("justify-between", !field.value && "text-muted-foreground")}
                          >
                            {field.value
                              ? responsaveis.find((r) => r.id === field.value)?.label
                              : "Selecionar responsável"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar responsável..." />
                          <CommandList>
                            <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                            <CommandGroup>
                              {(responsaveis || []).map((r) => (
                                <CommandItem key={r.id} onSelect={() => field.onChange(r.id)}>
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      r.id === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{r.label}</span>
                                    {r.subtitle && (
                                      <span className="text-xs text-muted-foreground">{r.subtitle}</span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormDescription>Padrão: você</FormDescription>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Setor */}
              <FormField
                control={form.control}
                name="setor"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Setor</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className="justify-between">
                            {SETORES.find((s) => s.value === field.value)?.label}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar setor..." />
                          <CommandList>
                            <CommandGroup>
                              {SETORES.map((s) => (
                                <CommandItem key={s.value} onSelect={() => field.onChange(s.value)}>
                                  <Check className={cn("mr-2 h-4 w-4", s.value === field.value ? "opacity-100" : "opacity-0")} />
                                  {s.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />

              {/* Prioridade */}
              <FormField
                control={form.control}
                name="prioridade"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Prioridade</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className="justify-between">
                            {PRIORIDADES.find((p) => p.value === field.value)?.label}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar prioridade..." />
                          <CommandList>
                            <CommandGroup>
                              {PRIORIDADES.map((p) => (
                                <CommandItem key={p.value} onSelect={() => field.onChange(p.value)}>
                                  <Check className={cn("mr-2 h-4 w-4", p.value === field.value ? "opacity-100" : "opacity-0")} />
                                  {p.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />

              {/* Prazo */}
              <FormField
                control={form.control}
                name="prazo"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Prazo *</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <InputMask
                          mask="99/99/9999"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        >
                          {(inputProps: any) => (
                            <Input placeholder="dd/mm/aaaa" {...inputProps} />
                          )}
                        </InputMask>
                      </FormControl>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" type="button">
                            <CalendarIcon className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? parsePrazo(field.value) : undefined}
                            onSelect={(date) => {
                              if (!date) return;
                              const str = format(date, "dd/MM/yyyy");
                              field.onChange(str);
                            }}
                            disabled={(date) => {
                              const today = new Date();
                              const atMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                              return isBefore(date, atMidnight);
                            }}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <FormDescription>Não permite datas passadas</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Status</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className="justify-between">
                            {STATUS.find((s) => s.value === field.value)?.label}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar status..." />
                          <CommandList>
                            <CommandGroup>
                              {STATUS.map((s) => (
                                <CommandItem key={s.value} onSelect={() => field.onChange(s.value)}>
                                  <Check className={cn("mr-2 h-4 w-4", s.value === field.value ? "opacity-100" : "opacity-0")} />
                                  {s.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />

              {/* Etiquetas */}
              <FormItem>
                <FormLabel>Etiquetas</FormLabel>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Digite e pressione Enter"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addTag}>
                    <CirclePlus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.watch("etiquetas").map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button type="button" onClick={() => removeTag(t)} aria-label={`Remover ${t}`}>
                        <X className="h-3 w-3 opacity-70" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </FormItem>
            </div>

            {/* Descrição (rich text) */}
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <div className="border rounded-md">
                      <ReactQuill theme="snow" value={field.value || ""} onChange={field.onChange} />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
