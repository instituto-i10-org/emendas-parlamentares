import type { Metadata } from "next";
import Link from "next/link";
import { Pagina } from "@/components/app/pagina";
import { AbaPerfis, AbaUsuarios, type PerfilTela } from "@/components/config/acesso";
import { AbaAuditoria, AbaBiblioteca, AbaDestinos, AbaNormas } from "@/components/config/catalogos";
import { AbaExercicio } from "@/components/config/exercicio";
import { AbaFontesPreco } from "@/components/config/fontes-preco";
import { AbaValidacao } from "@/components/config/validacao";
import { requireAccess } from "@/lib/access";
import { PERMISSOES, podeAtribuirPerfil, podeGerirExercicio, podeGerirPerfis, temPermissao } from "@/lib/authz";
import { diaBrasilia } from "@/lib/emendas/contexto";
import { getAnoAtivo, listarExercicios } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { DATA_HORA } from "@/lib/riep";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Configurações — Emendas360" };

const ABAS = [
  { id: "exercicio", titulo: "Exercício e parâmetros" },
  { id: "validacao", titulo: "Validação" },
  { id: "usuarios", titulo: "Usuários" },
  { id: "perfis", titulo: "Perfis", adminGeral: true },
  { id: "destinos", titulo: "Destinos" },
  { id: "biblioteca", titulo: "Biblioteca de objetos" },
  { id: "precos", titulo: "Fontes de preço" },
  { id: "normas", titulo: "Base legal" },
  { id: "auditoria", titulo: "Auditoria" },
] as const;

const num = (v: { toNumber(): number } | null | undefined) => (v == null ? null : v.toNumber());

export default async function ConfigPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const user = await requireAccess({ permissoes: ["administrarConfiguracoes"] });
  const { aba: abaParam } = await searchParams;
  const abas = ABAS.filter((a) => !("adminGeral" in a) || podeGerirPerfis(user));
  const aba = abas.find((a) => a.id === abaParam)?.id ?? "exercicio";

  return (
    <Pagina titulo="Configurações" descricao="Parâmetros do município e do exercício, acesso, catálogos do motor e base legal. Toda alteração fica na auditoria.">
      <nav aria-label="Seções" className="mb-5 flex flex-wrap gap-1 rounded-box bg-surface p-1.5 shadow-[0_1px_2px_rgba(10,36,99,.06)]">
        {abas.map((a) => (
          <Link
            key={a.id}
            href={`/config?aba=${a.id}`}
            aria-current={a.id === aba ? "page" : undefined}
            className={cn("rounded-md px-3.5 py-2 text-sm font-semibold", a.id === aba ? "bg-navy text-white" : "text-muted-foreground hover:bg-soft")}
          >
            {a.titulo}
          </Link>
        ))}
      </nav>
      {aba === "exercicio" ? await exercicio(podeGerirExercicio(user)) : null}
      {aba === "validacao" ? await validacao(podeGerirExercicio(user)) : null}
      {aba === "usuarios" ? await usuarios(user) : null}
      {aba === "perfis" ? await perfis(user) : null}
      {aba === "destinos" ? await destinos() : null}
      {aba === "biblioteca" ? await biblioteca() : null}
      {aba === "precos" ? await fontesPreco(temPermissao(user, "administrarConfiguracoes")) : null}
      {aba === "normas" ? await normas() : null}
      {aba === "auditoria" ? await auditoria() : null}
    </Pagina>
  );
}

async function exercicio(podeGerir: boolean) {
  const [lista, ano] = await Promise.all([listarExercicios(), getAnoAtivo()]);
  const atual = ano ? await prisma.exercicio.findUnique({ where: { ano }, include: { configuracao: true, prazos: { orderBy: { data: "asc" } } } }) : null;
  const c = atual?.configuracao;
  return (
    <AbaExercicio
      exercicios={lista}
      podeGerir={podeGerir}
      prazos={(atual?.prazos ?? []).map((p) => ({ id: p.id, descricao: p.descricao, data: p.data.toISOString().slice(0, 10), url: p.url }))}
      config={
        atual
          ? {
              exercicioId: atual.id,
              ano: atual.ano,
              cotaIndividual: num(c?.cotaIndividual),
              percentualRcl: num(c?.percentualRcl),
              rclBase: num(c?.rclBase),
              rclAnoBase: c?.rclAnoBase ?? null,
              rclObservacao: c?.rclObservacao ?? null,
              numeroVereadores: c?.numeroVereadores ?? null,
              memoriaCota: c?.memoriaCota ?? null,
              percentualSaude: num(c?.percentualSaude) ?? 50,
              afericaoSaude: c?.afericaoSaude ?? "GLOBAL",
              observacaoSaude: c?.observacaoSaude ?? null,
              toleranciaValorPct: num(c?.toleranciaValorPct) ?? 10,
              validadeReferenciaMeses: c?.validadeReferenciaMeses ?? 12,
              percentualAcessorio: num(c?.percentualAcessorio) ?? 20,
              fonteAudesp: c?.fonteAudesp ?? null,
              fonteAudespNome: c?.fonteAudespNome ?? null,
              codigoAplicacao: c?.codigoAplicacao ?? null,
              formatoVariacao: c?.formatoVariacao ?? 4,
              icEpVigente: c?.icEpVigente ?? false,
              icEpCodigo: c?.icEpCodigo ?? null,
              orgaosForaDasEmendas: c?.orgaosForaDasEmendas ?? [],
              rotuloBase: c?.rotuloBase ?? null,
              // Guardado às 23:59:59 de Brasília: o dia se lê no mesmo fuso.
              prazoProtocolo: c?.prazoProtocolo ? diaBrasilia(c.prazoProtocolo) : null,
              fontePrecoObrigatoria: c?.fontePrecoObrigatoria ?? true,
              situacoesEmendamento: c?.situacoesEmendamento ?? ["EM_TRAMITACAO"],
              validadeLinkEntidadeDias: c?.validadeLinkEntidadeDias ?? 10,
            }
          : null
      }
    />
  );
}

async function listaPerfis(user: Awaited<ReturnType<typeof requireAccess>>): Promise<PerfilTela[]> {
  const lista = await prisma.perfilAcesso.findMany({ orderBy: [{ perfilDoSistema: "desc" }, { nome: "asc" }], include: { _count: { select: { usuarios: true } } } });
  return lista.map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    poder: p.poder,
    adminGeral: p.adminGeral,
    perfilDoSistema: p.perfilDoSistema,
    permissoes: PERMISSOES.filter((k) => p[k]),
    usuarios: p._count.usuarios,
    atribuivel: podeAtribuirPerfil(user, p),
  }));
}

async function usuarios(user: Awaited<ReturnType<typeof requireAccess>>) {
  const [lista, perfisTela, autores] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, include: { perfil: true, autor: true } }),
    listaPerfis(user),
    prisma.autor.findMany({ orderBy: { nome: "asc" }, select: { nome: true } }),
  ]);
  return (
    <AbaUsuarios
      perfis={perfisTela}
      autores={autores.map((a) => a.nome)}
      usuarios={lista.map((u) => ({
        id: u.id,
        nome: u.name ?? u.email ?? "—",
        email: u.email ?? "",
        perfilId: u.perfilId,
        perfilNome: u.perfil?.nome ?? null,
        autor: u.autor?.nome ?? null,
        editavel: !u.perfil || podeAtribuirPerfil(user, u.perfil),
        poder: u.perfil?.poder ?? null,
        ativo: u.ativo,
      }))}
    />
  );
}

async function perfis(user: Awaited<ReturnType<typeof requireAccess>>) {
  return <AbaPerfis perfis={await listaPerfis(user)} />;
}

async function destinos() {
  const lista = await prisma.destino.findMany({ orderBy: [{ execucao: "asc" }, { nome: "asc" }], include: { _count: { select: { emendas: true } } } });
  return (
    <AbaDestinos
      destinos={lista.map((d) => ({
        id: d.id,
        nome: d.nome,
        execucao: d.execucao,
        unidade: d.unidadeCodigo,
        endereco: d.endereco,
        cnpj: d.cnpj,
        origem: d.origem,
        ativo: d.ativo,
        pendencia: d.pendenciaHabilitacao,
        subfuncao: d.subfuncaoSugerida,
        emendas: d._count.emendas,
      }))}
    />
  );
}

async function biblioteca() {
  const [areas, objetos] = await Promise.all([
    prisma.areaAplicacao.findMany({ orderBy: { ordem: "asc" } }),
    prisma.objetoBiblioteca.findMany({ orderBy: { ordem: "asc" }, include: { area: true } }),
  ]);
  return (
    <AbaBiblioteca
      areas={areas.map((a) => ({ id: a.id, nome: a.nome, orgaos: a.orgaos, unidadePadrao: a.unidadePadrao }))}
      objetos={objetos.map((o) => ({
        id: o.id,
        rotulo: o.rotulo,
        termos: o.termos,
        natureza: o.natureza,
        elemento: o.elemento,
        divisibilidade: o.divisibilidade,
        subfuncao: o.subfuncao,
        estrito: o.estrito,
        explicacao: o.explicacao,
        areaId: o.areaId,
        area: o.area?.nome ?? null,
        ativo: o.ativo,
      }))}
    />
  );
}

async function normas() {
  const lista = await prisma.documentoNormativo.findMany({ orderBy: [{ ativo: "desc" }, { tipo: "asc" }, { titulo: "asc" }] });
  return <AbaNormas normas={lista.map((n) => ({ id: n.id, tipo: n.tipo, titulo: n.titulo, numero: n.numero, artigo: n.artigo, trecho: n.trecho, url: n.url, ativo: n.ativo }))} />;
}

async function auditoria() {
  const lista = await prisma.auditLog.findMany({ orderBy: { criadoEm: "desc" }, take: 300, include: { usuario: { select: { name: true, email: true } } } });
  return (
    <AbaAuditoria
      linhas={lista.map((l) => ({
        id: l.id,
        quando: DATA_HORA(l.criadoEm),
        usuario: l.usuario?.name ?? l.usuario?.email ?? "sistema",
        entidade: l.entidade,
        entidadeId: l.entidadeId,
        acao: l.acao,
      }))}
    />
  );
}

async function fontesPreco(podeEditar: boolean) {
  const lista = await prisma.fontePrecoOficial.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }], include: { _count: { select: { referencias: true } } } });
  return (
    <AbaFontesPreco
      podeEditar={podeEditar}
      fontes={lista.map((f) => ({
        id: f.id,
        nome: f.nome,
        url: f.url,
        orientacao: f.orientacao,
        aplicaA: f.aplicaA,
        tipo: f.tipo,
        ordem: f.ordem,
        ativo: f.ativo,
        usos: f._count.referencias,
      }))}
    />
  );
}

async function validacao(podeEditar: boolean) {
  const ano = await getAnoAtivo();
  const ex = ano ? await prisma.exercicio.findUnique({ where: { ano }, include: { configuracao: true } }) : null;
  if (!ex || !ano) return <p className="text-sm text-muted-foreground">Nenhum exercício.</p>;
  const [regras, normasDb] = await Promise.all([
    prisma.regraValidacao.findMany({ where: { exercicioId: ex.id } }),
    prisma.documentoNormativo.findMany({ where: { ativo: true }, orderBy: [{ tipo: "asc" }, { titulo: "asc" }] }),
  ]);
  return (
    <AbaValidacao
      exercicioId={ex.id}
      ano={ano}
      podeEditar={podeEditar}
      regras={regras.map((r) => ({ codigo: r.codigo, modo: r.modo, ativa: r.ativa, fundamento: r.fundamento ?? "", normaId: r.normaId }))}
      normas={normasDb.map((n) => ({ id: n.id, rotulo: `${n.titulo}${n.artigo ? `, ${n.artigo}` : ""}`.slice(0, 120) }))}
      fundamentos={(ex.configuracao?.fundamentos as Record<string, { texto: string; normaId: string | null }> | null) ?? {}}
    />
  );
}
