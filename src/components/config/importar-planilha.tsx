"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TabelaDados } from "@/components/app/pagina";
import { Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { confirmarPlanilhaDestinos, confirmarPlanilhaHistorico, conferirPlanilhaDestinos, conferirPlanilhaHistorico } from "@/lib/actions/cadastros";
import type { Mudanca, PlanoDestinos, PlanoHistorico, Recusa } from "@/lib/cadastros/planilhas";

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const POR_PAGINA = 20;

type Tipo = "destinos" | "historico";

const TEXTOS: Record<Tipo, { botao: string; titulo: string; explica: string; confirmar: string }> = {
  destinos: {
    botao: "Importar planilha",
    titulo: "Importar destinos por planilha",
    explica:
      "Escolha uma planilha CSV ou XLSX. Nada é gravado agora: o sistema mostra o que entra, o que muda e o que é recusado, e só grava depois da sua confirmação. Destino já cadastrado (mesmo CNPJ ou mesmo nome) é atualizado, não duplicado; campo vazio na planilha não apaga o que está cadastrado.",
    confirmar: "Gravar destinos",
  },
  historico: {
    botao: "Importar emendas de anos anteriores",
    titulo: "Importar emendas de anos anteriores",
    explica:
      "Emendas apresentadas antes do sistema, para o histórico do portal e dos painéis (aparecem como “apresentadas fora do sistema”). Escolha uma planilha CSV ou XLSX. Nada é gravado agora: o sistema mostra a conferência e só grava depois da sua confirmação. Emenda com o mesmo número no mesmo ano é atualizada; autor que ainda não existe é criado, sem conta de acesso.",
    confirmar: "Gravar emendas",
  },
};

export function ImportarPlanilha({ tipo }: { tipo: Tipo }) {
  const router = useRouter();
  const t = TEXTOS[tipo];
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [plano, setPlano] = useState<PlanoDestinos | PlanoHistorico | null>(null);
  const [pendente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);

  const fechar = () => {
    setAberto(false);
    setArquivo(null);
    setPlano(null);
  };
  const form = () => {
    const f = new FormData();
    if (arquivo) f.set("arquivo", arquivo);
    return f;
  };
  const conferir = () =>
    iniciar(async () => {
      const r = tipo === "destinos" ? await conferirPlanilhaDestinos(form()) : await conferirPlanilhaHistorico(form());
      if (!r.ok) return void toast.error(r.erro);
      setPlano(r.plano);
    });
  const confirmar = () =>
    iniciar(async () => {
      const r = tipo === "destinos" ? await confirmarPlanilhaDestinos(form()) : await confirmarPlanilhaHistorico(form());
      if (!r.ok) return void toast.error(r.erro);
      if (r.mensagem) toast(r.mensagem);
      fechar();
      router.refresh();
    });

  const gravaveis = plano ? ("novos" in plano ? plano.novos.length + plano.atualizados.length : plano.novas.length + plano.atualizadas.length) : 0;

  return (
    <>
      <Button size="sm" variant="surface" onClick={() => setAberto(true)}>
        {t.botao}
      </Button>
      <Dialog open={aberto} onOpenChange={(a) => (a ? setAberto(true) : fechar())}>
        {aberto ? (
          <DialogContent
            titulo={t.titulo}
            largura="xl"
            acoes={
              <>
                {plano ? (
                  <Button disabled={pendente || !gravaveis} onClick={confirmar}>
                    {t.confirmar}
                  </Button>
                ) : (
                  <Button disabled={pendente || !arquivo} onClick={conferir}>
                    Conferir planilha
                  </Button>
                )}
                <Button variant="ghost" onClick={fechar}>
                  Cancelar
                </Button>
              </>
            }
          >
            <div className="grid gap-4">
              <p className="text-sm text-muted-foreground">{t.explica}</p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={entrada}
                  id={`pl-${tipo}`}
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  className="sr-only"
                  onChange={(e) => {
                    setArquivo(e.target.files?.[0] ?? null);
                    setPlano(null);
                  }}
                />
                <Button size="sm" variant="surface" onClick={() => entrada.current?.click()}>
                  {arquivo ? "Trocar planilha" : "Escolher planilha"}
                </Button>
                <span className="text-sm">{arquivo ? arquivo.name : "Nenhuma planilha escolhida."}</span>
                <a className="text-sm font-semibold text-navy underline" href={`/api/cadastros/modelo?tipo=${tipo}`}>
                  Baixar a planilha-modelo
                </a>
              </div>
              {plano ? <Conferencia plano={plano} /> : null}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

function Conferencia({ plano }: { plano: PlanoDestinos | PlanoHistorico }) {
  if (plano.faltam.length) {
    return (
      <p className="rounded-md bg-soft p-3 text-sm" data-conferencia>
        A planilha não tem estas colunas obrigatórias: <b>{plano.faltam.join(", ")}</b>. Use a planilha-modelo como base.
      </p>
    );
  }
  const ehDestinos = "novos" in plano;
  const resumo = ehDestinos
    ? `${plano.novos.length} novo(s), ${plano.atualizados.length} atualizado(s), ${plano.semMudanca.length} sem mudança, ${plano.recusados.length} recusado(s)`
    : `${plano.novas.length} nova(s), ${plano.atualizadas.length} atualizada(s), ${plano.semMudanca.length} sem mudança, ${plano.recusados.length} recusada(s)`;
  return (
    <div className="grid gap-4" data-conferencia>
      <p className="text-sm font-semibold" data-resumo>
        {resumo}.
      </p>
      {ehDestinos ? (
        <>
          <Bloco titulo="Novos" n={plano.novos.length}>
            <Paginada
              colunas={[{ titulo: "Linha" }, { titulo: "Nome" }, { titulo: "Execução" }, { titulo: "Unidade" }]}
              linhas={plano.novos.map((n) => ({ chave: `n${n.linha}`, celulas: [n.linha, n.dados.nome, n.dados.execucao === "DIRETA" ? "Direta" : "Indireta", n.dados.unidadeCodigo ?? n.dados.unidadeRepasseCodigo ?? "—"] }))}
            />
          </Bloco>
          <Bloco titulo="Atualizados" n={plano.atualizados.length}>
            <Paginada
              colunas={[{ titulo: "Linha" }, { titulo: "Destino cadastrado" }, { titulo: "O que muda" }]}
              linhas={plano.atualizados.map((u) => ({ chave: `a${u.linha}`, celulas: [u.linha, u.nome, <Mudancas key="m" lista={u.mudancas} />] }))}
            />
          </Bloco>
        </>
      ) : (
        <>
          {plano.autoresNovos.length ? (
            <p className="text-sm">
              Autor(es) novo(s), criados sem conta de acesso: <b>{plano.autoresNovos.join(", ")}</b>.
            </p>
          ) : null}
          <Bloco titulo="Novas" n={plano.novas.length}>
            <Paginada
              colunas={[{ titulo: "Linha" }, { titulo: "Nº/ano" }, { titulo: "Autor" }, { titulo: "Descrição" }, { titulo: "Valor" }]}
              linhas={plano.novas.map((n) => ({ chave: `n${n.linha}`, celulas: [n.linha, `${n.dados.numero}/${n.dados.ano}`, n.dados.autor, n.dados.descricao.slice(0, 90), BRL(n.dados.valor)] }))}
            />
          </Bloco>
          <Bloco titulo="Atualizadas" n={plano.atualizadas.length}>
            <Paginada
              colunas={[{ titulo: "Linha" }, { titulo: "Nº/ano" }, { titulo: "O que muda" }]}
              linhas={plano.atualizadas.map((u) => ({ chave: `a${u.linha}`, celulas: [u.linha, `${u.dados.numero}/${u.dados.ano}`, <Mudancas key="m" lista={u.mudancas} />] }))}
            />
          </Bloco>
        </>
      )}
      <Bloco titulo="Recusados" n={plano.recusados.length}>
        <Recusas lista={plano.recusados} />
      </Bloco>
    </div>
  );
}

function Bloco({ titulo, n, children }: { titulo: string; n: number; children: ReactNode }) {
  if (!n) return null;
  return (
    <section className="grid gap-2" data-bloco={titulo}>
      <h3 className="flex items-center gap-2 text-sm font-bold">
        {titulo} <Selo tipo="neutro">{n}</Selo>
      </h3>
      {children}
    </section>
  );
}

function Mudancas({ lista }: { lista: Mudanca[] }) {
  return (
    <ul className="grid gap-0.5 text-xs">
      {lista.map((m) => (
        <li key={m.campo}>
          <b>{m.campo}:</b> {m.antes} → {m.depois}
        </li>
      ))}
    </ul>
  );
}

function Recusas({ lista }: { lista: Recusa[] }) {
  return (
    <Paginada
      colunas={[{ titulo: "Linha" }, { titulo: "Motivo" }, { titulo: "Conteúdo", className: "@max-[640px]:hidden" }]}
      linhas={lista.map((r) => ({ chave: `r${r.linha}`, celulas: [r.linha, r.motivos.join(" "), <span key="c" className="text-xs text-muted-foreground">{r.conteudo}</span>] }))}
    />
  );
}

function Paginada({ colunas, linhas }: { colunas: { titulo: string; className?: string }[]; linhas: { chave: string; celulas: ReactNode[] }[] }) {
  const [pagina, setPagina] = useState(1);
  const total = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
  const visiveis = linhas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  return (
    <div className="grid gap-2">
      <TabelaDados colunas={colunas} linhas={visiveis} />
      {total > 1 ? (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button size="xs" variant="ghost" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>
            Anterior
          </Button>
          <span>
            Página {pagina} de {total}
          </span>
          <Button size="xs" variant="ghost" disabled={pagina === total} onClick={() => setPagina(pagina + 1)}>
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}
