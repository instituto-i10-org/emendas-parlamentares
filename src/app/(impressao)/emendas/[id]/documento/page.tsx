import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { podeGerirEmenda, podeVerTodasEmendas, temPermissao } from "@/lib/authz";
import { buscarEmenda } from "@/lib/emendas/carregar";
import { documentoDaEmenda } from "@/lib/emendas/documento-servidor";
import type { DocumentoEmenda, Linha } from "@/lib/emendas/documento";
import { getCurrentUser } from "@/lib/session";
import { BotaoImprimir } from "@/components/app/botao-imprimir";
import { Button } from "@/components/ui/button";
import { ConteudoPlano } from "@/components/emenda/plano-trabalho";

export const metadata: Metadata = { title: "Documento da emenda — Emendas360" };

// Brasão oficial da Câmara (ver public/camara/ORIGEM.md).
const BRASAO = "/camara/brasao.png";

// Texto como string CSS, para o cabeçalho e o rodapé das páginas impressas.
// O "<" vira escape para nada fechar o <style>.
const cssStr = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\A ").replace(/</g, "\\3C ")}"`;

// Documento da emenda para imprimir ou salvar em PDF pelo navegador: capa do
// processo, a emenda e o plano de trabalho anexo. Minuta (com marca d'água)
// enquanto não remetida; definitivo, com número e data de entrada, depois.
export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const x = await buscarEmenda(id);
  if (!x) notFound();
  const ve =
    podeGerirEmenda(user, { autorUsuarioId: x.autor.usuarioId }) ||
    podeVerTodasEmendas(user) ||
    temPermissao(user, "analisarViabilidade", "registrarExecucao", "consultarTudo");
  if (!ve) notFound();
  const doc = await documentoDaEmenda(x);

  // Cabeçalho e rodapé repetidos em cada página impressa (caixas de margem do
  // @page; Chrome e Edge numeram "Fls. n/m").
  const estiloPagina = `
@page { size: A4; margin: 22mm 18mm 24mm;
  @top-right { content: ${cssStr(`${doc.identificador} | Fls. `)} counter(page) "/" counter(pages); font: 9pt "Times New Roman", Times, serif; color: #333; }
  ${doc.camara.rodape ? `@bottom-center { content: ${cssStr(doc.camara.rodape)}; font: 7.5pt "Times New Roman", Times, serif; color: #444; white-space: pre-wrap; text-align: center; }` : ""}
}`;

  return (
    <div className="documento min-h-dvh bg-page py-8 print:bg-white print:py-0">
      <style dangerouslySetInnerHTML={{ __html: estiloPagina }} />
      {doc.minuta ? (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 hidden place-items-center print:grid">
          <span className="-rotate-[24deg] text-[110px] font-bold tracking-[0.1em] text-[rgba(229,72,77,0.10)]">MINUTA</span>
        </div>
      ) : null}

      <div className="mx-auto mb-4 flex max-w-[860px] flex-wrap items-center justify-end gap-2 px-4 print:hidden">
        <p className="mr-auto text-sm text-muted-foreground">
          {doc.minuta
            ? "Minuta: o número, o protocolo e a data de entrada saem no envio."
            : `Documento definitivo da emenda nº ${doc.numeroTexto}.`}
        </p>
        <Button asChild variant="ghost">
          <Link href={`/emendas/${x.id}/plano`}>
            <ClipboardList /> Plano de trabalho
          </Link>
        </Button>
        <BotaoImprimir rotulo="Imprimir / Salvar como PDF" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-[860px] gap-6 px-4 print:block print:max-w-none print:px-0">
        <Folha doc={doc} primeira>
          <Capa doc={doc} />
        </Folha>

        <Folha doc={doc}>
          <Timbre nome={doc.camara.nome} />
          <h1 className="mt-2 text-center text-[15px] font-bold" data-doc="titulo">
            {doc.titulo}
          </h1>
          <p className="mb-4 text-center">{doc.subtitulo}</p>
          <Linhas linhas={doc.cabecalho} />
          <p className="mt-4">
            <b>Art. 1º</b> {doc.art1.caput}
          </p>
          <p className="mt-2">
            <b>Adequação orçamentária:</b> {doc.art1.adequacao}
          </p>
          <p className="mt-3 mb-1 font-bold">I – Classificações da Emenda:</p>
          <Linhas linhas={doc.art1.classificacoes} />
          <p className="mt-4">
            <b>Art. 2º</b> {doc.art2.caput}
          </p>
          <p className="mt-3 mb-1 font-bold">II – Recursos para atendimento:</p>
          <Linhas linhas={doc.art2.dotacao} />
          <p className="mt-4">
            <b>Art. 3º</b> {doc.art3}
          </p>
          <p className="mt-6">{doc.localData}</p>
          <div className="mt-12 text-center break-inside-avoid">
            <div className="mx-auto w-72 border-t border-[#111] pt-1 font-bold">{doc.assinatura.nome}</div>
            <div>{doc.assinatura.cargo}</div>
          </div>
        </Folha>

        <Folha doc={doc}>
          <h2 className="mb-1 text-center text-[15px] font-bold">ANEXO — PLANO DE TRABALHO</h2>
          <p className="mb-2 text-center text-xs">Emenda nº {doc.numeroTexto}</p>
          <div className="font-sans">
            <ConteudoPlano x={x} validacao={false} />
          </div>
        </Folha>
      </div>
    </div>
  );
}

// Uma folha na tela; na impressão, cada uma começa em página nova.
function Folha({ doc, primeira = false, children }: { doc: DocumentoEmenda; primeira?: boolean; children: React.ReactNode }) {
  return (
    <section
      className={`relative overflow-hidden border border-line bg-white p-10 font-['Times_New_Roman',Times,serif] text-[14px] leading-[1.55] text-[#111] shadow-card max-sm:p-5 print:overflow-visible print:border-0 print:p-0 print:shadow-none ${primeira ? "" : "print:break-before-page"}`}
    >
      {doc.minuta ? (
        <span aria-hidden data-doc="minuta" className="pointer-events-none absolute inset-0 grid place-items-center print:hidden">
          <span className="-rotate-[24deg] text-[96px] font-bold tracking-[0.1em] text-[rgba(229,72,77,0.10)] max-sm:text-[56px]">MINUTA</span>
        </span>
      ) : null}
      <p className="mb-3 text-right text-[11px] print:hidden">{doc.identificador}</p>
      <div className="relative">{children}</div>
      {doc.camara.rodape ? <p className="mt-8 border-t border-[#999] pt-2 text-center text-[10.5px] whitespace-pre-line text-[#444] print:hidden">{doc.camara.rodape}</p> : null}
    </section>
  );
}

function Timbre({ nome }: { nome: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 border-b border-[#999] pb-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRASAO} alt="Brasão" className="h-14 w-auto" />
      <div>
        <div className="font-bold">{nome}</div>
        <div className="text-xs">Estado de São Paulo</div>
      </div>
    </div>
  );
}

function Capa({ doc }: { doc: DocumentoEmenda }) {
  const c = doc.capa;
  const rot = "block text-[10px]";
  const forte = "font-[Arial,Helvetica,sans-serif] text-[15px] font-bold";
  return (
    <div className="border-2 border-[#111]" data-doc="capa">
      <div className="flex items-center gap-4 border-b-[3px] border-[#111] p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRASAO} alt="Brasão" className="h-20 w-auto flex-none" />
        <div className="flex-1 text-center">
          <div className="text-[20px] font-bold">{doc.camara.nome.toLocaleUpperCase("pt-BR")}</div>
          {doc.camara.endereco ? <div className="text-[11px]">{doc.camara.endereco.toLocaleUpperCase("pt-BR")}</div> : null}
          <div className="text-[15px] font-bold">PODER LEGISLATIVO</div>
          <div className="text-[15px] font-bold">SECRETARIA DA CÂMARA</div>
        </div>
      </div>
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className="w-[22%] border-t border-[#111] px-2 py-1.5 align-top">
              <span className={rot}>Nr. Protocolo</span>
              {c.protocolo}
            </td>
            <td className="border-t border-l border-[#111] px-2 py-1.5 align-top">
              <span className={rot}>Tipo de Proposição</span>
              <span className={forte}>{c.tipo}</span>
            </td>
            <td className="w-[24%] border-t border-l border-[#111] px-2 py-1.5 align-top">
              <span className={rot}>Número</span>
              <span className={forte}>{c.numero}</span>
            </td>
          </tr>
          <tr>
            <td colSpan={3} className="border-t border-[#111] px-2 py-1.5">
              <span className={rot}>Autor(es)</span>
              <span className={forte}>{c.autor}</span>
            </td>
          </tr>
          <tr>
            <td colSpan={3} className="h-20 border-t border-[#111] px-2 py-1.5 align-top">
              <span className={rot}>Ementa:</span>
              {c.ementa}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="border-t border-[#111] px-2 py-1.5">
              <span className={rot}>Data da Entrada</span>
              <span className={forte}>{c.data}</span>
            </td>
            <td className="border-t border-l border-[#111] px-2 py-1.5">
              <span className={rot}>Horário</span>
              {c.horario}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Linhas({ linhas }: { linhas: Linha[] }) {
  return (
    <div className="grid gap-1">
      {linhas.map((l) => (
        <div key={l.rotulo} className="grid grid-cols-[minmax(0,190px)_1fr] gap-3 break-inside-avoid max-sm:grid-cols-1 max-sm:gap-0">
          <b>{l.rotulo}:</b>
          <span className={l.pendente ? "text-[#b42318] italic" : ""}>
            {l.valor.map((v, i) => (
              <span key={i} className="block">
                {v}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
