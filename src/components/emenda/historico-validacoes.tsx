import type { Checagem, Verificacao } from "@/lib/riep";
import { DATA_HORA } from "@/lib/riep";
import { RelatorioVerificacoes } from "./relatorio-verificacoes";
import { Selo } from "./ui";

export type ValidacaoTela = {
  id: string;
  executadaEm: Date;
  momento: "VALIDACAO" | "REMESSA" | "REENVIO";
  valida: boolean;
  revisao: number | null;
  quem: string;
  verificacoes: Verificacao[];
  complementares: Checagem[];
};

const MOMENTO = { VALIDACAO: "Validação", REMESSA: "Remessa", REENVIO: "Reenvio após diligência" };

// Toda validação feita no servidor, inclusive as reprovadas, da mais recente
// para a mais antiga; cada uma abre o relatório completo daquele momento.
export function HistoricoValidacoes({ validacoes }: { validacoes: ValidacaoTela[] }) {
  if (!validacoes.length) return <p className="text-sm text-muted-foreground">Nenhuma validação registrada.</p>;
  return (
    <ul className="grid gap-2">
      {validacoes.map((v) => (
        <li key={v.id}>
          <details className="group rounded-box bg-soft">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3.5 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
              <Selo tipo={v.valida ? "ok" : "bad"}>{v.valida ? "Válida" : "Inválida"}</Selo>
              <b>{MOMENTO[v.momento]}</b>
              <span className="text-xs text-muted-foreground">
                {DATA_HORA(v.executadaEm)} · {v.quem}
                {v.revisao != null ? ` · revisão ${v.revisao}` : ""}
              </span>
            </summary>
            <div className="border-t border-hair p-3.5">
              {v.verificacoes.length ? (
                <RelatorioVerificacoes verificacoes={v.verificacoes} complementares={v.complementares} valida={v.valida} />
              ) : (
                <p className="text-xs text-muted-foreground">Validação anterior às treze verificações: só as conferências do motor antigo.</p>
              )}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
