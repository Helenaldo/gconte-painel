import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function Indicadores() {
  // Lista de indicadores contábeis e financeiros
  const indicadores = [
    "Liquidez Corrente",
    "Liquidez Seca", 
    "Liquidez Imediata",
    "Liquidez Geral",
    "Endividamento Geral",
    "Composição do Endividamento",
    "Imobilização do Capital Próprio",
    "Imobilização dos Recursos Não Correntes",
    "Giro do Ativo",
    "Giro do Ativo Circulante",
    "Giro do Estoque",
    "Prazo Médio de Recebimento",
    "Prazo Médio de Pagamento",
    "Margem Bruta",
    "Margem Operacional", 
    "Margem Líquida",
    "ROE - Retorno sobre Patrimônio Líquido",
    "ROA - Retorno sobre Ativo Total",
    "ROIC - Retorno sobre Capital Investido"
  ]

  // Meses do ano
  const meses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ]

  return (
    <div className="space-y-6 w-full max-w-none">
      {/* Cabeçalho */}
      <div className="flex flex-col space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Indicadores Contábeis e Financeiros</h1>
          <p className="text-muted-foreground">
            Análise comparativa dos principais indicadores empresariais
          </p>
        </div>
        
        {/* Área reservada para filtros futuros */}
        <div className="min-h-[60px] flex items-center border border-dashed border-muted-foreground/25 rounded-lg">
          <p className="text-sm text-muted-foreground ml-4">
            Área reservada para filtros e controles
          </p>
        </div>
      </div>

      {/* Tabela de Indicadores */}
      <Card className="w-[95vw] max-w-[95vw] mx-auto">
        <CardHeader>
          <CardTitle>Tabela de Indicadores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative">
            {/* Container com scroll horizontal */}
            <div className="overflow-x-auto">
              <Table className="relative">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    {/* Primeira coluna fixa - Indicadores */}
                    <TableHead className="sticky left-0 bg-background z-20 min-w-[280px] border-r font-semibold">
                      Indicador
                    </TableHead>
                    {/* Colunas dos meses */}
                    {meses.map((mes) => (
                      <TableHead 
                        key={mes} 
                        className="text-center min-w-[100px] font-semibold"
                      >
                        {mes}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicadores.map((indicador, index) => (
                    <TableRow 
                      key={indicador}
                      className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}
                    >
                      {/* Primeira coluna fixa - Nome do indicador */}
                      <TableCell className="sticky left-0 bg-inherit z-10 border-r font-medium">
                        {indicador}
                      </TableCell>
                      {/* Células dos meses com valores placeholder */}
                      {meses.map((mes) => (
                        <TableCell 
                          key={mes} 
                          className="text-center text-muted-foreground"
                        >
                          –
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nota explicativa */}
      <div className="text-sm text-muted-foreground text-center max-w-4xl mx-auto">
        <p>
          Esta tabela apresentará os indicadores calculados automaticamente com base nos balancetes parametrizados.
          Os valores serão preenchidos após a implementação dos cálculos específicos.
        </p>
      </div>
    </div>
  )
}