import { respostaPlanilha } from "@/lib/exportacao";
import { podeVerTodasEmendas, temPermissao } from "@/lib/authz";
import { listarEmendas, orgaosDaArea } from "@/lib/emendas/consultas";
import { autoresDaEmenda, ondeParticipa, parteDe } from "@/lib/emendas/autoria";
import { lerFiltros, ondeDosFiltros } from "@/lib/emendas/filtros";
import { PARCELA, STATUS_EMENDA } from "@/lib/emendas/rotulos";
import { usuarioDaSessao } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { NAO_REMETIDAS } from "@/lib/emendas/situacoes";

// Exportação das emendas do exercício (CSV ou XLSX), com a mesma consulta da
// tela. Da lista de emendas (lista=1): quem vê todas exporta todas; o autor,
// só as próprias, em qualquer situação. Das demais telas: as remetidas, para
// quem vê todas as emendas ou analisa (Comissão, Presidência, Executivo).
export async function GET(req: Request) {
  const ator = await usuarioDaSessao();
  if (!ator) return new Response("Não autenticado.", { status: 401 });
  const url = new URL(req.url);
  const ano = Number(url.searchParams.get("ano"));
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return new Response("Ano inválido.", { status: 400 });
  const formato = url.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";
  const daLista = url.searchParams.get("lista") === "1";
  const todas = podeVerTodasEmendas(ator) || temPermissao(ator, "analisarViabilidade", "registrarExecucao", "consultarTudo");
  let escopo: Prisma.EmendaWhereInput;
  if (daLista && podeVerTodasEmendas(ator)) escopo = {};
  else if (daLista) {
    const autor = await prisma.autor.findUnique({ where: { usuarioId: ator.id }, select: { id: true } });
    if (!autor && !todas) return new Response("Sem permissão.", { status: 403 });
    escopo = autor ? ondeParticipa(autor.id) : { status: { notIn: NAO_REMETIDAS } };
  } else {
    if (!todas) return new Response("Sem permissão.", { status: 403 });
    escopo = { status: { notIn: NAO_REMETIDAS } };
  }

  // Os mesmos filtros da tela (situação, autor, área, texto e período).
  const f = lerFiltros(Object.fromEntries(url.searchParams));
  const filtro = ondeDosFiltros(f, await orgaosDaArea(f.areaId));
  const emendas = await listarEmendas(ano, { AND: [filtro, escopo] });
  const dia = (d: Date | null | undefined) => (d ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
  const linhas = emendas.map((e) => {
    const d = e.dotacao;
    return {
      Numero: e.numero,
      Exercicio: ano,
      Situacao: STATUS_EMENDA[e.status].rotulo,
      Autor: e.autor.nome,
      // Coautoria: os demais vereadores com a parte de cada um.
      Coautores: autoresDaEmenda(e)
        .filter((a) => !a.principal)
        .map((a) => `${a.nome} (${a.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`)
        .join("; "),
      ParteDoAutor: parteDe(e, e.autorId),
      Objeto: e.objeto,
      Beneficiario: e.destino?.nome ?? "",
      Orgao: d?.orgao.codigo ?? "",
      OrgaoNome: d?.orgao.nome ?? "",
      Unidade: d?.unidadeOrcamentaria.codigo ?? "",
      UnidadeNome: d?.unidadeOrcamentaria.nome ?? "",
      Funcao: d?.funcao.codigo ?? "",
      Subfuncao: d?.subfuncao.codigo ?? "",
      Programa: d?.programa.codigo ?? "",
      ProgramaNome: d?.programa.nome ?? "",
      Acao: d?.acao.codigo ?? "",
      AcaoNome: d?.acao.nome ?? "",
      Natureza: d?.naturezaDespesa.codigo ?? "",
      Fonte: d?.fonteRecurso.codigo ?? "",
      Ficha: d?.ficha ?? "",
      Parcela: e.parcelaEfetiva ? PARCELA[e.parcelaEfetiva] : "",
      Valor: e.valor.toNumber(),
      Remetida: dia(e.submetidaEm),
      Decidida: dia(e.tramitadaEm),
      IncorporadaNaLei: dia(e.incorporadaEm),
      Empenhado: e.somasExec.empenhado,
      Liquidado: e.somasExec.liquidado,
      Pago: e.somasExec.pago,
    };
  });
  // Uma linha por vereador e emenda, com a parte dele: é o que soma na cota.
  const partes = emendas.flatMap((e) =>
    autoresDaEmenda(e).map((a) => ({
      Numero: e.numero,
      Exercicio: ano,
      Vereador: a.nome,
      Partido: a.partido ?? "",
      Papel: a.principal ? "Autor" : "Coautor",
      Parte: a.valor,
      ValorDaEmenda: e.valor.toNumber(),
      Situacao: STATUS_EMENDA[e.status].rotulo,
      Parcela: e.parcelaEfetiva ? PARCELA[e.parcelaEfetiva] : "",
      Objeto: e.objeto,
    }))
  );
  // O CSV leva uma aba só (a de emendas); a planilha, as duas.
  return respostaPlanilha(
    formato,
    `emendas-${ano}`,
    formato === "xlsx" ? [{ nome: "Emendas", linhas }, { nome: "Partes por vereador", linhas: partes }] : [{ nome: "Emendas", linhas }]
  );
}
