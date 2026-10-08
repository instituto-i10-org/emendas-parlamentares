"use client";

import { useMemo, useState } from "react";
import { Cartao, TabelaDados } from "@/components/app/pagina";
import { Campo, Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { alternarTipoDestino, moverTipoDestino, salvarTipoDestino } from "@/lib/actions/cadastros";
import { itensParaPadrao, novoItem, padraoParaItens, padraoValido, testarNome, type ItemReconhecimento } from "@/lib/cadastros/tipos-destino";
import { SUBFUNCOES_SUGERIDAS } from "./catalogos";
import { BotaoAcao, useAcao } from "./comum";

export type TipoDestinoTela = { id: string; nome: string; padrao: string; pistas: string[]; subfuncao: string | null; ativo: boolean };

const rotuloSubfuncao = (s: string | null) => SUBFUNCOES_SUGERIDAS.find(([v]) => v === (s ?? ""))?.[1] ?? (s ? `${s}` : "Sem sugestão");

// Como a regra aparece na tela: as palavras, ou "regra avançada".
function resumoRegra(padrao: string): string {
  const itens = padraoParaItens(padrao);
  if (!itens) return "Regra avançada";
  return itens.map((i) => i.texto).join(" · ");
}

// Tipos de destino (UBS, CAPS, EMEF…): reconhecem o tipo pelo nome do destino
// e sugerem a subfunção certa. Os ativos valem na ordem da lista: o primeiro
// que reconhece o nome decide.
export function AbaTiposDestino({ tipos, podeEditar }: { tipos: TipoDestinoTela[]; podeEditar: boolean }) {
  const [editando, setEditando] = useState<TipoDestinoTela | "novo" | null>(null);
  const [teste, setTeste] = useState("");
  const { pendente, executar } = useAcao();
  const ativos = tipos.filter((t) => t.ativo);
  const reconhecido = teste.trim() ? testarNome(teste, ativos) : null;
  return (
    <div className="grid gap-5">
      <Cartao guia="config.tipos-destino.teste"
        titulo="Testar um nome"
        ajuda="Digite o nome de um destino como ele aparece no cadastro e veja qual tipo o sistema reconhece e qual subfunção sugere."
      >
        <div className="grid grid-cols-[1fr_auto] items-end gap-4 max-md:grid-cols-1">
          <Campo rotulo="Nome do destino" htmlFor="td-teste">
            <input id="td-teste" className="campo h-12 px-3.5" placeholder="Ex.: UBS Jardim Ypê" value={teste} onChange={(e) => setTeste(e.target.value)} />
          </Campo>
          <p className="pb-3 text-sm" aria-live="polite" data-resultado-teste>
            {!teste.trim() ? (
              <span className="text-muted-foreground">Digite um nome.</span>
            ) : reconhecido ? (
              <>
                Reconhecido como <b>{reconhecido.nome}</b> · {rotuloSubfuncao(reconhecido.subfuncao)}
              </>
            ) : (
              <span className="text-muted-foreground">Nenhum tipo reconhece este nome.</span>
            )}
          </p>
        </div>
      </Cartao>
      <Cartao guia="config.tipos-destino.lista"
        titulo={`Tipos de destino (${tipos.length})`}
        ajuda="Cada tipo tem as palavras que o identificam no nome do destino e a subfunção que ele sugere (UBS → atenção básica; EMEF → ensino fundamental). Vale o primeiro da lista que reconhecer o nome. Mudar um tipo vale para os destinos cadastrados daqui em diante e para a classificação de novas emendas; a subfunção já gravada nos destinos existentes não muda."
        acoes={podeEditar ? <Button data-guia="config.tipos-destino.novo" size="sm" onClick={() => setEditando("novo")}>Novo tipo</Button> : null}
      >
        <TabelaDados
          vazio="Nenhum tipo cadastrado."
          colunas={[{ titulo: "Tipo" }, { titulo: "Reconhece" , className: "@max-[640px]:hidden" }, { titulo: "Subfunção sugerida" }, { titulo: "" }]}
          linhas={tipos.map((t, i) => ({
            chave: t.id,
            celulas: [
              <div key="n" className={t.ativo ? "" : "opacity-50"} data-tipo={t.nome}>
                <b>{t.nome}</b>
                {!t.ativo ? <Selo>inativo</Selo> : null}
              </div>,
              <span key="r" data-guia="config.tipos-destino.regra" className="text-sm text-muted-foreground">{resumoRegra(t.padrao)}</span>,
              <span key="s" className="text-sm">{rotuloSubfuncao(t.subfuncao)}</span>,
              podeEditar ? (
                <div key="b" className="flex flex-wrap items-center justify-end gap-1">
                  <Button size="xs" variant="ghost" aria-label={`Subir ${t.nome}`} disabled={pendente || i === 0} onClick={() => executar(() => moverTipoDestino(t.id, "acima"))}>
                    Subir
                  </Button>
                  <Button size="xs" variant="ghost" aria-label={`Descer ${t.nome}`} disabled={pendente || i === tipos.length - 1} onClick={() => executar(() => moverTipoDestino(t.id, "abaixo"))}>
                    Descer
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setEditando(t)}>
                    Editar
                  </Button>
                  <BotaoAcao acao={() => alternarTipoDestino(t.id)} confirmar={t.ativo ? `Desativar o tipo ${t.nome}? Destinos novos com este nome deixam de ter subfunção sugerida por ele.` : undefined} titulo={t.ativo ? `Desativar ${t.nome}` : undefined} rotulo={t.ativo ? "Desativar" : undefined}>
                    {t.ativo ? "Desativar" : "Ativar"}
                  </BotaoAcao>
                </div>
              ) : (
                <span key="b" />
              ),
            ],
          }))}
        />
        {!podeEditar ? <p className="mt-3 text-sm text-muted-foreground">Somente o Administrador Geral altera os tipos de destino.</p> : null}
      </Cartao>
      <EditorTipo tipo={editando} aoFechar={() => setEditando(null)} />
    </div>
  );
}

function EditorTipo({ tipo, aoFechar }: { tipo: TipoDestinoTela | "novo" | null; aoFechar: () => void }) {
  const base = tipo && tipo !== "novo" ? tipo : null;
  const inicial = () => {
    const itens = base ? padraoParaItens(base.padrao) : [novoItem()];
    return {
      nome: base?.nome ?? "",
      itens: itens ?? [],
      avancado: itens === null,
      regra: base?.padrao ?? "",
      pistas: (base?.pistas ?? []).join(", "),
      subfuncao: base?.subfuncao ?? "",
    };
  };
  const [f, setF] = useState(inicial);
  // Enquanto a pessoa não mexer na marca, "palavra inteira" acompanha o texto
  // (uma palavra só, sim; expressão com espaço, não). As palavras que já vêm
  // gravadas mantêm a marca como está.
  const [manual, setManual] = useState<Set<number>>(new Set());
  const [aberto, setAberto] = useState<string | null>(null);
  const chave = tipo === "novo" ? "novo" : tipo?.id ?? null;
  if (chave !== aberto) {
    setAberto(chave);
    const ini = inicial();
    setF(ini);
    setManual(new Set(base ? ini.itens.map((_, k) => k) : []));
  }
  const { pendente, executar } = useAcao();
  const padrao = f.avancado ? f.regra : itensParaPadrao(f.itens);
  const problema = useMemo(() => (padrao ? padraoValido(padrao) : null), [padrao]);
  const mudaItem = (k: number, item: Partial<ItemReconhecimento>) =>
    setF({
      ...f,
      itens: f.itens.map((x, j) => {
        if (j !== k) return x;
        const novo = { ...x, ...item };
        return item.texto !== undefined && !manual.has(k) ? { ...novo, inteira: novoItem(item.texto).inteira } : novo;
      }),
    });

  function salvar() {
    executar(
      () =>
        salvarTipoDestino({
          id: base?.id,
          nome: f.nome,
          ...(f.avancado ? { regraAvancada: f.regra } : { itens: f.itens }),
          pistas: f.pistas.split(",").map((x) => x.trim()).filter(Boolean),
          subfuncao: f.subfuncao,
        }),
      aoFechar
    );
  }

  return (
    <Dialog open={!!tipo} onOpenChange={(a) => !a && aoFechar()}>
      {tipo ? (
        <DialogContent
          titulo={base ? `Editar o tipo ${base.nome}` : "Novo tipo de destino"}
          largura="lg"
          acoes={
            <>
              <Button disabled={pendente || !!problema} onClick={salvar}>
                {base ? "Salvar" : "Criar tipo"}
              </Button>
              <Button variant="ghost" onClick={aoFechar}>
                Cancelar
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <Campo rotulo="Nome do tipo" obrigatorio htmlFor="td-nome">
              <input id="td-nome" className="campo h-12 px-3.5" maxLength={80} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
            </Campo>
            {f.avancado ? (
              <Campo
                rotulo="Regra avançada"
                htmlFor="td-regra"
                dica="Esta regra usa recursos que não cabem numa lista de palavras. Edite com cuidado: ela é aplicada ao nome do destino sem acentos e em minúsculas."
              >
                <input id="td-regra" className="campo h-12 px-3.5 font-mono text-sm" value={f.regra} onChange={(e) => setF({ ...f, regra: e.target.value })} />
              </Campo>
            ) : (
              <div className="grid gap-2">
                <span className="text-sm font-semibold text-label">Palavras ou expressões que identificam o tipo no nome do destino</span>
                <p className="text-xs text-muted-foreground">Marque “palavra inteira” para siglas (UBS não deve reconhecer “Subsede”). Acentos e maiúsculas não importam.</p>
                {f.itens.map((it, k) => (
                  <div key={k} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                    <input aria-label={`Palavra ${k + 1}`} className="campo h-10 px-3" maxLength={120} value={it.texto} onChange={(e) => mudaItem(k, { texto: e.target.value })} />
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={it.inteira}
                        onChange={(e) => {
                          setManual(new Set(manual).add(k));
                          mudaItem(k, { inteira: e.target.checked });
                        }}
                      />
                      palavra inteira
                    </label>
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-label={`Retirar palavra ${k + 1}`}
                      onClick={() => {
                        setManual(new Set([...manual].filter((j) => j !== k).map((j) => (j > k ? j - 1 : j))));
                        setF({ ...f, itens: f.itens.filter((_, j) => j !== k) });
                      }}
                    >
                      Retirar
                    </Button>
                  </div>
                ))}
                <div>
                  <Button size="xs" variant="surface" onClick={() => setF({ ...f, itens: [...f.itens, novoItem()] })}>
                    Adicionar palavra
                  </Button>
                </div>
              </div>
            )}
            {problema ? <p className="text-sm text-bad-ink">{problema}</p> : null}
            <Campo rotulo="Subfunção sugerida" htmlFor="td-sub">
              <select id="td-sub" className="campo h-12 px-3" value={f.subfuncao} onChange={(e) => setF({ ...f, subfuncao: e.target.value })}>
                {SUBFUNCOES_SUGERIDAS.map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
                {f.subfuncao && !SUBFUNCOES_SUGERIDAS.some(([v]) => v === f.subfuncao) ? <option value={f.subfuncao}>{f.subfuncao}</option> : null}
              </select>
            </Campo>
            <Campo rotulo="Pistas para a classificação" htmlFor="td-pistas" dica="Palavras que, no nome da ação do orçamento, confirmam que a dotação serve a este tipo (ex.: “atencao basica” para UBS). Separadas por vírgula. Opcional.">
              <input id="td-pistas" className="campo h-12 px-3.5" value={f.pistas} onChange={(e) => setF({ ...f, pistas: e.target.value })} />
            </Campo>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
