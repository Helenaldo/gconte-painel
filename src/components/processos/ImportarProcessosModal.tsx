import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/auth-context";

const SETORES = ["contabil","fiscal","pessoal","societario","financeiro","outro"] as const;
const PRIORIDADES = ["baixa","media","alta","critica"] as const;
const STATUS = ["aberto","em_andamento","aguardando_terceiros","em_revisao","concluido","cancelado"] as const;

type Setor = typeof SETORES[number];
type Prioridade = typeof PRIORIDADES[number];
type Status = typeof STATUS[number];

type Row = {
  titulo: string;
  cnpj_cliente?: string | null;
  cliente_nome?: string | null;
  responsavel_email: string;
  setor: string;
  prioridade?: string | null;
  prazo?: string | null;
  status: string;
  descricao?: string | null;
  etiquetas?: string | null;
  orgao_nome?: string | null;
  processo_numero?: string | null;
  __errors?: Partial<Record<keyof Row, string>> & { __row?: string };
};

function normalizeText(v?: string | null) {
  return (v || "").trim();
}

function parseDate(input?: string | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  // Accept YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Accept dd/MM/yyyy
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function mapPrioridade(label?: string | null): Prioridade | null {
  if (!label) return null;
  const l = label.toLowerCase();
  if (["baixa","média","media"].includes(l)) return "baixa" as any;
  if (["alta"].includes(l)) return "alta" as any;
  if (["crítica","critica"].includes(l)) return "critica" as any;
  if (["média","media"].includes(l)) return "media" as any;
  return null;
}

function mapStatus(label?: string | null): Status | null {
  if (!label) return null;
  const l = label.toLowerCase();
  const map: Record<string, Status> = {
    "aberto": "aberto",
    "em andamento": "em_andamento",
    "aguardando terceiros": "aguardando_terceiros",
    "em revisão": "em_revisao",
    "em revisao": "em_revisao",
    "concluído": "concluido",
    "concluido": "concluido",
    "cancelado": "cancelado",
  };
  return map[l] || null;
}

function validateRow(row: Row) {
  const errors: any = {};
  if (!normalizeText(row.titulo)) errors.titulo = "Obrigatório";
  const email = normalizeText(row.responsavel_email);
  if (!email) errors.responsavel_email = "Obrigatório";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.responsavel_email = "E-mail inválido";
  const setor = normalizeText(row.setor).toLowerCase();
  if (!setor) errors.setor = "Obrigatório";
  else if (!SETORES.includes(setor as Setor)) errors.setor = "Valor inválido";
  const status = mapStatus(row.status) || row.status;
  if (!status) errors.status = "Obrigatório";
  else if (!STATUS.includes((status as any) as Status)) errors.status = "Valor inválido";
  const prio = row.prioridade ? mapPrioridade(row.prioridade) : null;
  if (row.prioridade && !prio) errors.prioridade = "Valor inválido";
  const prazo = row.prazo ? parseDate(row.prazo) : null;
  if (row.prazo && !prazo) errors.prazo = "Data inválida";
  return errors;
}

export default function ImportarProcessosModal({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (o: boolean) => void; onImported?: () => void; }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorReport, setErrorReport] = useState<Row[] | null>(null);
  const [newOrgaos, setNewOrgaos] = useState<string[]>([]);

  const isAdmin = (profile as any)?.role === "administrador";

  const onFile = async (file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Arquivo acima de 5MB");
        return;
      }
      setFileName(file.name);
      setLoading(true);
      const buf = await file.arrayBuffer();
      let wb: XLSX.WorkBook;
      try {
        wb = XLSX.read(buf, { type: "array" });
      } catch (e) {
        toast.error("XLSX inválido");
        setLoading(false);
        return;
      }
      const sheet = wb.Sheets["Processos"] || wb.Sheets[wb.SheetNames[0]];
      if (!sheet) {
        toast.error("Aba 'Processos' não encontrada");
        setLoading(false);
        return;
      }
      const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
      const parsed: Row[] = json.map((r: any) => ({
        titulo: String(r.titulo || r.Titulo || "").trim(),
        cnpj_cliente: normalizeText(r.cnpj_cliente || r.cnpj || "") || null,
        cliente_nome: normalizeText(r.cliente_nome || r.cliente || "") || null,
        responsavel_email: String(r.responsavel_email || r.responsavel || "").trim(),
        setor: String(r.setor || "").toLowerCase().trim(),
        prioridade: normalizeText(r.prioridade || "").toLowerCase() || null,
        prazo: normalizeText(r.prazo || "") || null,
        status: String(r.status || "").trim(),
        descricao: normalizeText(r.descricao || "") || null,
        etiquetas: normalizeText(r.etiquetas || "") || null,
        orgao_nome: normalizeText(r.orgao_nome || r.orgao || "") || null,
        processo_numero: normalizeText(r.processo_numero || r.processo_num || r.numero || "") || null,
      }));
      // validate
      const withErr = parsed.map((p) => ({ ...p, __errors: validateRow(p) }));
      
      // Identificar novos órgãos que precisam ser criados
      const orgaoNomes = Array.from(new Set(withErr.map(r => r.orgao_nome).filter(Boolean))) as string[];
      if (orgaoNomes.length) {
        const { data: existingOrgaos } = await supabase
          .from("orgaos_instituicoes")
          .select("nome")
          .in("nome", orgaoNomes);
        
        const existingNames = new Set((existingOrgaos || []).map((o: any) => o.nome));
        const missing = orgaoNomes.filter(nome => !existingNames.has(nome));
        setNewOrgaos(missing);
      } else {
        setNewOrgaos([]);
      }
      
      setRows(withErr);
      setErrorReport(null);
    } finally {
      setLoading(false);
    }
  };

  const updateCell = (idx: number, key: keyof Row, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      const row = { ...copy[idx], [key]: value } as Row;
      row.__errors = validateRow(row);
      copy[idx] = row;
      return copy;
    });
  };

  const anyErrors = rows.some((r) => r.__errors && Object.keys(r.__errors).length > 0);

  const createNewOrgaos = async () => {
    if (!isAdmin || !newOrgaos.length) return;
    
    try {
      const orgaosToCreate = newOrgaos.map(nome => ({ nome }));
      const { error } = await supabase
        .from("orgaos_instituicoes")
        .insert(orgaosToCreate);
      
      if (error) throw error;
      
      toast.success(`${newOrgaos.length} órgão(s) criado(s) com sucesso`);
      setNewOrgaos([]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao criar órgãos");
    }
  };

  const handleImport = async () => {
    if (!rows.length) {
      toast.error("Nenhuma linha para importar");
      return;
    }
    setProgress(0);
    setLoading(true);
    const errors: Row[] = [];
    try {
      // Resolve responsaveis
      const emails = Array.from(new Set(rows.map((r) => r.responsavel_email.trim().toLowerCase()).filter(Boolean)));
      const { data: perf } = await supabase.from("profiles").select("id, email, nome").in("email", emails);
      const byEmail: Record<string, string> = {};
      (perf || []).forEach((p: any) => { byEmail[(p.email as string).toLowerCase()] = p.id as string; });

      // Resolve clientes por CNPJ ou nome
      const cnpjs = Array.from(new Set(rows.map((r) => r.cnpj_cliente).filter(Boolean))) as string[];
      const nomes = Array.from(new Set(rows.map((r) => r.cliente_nome).filter(Boolean))) as string[];
      const [cliByCnpj, cliByNome] = await Promise.all([
        cnpjs.length ? supabase.from("clients").select("id, cnpj").in("cnpj", cnpjs) : Promise.resolve({ data: [] as any }),
        nomes.length ? supabase.from("clients").select("id, nome_empresarial, nome_fantasia") : Promise.resolve({ data: [] as any }),
      ]);
      const mapCnpj: Record<string, string> = {};
      (cliByCnpj.data || []).forEach((c: any) => { mapCnpj[c.cnpj] = c.id; });
      const mapNome: Record<string, string> = {};
      (cliByNome.data || []).forEach((c: any) => { mapNome[(c.nome_fantasia || c.nome_empresarial).toLowerCase()] = c.id; });

      // Resolve órgãos por nome
      const orgaoNomes = Array.from(new Set(rows.map((r) => r.orgao_nome).filter(Boolean))) as string[];
      const mapOrgao: Record<string, string> = {};
      if (orgaoNomes.length) {
        const { data: orgaos } = await supabase.from("orgaos_instituicoes").select("id, nome").in("nome", orgaoNomes);
        (orgaos || []).forEach((o: any) => { mapOrgao[o.nome] = o.id; });
      }

      let done = 0;
      for (const r of rows) {
        const errs = validateRow(r);
        const email = r.responsavel_email.trim().toLowerCase();
        const respId = byEmail[email];
        const isOwn = respId === profile?.id;
        const allowed = isAdmin || isOwn;
        if (!respId) {
          errors.push({ ...r, __errors: { __row: "Responsável não encontrado" } });
          continue;
        }
        if (!allowed) {
          errors.push({ ...r, __errors: { __row: "Sem permissão para criar para este responsável" } });
          continue;
        }
        if (Object.keys(errs).length) {
          errors.push({ ...r, __errors: { __row: "Linha inválida", ...errs } });
          continue;
        }
        
        // Verificar se órgão existe (se especificado)
        const orgaoId = r.orgao_nome ? mapOrgao[r.orgao_nome] : null;
        if (r.orgao_nome && !orgaoId) {
          errors.push({ ...r, __errors: { __row: `Órgão "${r.orgao_nome}" não encontrado` } });
          continue;
        }
        
        const prio = r.prioridade ? mapPrioridade(r.prioridade) : null;
        const stat = mapStatus(r.status) as Status | null;
        const prazoISO = r.prazo ? parseDate(r.prazo) : null;
        const etiquetasArr = r.etiquetas ? r.etiquetas.split(";").map((s) => s.trim()).filter(Boolean) : [];
        const clienteId = r.cnpj_cliente ? mapCnpj[r.cnpj_cliente] : (r.cliente_nome ? mapNome[(r.cliente_nome || "").toLowerCase()] : null);
        const payload: any = {
          titulo: r.titulo,
          cliente_id: clienteId || null,
          responsavel_id: respId,
          setor: r.setor as Setor,
          prioridade: prio || "media",
          prazo: prazoISO,
          status: stat || "aberto",
          descricao: r.descricao || null,
          etiquetas: etiquetasArr,
          orgao_id: orgaoId || null,
          processo_numero: r.processo_numero || null,
        };
        const { error } = await supabase.from("processos").insert(payload);
        if (error) {
          errors.push({ ...r, __errors: { __row: error.message } });
        }
        done++;
        setProgress(Math.round((done / rows.length) * 100));
      }
      if (errors.length) {
        setErrorReport(errors);
        toast.error(`Importação concluída com erros (${errors.length}/${rows.length})`);
      } else {
        toast.success("Importação concluída com sucesso");
        onOpenChange(false);
        onImported?.();
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha na importação");
    } finally {
      setLoading(false);
    }
  };

  const downloadErrors = () => {
    if (!errorReport?.length) return;
    const data = errorReport.map((r) => ({ ...r, erro: r.__errors?.__row || "" }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Erros");
    XLSX.writeFile(wb, "erros-importacao-processos.xlsx");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Importar Processos via XLSX</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input type="file" accept=".xlsx" onChange={(e) => e.target.files && onFile(e.target.files[0])} />
          {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
        </div>

        {/* Novos órgãos que precisam ser criados */}
        {newOrgaos.length > 0 && (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
            <div className="text-sm font-medium text-orange-800 mb-2">
              Órgãos não encontrados (será necessário criar):
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {newOrgaos.map((nome) => (
                <Badge key={nome} variant="outline" className="text-orange-700 border-orange-300">
                  {nome}
                </Badge>
              ))}
            </div>
            {isAdmin ? (
              <Button size="sm" variant="outline" onClick={createNewOrgaos} className="text-orange-700 border-orange-300">
                Criar órgãos faltantes
              </Button>
            ) : (
              <div className="text-xs text-orange-700">
                Apenas administradores podem criar novos órgãos.
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="w-full bg-secondary rounded h-2 overflow-hidden">
            <div className="h-2 bg-primary" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Preview */}
        {rows.length > 0 && (
          <div className="rounded-md border max-h-[50vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    "titulo","cnpj_cliente","cliente_nome","responsavel_email","setor","prioridade","prazo","status","descricao","etiquetas","orgao_nome","processo_numero"
                  ].map((h) => (
                    <TableHead key={h} className="whitespace-nowrap capitalize">{h.replace(/_/g, " ")}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={idx}>
                    {(Object.keys(r) as (keyof Row)[]).filter((k) => !k.startsWith("__")).map((k) => (
                      <TableCell key={String(k)}>
                        <Input
                          value={(r[k] as any) || ""}
                          onChange={(e) => updateCell(idx, k, e.target.value)}
                          className={r.__errors && r.__errors[k] ? "border-destructive" : ""}
                        />
                        {r.__errors && r.__errors[k] && (
                          <div className="text-[10px] text-destructive mt-0.5">{r.__errors[k]}</div>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between">
          {anyErrors ? (
            <Badge variant="destructive">Há erros na planilha</Badge>
          ) : rows.length ? (
            <Badge variant="success">Pronto para importar</Badge>
          ) : (
            <span className="text-sm text-muted-foreground">Selecione um arquivo XLSX</span>
          )}
          <div className="flex items-center gap-2">
            {errorReport?.length ? (
              <Button variant="outline" onClick={downloadErrors}>Baixar erros</Button>
            ) : null}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!rows.length || loading}>Importar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
