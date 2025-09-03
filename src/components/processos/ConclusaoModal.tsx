import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";

interface ConclusaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  processoTitulo: string;
  onConcluded: () => void;
}

export default function ConclusaoModal({
  open,
  onOpenChange,
  processoId,
  processoTitulo,
  onConcluded
}: ConclusaoModalProps) {
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { profile } = useAuth();

  const handleSubmit = async () => {
    if (!motivo.trim()) {
      toast.error("O motivo da conclusão é obrigatório");
      return;
    }

    setSubmitting(true);
    try {
      // Criar movimento final com o motivo
      const { error: movimentoError } = await supabase
        .from("movimentos")
        .insert({
          processo_id: processoId,
          tipo: 'anotacao',
          responsavel_id: profile?.id,
          descricao: `CONCLUSÃO: ${motivo.trim()}`,
          status_mov: 'feito'
        });

      if (movimentoError) throw movimentoError;

      // Marcar processo como concluído
      const { error: processoError } = await supabase
        .from("processos")
        .update({ 
          status: "concluido",
          data_conclusao: new Date().toISOString()
        })
        .eq("id", processoId);

      if (processoError) throw processoError;

      toast.success("Processo concluído com sucesso");
      onConcluded();
      onOpenChange(false);
      setMotivo("");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Erro ao concluir processo");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Concluir Processo</DialogTitle>
          <DialogDescription>
            Você está prestes a marcar o processo "{processoTitulo}" como concluído.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da Conclusão *</Label>
            <Textarea
              id="motivo"
              placeholder="Descreva o motivo da conclusão do processo..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !motivo.trim()}
          >
            {submitting ? "Concluindo..." : "Concluir Processo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}