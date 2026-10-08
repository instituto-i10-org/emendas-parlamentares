"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Cartao } from "@/components/app/pagina";
import { Campo, CampoNumero, Pilulas, Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { adicionarPrazo, criarExercicio, definirStatusExercicio, excluirPrazo, salvarConfiguracao } from "@/lib/actions/config";
import { formatarNumero, lerNumero } from "@/lib/emendas/estado";
import { useConfirmarImpacto } from "@/components/app/confirmar-impacto";
import { BotaoAcao, useAcao } from "./comum";

export type ConfiguracaoTela = {
  exercicioId: string;
  ano: number;
  cotaIndividual: number | null;
  percentualRcl: number | null;
  rclBase: number | null;
  rclAnoBase: number | null;
  rclObservacao: string | null;
  numeroVereadores: number | null;
  memoriaCota: string | null;
  percentualSaude: number;
  afericaoSaude: "GLOBAL" | "INDIVIDUAL";
  observacaoSaude: string | null;
  toleranciaValorPct: number;
  validadeReferenciaMeses: number;
  percentualAcessorio: number;
  fonteAudesp: string | null;
  fonteAudespNome: string | null;
  codigoAplicacao: string | null;
  formatoVariacao: number;
  icEpVigente: boolean;
  icEpCodigo: string | null;
  orgaosForaDasEmendas: string[];
  rotuloBase: string | null;
  prazoProtocolo: string | null;
  fontePrecoObrigatoria: boolean;
  validadeLinkEntidadeDias: number;
  situacoesEmendamento: string[];
  custoM2Referencia: number | null;
  custoM2Competencia: string | null;
  custoM2Fonte: string | null;
  custoM2Url: string | null;
  fichaReserva: string | null;
  fundamentoDocumento: string | null;
};

const SITUACOES_PL: [string, string][] = [
  ["EM_ELABORACAO", "Em elaboração"],
  ["ENVIADO", "Enviado"],
  ["EM_TRAMITACAO", "Em tramitação"],
  ["APROVADO", "Aprovado"],
];

const txt = (v: string | null | undefined) => v ?? "";
const nulo = (v: string) => (v.trim() ? v.trim() : null);

export function AbaExercicio({
  exercicios,
  config,
  prazos,
  podeGerir,
}: {
  exercicios: { id: string; ano: number; status: string; historico: boolean }[];
  config: ConfiguracaoTela | null;
  prazos: { id: string; descricao: string; data: string; url: string | null }[];
  podeGerir: boolean;
}) {
  return (
    <div className="grid gap-5">
      <Exercicios exercicios={exercicios} podeGerir={podeGerir} />
      {config ? <FormConfiguracao c={config} podeGerir={podeGerir} /> : null}
      {config ? <Prazos exercicioId={config.exercicioId} prazos={prazos} podeGerir={podeGerir} /> : null}
    </div>
  );
}

function Exercicios({ exercicios, podeGerir }: { exercicios: { id: string; ano: number; status: string; historico: boolean }[]; podeGerir: boolean }) {
  const [ano, setAno] = useState(String(new Date().getFullYear() + 1));
  const { pendente, executar } = useAcao();
  return (
    <Cartao guia="config.exercicio.lista" titulo="Exercícios">
      <ul className="mb-4 grid gap-2">
        {exercicios.map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-md bg-soft px-3 py-2 text-sm">
            <b className="tnum">{e.ano}</b>
            {e.historico ? (
              <>
                <Selo tipo="neutro">histórico</Selo>
                <span className="text-xs text-muted-foreground">anterior ao exercício em curso: só consulta</span>
              </>
            ) : (
              <Selo tipo={e.status === "ABERTO" ? "ok" : "neutro"}>{e.status === "ABERTO" ? "aberto" : "encerrado"}</Selo>
            )}
            {podeGerir && !e.historico ? (
              <span className="ml-auto">
                <BotaoAcao
                  acao={(ciente) => definirStatusExercicio(e.id, e.status === "ABERTO" ? "ENCERRADO" : "ABERTO", ciente)}
                  impacto={{ tipo: "statusExercicio", id: e.id, status: e.status === "ABERTO" ? "ENCERRADO" : "ABERTO" }}
                  titulo={e.status === "ABERTO" ? `Encerrar o exercício ${e.ano}` : `Reabrir o exercício ${e.ano}`}
                  rotulo={e.status === "ABERTO" ? "Encerrar" : "Reabrir"}
                >
                  {e.status === "ABERTO" ? "Encerrar" : "Reabrir"}
                </BotaoAcao>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {podeGerir ? (
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Novo exercício" htmlFor="novo-ano">
            <input id="novo-ano" inputMode="numeric" maxLength={4} className="campo h-10 w-28 px-3 tnum" value={ano} onChange={(e) => setAno(e.target.value.replace(/\D/g, ""))} />
          </Campo>
          <Button size="sm" disabled={pendente} onClick={() => executar(() => criarExercicio(Number(ano)))}>
            Criar exercício
          </Button>
        </div>
      ) : null}
    </Cartao>
  );
}

function FormConfiguracao({ c, podeGerir }: { c: ConfiguracaoTela; podeGerir: boolean }) {
  const [f, setF] = useState({
    cotaIndividual: c.cotaIndividual !== null ? formatarNumero(c.cotaIndividual, 2) : "",
    percentualRcl: c.percentualRcl !== null ? formatarNumero(c.percentualRcl, 2) : "",
    rclBase: c.rclBase !== null ? formatarNumero(c.rclBase, 2) : "",
    rclAnoBase: c.rclAnoBase ? String(c.rclAnoBase) : "",
    rclObservacao: txt(c.rclObservacao),
    numeroVereadores: c.numeroVereadores ? String(c.numeroVereadores) : "",
    memoriaCota: txt(c.memoriaCota),
    percentualSaude: formatarNumero(c.percentualSaude, 2),
    afericaoSaude: c.afericaoSaude,
    observacaoSaude: txt(c.observacaoSaude),
    toleranciaValorPct: formatarNumero(c.toleranciaValorPct, 2),
    validadeReferenciaMeses: String(c.validadeReferenciaMeses),
    percentualAcessorio: formatarNumero(c.percentualAcessorio, 2),
    fonteAudesp: txt(c.fonteAudesp),
    fonteAudespNome: txt(c.fonteAudespNome),
    codigoAplicacao: txt(c.codigoAplicacao),
    formatoVariacao: String(c.formatoVariacao),
    icEpVigente: c.icEpVigente,
    icEpCodigo: txt(c.icEpCodigo),
    orgaosForaDasEmendas: c.orgaosForaDasEmendas.join(", "),
    rotuloBase: txt(c.rotuloBase),
    prazoProtocolo: txt(c.prazoProtocolo),
    fontePrecoObrigatoria: c.fontePrecoObrigatoria,
    situacoesEmendamento: c.situacoesEmendamento,
    validadeLinkEntidadeDias: String(c.validadeLinkEntidadeDias),
    custoM2Referencia: c.custoM2Referencia !== null ? formatarNumero(c.custoM2Referencia, 2) : "",
    custoM2Competencia: txt(c.custoM2Competencia),
    custoM2Fonte: txt(c.custoM2Fonte),
    custoM2Url: txt(c.custoM2Url),
    fichaReserva: txt(c.fichaReserva),
    fundamentoDocumento: txt(c.fundamentoDocumento),
  });
  const conf = useConfirmarImpacto();
  const pendente = conf.pendente;
  const m = (k: keyof typeof f) => ({
    value: f[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value }),
    disabled: !podeGerir,
  });
  // Sugestão da cota a partir da RCL, sem sobrescrever o que foi digitado.
  const sugerida =
    lerNumero(f.rclBase) && lerNumero(f.percentualRcl) && Number(f.numeroVereadores)
      ? (lerNumero(f.rclBase) * lerNumero(f.percentualRcl)) / 100 / Number(f.numeroVereadores)
      : null;

  function salvar() {
    const entrada = {
        exercicioId: c.exercicioId,
        cotaIndividual: f.cotaIndividual ? lerNumero(f.cotaIndividual) : null,
        percentualRcl: f.percentualRcl ? lerNumero(f.percentualRcl) : null,
        rclBase: f.rclBase ? lerNumero(f.rclBase) : null,
        rclAnoBase: f.rclAnoBase ? Number(f.rclAnoBase) : null,
        rclObservacao: nulo(f.rclObservacao),
        numeroVereadores: f.numeroVereadores ? Number(f.numeroVereadores) : null,
        memoriaCota: nulo(f.memoriaCota),
        percentualSaude: lerNumero(f.percentualSaude),
        afericaoSaude: f.afericaoSaude,
        observacaoSaude: nulo(f.observacaoSaude),
        toleranciaValorPct: lerNumero(f.toleranciaValorPct),
        validadeReferenciaMeses: Number(f.validadeReferenciaMeses),
        percentualAcessorio: lerNumero(f.percentualAcessorio),
        fonteAudesp: nulo(f.fonteAudesp),
        fonteAudespNome: nulo(f.fonteAudespNome),
        codigoAplicacao: nulo(f.codigoAplicacao),
        formatoVariacao: Number(f.formatoVariacao),
        variacaoOcupaFonte: false,
        icEpVigente: f.icEpVigente,
        icEpCodigo: nulo(f.icEpCodigo),
        orgaosForaDasEmendas: f.orgaosForaDasEmendas.split(/[,\s]+/).filter(Boolean),
        rotuloBase: nulo(f.rotuloBase),
        prazoProtocolo: nulo(f.prazoProtocolo),
        fontePrecoObrigatoria: f.fontePrecoObrigatoria,
        situacoesEmendamento: f.situacoesEmendamento,
        validadeLinkEntidadeDias: Number(f.validadeLinkEntidadeDias),
        custoM2Referencia: f.custoM2Referencia ? lerNumero(f.custoM2Referencia) : null,
        custoM2Competencia: nulo(f.custoM2Competencia),
        custoM2Fonte: nulo(f.custoM2Fonte),
        custoM2Url: nulo(f.custoM2Url),
        fichaReserva: nulo(f.fichaReserva),
        fundamentoDocumento: nulo(f.fundamentoDocumento),
      } as Parameters<typeof salvarConfiguracao>[0];
    conf.pedir({
      titulo: `Salvar os parâmetros de ${c.ano}`,
      impacto: { tipo: "configuracao", entrada: entrada as unknown as Record<string, unknown> & { exercicioId: string } },
      rotulo: "Salvar parâmetros",
      acao: (ciente) => salvarConfiguracao(entrada, ciente),
    });
  }

  return (
    <Cartao guia="config.exercicio.parametros"
      titulo={`Parâmetros do exercício ${c.ano}`}
      ajuda="Campo vazio significa “não parametrizado”: o sistema mostra a pendência e não presume valor."
      acoes={
        podeGerir ? (
          <Button size="sm" onClick={salvar} disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar parâmetros"}
          </Button>
        ) : null
      }
    >
      {conf.janela}
      <h3 className="mb-2 antena">Cota individual</h3>
      <div className="mb-5 grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Campo rotulo="RCL base (R$)" htmlFor="c-rcl">
          <CampoNumero id="c-rcl" valor={f.rclBase} aoMudar={(v) => setF({ ...f, rclBase: v })} disabled={!podeGerir} />
        </Campo>
        <Campo rotulo="Ano da RCL" htmlFor="c-rclano">
          <input id="c-rclano" className="campo h-12 px-3.5 tnum" {...m("rclAnoBase")} />
        </Campo>
        <Campo rotulo="% da RCL" htmlFor="c-pct">
          <CampoNumero id="c-pct" valor={f.percentualRcl} aoMudar={(v) => setF({ ...f, percentualRcl: v })} disabled={!podeGerir} />
        </Campo>
        <Campo rotulo="Número de vereadores" htmlFor="c-ver">
          <input id="c-ver" className="campo h-12 px-3.5 tnum" {...m("numeroVereadores")} />
        </Campo>
        <Campo
          rotulo="Cota individual (R$)"
          htmlFor="c-cota"
          dica={sugerida ? `Pela RCL: ${sugerida.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : undefined}
        >
          <CampoNumero id="c-cota" valor={f.cotaIndividual} aoMudar={(v) => setF({ ...f, cotaIndividual: v })} disabled={!podeGerir} />
        </Campo>
        <Campo rotulo="Rótulo da base" htmlFor="c-rot" dica="Como a LOA aparece para quem elabora.">
          <input id="c-rot" className="campo h-12 px-3.5" {...m("rotuloBase")} />
        </Campo>
        <Campo rotulo="Memória de cálculo da cota" htmlFor="c-mem" className="col-span-full">
          <textarea id="c-mem" className="campo min-h-[70px] p-3.5" {...m("memoriaCota")} />
        </Campo>
        <Campo rotulo="Observação sobre a RCL" htmlFor="c-rclobs" className="col-span-full">
          <input id="c-rclobs" className="campo h-12 px-3.5" {...m("rclObservacao")} />
        </Campo>
      </div>

      <h3 className="mb-2 antena">Reserva da saúde</h3>
      <div className="mb-5 grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Campo rotulo="% mínimo em saúde" htmlFor="c-sau">
          <CampoNumero id="c-sau" valor={f.percentualSaude} aoMudar={(v) => setF({ ...f, percentualSaude: v })} disabled={!podeGerir} />
        </Campo>
        <div className="col-span-2 max-md:col-span-1">
          <p className="mb-1.5 text-sm font-semibold text-label">Aferição (definida na LDO)</p>
          <Pilulas
            rotulo="Aferição"
            opcoes={["GLOBAL", "INDIVIDUAL"] as const}
            valor={f.afericaoSaude}
            curto={(v) => (v === "GLOBAL" ? "Global — no conjunto das emendas" : "Individual — em cada emenda")}
            aoEscolher={(v) => podeGerir && setF({ ...f, afericaoSaude: v })}
          />
        </div>
        <Campo rotulo="Fundamento" htmlFor="c-saobs" className="col-span-full">
          <input id="c-saobs" className="campo h-12 px-3.5" {...m("observacaoSaude")} />
        </Campo>
      </div>

      <h3 className="mb-2 antena">Motor de classificação</h3>
      <div className="mb-5 grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Campo rotulo="Tolerância planilha × valor da emenda (%)" htmlFor="c-tol">
          <CampoNumero id="c-tol" valor={f.toleranciaValorPct} aoMudar={(v) => setF({ ...f, toleranciaValorPct: v })} disabled={!podeGerir} />
        </Campo>
        <Campo rotulo="Validade da referência de preço (meses)" htmlFor="c-val">
          <input id="c-val" className="campo h-12 px-3.5 tnum" {...m("validadeReferenciaMeses")} />
        </Campo>
        <Campo rotulo="Limite do item acessório (%)" htmlFor="c-ace">
          <CampoNumero id="c-ace" valor={f.percentualAcessorio} aoMudar={(v) => setF({ ...f, percentualAcessorio: v })} disabled={!podeGerir} />
        </Campo>
        <Campo rotulo="Órgãos que não recebem emenda" htmlFor="c-fora" dica="Códigos separados por vírgula (ex.: 01, 17)." className="col-span-2 max-md:col-span-1">
          <input id="c-fora" className="campo h-12 px-3.5" {...m("orgaosForaDasEmendas")} />
        </Campo>
        <Campo rotulo="Fim do protocolo de emendas" htmlFor="c-prazo" dica="Depois dessa data não se submete.">
          <input id="c-prazo" type="date" className="campo h-12 px-3.5" {...m("prazoProtocolo")} />
        </Campo>
        <fieldset className="col-span-full">
          <legend className="mb-1.5 text-sm font-semibold text-label">O projeto de lei recebe emendas quando está</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {SITUACOES_PL.map(([k, rot]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!podeGerir}
                  checked={f.situacoesEmendamento.includes(k)}
                  onChange={(e) =>
                    setF({ ...f, situacoesEmendamento: e.target.checked ? [...f.situacoesEmendamento, k] : f.situacoesEmendamento.filter((x) => x !== k) })
                  }
                />
                {rot}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <h3 className="mb-2 antena">Preços e plano da entidade</h3>
      <div className="mb-5 grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <div className="col-span-2 max-md:col-span-1">
          <p className="mb-1.5 text-sm font-semibold text-label">Item com preço e sem fonte informada</p>
          <Pilulas
            rotulo="Fonte do preço"
            opcoes={["BLOQUEIA", "ALERTA"] as const}
            valor={f.fontePrecoObrigatoria ? "BLOQUEIA" : "ALERTA"}
            curto={(v) => (v === "BLOQUEIA" ? "Impede a submissão" : "Só alerta")}
            aoEscolher={(v) => podeGerir && setF({ ...f, fontePrecoObrigatoria: v === "BLOQUEIA" })}
          />
        </div>
        <Campo rotulo="Validade do link da entidade (dias)" htmlFor="c-link" dica="Depois disso o link deixa de abrir.">
          <input id="c-link" className="campo h-12 px-3.5 tnum" {...m("validadeLinkEntidadeDias")} />
        </Campo>
      </div>

      <h3 className="mb-2 antena">Obras: custo de referência do m² de construção</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Nas emendas de obra, a memória de cálculo sugere um item único em m² com este valor. Vazio: a sugestão não aparece.
      </p>
      <div data-guia="config.exercicio.m2" className="mb-5 grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Campo rotulo="Custo do m² (R$)" htmlFor="c-m2">
          <CampoNumero id="c-m2" valor={f.custoM2Referencia} aoMudar={(v) => setF({ ...f, custoM2Referencia: v })} disabled={!podeGerir} />
        </Campo>
        <Campo rotulo="Competência" htmlFor="c-m2c" dica="Mês de referência (ex.: ago/2026).">
          <input id="c-m2c" className="campo h-12 px-3.5" {...m("custoM2Competencia")} />
        </Campo>
        <Campo rotulo="Fonte" htmlFor="c-m2f">
          <input id="c-m2f" className="campo h-12 px-3.5" {...m("custoM2Fonte")} />
        </Campo>
        <Campo rotulo="Link da fonte" htmlFor="c-m2u" className="col-span-full">
          <input id="c-m2u" className="campo h-12 px-3.5" placeholder="https://" {...m("custoM2Url")} />
        </Campo>
      </div>

      <h3 className="mb-2 antena">Documento da emenda</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        O Art. 2º do documento anula parcialmente esta dotação, no valor da emenda (em geral, a Reserva de Contingência). A ficha é procurada no projeto de lei do exercício.
      </p>
      <div data-guia="config.exercicio.documento" className="mb-5 grid grid-cols-[180px_1fr] gap-3.5 max-md:grid-cols-1">
        <Campo rotulo="Dotação de reserva das emendas (ficha)" htmlFor="c-reserva">
          <input id="c-reserva" className="campo h-12 px-3.5 tnum" inputMode="numeric" maxLength={20} {...m("fichaReserva")} />
        </Campo>
        <Campo rotulo="Fundamento legal do documento" htmlFor="c-fundoc" dica="Uma norma por linha. Sai em “Fundamento legal” no documento da emenda.">
          <textarea id="c-fundoc" className="campo min-h-[70px] p-3.5" maxLength={2000} {...m("fundamentoDocumento")} />
        </Campo>
      </div>

      <h3 className="mb-2 antena">Identificadores AUDESP (camada C)</h3>
      <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
        <Campo rotulo="Fonte AUDESP" htmlFor="c-fa">
          <input id="c-fa" className="campo h-12 px-3.5" {...m("fonteAudesp")} />
        </Campo>
        <Campo rotulo="Nome da fonte" htmlFor="c-fan" className="col-span-2 max-md:col-span-1">
          <input id="c-fan" className="campo h-12 px-3.5" {...m("fonteAudespNome")} />
        </Campo>
        <Campo rotulo="Código de aplicação" htmlFor="c-ca">
          <input id="c-ca" className="campo h-12 px-3.5" {...m("codigoAplicacao")} />
        </Campo>
        <Campo rotulo="Dígitos da variação" htmlFor="c-fv">
          <input id="c-fv" className="campo h-12 px-3.5 tnum" {...m("formatoVariacao")} />
        </Campo>
        <Campo rotulo="Código IC-EP" htmlFor="c-icep" dica="Vigora a partir de 2027 (Portaria STN/MF 636/2026).">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.icEpVigente} disabled={!podeGerir} onChange={(e) => setF({ ...f, icEpVigente: e.target.checked })} /> vigente
            </label>
            <input id="c-icep" className="campo h-12 px-3.5" {...m("icEpCodigo")} />
          </div>
        </Campo>
      </div>
    </Cartao>
  );
}

function Prazos({
  exercicioId,
  prazos,
  podeGerir,
}: {
  exercicioId: string;
  prazos: { id: string; descricao: string; data: string; url: string | null }[];
  podeGerir: boolean;
}) {
  const [f, setF] = useState({ descricao: "", data: "", url: "" });
  const { pendente, executar } = useAcao();
  return (
    <Cartao guia="config.exercicio.prazos" titulo="Prazos do exercício">
      <ul className="mb-4 divide-y divide-hair">
        {prazos.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
            <b className="w-24 shrink-0 tnum">{new Date(`${p.data}T12:00:00`).toLocaleDateString("pt-BR")}</b>
            <span className="flex-1">
              {p.descricao}
              {p.url ? (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-xs font-bold text-navy hover:underline">
                  fonte
                </a>
              ) : null}
            </span>
            {podeGerir ? (
              <BotaoAcao acao={() => excluirPrazo(p.id)} confirmar="Excluir este prazo?" titulo="Excluir prazo" rotulo="Excluir" destrutiva exclusao>
                <Trash2 className="size-4" />
              </BotaoAcao>
            ) : null}
          </li>
        ))}
      </ul>
      {podeGerir ? (
        <div className="grid grid-cols-[160px_1fr_1fr_auto] items-end gap-2 max-md:grid-cols-1">
          <Campo rotulo="Data" htmlFor="p-data">
            <input id="p-data" type="date" className="campo h-10 px-3" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} />
          </Campo>
          <Campo rotulo="Descrição" htmlFor="p-desc">
            <input id="p-desc" className="campo h-10 px-3" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
          </Campo>
          <Campo rotulo="Link da fonte" htmlFor="p-url">
            <input id="p-url" className="campo h-10 px-3" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          </Campo>
          <Button size="sm" disabled={pendente} onClick={() => executar(() => adicionarPrazo({ exercicioId, ...f }), () => setF({ descricao: "", data: "", url: "" }))}>
            Adicionar
          </Button>
        </div>
      ) : null}
    </Cartao>
  );
}
