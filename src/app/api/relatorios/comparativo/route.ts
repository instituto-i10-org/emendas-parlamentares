import { respostaPlanilha } from "@/lib/exportacao";
import { dadosComparativo } from "@/lib/orcamento/comparativo-servidor";
import { usuarioDaSessao } from "@/lib/session";

// Comparativo projeto × lei por dotação, em CSV ou XLSX, com os filtros da tela.
export async function GET(req: Request) {
  const ator = await usuarioDaSessao();
  if (!ator) return new Response("Não autenticado.", { status: 401 });
  const url = new URL(req.url);
  const ano = Number(url.searchParams.get("ano"));
  if (!Number.isInteger(ano)) return new Response("Ano inválido.", { status: 400 });
  const orgao = url.searchParams.get("orgao") ?? "";
  const uo = url.searchParams.get("uo") ?? "";
  const dados = await dadosComparativo(ano);
  if (!dados) return new Response("Exercício não encontrado.", { status: 404 });
  const linhas = (
    dados.linhas
      .filter((l) => {
        const d = (l.pl ?? l.lei)!;
        return (!orgao || d.orgao === orgao) && (!uo || d.uo === uo);
      })
      .map((l) => {
        const d = (l.pl ?? l.lei)!;
        return {
          Codigo: d.codigo,
          Ficha: d.ficha ?? "",
          Acao: d.nome,
          Unidade: d.uo,
          Natureza: d.natureza,
          Fonte: d.fonte,
          Projeto: l.valorPl,
          Lei: l.valorLei,
          Diferenca: l.diferenca,
          Marca: l.marca === "NOVA" ? "só na lei" : l.marca === "SUPRIMIDA" ? "só no projeto" : "",
          Emendas: l.emendas.map((e) => `nº ${e.numero ?? "—"} (${e.efeito})`).join("; "),
        };
      })
  );
  return respostaPlanilha(url.searchParams.get("formato"), `projeto-x-lei-${ano}`, [{ nome: "Comparativo", linhas }]);
}
