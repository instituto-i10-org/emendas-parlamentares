import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { usaBlob } from "@/lib/arquivos/armazenamento";
import { CHAVE_VALIDA, podeEnviarArquivo } from "@/lib/arquivos/permissao";
import { REGRAS_ARQUIVO, type UsoArquivo } from "@/lib/arquivos/regras";
import { usuarioDaSessao } from "@/lib/session";

// Envio direto do navegador ao Blob privado (o servidor só aceita requisições
// de até 4,5 MB; um orçamento em PDF passa disso). Aqui só se autoriza: quem,
// para que uso, que tipo e até que tamanho.
export async function GET() {
  return Response.json({ blob: usaBlob() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const r = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await usuarioDaSessao();
        const uso = (JSON.parse(clientPayload ?? "{}") as { uso?: UsoArquivo }).uso;
        if (!user || !uso || !REGRAS_ARQUIVO[uso] || !podeEnviarArquivo(user, uso)) throw new Error("Sem permissão para enviar este arquivo.");
        if (!CHAVE_VALIDA.test(pathname) || !pathname.startsWith(uso.toLowerCase() + "/")) throw new Error("Caminho inválido.");
        return {
          allowedContentTypes: [...REGRAS_ARQUIVO[uso].tipos, "application/octet-stream"],
          maximumSizeInBytes: REGRAS_ARQUIVO[uso].maxBytes,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
      // O registro no banco é feito pela ação registrarArquivo, chamada pelo
      // navegador ao fim do envio (este aviso não chega ao ambiente local).
      onUploadCompleted: async () => {},
    });
    return Response.json(r);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Envio recusado." }, { status: 400 });
  }
}
