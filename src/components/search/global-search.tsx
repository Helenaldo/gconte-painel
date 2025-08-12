import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, FolderOpen, Building2, User, Calendar, Contact2, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const placeholders = [
  "Buscar processos, clientes ou colaboradores...",
  "Digite parte do título, nome ou CNPJ...",
  "Procure por eventos, contatos e balancetes...",
];

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

type SearchResult = {
  processos: any[];
  processos_count: number;
  clients: any[];
  clients_count: number;
  profiles: any[];
  profiles_count: number;
  eventos: any[];
  eventos_count: number;
  contatos: any[];
  contatos_count: number;
  balancetes: any[];
  balancetes_count: number;
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [phIndex, setPhIndex] = useState(0);
  const [openDropdown, setOpenDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debounced = useDebouncedValue(q, 300);

  useEffect(() => {
    const id = setInterval(() => setPhIndex((i) => (i + 1) % placeholders.length), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.innerWidth < 768) setOpenModal(true);
        else inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const term = debounced.trim();
      if (term.length < 2) {
        setResults(null);
        setOpenDropdown(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("search-global", { body: { q: term } });
        if (error) throw error;
        if (!cancelled) {
          setResults(data as SearchResult);
          setOpenDropdown(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  function goToAll(category: string) {
    const term = q.trim();
    switch (category) {
      case "processos":
        navigate(`/processos/listar?search=${encodeURIComponent(term)}`);
        break;
      case "clients":
        navigate(`/escritorio/clientes?q=${encodeURIComponent(term)}`);
        break;
      case "profiles":
        navigate(`/escritorio/colaboradores?q=${encodeURIComponent(term)}`);
        break;
      case "eventos":
        navigate(`/escritorio/eventos?q=${encodeURIComponent(term)}`);
        break;
      case "contatos":
        navigate(`/escritorio/contatos?q=${encodeURIComponent(term)}`);
        break;
      case "balancetes":
        navigate(`/indicadores/dados?q=${encodeURIComponent(term)}`);
        break;
    }
    setOpenDropdown(false);
  }

  function Row({ icon: Icon, title, subtitle, badge, onClick }: { icon: any; title: string; subtitle?: string; badge?: string; onClick: () => void }) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/60 rounded cursor-pointer" onClick={onClick}>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-sm truncate">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
        </div>
        {badge && <Badge className="ml-2">{badge}</Badge>}
      </div>
    );
  }

  const panel = (
    <div className={cn("absolute z-50 mt-2 w-full max-w-3xl rounded-md border bg-popover text-popover-foreground shadow-md", !openDropdown && "hidden")}
      role="dialog" aria-label="Resultados da busca">
      {!results ? (
        <div className="p-4 text-sm text-muted-foreground">Digite pelo menos 2 caracteres para buscar.</div>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto py-2">
          {/* Processos */}
          <div>
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground">Processos ({results.processos_count ?? results.processos?.length ?? 0})</div>
            {results.processos?.map((p: any) => (
              <Row key={p.id} icon={FolderOpen} title={p.titulo} subtitle={`${p.status}${p.prazo ? ` • prazo ${p.prazo.slice(0,10)}` : ""}`} badge={p.prioridade}
                onClick={()=>{ navigate(`/processos/${p.id}`); setOpenDropdown(false); }} />
            ))}
            <div className="px-3 py-1"><Button variant="ghost" size="sm" onClick={()=>goToAll("processos")}>Ver todos</Button></div>
          </div>
          <CommandSeparator />
          {/* Clientes */}
          <div>
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground">Clientes ({results.clients_count ?? results.clients?.length ?? 0})</div>
            {results.clients?.map((c: any) => (
              <Row key={c.id} icon={Building2} title={c.nome_empresarial || c.nome_fantasia} subtitle={c.cnpj} onClick={()=>{ navigate(`/escritorio/clientes?q=${encodeURIComponent(c.cnpj || c.nome_empresarial)}`); setOpenDropdown(false); }} />
            ))}
            <div className="px-3 py-1"><Button variant="ghost" size="sm" onClick={()=>goToAll("clients")}>Ver todos</Button></div>
          </div>
          <CommandSeparator />
          {/* Colaboradores */}
          <div>
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground">Colaboradores ({results.profiles_count ?? results.profiles?.length ?? 0})</div>
            {results.profiles?.map((p: any) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/60 rounded cursor-pointer" onClick={()=>{ navigate(`/escritorio/colaboradores?q=${encodeURIComponent(p.nome)}`); setOpenDropdown(false); }}>
                <Avatar className="h-5 w-5"><AvatarImage src={p.avatar_url || undefined}/><AvatarFallback>{p.nome?.[0] || "?"}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{p.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                </div>
              </div>
            ))}
            <div className="px-3 py-1"><Button variant="ghost" size="sm" onClick={()=>goToAll("profiles")}>Ver todos</Button></div>
          </div>
          <CommandSeparator />
          {/* Eventos */}
          <div>
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground">Eventos ({results.eventos_count ?? results.eventos?.length ?? 0})</div>
            {results.eventos?.map((e: any) => (
              <Row key={e.id} icon={Calendar} title={e.titulo} subtitle={e.setor} onClick={()=>{ navigate(`/escritorio/eventos?q=${encodeURIComponent(e.titulo)}`); setOpenDropdown(false); }} />
            ))}
            <div className="px-3 py-1"><Button variant="ghost" size="sm" onClick={()=>goToAll("eventos")}>Ver todos</Button></div>
          </div>
          <CommandSeparator />
          {/* Contatos */}
          <div>
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground">Contatos ({results.contatos_count ?? results.contatos?.length ?? 0})</div>
            {results.contatos?.map((e: any) => (
              <Row key={e.id} icon={Contact2} title={e.nome} subtitle={`${e.email || ""}${e.telefone ? ` • ${e.telefone}` : ""}`} onClick={()=>{ navigate(`/escritorio/contatos?q=${encodeURIComponent(e.nome)}`); setOpenDropdown(false); }} />
            ))}
            <div className="px-3 py-1"><Button variant="ghost" size="sm" onClick={()=>goToAll("contatos")}>Ver todos</Button></div>
          </div>
          <CommandSeparator />
          {/* Balancetes */}
          <div>
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground">Balancetes ({results.balancetes_count ?? results.balancetes?.length ?? 0})</div>
            {results.balancetes?.map((b: any) => (
              <Row key={b.id} icon={Database} title={b.empresa} subtitle={`${b.periodo} • ${b.mes}/${b.ano}`} onClick={()=>{ navigate(`/indicadores/dados?q=${encodeURIComponent(b.empresa)}`); setOpenDropdown(false); }} />
            ))}
            <div className="px-3 py-1"><Button variant="ghost" size="sm" onClick={()=>goToAll("balancetes")}>Ver todos</Button></div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative hidden md:block">
      <div className="flex items-center gap-2">
        <div className="relative w-[320px] lg:w-[420px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            onFocus={()=>setOpenDropdown(!!results)}
            onBlur={()=>setTimeout(()=>setOpenDropdown(false), 150)}
            placeholder={placeholders[phIndex]}
            className="pl-8"
            aria-label="Buscar no sistema"
          />
          {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          {panel}
        </div>
      </div>

      {/* Mobile trigger */}
      <div className="md:hidden">
        <Button variant="ghost" size="icon" onClick={()=>setOpenModal(true)} aria-label="Abrir busca">
          <Search className="h-5 w-5" />
        </Button>
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Busca</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder={placeholders[phIndex]}
              className="pl-8"
            />
            {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="mt-2 max-h-[60vh] overflow-y-auto border rounded-md">
            {panel}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
