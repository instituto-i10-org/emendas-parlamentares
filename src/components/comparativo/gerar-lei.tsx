"use client";

import { useConfirmarImpacto } from "@/components/app/confirmar-impacto";
import { Button } from "@/components/ui/button";
import { gerarLeiDoProjeto } from "@/lib/actions/planejamento";

export function GerarLei({ ano }: { ano: number }) {
  const conf = useConfirmarImpacto();
  return (
    <>
      {conf.janela}
      <Button
        variant="surface"
        disabled={conf.pendente}
        onClick={() =>
          conf.pedir({
            titulo: `Gerar a base da lei aprovada de ${ano}`,
            mensagem: "A base da lei aprovada é gerada a partir do projeto de lei somado às emendas incorporadas.",
            impacto: { tipo: "gerarLei", ano },
            rotulo: "Gerar base da lei",
            acao: () => gerarLeiDoProjeto(ano),
          })
        }
      >
        {conf.pendente ? "Gerando…" : "Gerar base da lei"}
      </Button>
    </>
  );
}
