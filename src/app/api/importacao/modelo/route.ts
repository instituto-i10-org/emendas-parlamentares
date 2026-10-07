import { CAMPOS, type TipoCarga } from "@/lib/orcamento/colunas";
import { modeloCsv } from "@/lib/orcamento/planilha";

// Planilha-modelo da importação: só o cabeçalho, com os nomes reconhecidos.
export async function GET(req: Request) {
  const tipo = new URL(req.url).searchParams.get("tipo") as TipoCarga;
  if (!CAMPOS[tipo]) return new Response("Tipo de carga inválido.", { status: 400 });
  const nome = { DOTACOES: "modelo-dotacoes.csv", PRIORIDADES_LDO: "modelo-prioridades-ldo.csv", PROGRAMAS_PPA: "modelo-programas-ppa.csv" }[tipo];
  return new Response(modeloCsv(tipo), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"` },
  });
}
