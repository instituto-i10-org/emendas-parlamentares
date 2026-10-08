import type { Checagem, Verificacao } from "@/lib/riep";
import { LinhaChecagem } from "./linha-checagem";
import { Selo } from "./ui";

const ESTADO = {
  conforme: { rotulo: "Conforme", tipo: "ok" as const },
  alerta: { rotulo: "Alerta", tipo: "warn" as const },
  falha: { rotulo: "Falha", tipo: "bad" as const },
};
const MODO = { BLOQUEANTE: "bloqueante", ALERTA: "alerta", FIXO: "fixa" };

// As treze verificações, sempre todas e na mesma ordem, com estado, razão e
// fundamento. Nenhuma fica escondida. Compacta: cada uma é uma linha (número,
// título, resultado) que abre a explicação ao clicar; as com alerta ou falha
// já vêm abertas.
export function ListaVerificacoes({ verificacoes, compacta = false }: { verificacoes: Verificacao[]; compacta?: boolean }) {
  if (compacta) {
    return (
      <ol aria-label="As treze verificações" className="divide-y divide-hair rounded-box border border-hair">
        {verificacoes.map((v) => (
          <li key={v.codigo} data-codigo={v.codigo}>
            <details open={v.estado !== "conforme"} className="group">
              <summary className="grid cursor-pointer list-none grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 px-3.5 py-2.5 hover:bg-soft [&::-webkit-details-marker]:hidden">
                <span className="text-xs font-extrabold text-muted-foreground uppercase">({v.numero})</span>
                <b className="min-w-0 text-sm leading-snug">{v.titulo}</b>
                <Selo tipo={ESTADO[v.estado].tipo}>{ESTADO[v.estado].rotulo}</Selo>
              </summary>
              <div className="px-3.5 pb-3 pl-[50px]">
                <span className="block text-sm leading-snug break-words">{v.razao}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Fundamento: {v.fundamento} · verificação {MODO[v.modo]}
                </span>
              </div>
            </details>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol aria-label="As treze verificações" className="divide-y divide-hair rounded-box border border-hair">
      {verificacoes.map((v) => (
        <li key={v.codigo} data-codigo={v.codigo} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 max-sm:grid-cols-[36px_minmax(0,1fr)]">
          <span className="pt-0.5 text-xs font-extrabold text-muted-foreground uppercase">({v.numero})</span>
          <div className="min-w-0">
            <b className="block text-sm">{v.titulo}</b>
            <span className="block text-sm leading-snug break-words">{v.razao}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Fundamento: {v.fundamento} · verificação {MODO[v.modo]}
            </span>
          </div>
          <span className="max-sm:col-start-2">
            <Selo tipo={ESTADO[v.estado].tipo}>{ESTADO[v.estado].rotulo}</Selo>
          </span>
        </li>
      ))}
    </ol>
  );
}

// O relatório completo: situação, as treze e as conferências complementares.
export function RelatorioVerificacoes({
  verificacoes,
  complementares,
  valida,
  cabecalho,
  compacta = false,
}: {
  verificacoes: Verificacao[];
  complementares: Checagem[];
  valida: boolean;
  cabecalho?: React.ReactNode;
  // Linhas que abrem ao clicar (lateral da página da emenda).
  compacta?: boolean;
}) {
  const falhas = verificacoes.filter((v) => v.estado === "falha").length + complementares.filter((c) => c.nivel === "bad").length;
  const alertas = verificacoes.filter((v) => v.estado === "alerta").length + complementares.filter((c) => c.nivel === "warn").length;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Selo tipo={valida ? "ok" : "bad"}>{valida ? "Válida" : "Inválida"}</Selo>
        <span className="text-muted-foreground">
          {falhas} falha{falhas === 1 ? "" : "s"} · {alertas} alerta{alertas === 1 ? "" : "s"}
        </span>
        {cabecalho ? <span className="ml-auto text-xs text-muted-foreground">{cabecalho}</span> : null}
      </div>
      <ListaVerificacoes verificacoes={verificacoes} compacta={compacta} />
      {complementares.length ? (
        <div>
          <h3 className="mb-1 text-sm font-bold">Conferências complementares</h3>
          <div className="divide-y divide-hair">
            {complementares.map((c, i) => (
              <LinhaChecagem key={i} c={c} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
