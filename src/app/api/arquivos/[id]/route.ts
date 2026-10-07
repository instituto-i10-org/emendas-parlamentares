import { lerStream } from "@/lib/arquivos/armazenamento";
import { prisma } from "@/lib/prisma";
import { usuarioDaSessao } from "@/lib/session";

// Download. Arquivo público (peça orçamentária e norma publicadas) abre sem
// login; os demais, só para quem está logado.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await prisma.arquivo.findUnique({ where: { id } });
  if (!a) return new Response("Arquivo não encontrado.", { status: 404 });
  if (!a.publico && !(await usuarioDaSessao())) return new Response("Entre no sistema para baixar este arquivo.", { status: 401 });
  try {
    const { stream, tamanho } = await lerStream(a.chave);
    return new Response(stream, {
      headers: {
        "Content-Type": a.tipo,
        "Content-Length": String(tamanho),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(a.nome)}`,
        "Cache-Control": a.publico ? "public, max-age=300" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Arquivo indisponível no armazenamento.", { status: 404 });
  }
}
