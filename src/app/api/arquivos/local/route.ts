import { gravar, novaChave, usaBlob } from "@/lib/arquivos/armazenamento";
import { podeEnviarArquivo } from "@/lib/arquivos/permissao";
import { REGRAS_ARQUIVO, conferirArquivo, nomeSeguro, tipoDoArquivo, type UsoArquivo } from "@/lib/arquivos/regras";
import { usuarioDaSessao } from "@/lib/session";

// Envio em ambiente local (sem Blob): o arquivo vem no corpo e vai para o disco.
// Devolve a chave; o registro é o mesmo do envio direto (registrarArquivo).
export async function POST(req: Request) {
  if (usaBlob()) return Response.json({ error: "Use o envio direto." }, { status: 400 });
  const user = await usuarioDaSessao();
  const form = await req.formData();
  const uso = String(form.get("uso") ?? "") as UsoArquivo;
  const arquivo = form.get("arquivo");
  if (!user || !REGRAS_ARQUIVO[uso] || !podeEnviarArquivo(user, uso)) return Response.json({ error: "Sem permissão." }, { status: 403 });
  if (!(arquivo instanceof File)) return Response.json({ error: "Arquivo ausente." }, { status: 400 });
  const nome = nomeSeguro(arquivo.name);
  const tipo = tipoDoArquivo(nome, arquivo.type);
  const erro = conferirArquivo(uso, { nome, tipo, tamanho: arquivo.size });
  if (erro) return Response.json({ error: erro }, { status: 400 });
  const chave = novaChave(uso, nome);
  await gravar(chave, Buffer.from(await arquivo.arrayBuffer()), tipo);
  return Response.json({ chave });
}
