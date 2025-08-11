import { useEffect } from "react";
import { useParams } from "react-router-dom";

export default function ProcessoDetalhes() {
  const { id } = useParams();

  useEffect(() => {
    document.title = `Detalhes do Processo | ${id}`;
  }, [id]);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Detalhes do Processo</h1>
      <p className="text-muted-foreground mt-2">ID: {id}</p>
    </main>
  );
}
