import type { Metadata } from "next";
import Link from "next/link";
import { Pagina } from "@/components/app/pagina";
import { AbaPerfis, AbaUsuarios, type PerfilTela } from "@/components/config/acesso";
import { AbaAuditoria, AbaBiblioteca, AbaDestinos, AbaNormas } from "@/components/config/catalogos";
import { AbaExercicio } from "@/components/config/exercicio";
import { AbaFontesPreco } from "@/components/config/fontes-preco";
import { AbaValidacao } from "@/components/config/validacao";
import { AbaPortal } from "@/components/config/portal";
import { requireAccess } from "@/lib/access";
import { PERMISSOES, podeAtribuirPerfil, podeGerirExercicio, podeGerirPerfis, temPermissao } from "@/lib/authz";
import { diaBrasilia, paraDestinoMotor } from "@/lib/emendas/contexto";
import { getAnoAtivo, listarExercicios } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { DATA_HORA } from "@/lib/riep";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Configurações — Emendas360" };

const ABAS = [
  { id: "exercicio", titulo: "Exercício e parâmetros" },
  { id: "validacao", titulo: "Validação" },
  { id: "portal", titulo: "Portal e manual" },
  { id: "usuarios", titulo: "Usuários" },
  { id: "perfis", titulo: "Perfis", adminGeral: true },
  { id: "destinos", titulo: "Destinos" },
  { id: "biblioteca", titulo: "Biblioteca de objetos" },
  { id: "precos", titulo: "Fontes de preço" },
  { id: "normas", titulo: "Base legal" },
  { id: "auditoria", titulo: "Auditoria" },
] as const;

const num = (v: { toNumber(): number } | null | undefined) => (v == null ? null : v.toNumber());

export default async function ConfigPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAccess({ permissoes: ["administrarConfiguracoes"] });
  const sp = await searchParams;
  const abaParam = sp.aba;
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
      {aba === "portal" ? await portal(temPermissao(user, "administrarConfiguracoes")) : null}
      {aba === "usuarios" ? await usuarios(user) : null}
      {aba === "perfis" ? await perfis(user) : null}
      {aba === "destinos" ? await destinos() : null}
      {aba === "biblioteca" ? await biblioteca() : null}
      {aba === "precos" ? await fontesPreco(temPermissao(user, "administrarConfiguracoes")) : null}
      {aba === "normas" ? await normas() : null}
      {aba === "auditoria" ? await auditoria(sp) : null}
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
  const ano = await getAnoAtivo();
  const [lista, unidadesDb] = await Promise.all([
    prisma.destino.findMany({ orderBy: [{ execucao: "asc" }, { nome: "asc" }], include: { _count: { select: { emendas: true } } } }),
    ano ? prisma.unidadeOrcamentaria.findMany({ where: { exercicio: { ano } }, orderBy: { codigo: "asc" }, select: { codigo: true, nome: true } }) : [],
  ]);
  const unidades = Object.fromEntries(unidadesDb.map((u) => [u.codigo, u.nome]));
  return (
    <AbaDestinos
      unidades={unidadesDb}
      exercicio={ano ?? new Date().getFullYear()}
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
        apelidos: d.apelidos,
        tela: d.origem === "CADASTRO" ? paraDestinoMotor(d, unidades) : null,
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

async function portal(podeEditar: boolean) {
  const [m, atos] = await Promise.all([
    prisma.municipio.findFirst({ include: { manualPublicadoPor: { select: { name: true, email: true } } } }),
    prisma.documentoNormativo.findMany({ where: { ativo: true }, orderBy: [{ tipo: "asc" }, { titulo: "asc" }] }),
  ]);
  return (
    <AbaPortal
      podeEditar={podeEditar}
      portalPublico={m?.portalPublico ?? true}
      atoId={m?.manualAtoId ?? null}
      publicadoEm={m?.manualPublicadoEm ? DATA_HORA(m.manualPublicadoEm) : null}
      publicadoPor={m?.manualPublicadoPor?.name ?? m?.manualPublicadoPor?.email ?? null}
      atos={atos.map((a) => ({ id: a.id, rotulo: `${a.titulo}${a.numero ? ` nº ${a.numero}` : ""}${a.artigo ? ` — ${a.artigo}` : ""}`.slice(0, 140) }))}
    />
  );
}

async function normas() {
  const lista = await prisma.documentoNormativo.findMany({ orderBy: [{ ativo: "desc" }, { tipo: "asc" }, { titulo: "asc" }], include: { arquivo: { select: { id: true, nome: true } } } });
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  return (
    <AbaNormas
      normas={lista.map((n) => ({
        id: n.id,
        tipo: n.tipo,
        titulo: n.titulo,
        numero: n.numero,
        artigo: n.artigo,
        trecho: n.trecho,
        url: n.url,
        dataAto: iso(n.dataAto),
        dataVigencia: iso(n.dataVigencia),
        vigenciaFim: iso(n.vigenciaFim),
        arquivo: n.arquivo,
        ativo: n.ativo,
      }))}
    />
  );
}

const AUDITORIA_POR_PAGINA = 50;

// Trilha com filtro por período, usuário, entidade e ação; paginada.
async function auditoria(sp: Record<string, string | undefined>) {
  const data = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  const filtros = { de: data(sp.de), ate: data(sp.ate), usuario: (sp.usuario ?? "").slice(0, 40), entidade: (sp.entidade ?? "").slice(0, 60), acao: (sp.acao ?? "").trim().slice(0, 60) };
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const where = {
    ...(filtros.de || filtros.ate
      ? { criadoEm: { ...(filtros.de ? { gte: new Date(`${filtros.de}T00:00:00-03:00`) } : {}), ...(filtros.ate ? { lte: new Date(`${filtros.ate}T23:59:59-03:00`) } : {}) } }
      : {}),
    ...(filtros.usuario ? { usuarioId: filtros.usuario } : {}),
    ...(filtros.entidade ? { entidade: filtros.entidade } : {}),
    ...(filtros.acao ? { acao: { contains: filtros.acao, mode: "insensitive" as const } } : {}),
  };
  const [total, lista, usuarios, entidades] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { criadoEm: "desc" }, skip: (pagina - 1) * AUDITORIA_POR_PAGINA, take: AUDITORIA_POR_PAGINA, include: { usuario: { select: { name: true, email: true } } } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.auditLog.findMany({ distinct: ["entidade"], select: { entidade: true }, orderBy: { entidade: "asc" } }),
  ]);
  return (
    <AbaAuditoria
      total={total}
      pagina={pagina}
      porPagina={AUDITORIA_POR_PAGINA}
      filtros={filtros}
      usuarios={usuarios.map((u) => ({ id: u.id, nome: u.name ?? u.email ?? u.id }))}
      entidades={entidades.map((e) => e.entidade)}
      linhas={lista.map((l) => ({
        id: l.id,
        quando: DATA_HORA(l.criadoEm),
        usuario: l.usuario?.name ?? l.usuario?.email ?? "sistema",
        entidade: l.entidade,
        entidadeId: l.entidadeId,
        acao: l.acao,
        antes: l.dadosAntes,
        depois: l.dadosDepois,
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
      prazoDiligenciaDias={ex.configuracao?.prazoDiligenciaDias ?? 5}
      fundamentos={(ex.configuracao?.fundamentos as Record<string, { texto: string; normaId: string | null }> | null) ?? {}}
    />
  );
}
