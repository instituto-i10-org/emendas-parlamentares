import { podeGerirPlanejamento, temPermissao } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { usuarioDaSessao } from "@/lib/session";

// Relatório da leitura: cada linha recusada ou com aviso, com o número da
// linha (ou a página) e o motivo. CSV com ponto e vírgula, para o Excel.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await usuarioDaSessao();
  if (!user || !(podeGerirPlanejamento(user) || temPermissao(user, "consultarTudo"))) return new Response("Sem permissão.", { status: 403 });
  const { id } = await params;
  const linhas = await prisma.linhaImportada.findMany({
    where: { importacaoId: id, OR: [{ motivos: { isEmpty: false } }, { avisos: { isEmpty: false } }] },
    orderBy: [{ pagina: "asc" }, { numero: "asc" }],
  });
  const q = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const corpo = ["linha;pagina;situacao;motivo;conteudo"]
    .concat(
      linhas.flatMap((l) =>
        [...l.motivos.map((m) => ["recusada", m]), ...l.avisos.map((m) => ["aviso", m])].map(([s, m]) =>
          [l.numero, l.pagina ?? "", s, q(m), q(Object.values(l.campos as Record<string, string>).join(" | "))].join(";")
        )
      )
    )
    .join("\r\n");
  return new Response("﻿" + corpo + "\r\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="relatorio-importacao-${id}.csv"` },
  });
}
