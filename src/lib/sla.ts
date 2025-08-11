// Shared SLA helper
export type SlaBadge = { label: string; variant: "success" | "destructive" | "warning" | "info" | "secondary" };

export function getSla(prazo?: Date | null, status?: string, dataConclusao?: Date | null): SlaBadge {
  if (!prazo) return { label: "-", variant: "secondary" };

  // Concluído => sempre verde "Concluído no prazo" (simplificado)
  if (status === "concluido") {
    return { label: "Concluído no prazo", variant: "success" };
  }

  const today = new Date();
  const atMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate());
  const diffDays = Math.ceil((target.getTime() - atMidnight.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `Atrasado +${Math.abs(diffDays)}`, variant: "destructive" };
  }
  if (diffDays === 0) {
    return { label: "Hoje", variant: "warning" };
  }
  // Futuro => D-N; para proximidade usamos "warning" (âmbar), distante "info"
  const variant = diffDays <= 3 ? "warning" : "info";
  return { label: `D-${diffDays}`, variant };
}
