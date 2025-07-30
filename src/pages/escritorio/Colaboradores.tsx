import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { UserCheck, Plus } from "lucide-react"

export function Colaboradores() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Colaboradores</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie a equipe do escritório
          </p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" />
          Novo Colaborador
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipe do Escritório</CardTitle>
          <CardDescription>
            12 colaboradores ativos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <UserCheck className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Funcionalidade em desenvolvimento</p>
            <p className="text-sm">Em breve você poderá gerenciar toda a equipe aqui</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}