import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, Pagina, TabelaDados } from "@/components/app/pagina";
import { AbaAreas } from "@/components/config/areas";
import { diferencaLegivel, idsDoRegistro, nomeDoRegistro, rotuloAcao, rotuloEntidade } from "@/lib/auditoria/legivel";
import { ImportarPlanilha } from "@/components/config/importar-planilha";
import { AbaMunicipio } from "@/components/config/municipio";
import { AbaTiposDestino } from "@/components/config/tipos-destino";
import { AbaPerfis, AbaUsuarios, type PerfilTela } from "@/components/config/acesso";
import { AbaAuditoria, AbaBiblioteca, AbaDestinos, AbaNormas } from "@/components/config/catalogos";
import { AbaExercicio } from "@/components/config/exercicio";
import { AbaFontesPreco } from "@/components/config/fontes-preco";
import { AbaValidacao } from "@/components/config/validacao";
import { AbaPortal } from "@/components/config/portal";
import { requireAccess } from "@/lib/access";
import { ehAdminGeral, PERMISSOES, podeAtribuirPerfil, podeGerirExercicio, podeGerirPerfis, temPermissao } from "@/lib/authz";
import { diaBrasilia, paraDestinoMotor } from "@/lib/emendas/contexto";
import { anoPadrao, getAnoAtivo, listarExercicios } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";
import { DATA_HORA } from "@/lib/riep";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Configurações — Emendas360" };

const ABAS = [
  { id: "municipio", titulo: "Município" },
  { id: "exercicio", titulo: "Exercício e parâmetros" },
  { id: "validacao", titulo: "Validação" },
  { id: "portal", titulo: "Portal e manual" },
  { id: "usuarios", titulo: "Usuários" },
  { id: "perfis", titulo: "Perfis", adminGeral: true },
  { id: "areas", titulo: "Áreas" },
  { id: "tipos-destino", titulo: "Tipos de destino" },
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
    <Pagina titulo="Configurações" guia="config" descricao="Parâmetros do município e do exercício, acesso, catálogos do motor e base legal. Toda alteração fica na auditoria.">
      <nav data-guia="config.abas" aria-label="Seções" className="mb-5 flex flex-wrap gap-1 rounded-box bg-surface p-1.5 shadow-[0_1px_2px_rgba(10,36,99,.06)]">
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
      {aba === "municipio" ? await municipio(ehAdminGeral(user)) : null}
      {aba === "exercicio" ? await exercicio(podeGerirExercicio(user)) : null}
      {aba === "exercicio" ? await historico(ehAdminGeral(user)) : null}
      {aba === "validacao" ? await validacao(podeGerirExercicio(user)) : null}
      {aba === "portal" ? await portal(temPermissao(user, "administrarConfiguracoes")) : null}
      {aba === "usuarios" ? await usuarios(user) : null}
      {aba === "perfis" ? await perfis(user) : null}
      {aba === "areas" ? await areas(ehAdminGeral(user)) : null}
      {aba === "tipos-destino" ? await tiposDestino(ehAdminGeral(user)) : null}
      {aba === "destinos" ? await destinos(ehAdminGeral(user)) : null}
      {aba === "biblioteca" ? await biblioteca() : null}
      {aba === "precos" ? await fontesPreco(temPermissao(user, "administrarConfiguracoes")) : null}
      {aba === "normas" ? await normas() : null}
      {aba === "auditoria" ? await auditoria(sp) : null}
    </Pagina>
  );
}

async function exercicio(podeGerir: boolean) {
  const [lista, ano] = await Promise.all([listarExercicios(), getAnoAtivo()]);
  // Anterior ao exercício em curso: histórico (só consulta; não encerra nem reabre).
  const padrao = anoPadrao(lista);
  const atual = ano ? await prisma.exercicio.findUnique({ where: { ano }, include: { configuracao: true, prazos: { orderBy: { data: "asc" } } } }) : null;
  const c = atual?.configuracao;
  return (
    <AbaExercicio
      exercicios={lista.map((e) => ({ ...e, historico: padrao !== null && e.ano < padrao }))}
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
              custoM2Referencia: num(c?.custoM2Referencia),
              custoM2Competencia: c?.custoM2Competencia ?? null,
              custoM2Fonte: c?.custoM2Fonte ?? null,
              custoM2Url: c?.custoM2Url ?? null,
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

async function destinos(podeImportar: boolean) {
  const ano = await getAnoAtivo();
  const [lista, unidadesDb] = await Promise.all([
    prisma.destino.findMany({ orderBy: [{ execucao: "asc" }, { nome: "asc" }], include: { _count: { select: { emendas: true } } } }),
    ano ? prisma.unidadeOrcamentaria.findMany({ where: { exercicio: { ano } }, orderBy: { codigo: "asc" }, select: { codigo: true, nome: true } }) : [],
  ]);
  const unidades = Object.fromEntries(unidadesDb.map((u) => [u.codigo, u.nome]));
  return (
    <AbaDestinos
      importar={podeImportar}
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
    ...(filtros.acao ? { acao: filtros.acao } : {}),
  };
  const [total, lista, usuarios, entidades, acoes] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { criadoEm: "desc" }, skip: (pagina - 1) * AUDITORIA_POR_PAGINA, take: AUDITORIA_POR_PAGINA, include: { usuario: { select: { name: true, email: true } } } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.auditLog.findMany({ distinct: ["entidade"], select: { entidade: true }, orderBy: { entidade: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["acao"], select: { acao: true }, orderBy: { acao: "asc" } }),
  ]);
  // Nomes no lugar dos ids que aparecem no antes e no depois.
  const nomes = await nomesDosIds(lista.flatMap((l) => idsDoRegistro(l.dadosAntes, l.dadosDepois)));
  return (
    <AbaAuditoria
      total={total}
      pagina={pagina}
      porPagina={AUDITORIA_POR_PAGINA}
      filtros={filtros}
      usuarios={usuarios.map((u) => ({ id: u.id, nome: u.name ?? u.email ?? u.id }))}
      entidades={entidades.map((e) => ({ valor: e.entidade, rotulo: rotuloEntidade(e.entidade) })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"))}
      acoes={acoes.map((a) => ({ valor: a.acao, rotulo: rotuloAcao(a.acao) })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"))}
      linhas={lista.map((l) => ({
        id: l.id,
        quando: DATA_HORA(l.criadoEm),
        usuario: l.usuario?.name ?? l.usuario?.email ?? "sistema",
        entidade: rotuloEntidade(l.entidade),
        acao: rotuloAcao(l.acao),
        registro: nomeDoRegistro(l.dadosAntes, l.dadosDepois) ?? nomes[l.entidadeId] ?? null,
        grupos: diferencaLegivel(l.dadosAntes, l.dadosDepois, nomes),
      }))}
    />
  );
}

// Nome legível de cada id citado na auditoria (usuário, destino, perfil, norma…).
async function nomesDosIds(ids: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(ids)];
  if (!unicos.length) return {};
  const em = { in: unicos };
  const [us, ds, ps, ns, as, es, is, aus, arqs] = await Promise.all([
    prisma.user.findMany({ where: { id: em }, select: { id: true, name: true, email: true } }),
    prisma.destino.findMany({ where: { id: em }, select: { id: true, nome: true } }),
    prisma.perfilAcesso.findMany({ where: { id: em }, select: { id: true, nome: true } }),
    prisma.documentoNormativo.findMany({ where: { id: em }, select: { id: true, titulo: true } }),
    prisma.areaAplicacao.findMany({ where: { id: em }, select: { id: true, nome: true } }),
    prisma.exercicio.findMany({ where: { id: em }, select: { id: true, ano: true } }),
    prisma.instrumentoPlanejamento.findMany({ where: { id: em }, select: { id: true, numero: true } }),
    prisma.autor.findMany({ where: { id: em }, select: { id: true, nome: true } }),
    prisma.arquivo.findMany({ where: { id: em }, select: { id: true, nome: true } }),
  ]);
  return Object.fromEntries([
    ...us.map((x) => [x.id, x.name ?? x.email ?? "usuário"]),
    ...ds.map((x) => [x.id, x.nome]),
    ...ps.map((x) => [x.id, x.nome]),
    ...ns.map((x) => [x.id, x.titulo]),
    ...as.map((x) => [x.id, x.nome]),
    ...es.map((x) => [x.id, `Exercício ${x.ano}`]),
    ...is.map((x) => [x.id, x.numero]),
    ...aus.map((x) => [x.id, x.nome]),
    ...arqs.map((x) => [x.id, x.nome]),
  ]);
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
        destaque: f.destaque,
        assinaturaPaga: f.assinaturaPaga,
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

async function municipio(podeEditar: boolean) {
  const m = await prisma.municipio.findFirst();
  return (
    <AbaMunicipio
      podeEditar={podeEditar}
      dados={{ nome: m?.nome ?? "", uf: (m?.uf ?? "") as "SP", codigoIbge: m?.codigoIbge ?? "", nomeCamara: m?.nomeCamara ?? "", nomePrefeitura: m?.nomePrefeitura ?? "" }}
    />
  );
}

async function areas(podeEditar: boolean) {
  const ano = await getAnoAtivo();
  const [lista, unidades] = await Promise.all([
    prisma.areaAplicacao.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }], include: { objetos: { select: { rotulo: true }, orderBy: { rotulo: "asc" } } } }),
    ano ? prisma.unidadeOrcamentaria.findMany({ where: { exercicio: { ano } }, select: { codigo: true } }) : [],
  ]);
  return (
    <AbaAreas
      podeEditar={podeEditar}
      unidades={unidades.map((u) => u.codigo)}
      areas={lista.map((a) => ({ id: a.id, nome: a.nome, orgaos: a.orgaos, unidadePadrao: a.unidadePadrao, objetos: a.objetos.length, nomesObjetos: a.objetos.map((o) => o.rotulo) }))}
    />
  );
}

async function tiposDestino(podeEditar: boolean) {
  const lista = await prisma.tipoDestino.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
  return <AbaTiposDestino podeEditar={podeEditar} tipos={lista.map((t) => ({ id: t.id, nome: t.nome, padrao: t.padrao, pistas: t.pistas, subfuncao: t.subfuncao, ativo: t.ativo }))} />;
}

// Emendas apresentadas antes do sistema (histórico do portal e dos painéis).
async function historico(podeImportar: boolean) {
  const porAno = await prisma.emendaImportada.groupBy({ by: ["exercicioId"], _count: { _all: true }, _sum: { valor: true } });
  const exercicios = await prisma.exercicio.findMany({ where: { id: { in: porAno.map((p) => p.exercicioId) } }, select: { id: true, ano: true } });
  const ano = new Map(exercicios.map((e) => [e.id, e.ano]));
  const linhas = porAno
    .map((p) => ({ ano: ano.get(p.exercicioId) ?? 0, qtd: p._count._all, valor: p._sum.valor?.toNumber() ?? 0 }))
    .sort((a, b) => b.ano - a.ano);
  return (
    <div className="mt-5">
      <Cartao guia="config.exercicio.historico"
        titulo="Emendas de anos anteriores"
        ajuda="Emendas apresentadas fora do sistema (antes de ele existir). Entram no portal público e nos painéis como “apresentadas fora do sistema”. A importação por planilha é opcional."
        acoes={podeImportar ? <ImportarPlanilha tipo="historico" /> : null}
      >
        <TabelaDados
          vazio="Nenhuma emenda de anos anteriores cadastrada."
          colunas={[{ titulo: "Exercício" }, { titulo: "Emendas", className: "text-right" }, { titulo: "Valor", className: "text-right" }]}
          linhas={linhas.map((l) => ({
            chave: String(l.ano),
            celulas: [
              <b key="a">{l.ano}</b>,
              <span key="q" className="tnum">{l.qtd}</span>,
              <span key="v" className="whitespace-nowrap tnum">{l.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>,
            ],
          }))}
        />
        {!podeImportar ? <p className="mt-3 text-sm text-muted-foreground">Somente o Administrador Geral importa emendas de anos anteriores.</p> : null}
      </Cartao>
    </div>
  );
}
