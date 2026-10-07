import { CAMPOS_DESTINOS, CAMPOS_HISTORICO, modeloCsv } from "@/lib/cadastros/planilhas";

// Planilha-modelo dos cadastros em lote: só o cabeçalho, com os nomes
// reconhecidos (CSV com ponto e vírgula; abre certo no Excel em português).
export async function GET(req: Request) {
  const tipo = new URL(req.url).searchParams.get("tipo");
  const modelos = {
    destinos: { campos: CAMPOS_DESTINOS, nome: "modelo-destinos.csv" },
    historico: { campos: CAMPOS_HISTORICO, nome: "modelo-emendas-anos-anteriores.csv" },
  } as const;
  const m = tipo === "destinos" || tipo === "historico" ? modelos[tipo] : null;
  if (!m) return new Response("Tipo de planilha inválido.", { status: 400 });
  return new Response(modeloCsv(m.campos), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${m.nome}"` },
  });
}
