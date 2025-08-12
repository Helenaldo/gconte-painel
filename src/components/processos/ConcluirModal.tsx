import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarIcon, Check, ChevronsUpDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";
import ReactQuill from "react-quill";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export type ProcessoForClose = {
  id: string;
  titulo: string;
  cliente_id: string | null;
  responsavel_id: string;
  setor: string;
  prioridade: string;
  status: string;
  prazo: string | null; // yyyy-MM-dd
  descricao: string | null;
  etiquetas: string[];
  data_abertura?: string;
};

export type MovimentoLite = { id: string; tipo: string; status_mov: string; data_mov: string; prazo_mov: string | null };
export type AnexoLite = { id: string; movimento_id: string; nome_arquivo: string; mime: string; tamanho: number; url: string };

export default function ConcluirModal({
  open,
  onOpenChange,
  proc,
  movs,
  anexosByMov,
  checklist,
  clientName,
  officeLogoUrl,
  onConcluded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  proc: ProcessoForClose;
  movs: MovimentoLite[];
  anexosByMov: Record<string, AnexoLite[]>;
  checklist: { id: string; text: string; done: boolean }[];
  clientName: string | null;
  officeLogoUrl?: string | null;
  onConcluded?: (payload: { data_conclusao: string; status: string }) => void;
}) {
  const { profile } = useAuth();

  const [dataConclusao, setDataConclusao] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState<string>("");
  const [rating, setRating] = useState<number>(0);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [incluirAnexos, setIncluirAnexos] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  const MOTIVOS = [
    { label: "Entregue no prazo", value: "no_prazo" },
    { label: "Fora do prazo", value: "fora_do_prazo" },
    { label: "Exigência do órgão", value: "exigencia_orgao" },
    { label: "Cancelado pelo cliente", value: "cancelado_cliente" },
    { label: "Outro", value: "outro" },
  ];

  const pendChecklist = useMemo(() => checklist.filter((i) => !i.done).length, [checklist]);
  const pendMovs = useMemo(() => movs.filter((m) => m.status_mov === "pendente").length, [movs]);

  const summaryRef = useRef<HTMLDivElement | null>(null);

  const ultimosAnexos = useMemo(() => {
    // Pegar últimos até 3 anexos pela ordem dos movimentos (recente primeiro)
    const orderedMovs = [...movs].sort((a, b) => new Date(b.data_mov).getTime() - new Date(a.data_mov).getTime());
    const list: AnexoLite[] = [];
    for (const m of orderedMovs) {
      const arr = anexosByMov[m.id] || [];
      for (const a of arr) {
        list.push(a);
        if (list.length >= 3) break;
      }
      if (list.length >= 3) break;
    }
    return list;
  }, [movs, anexosByMov]);

  async function generatePdf(): Promise<string | null> {
    try {
      if (!summaryRef.current) return null;
      const node = summaryRef.current;
      const canvas = await html2canvas(node as any, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const imgWidth = canvas.width * ratio;
      const imgHeight = canvas.height * ratio;
      const x = (pageWidth - imgWidth) / 2;
      const y = 20;
      pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);

      if (incluirAnexos && ultimosAnexos.length) {
        for (const a of ultimosAnexos) {
          if (a.mime?.startsWith("image/")) {
            const img = await loadImage(a.url);
            const { w, h } = fitToPage(img.width, img.height, pageWidth - 60, pageHeight - 60);
            pdf.addPage();
            pdf.text(`Anexo: ${a.nome_arquivo}`, 30, 30);
            // @ts-ignore
            pdf.addImage(img, "JPEG", 30, 50, w, h);
          }
        }
      }

      const filename = `encerramento-${proc.id}.pdf`;
      pdf.save(filename);
      // Return base64 for email
      return pdf.output("datauristring");
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  function fitToPage(imgW: number, imgH: number, maxW: number, maxH: number) {
    const ratio = Math.min(maxW / imgW, maxH / imgH);
    return { w: imgW * ratio, h: imgH * ratio };
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  const handleSubmit = async () => {
    if (pendChecklist > 0) {
      const ok = window.confirm(`Há ${pendChecklist} item(ns) do checklist pendente(s). Deseja concluir mesmo assim?`);
      if (!ok) return;
    }
    if (pendMovs > 0) {
      const ok2 = window.confirm(`Há ${pendMovs} movimento(s) pendente(s). Deseja concluir mesmo assim?`);
      if (!ok2) return;
    }
    setSubmitting(true);
    try {
      const concluidoNoPrazo = proc.prazo ? new Date(dataConclusao) <= new Date(proc.prazo) : true;

      // Atualiza processo
      const { error: upErr } = await supabase
        .from("processos")
        .update({ status: "concluido", data_conclusao: new Date(dataConclusao).toISOString() })
        .eq("id", proc.id);
      if (upErr) throw upErr;

      // Registra observações no histórico como anotação
      const resumo = `<p><strong>Encerrado por:</strong> ${profile?.nome || profile?.id}</p>` +
        `<p><strong>Data:</strong> ${new Date().toLocaleString()}</p>` +
        `<p><strong>Motivo:</strong> ${MOTIVOS.find((m) => m.value === motivo)?.label || "—"}</p>` +
        `<p><strong>Avaliação:</strong> ${rating}/5</p>` +
        `<p><strong>No prazo:</strong> ${concluidoNoPrazo ? "Sim" : "Não"}</p>` +
        (obs ? `<hr/>${obs}` : "");

      await supabase.from("movimentos").insert({
        processo_id: proc.id,
        tipo: "anotacao",
        descricao: resumo,
        responsavel_id: profile?.id,
        status_mov: "feito",
      } as any);

      // Gera PDF
      const pdfDataUri = await generatePdf();
      if (!pdfDataUri) {
        toast.warning("Falha ao gerar PDF. Processo concluído mesmo assim.");
      }

      // Tenta enviar e-mail (se edge function configurada)
      try {
        await supabase.functions.invoke("send-closure-email", {
          body: {
            processId: proc.id,
            processTitle: proc.titulo,
            clientName,
            to: "responsavel",
            includePdf: Boolean(pdfDataUri && incluirAnexos),
            pdfDataUri,
          },
        });
      } catch (e) {
        console.warn("Email de encerramento não enviado (verifique chave RESEND)");
      }

      toast.success("Processo concluído");
      onConcluded?.({ data_conclusao: new Date(dataConclusao).toISOString(), status: "concluido" });
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao concluir");
    } finally {
      setSubmitting(false);
    }
  };

  const finalStatusBadge = useMemo(() => {
    const ok = proc.prazo ? new Date(dataConclusao) <= new Date(proc.prazo) : true;
    return ok ? { variant: "success" as const, label: "No prazo" } : { variant: "destructive" as const, label: "Atrasado" };
  }, [dataConclusao, proc.prazo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Concluir Processo</DialogTitle>
        </DialogHeader>

        {/* Alerts de pré-validação */}
        {(pendChecklist > 0 || pendMovs > 0) && (
          <div className="space-y-2 mb-2">
            {pendChecklist > 0 && (
              <div className="rounded-md border p-2 text-sm">Há {pendChecklist} item(ns) do checklist pendente(s).</div>
            )}
            {pendMovs > 0 && (
              <div className="rounded-md border p-2 text-sm">Há {pendMovs} movimento(s) com status pendente.</div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm">Data de conclusão</label>
            <div className="relative mt-1">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="date" className="pl-9" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm">Avaliação de qualidade</label>
            <div className="flex items-center gap-1 mt-2">
              {Array.from({ length: 5 }).map((_, i) => {
                const n = i + 1;
                return (
                  <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} estrelas`}>
                    <Star className={cn("h-5 w-5", n <= rating ? "text-yellow-500" : "text-muted-foreground")} fill={n <= rating ? "currentColor" : "none"} />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-sm">Motivo</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-between mt-1", !motivo && "text-muted-foreground")} type="button">
                  {motivo ? MOTIVOS.find((m) => m.value === motivo)?.label : "Selecionar motivo"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command>
                  <CommandInput placeholder="Buscar motivo..." />
                  <CommandList>
                    <CommandEmpty>Nenhum</CommandEmpty>
                    <CommandGroup>
                      {MOTIVOS.map((m) => (
                        <CommandItem key={m.value} onSelect={() => setMotivo(m.value)}>
                          <Check className={cn("mr-2 h-4 w-4", motivo === m.value ? "opacity-100" : "opacity-0")} />
                          {m.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div>
          <label className="text-sm">Observações finais</label>
          <div className="mt-1 border rounded-md">
            <ReactQuill theme="snow" value={obs} onChange={setObs} />
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Switch checked={incluirAnexos} onCheckedChange={setIncluirAnexos} id="toggle-anexos" />
            <label htmlFor="toggle-anexos" className="text-sm">Anexar últimos anexos ao PDF</label>
          </div>
          <Badge variant={finalStatusBadge.variant}>{finalStatusBadge.label}</Badge>
        </div>

        {/* Área oculta para render do PDF */}
        <div className="sr-only">
          <div ref={summaryRef} className="p-6 w-[794px] bg-white text-black">
            <div className="flex items-center justify-between">
              <div className="text-xl font-semibold">Resumo de Encerramento</div>
              {officeLogoUrl ? <img src={officeLogoUrl} alt="Logo" className="h-10" /> : null}
            </div>
            <hr className="my-3" />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div><strong>Processo:</strong> {proc.titulo}</div>
                <div><strong>Cliente:</strong> {clientName || "—"}</div>
                <div><strong>Setor:</strong> {proc.setor}</div>
                <div><strong>Responsável:</strong> {proc.responsavel_id}</div>
              </div>
              <div>
                <div><strong>Abertura:</strong> {proc.data_abertura ? new Date(proc.data_abertura).toLocaleDateString() : "—"}</div>
                <div><strong>Prazo:</strong> {proc.prazo || "—"}</div>
                <div><strong>Conclusão:</strong> {new Date(dataConclusao).toLocaleDateString()}</div>
                <div><strong>Status:</strong> Concluído</div>
              </div>
            </div>
            <div className="mt-2">
              <Badge>{finalStatusBadge.label}</Badge>
            </div>
            <div className="mt-4 text-sm">
              <div className="font-medium mb-1">Etiquetas</div>
              <div className="flex flex-wrap gap-2">
                {(proc.etiquetas || []).map((t) => (<span key={t} className="border rounded px-2 py-0.5">{t}</span>))}
              </div>
            </div>
            <div className="mt-4 text-sm">
              <div className="font-medium mb-1">Checklist</div>
              <ul className="list-disc pl-5">
                {checklist.map((i) => (<li key={i.id}>{i.done ? "[x]" : "[ ]"} {i.text}</li>))}
              </ul>
            </div>
            <div className="mt-4 text-sm">
              <div className="font-medium mb-1">Últimos movimentos</div>
              <ul className="list-disc pl-5">
                {movs.slice(0, 5).map((m) => (
                  <li key={m.id}>{new Date(m.data_mov).toLocaleString()} • {m.tipo} • {m.status_mov}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4 text-sm">
              <div className="font-medium mb-1">Anexos</div>
              <ul className="list-disc pl-5">
                {ultimosAnexos.map((a) => (
                  <li key={a.id}>{a.nome_arquivo} • {Math.round(Number(a.tamanho)/1024)} KB</li>
                ))}
              </ul>
            </div>
            <div className="mt-4 text-sm">
              <div className="font-medium mb-1">Avaliação</div>
              <div>{rating}/5 • Motivo: {MOTIVOS.find((m) => m.value === motivo)?.label || "—"}</div>
            </div>
            {obs && (
              <div className="mt-4 text-sm">
                <div className="font-medium mb-1">Observações</div>
                <div dangerouslySetInnerHTML={{ __html: obs }} />
              </div>
            )}
            <div className="mt-6 text-xs text-neutral-500">Gerado em {new Date().toLocaleString()} por {profile?.nome || profile?.email}</div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>Concluir</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
