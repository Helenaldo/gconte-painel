import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KanbanSquare, Plus } from "lucide-react";

const STATUS = [
  { label: "Aberto", value: "aberto" },
  { label: "Em Andamento", value: "em_andamento" },
  { label: "Aguardando Terceiros", value: "aguardando_terceiros" },
  { label: "Em Revisão", value: "em_revisao" },
  { label: "Concluído", value: "concluido" },
  { label: "Cancelado", value: "cancelado" },
] as const;

type Status = typeof STATUS[number]["value"];

interface ProcessoCard {
  id: string;
  titulo: string;
  cliente_id: string | null;
  prioridade: string;
  status: Status;
  prazo: string | null;
}

export default function ResponsavelKanban({ responsavelId, responsavelNome }: { responsavelId: string; responsavelNome: string }) {
  const [cols, setCols] = useState<Record<Status, ProcessoCard[]>>({
    aberto: [], em_andamento: [], aguardando_terceiros: [], em_revisao: [], concluido: [], cancelado: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("processos")
        .select("id, titulo, cliente_id, prioridade, status, prazo")
        .eq("responsavel_id", responsavelId)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) { console.error(error); setLoading(false); return; }
      const grouped: Record<Status, ProcessoCard[]> = { aberto: [], em_andamento: [], aguardando_terceiros: [], em_revisao: [], concluido: [], cancelado: [] };
      (data || []).forEach((p: any) => { grouped[p.status as Status]?.push(p as any); });
      setCols(grouped);
      setLoading(false);
    })();
    return () => { active = false };
  }, [responsavelId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Responsável: <span className="font-medium text-foreground">{responsavelNome}</span></div>
        <div className="flex gap-2">
          <Button onClick={() => window.open(`/processos/novo?responsavel_id=${responsavelId}`, "_blank")}>
            <Plus className="h-4 w-4 mr-2" /> Novo Processo
          </Button>
          <Button variant="outline" onClick={() => window.open(`/processos/visao-geral?responsavel_id=${responsavelId}`, "_blank")}>
            <KanbanSquare className="h-4 w-4 mr-2" /> Ver Kanban
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(["aberto","em_andamento","aguardando_terceiros","em_revisao","concluido","cancelado"] as Status[]).map((st) => (
          <Card key={st}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{STATUS.find((s) => s.value === st)?.label}</span>
                <Badge variant="secondary">{cols[st]?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(cols[st] || []).map((p) => (
                <div key={p.id} className="border rounded-md p-2">
                  <div className="text-sm font-medium">{p.titulo}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <Badge variant={p.prioridade === 'alta' ? 'warning' : p.prioridade === 'critica' ? 'destructive' : p.prioridade === 'media' ? 'info' : 'secondary'}>
                      {p.prioridade}
                    </Badge>
                    <div className="space-x-1">
                      <Button size="sm" variant="outline" onClick={() => window.open(`/processos/${p.id}`, "_blank")}>Ver</Button>
                    </div>
                  </div>
                </div>
              ))}
              {(!cols[st] || cols[st].length === 0) && (
                <div className="text-xs text-muted-foreground">Sem itens</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
