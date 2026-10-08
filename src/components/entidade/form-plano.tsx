"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useConfirmar } from "@/components/app/confirmar";
import { Campo, CampoNumero } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { enviarPlanoEntidade } from "@/lib/actions/convite";
import { totalPlanoEntidade, type ItemEntidade, type PlanoEntidade } from "@/lib/emendas/convite";
import { lerNumero } from "@/lib/emendas/estado";
import { BRL, conferirPlanilha, ordenarFontes, urlDaFonte, type FontePreco } from "@/lib/riep";
import { hojeIso } from "@/lib/utils";

const OUTRA = "__outra";
const itemVazio = (): ItemEntidade => ({
  descricao: "",
  unidade: "",
  quantidade: "1",
  valorUnitario: "",
  fonteId: null,
  fonteOutra: "",
  dataConsulta: hojeIso(),
  link: "",
});

// O que a entidade preenche: quem preenche, o resultado esperado, metas,
// itens com a fonte de cada preço, etapas e cronograma. O rascunho fica só
// neste navegador até o envio, que é único.
export function FormPlanoEntidade({
  codigo,
  etapasSugeridas,
  valorPretendido,
  tolerancia,
  indicadas,
  todas,
}: {
  codigo: string;
  etapasSugeridas: string;
  valorPretendido: number | null;
  tolerancia: number;
  indicadas: FontePreco[];
  todas: FontePreco[];
}) {
  const chave = `plano-entidade:${codigo.slice(0, 16)}`;
  const [p, setP] = useState<PlanoEntidade>({
    responsavelNome: "",
    responsavelCargo: "",
    metaFinalistica: "",
    metas: [{ beneficiarios: "", unidade: "", quantidade: "" }],
    etapas: etapasSugeridas,
    itens: [itemVazio()],
    parcelas: [""],
    observacao: "",
  });
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [pendente, iniciar] = useTransition();
  const { confirmar, janela } = useConfirmar();

  // Rascunho local: sobrevive a fechar a aba, nunca sai do navegador.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chave);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (salvo) setP(JSON.parse(salvo) as PlanoEntidade);
    } catch {
      /* armazenamento indisponível: segue sem rascunho */
    }
    setCarregado(true);
  }, [chave]);
  useEffect(() => {
    if (!carregado || enviado) return;
    try {
      localStorage.setItem(chave, JSON.stringify(p));
    } catch {
      /* idem */
    }
  }, [p, carregado, enviado, chave]);

  const outras = todas.filter((x) => !indicadas.some((i) => i.id === x.id));
  const total = totalPlanoEntidade(p);
  const mudarItem = (i: number, parcial: Partial<ItemEntidade>) => setP({ ...p, itens: p.itens.map((it, j) => (j === i ? { ...it, ...parcial } : it)) });
  const mudarMeta = (i: number, parcial: Partial<PlanoEntidade["metas"][number]>) =>
    setP({ ...p, metas: p.metas.map((m, j) => (j === i ? { ...m, ...parcial } : m)) });

  async function enviar() {
    setErro("");
    if (!(await confirmar({ titulo: "Enviar o plano", mensagem: "Depois do envio este link deixa de funcionar e não é possível alterar o plano.", rotulo: "Enviar plano" }))) return;
    iniciar(async () => {
      const r = await enviarPlanoEntidade(codigo, { ...p, parcelas: p.parcelas.filter((x) => x.trim()) });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      try {
        localStorage.removeItem(chave);
      } catch {
        /* idem */
      }
      setEnviado(true);
    });
  }

  if (enviado) {
    return (
      <section className="rounded-card bg-surface p-7 shadow-card">
        <h2 className="mb-2 text-lg font-extrabold">Plano enviado</h2>
        <p className="text-sm leading-relaxed">
          O gabinete do vereador recebeu o plano de trabalho. Este link não vale mais. Se for preciso corrigir algo, peça um novo link ao gabinete.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-6 rounded-card bg-surface p-7 shadow-card max-md:px-4 max-md:py-5">
      {janela}
      <div>
        <h2 className="mb-3 text-md font-bold">1. Quem está preenchendo</h2>
        <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
          <Campo rotulo="Nome completo" obrigatorio htmlFor="pe-nome">
            <input id="pe-nome" className="campo h-12 px-3.5" autoComplete="name" value={p.responsavelNome} onChange={(e) => setP({ ...p, responsavelNome: e.target.value })} />
          </Campo>
          <Campo rotulo="Cargo na entidade" obrigatorio htmlFor="pe-cargo">
            <input id="pe-cargo" className="campo h-12 px-3.5" value={p.responsavelCargo} onChange={(e) => setP({ ...p, responsavelCargo: e.target.value })} />
          </Campo>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-md font-bold">2. Resultado esperado</h2>
        <Campo rotulo="Meta finalística" obrigatorio htmlFor="pe-meta" dica="O que muda para o público atendido quando a emenda for executada.">
          <textarea id="pe-meta" className="campo min-h-[80px] p-3.5" maxLength={500} value={p.metaFinalistica} onChange={(e) => setP({ ...p, metaFinalistica: e.target.value })} />
        </Campo>
      </div>

      <div>
        <h2 className="mb-3 text-md font-bold">3. Metas físicas</h2>
        <div className="grid gap-3">
          {p.metas.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_160px_120px_auto] items-end gap-2 max-md:grid-cols-1">
              <Campo rotulo={`Quem será atendido (meta ${i + 1})`} htmlFor={`pe-mb-${i}`}>
                <input id={`pe-mb-${i}`} className="campo h-11 px-3" value={m.beneficiarios} onChange={(e) => mudarMeta(i, { beneficiarios: e.target.value })} />
              </Campo>
              <Campo rotulo="Unidade" htmlFor={`pe-mu-${i}`}>
                <input id={`pe-mu-${i}`} className="campo h-11 px-3" placeholder="pessoas, kits…" value={m.unidade} onChange={(e) => mudarMeta(i, { unidade: e.target.value })} />
              </Campo>
              <Campo rotulo="Quantidade" htmlFor={`pe-mq-${i}`}>
                <CampoNumero id={`pe-mq-${i}`} className="h-11 px-3 text-right" casas={2} completar={false} valor={m.quantidade} aoMudar={(v) => mudarMeta(i, { quantidade: v })} />
              </Campo>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remover meta ${i + 1}`}
                disabled={p.metas.length === 1}
                onClick={() => setP({ ...p, metas: p.metas.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button variant="surface" size="sm" className="justify-self-start" onClick={() => setP({ ...p, metas: [...p.metas, { beneficiarios: "", unidade: "", quantidade: "" }] })}>
            <Plus /> Adicionar meta
          </Button>
        </div>
      </div>

      <div>
        <h2 className="mb-1 text-md font-bold">4. Itens e preços</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Para cada item, pesquise o preço numa fonte oficial, informe o valor unitário e diga de onde tirou. As fontes indicadas abrem em nova aba.
        </p>
        <ul className="mb-4 grid gap-2 sm:grid-cols-2">
          {ordenarFontes(indicadas).map((f) => (
            <li key={f.id} className="rounded-field bg-soft px-3.5 py-2.5">
              <a href={urlDaFonte(f)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy hover:underline">
                {f.nome}
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
              <p className="mt-0.5 text-xs text-muted-foreground">{f.orientacao}</p>
            </li>
          ))}
        </ul>
        <div className="grid gap-4">
          {p.itens.map((it, i) => (
            <fieldset key={i} className="rounded-box border border-hair p-4">
              <legend className="px-1 text-sm font-bold">Item {i + 1}</legend>
              <div className="grid grid-cols-[1fr_120px_110px_150px] gap-2.5 max-md:grid-cols-1">
                <Campo rotulo="Descrição" obrigatorio htmlFor={`pe-id-${i}`}>
                  <input id={`pe-id-${i}`} className="campo h-11 px-3" value={it.descricao} onChange={(e) => mudarItem(i, { descricao: e.target.value })} />
                </Campo>
                <Campo rotulo="Unidade" obrigatorio htmlFor={`pe-iu-${i}`}>
                  <input id={`pe-iu-${i}`} className="campo h-11 px-3" value={it.unidade} onChange={(e) => mudarItem(i, { unidade: e.target.value })} />
                </Campo>
                <Campo rotulo="Quantidade" obrigatorio htmlFor={`pe-iq-${i}`}>
                  <CampoNumero id={`pe-iq-${i}`} className="h-11 px-3 text-right" casas={2} completar={false} valor={it.quantidade} aoMudar={(v) => mudarItem(i, { quantidade: v })} />
                </Campo>
                <Campo rotulo="Valor unitário" obrigatorio htmlFor={`pe-iv-${i}`}>
                  <CampoNumero id={`pe-iv-${i}`} className="h-11 px-3 text-right" valor={it.valorUnitario} aoMudar={(v) => mudarItem(i, { valorUnitario: v })} placeholder="0,00" />
                </Campo>
              </div>
              <div className="mt-2.5 grid grid-cols-[1fr_160px] gap-2.5 max-md:grid-cols-1">
                <Campo rotulo="De onde tirou o preço" obrigatorio htmlFor={`pe-if-${i}`}>
                  <select
                    id={`pe-if-${i}`}
                    className="campo campo-select h-11 pr-9 pl-3"
                    value={it.fonteId ?? (it.fonteOutra ? OUTRA : "")}
                    onChange={(e) =>
                      mudarItem(i, e.target.value === OUTRA ? { fonteId: null, fonteOutra: it.fonteOutra || " " } : { fonteId: e.target.value || null, fonteOutra: "" })
                    }
                  >
                    <option value="">selecione…</option>
                    {indicadas.length ? (
                      <optgroup label="Indicadas">
                        {indicadas.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {outras.length ? (
                      <optgroup label="Outras fontes oficiais">
                        {outras.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    <option value={OUTRA}>Outra fonte (cotação, nota fiscal…)</option>
                  </select>
                </Campo>
                <Campo rotulo="Data da consulta" obrigatorio htmlFor={`pe-idt-${i}`}>
                  <input id={`pe-idt-${i}`} type="date" className="campo h-11 px-3" value={it.dataConsulta} onChange={(e) => mudarItem(i, { dataConsulta: e.target.value })} />
                </Campo>
              </div>
              {!it.fonteId && it.fonteOutra ? (
                <Campo rotulo="Quem emitiu o preço" obrigatorio htmlFor={`pe-io-${i}`} className="mt-2.5">
                  <input
                    id={`pe-io-${i}`}
                    className="campo h-11 px-3"
                    placeholder="fornecedor e CNPJ, ou órgão"
                    value={it.fonteOutra.trim()}
                    onChange={(e) => mudarItem(i, { fonteOutra: e.target.value || " " })}
                  />
                </Campo>
              ) : null}
              <Campo rotulo="Link do resultado (opcional)" htmlFor={`pe-il-${i}`} className="mt-2.5">
                <input id={`pe-il-${i}`} className="campo h-11 px-3" value={it.link} onChange={(e) => mudarItem(i, { link: e.target.value })} />
              </Campo>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold tnum">
                  Total do item: {BRL(lerNumero(it.quantidade) * lerNumero(it.valorUnitario))}
                </span>
                <Button variant="ghost" size="sm" disabled={p.itens.length === 1} onClick={() => setP({ ...p, itens: p.itens.filter((_, j) => j !== i) })}>
                  <Trash2 /> Remover item
                </Button>
              </div>
            </fieldset>
          ))}
          <Button variant="surface" size="sm" className="justify-self-start" onClick={() => setP({ ...p, itens: [...p.itens, itemVazio()] })}>
            <Plus /> Adicionar item
          </Button>
          <p className="text-right text-md font-extrabold tnum">
            Total do plano: {BRL(total)}
            {valorPretendido ? <ConferenciaEntidade valor={valorPretendido} soma={total} tolerancia={tolerancia} /> : null}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-md font-bold">5. Etapas de execução</h2>
        <Campo rotulo="Etapas" htmlFor="pe-et" dica="Uma etapa por linha. Pode ajustar a sugestão.">
          <textarea id="pe-et" className="campo min-h-[120px] p-3.5" maxLength={3000} value={p.etapas} onChange={(e) => setP({ ...p, etapas: e.target.value })} />
        </Campo>
      </div>

      <div>
        <h2 className="mb-3 text-md font-bold">6. Cronograma de desembolso</h2>
        <div className="grid gap-2">
          {p.parcelas.map((v, i) => (
            <div key={i} className="flex items-end gap-2">
              <Campo rotulo={`${i + 1}ª parcela`} htmlFor={`pe-pa-${i}`} className="w-56">
                <CampoNumero
                  id={`pe-pa-${i}`}
                  className="h-11 px-3 text-right"
                  valor={v}
                  aoMudar={(x) => setP({ ...p, parcelas: p.parcelas.map((y, j) => (j === i ? x : y)) })}
                  placeholder="0,00"
                />
              </Campo>
              <Button variant="ghost" size="sm" aria-label={`Remover parcela ${i + 1}`} disabled={p.parcelas.length === 1} onClick={() => setP({ ...p, parcelas: p.parcelas.filter((_, j) => j !== i) })}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button variant="surface" size="sm" className="justify-self-start" onClick={() => setP({ ...p, parcelas: [...p.parcelas, ""] })}>
            <Plus /> Adicionar parcela
          </Button>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-md font-bold">7. Observação ao gabinete (opcional)</h2>
        <textarea className="campo min-h-[70px] w-full p-3.5" aria-label="Observação ao gabinete" maxLength={2000} value={p.observacao} onChange={(e) => setP({ ...p, observacao: e.target.value })} />
      </div>

      {erro ? (
        <p role="alert" className="rounded-box border border-bad-line bg-bad-bg px-4 py-3 text-sm text-bad-ink">
          {erro}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void enviar()} disabled={pendente}>
          {pendente ? "Enviando…" : "Enviar plano ao gabinete"}
        </Button>
        <span className="text-xs text-muted-foreground">O que você digitou fica salvo neste navegador até o envio.</span>
      </div>
    </section>
  );
}

// A mesma conferência do gabinete: a planilha comprova o valor da emenda.
function ConferenciaEntidade({ valor, soma, tolerancia }: { valor: number; soma: number; tolerancia: number }) {
  const cp = conferirPlanilha(valor, soma, tolerancia);
  const base = `Valor da emenda: ${BRL(valor)}.`;
  const texto =
    cp.estado === "vazia" || cp.estado === "sem-valor"
      ? base
      : cp.estado === "igual"
        ? `${base} O plano confere com esse valor.`
        : cp.estado === "dentro"
          ? `${base} O plano difere ${cp.pct.toFixed(1)}%, dentro da tolerância de ${tolerancia}%.`
          : `${base} O plano difere ${cp.pct.toFixed(1)}%, acima da tolerância de ${tolerancia}%. Ajuste os itens ou combine o valor com o gabinete.`;
  return (
    <span data-teste="conferencia-entidade" data-estado={cp.estado} className={`block text-xs font-normal ${cp.estado === "fora" ? "text-bad-ink" : "text-muted-foreground"}`}>
      {texto}
    </span>
  );
}
