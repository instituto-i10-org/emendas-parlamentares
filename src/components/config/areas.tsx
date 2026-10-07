"use client";

import { useState } from "react";
import { useConfirmarImpacto } from "@/components/app/confirmar-impacto";
import { Cartao, TabelaDados } from "@/components/app/pagina";
import { Campo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { criarArea, excluirArea, moverArea, renomearArea } from "@/lib/actions/cadastros";
import { salvarArea } from "@/lib/actions/config";
import { BotaoAcao, useAcao } from "./comum";

export type AreaTela = { id: string; nome: string; orgaos: string[]; unidadePadrao: string | null; objetos: number };

const listaOrgaos = (t: string) => t.split(/[,\s;]+/).map((x) => x.trim()).filter(Boolean);

// Áreas de aplicação (Saúde, Educação…): quais órgãos atendem cada uma. O
// motor usa isso para saber se um objeto cabe no destino, qual parcela da
// cota a emenda consome e para os painéis por área.
export function AbaAreas({ areas, unidades, podeEditar }: { areas: AreaTela[]; unidades: string[]; podeEditar: boolean }) {
  const [editando, setEditando] = useState<AreaTela | "nova" | null>(null);
  const [excluindo, setExcluindo] = useState<AreaTela | null>(null);
  const { pendente, executar } = useAcao();
  const orgaosDoExercicio = new Set(unidades.map((u) => u.split(".")[0]));
  return (
    <div className="grid gap-5">
      <Cartao
        titulo={`Áreas de aplicação (${areas.length})`}
        ajuda="Quais órgãos orçamentários atendem cada área. É o que permite ao sistema dizer que um objeto de área estrita (ambulância é Saúde) não cabe num destino de outra área, definir a parcela da cota (saúde ou demais áreas) e montar os painéis por área. A ordem desempata quando um órgão aparece em mais de uma área."
        acoes={podeEditar ? <Button size="sm" onClick={() => setEditando("nova")}>Nova área</Button> : null}
      >
        <TabelaDados
          vazio="Nenhuma área cadastrada."
          colunas={[{ titulo: "Área" }, { titulo: "Órgãos" }, { titulo: "Unidade padrão", className: "@max-[640px]:hidden" }, { titulo: "Objetos", className: "text-right @max-[640px]:hidden" }, { titulo: "" }]}
          linhas={areas.map((a, i) => ({
            chave: a.id,
            celulas: [
              <b key="n" data-area={a.nome}>{a.nome}</b>,
              <span key="o" className="tnum">
                {a.orgaos.length ? a.orgaos.join(", ") : <span className="text-muted-foreground">nenhum</span>}
                {a.orgaos.some((o) => orgaosDoExercicio.size && !orgaosDoExercicio.has(o)) ? (
                  <span className="block text-xs text-muted-foreground">Algum órgão não existe no exercício em uso.</span>
                ) : null}
              </span>,
              <span key="u" className="tnum">{a.unidadePadrao ?? "—"}</span>,
              <span key="q" className="tnum">{a.objetos}</span>,
              podeEditar ? (
                <div key="b" className="flex flex-wrap items-center justify-end gap-1">
                  <Button size="xs" variant="ghost" aria-label={`Subir ${a.nome}`} disabled={pendente || i === 0} onClick={() => executar(() => moverArea(a.id, "acima"))}>
                    Subir
                  </Button>
                  <Button size="xs" variant="ghost" aria-label={`Descer ${a.nome}`} disabled={pendente || i === areas.length - 1} onClick={() => executar(() => moverArea(a.id, "abaixo"))}>
                    Descer
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setEditando(a)}>
                    Editar
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setExcluindo(a)}>
                    Excluir
                  </Button>
                </div>
              ) : (
                <span key="b" />
              ),
            ],
          }))}
        />
        {!podeEditar ? <p className="mt-3 text-sm text-muted-foreground">Somente o Administrador Geral altera as áreas.</p> : null}
      </Cartao>
      <EditorArea area={editando} aoFechar={() => setEditando(null)} />
      <Dialog open={!!excluindo} onOpenChange={(a) => !a && setExcluindo(null)}>
        {excluindo ? (
          <DialogContent
            titulo={`Excluir a área ${excluindo.nome}`}
            acoes={
              <>
                <BotaoAcao variante="destructive" tamanho="default" acao={async () => { const r = await excluirArea(excluindo.id); if (r.ok) setExcluindo(null); return r; }}>
                  Excluir área
                </BotaoAcao>
                <Button variant="ghost" onClick={() => setExcluindo(null)}>
                  Cancelar
                </Button>
              </>
            }
          >
            <p className="text-sm">
              {excluindo.objetos
                ? `Esta área tem ${excluindo.objetos} objeto(s) da biblioteca ligado(s). A exclusão será recusada: mude estes objetos de área antes, em Configurações › Biblioteca de objetos.`
                : "Nenhum objeto da biblioteca usa esta área. A exclusão fica registrada na auditoria."}
            </p>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function EditorArea({ area, aoFechar }: { area: AreaTela | "nova" | null; aoFechar: () => void }) {
  const base = area && area !== "nova" ? area : null;
  const [nome, setNome] = useState(base?.nome ?? "");
  const [orgaos, setOrgaos] = useState(base?.orgaos.join(", ") ?? "");
  const [unidade, setUnidade] = useState(base?.unidadePadrao ?? "");
  const [aberto, setAberto] = useState<string | null>(null);
  const chave = area === "nova" ? "nova" : area?.id ?? null;
  // Reinicia o formulário quando abre outra área.
  if (chave !== aberto) {
    setAberto(chave);
    setNome(base?.nome ?? "");
    setOrgaos(base?.orgaos.join(", ") ?? "");
    setUnidade(base?.unidadePadrao ?? "");
  }
  const { pendente, executar } = useAcao();
  const conf = useConfirmarImpacto();

  function salvar() {
    const entrada = { orgaos: listaOrgaos(orgaos), unidadePadrao: unidade.trim() };
    if (!base) return executar(() => criarArea({ nome, ...entrada }), aoFechar);
    const mudouNome = nome.trim() !== base.nome;
    const mudouOrgaos = entrada.orgaos.join(",") !== base.orgaos.join(",") || (entrada.unidadePadrao || null) !== base.unidadePadrao;
    const gravarOrgaos = () =>
      conf.pedir({
        titulo: `Salvar a área ${nome.trim() || base.nome}`,
        impacto: { tipo: "area", id: base.id, ...entrada },
        rotulo: "Salvar área",
        acao: (ciente) => salvarArea({ id: base.id, ...entrada }, ciente),
        aoConcluir: aoFechar,
      });
    if (mudouNome) {
      executar(() => renomearArea(base.id, nome), mudouOrgaos ? gravarOrgaos : aoFechar);
    } else if (mudouOrgaos) gravarOrgaos();
    else aoFechar();
  }

  return (
    <Dialog open={!!area} onOpenChange={(a) => !a && aoFechar()}>
      {conf.janela}
      {area ? (
        <DialogContent
          titulo={base ? `Editar a área ${base.nome}` : "Nova área"}
          acoes={
            <>
              <Button disabled={pendente || conf.pendente} onClick={salvar}>
                {base ? "Salvar" : "Criar área"}
              </Button>
              <Button variant="ghost" onClick={aoFechar}>
                Cancelar
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <Campo rotulo="Nome" obrigatorio htmlFor="ar-nome">
              <input id="ar-nome" className="campo h-12 px-3.5" maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />
            </Campo>
            <Campo rotulo="Órgãos" htmlFor="ar-orgaos" dica="Códigos dos órgãos do orçamento que atendem a área, separados por vírgula (ex.: 13, 20).">
              <input id="ar-orgaos" className="campo h-12 px-3.5 tnum" value={orgaos} onChange={(e) => setOrgaos(e.target.value)} />
            </Campo>
            <Campo rotulo="Unidade padrão" htmlFor="ar-unidade" dica="Unidade que responde pela área quando o destino não tem vínculo fixo, como entidades (ex.: 13.01). Opcional.">
              <input id="ar-unidade" className="campo h-12 px-3.5 tnum" maxLength={9} value={unidade} onChange={(e) => setUnidade(e.target.value)} />
            </Campo>
            {base ? <p className="text-xs text-muted-foreground">Mudar os órgãos pode mudar a área e a parcela de emendas já enviadas: o sistema mostra o impacto antes de gravar.</p> : null}
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
