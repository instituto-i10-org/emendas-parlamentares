"use client";

import { useState } from "react";
import { Cartao, TabelaDados } from "@/components/app/pagina";
import { Campo, Pilulas, Selo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { criarUsuario, definirSenha, excluirPerfil, reatribuirPerfil, salvarPerfil, vincularAutor } from "@/lib/actions/config";
import { PERMISSOES, type Permissao } from "@/lib/authz";
import { BotaoAcao, useAcao } from "./comum";

export type PerfilTela = {
  id: string;
  nome: string;
  descricao: string | null;
  poder: "LEGISLATIVO" | "EXECUTIVO" | null;
  adminGeral: boolean;
  perfilDoSistema: boolean;
  permissoes: Permissao[];
  usuarios: number;
  atribuivel: boolean;
};

export type UsuarioTela = {
  id: string;
  nome: string;
  email: string;
  perfilId: string | null;
  perfilNome: string | null;
  autor: string | null;
  editavel: boolean;
};

export const ROTULO_PERMISSAO: Record<Permissao, string> = {
  apresentarEmendas: "Apresenta emendas",
  gerirTodasEmendas: "Gere todas as emendas",
  tramitarEmendas: "Tramita emendas",
  gerirPlanejamento: "Gere o planejamento",
  gerirExercicios: "Gere exercícios",
  administrarConfiguracoes: "Administra configurações",
  analisarViabilidade: "Analisa viabilidade",
  registrarExecucao: "Registra execução",
};

const poderRotulo = (p: PerfilTela["poder"]) => (p === "LEGISLATIVO" ? "Legislativo" : p === "EXECUTIVO" ? "Executivo" : "Transversal");

// ------------------------------------------------------------------ usuários

export function AbaUsuarios({ usuarios, perfis, autores }: { usuarios: UsuarioTela[]; perfis: PerfilTela[]; autores: string[] }) {
  const [novo, setNovo] = useState(false);
  const [senhaDe, setSenhaDe] = useState<UsuarioTela | null>(null);
  const [autorDe, setAutorDe] = useState<UsuarioTela | null>(null);
  const atribuiveis = perfis.filter((p) => p.atribuivel);
  return (
    <Cartao titulo="Usuários" acoes={<Button size="sm" onClick={() => setNovo(true)}>Novo usuário</Button>}>
      <TabelaDados
        colunas={[{ titulo: "Nome" }, { titulo: "Perfil" }, { titulo: "Autor (vereador)", className: "max-md:hidden" }, { titulo: "" }]}
        linhas={usuarios.map((u) => ({
          chave: u.id,
          celulas: [
            <div key="n">
              <b>{u.nome}</b>
              <span className="block text-xs text-muted-foreground">{u.email}</span>
            </div>,
            u.editavel ? <SeletorPerfil key="p" usuario={u} perfis={atribuiveis} /> : <span key="p">{u.perfilNome ?? "sem perfil"}</span>,
            <span key="a" className="max-md:hidden">{u.autor ?? <span className="text-muted-foreground">—</span>}</span>,
            u.editavel ? (
              <div key="b" className="flex items-center justify-end gap-1">
                <Button size="xs" variant="ghost" onClick={() => setAutorDe(u)}>
                  Autor
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setSenhaDe(u)}>
                  Senha
                </Button>
              </div>
            ) : null,
          ],
        }))}
      />
      <NovoUsuario aberto={novo} aoFechar={() => setNovo(false)} perfis={atribuiveis} autores={autores} />
      <DefinirSenha usuario={senhaDe} aoFechar={() => setSenhaDe(null)} />
      <VincularAutor usuario={autorDe} autores={autores} aoFechar={() => setAutorDe(null)} />
    </Cartao>
  );
}

function SeletorPerfil({ usuario, perfis }: { usuario: UsuarioTela; perfis: PerfilTela[] }) {
  const { pendente, executar } = useAcao();
  return (
    <select
      aria-label={`Perfil de ${usuario.nome}`}
      className="campo campo-select h-9 max-w-[260px] pr-9 pl-3"
      disabled={pendente}
      value={usuario.perfilId ?? ""}
      onChange={(e) => executar(() => reatribuirPerfil(usuario.id, e.target.value || null))}
    >
      <option value="">Sem perfil (sem acesso)</option>
      {perfis.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nome} · {poderRotulo(p.poder)}
        </option>
      ))}
    </select>
  );
}

function NovoUsuario({ aberto, aoFechar, perfis, autores }: { aberto: boolean; aoFechar: () => void; perfis: PerfilTela[]; autores: string[] }) {
  const [f, setF] = useState({ nome: "", email: "", perfilId: "", senha: "", autorNome: "" });
  const { pendente, executar } = useAcao();
  const perfil = perfis.find((p) => p.id === f.perfilId);
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent
        titulo="Novo usuário"
        acoes={
          <>
            <Button
              disabled={pendente}
              onClick={() =>
                executar(
                  () => criarUsuario({ ...f, autorNome: perfil?.permissoes.includes("apresentarEmendas") ? f.autorNome : undefined }),
                  () => {
                    setF({ nome: "", email: "", perfilId: "", senha: "", autorNome: "" });
                    aoFechar();
                  }
                )
              }
            >
              Criar usuário
            </Button>
            <Button variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="grid gap-3.5">
          <Campo rotulo="Nome" obrigatorio htmlFor="u-nome">
            <input id="u-nome" className="campo h-12 px-3.5" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          </Campo>
          <Campo rotulo="E-mail" obrigatorio htmlFor="u-mail">
            <input id="u-mail" type="email" className="campo h-12 px-3.5" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Campo>
          <Campo rotulo="Perfil" obrigatorio htmlFor="u-perfil">
            <select id="u-perfil" className="campo campo-select h-12 pr-9 pl-3.5" value={f.perfilId} onChange={(e) => setF({ ...f, perfilId: e.target.value })}>
              <option value="">Selecione…</option>
              {perfis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} · {poderRotulo(p.poder)}
                </option>
              ))}
            </select>
          </Campo>
          {perfil?.permissoes.includes("apresentarEmendas") ? (
            <Campo rotulo="Autor (vereador)" htmlFor="u-autor" dica="Escolha um vereador já cadastrado ou digite um nome novo.">
              <input id="u-autor" list="autores" className="campo h-12 px-3.5" value={f.autorNome} onChange={(e) => setF({ ...f, autorNome: e.target.value })} />
              <datalist id="autores">
                {autores.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </Campo>
          ) : null}
          <Campo rotulo="Senha inicial" obrigatorio htmlFor="u-senha" dica="Ao menos 10 caracteres. Entregue por canal seguro.">
            <input id="u-senha" type="password" autoComplete="new-password" className="campo h-12 px-3.5" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} />
          </Campo>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DefinirSenha({ usuario, aoFechar }: { usuario: UsuarioTela | null; aoFechar: () => void }) {
  const [senha, setSenha] = useState("");
  const { pendente, executar } = useAcao();
  return (
    <Dialog open={!!usuario} onOpenChange={(a) => !a && aoFechar()}>
      {usuario ? (
        <DialogContent
          titulo={`Definir senha — ${usuario.nome}`}
          largura="sm"
          acoes={
            <Button disabled={pendente} onClick={() => executar(() => definirSenha(usuario.id, senha), () => { setSenha(""); aoFechar(); })}>
              Definir senha
            </Button>
          }
        >
          <Campo rotulo="Nova senha" htmlFor="s-nova" dica="Ao menos 10 caracteres.">
            <input id="s-nova" type="password" autoComplete="new-password" className="campo h-12 px-3.5" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Campo>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function VincularAutor({ usuario, autores, aoFechar }: { usuario: UsuarioTela | null; autores: string[]; aoFechar: () => void }) {
  const [nome, setNome] = useState("");
  const { pendente, executar } = useAcao();
  return (
    <Dialog open={!!usuario} onOpenChange={(a) => !a && aoFechar()}>
      {usuario ? (
        <DialogContent
          titulo={`Autor vinculado — ${usuario.nome}`}
          largura="sm"
          onOpenAutoFocus={() => setNome(usuario.autor ?? "")}
          descricao="O vínculo define de quem são as emendas que a conta apresenta e qual cota elas consomem."
          acoes={
            <>
              <Button disabled={pendente} onClick={() => executar(() => vincularAutor(usuario.id, nome), aoFechar)}>
                Salvar vínculo
              </Button>
              {usuario.autor ? (
                <Button variant="ghost" disabled={pendente} onClick={() => executar(() => vincularAutor(usuario.id, null), aoFechar)}>
                  Desvincular
                </Button>
              ) : null}
            </>
          }
        >
          <Campo rotulo="Vereador" htmlFor="v-autor">
            <input id="v-autor" list="autores-v" className="campo h-12 px-3.5" value={nome} placeholder={usuario.autor ?? ""} onChange={(e) => setNome(e.target.value)} />
            <datalist id="autores-v">
              {autores.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Campo>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

// ------------------------------------------------------------------- perfis

export function AbaPerfis({ perfis }: { perfis: PerfilTela[] }) {
  const [editando, setEditando] = useState<PerfilTela | "novo" | null>(null);
  return (
    <Cartao ajuda="Um perfil combina um Poder de atuação com permissões. Sem permissões, é perfil de consulta. Mudanças valem no próximo login." titulo="Perfis de acesso" acoes={<Button size="sm" onClick={() => setEditando("novo")}>Novo perfil</Button>}>
      <TabelaDados
        colunas={[{ titulo: "Perfil" }, { titulo: "Poder" }, { titulo: "Permissões", className: "max-md:hidden" }, { titulo: "Usuários", className: "text-right" }, { titulo: "" }]}
        linhas={perfis.map((p) => ({
          chave: p.id,
          celulas: [
            <div key="n">
              <b>{p.nome}</b>
              {p.perfilDoSistema ? <span className="ml-2"><Selo>sistema</Selo></span> : null}
              {p.descricao ? <span className="block text-xs text-muted-foreground">{p.descricao}</span> : null}
            </div>,
            poderRotulo(p.poder),
            <div key="p" className="flex max-w-md flex-wrap gap-1 max-md:hidden">
              {p.adminGeral ? (
                <Selo tipo="info">acesso total</Selo>
              ) : p.permissoes.length ? (
                p.permissoes.map((k) => <Selo key={k}>{ROTULO_PERMISSAO[k]}</Selo>)
              ) : (
                <Selo>somente consulta</Selo>
              )}
            </div>,
            <span key="u" className="tnum">{p.usuarios}</span>,
            p.perfilDoSistema ? null : (
              <div key="a" className="flex items-center justify-end gap-1">
                <Button size="xs" variant="ghost" onClick={() => setEditando(p)}>
                  Editar
                </Button>
                <BotaoAcao acao={() => excluirPerfil(p.id)} confirmar={`Excluir o perfil ${p.nome}?`} desabilitado={p.usuarios > 0}>
                  Excluir
                </BotaoAcao>
              </div>
            ),
          ],
        }))}
      />
      <EditorPerfil perfil={editando} aoFechar={() => setEditando(null)} />
    </Cartao>
  );
}

function EditorPerfil({ perfil, aoFechar }: { perfil: PerfilTela | "novo" | null; aoFechar: () => void }) {
  const base = perfil && perfil !== "novo" ? perfil : null;
  const [f, setF] = useState({ nome: "", descricao: "", poder: "LEGISLATIVO" as PerfilTela["poder"], permissoes: [] as Permissao[] });
  const { pendente, executar } = useAcao();
  return (
    <Dialog
      open={!!perfil}
      onOpenChange={(a) => {
        if (a) return;
        aoFechar();
      }}
    >
      {perfil ? (
        <DialogContent
          titulo={base ? `Editar perfil — ${base.nome}` : "Novo perfil"}
          onOpenAutoFocus={() =>
            setF(base ? { nome: base.nome, descricao: base.descricao ?? "", poder: base.poder, permissoes: base.permissoes } : { nome: "", descricao: "", poder: "LEGISLATIVO", permissoes: [] })
          }
          acoes={
            <Button disabled={pendente} onClick={() => executar(() => salvarPerfil({ id: base?.id, ...f }), aoFechar)}>
              Salvar perfil
            </Button>
          }
        >
          <div className="grid gap-3.5">
            <Campo rotulo="Nome" obrigatorio htmlFor="pf-nome">
              <input id="pf-nome" className="campo h-12 px-3.5" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
            </Campo>
            <Campo rotulo="Descrição" htmlFor="pf-desc">
              <input id="pf-desc" className="campo h-12 px-3.5" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
            </Campo>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-label">Poder de atuação</p>
              <Pilulas
                rotulo="Poder"
                opcoes={["LEGISLATIVO", "EXECUTIVO", "TRANSVERSAL"] as const}
                valor={f.poder ?? "TRANSVERSAL"}
                curto={(v) => (v === "LEGISLATIVO" ? "Legislativo" : v === "EXECUTIVO" ? "Executivo" : "Transversal")}
                aoEscolher={(v) => setF({ ...f, poder: v === "TRANSVERSAL" ? null : v })}
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-label">Permissões</p>
              <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                {PERMISSOES.map((k) => (
                  <label key={k} className="flex items-center gap-2 rounded-md bg-soft px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={f.permissoes.includes(k)}
                      onChange={(e) => setF({ ...f, permissoes: e.target.checked ? [...f.permissoes, k] : f.permissoes.filter((x) => x !== k) })}
                    />
                    {ROTULO_PERMISSAO[k]}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Sem nenhuma marcada, o perfil é de consulta: vê os painéis do seu Poder, sem botões de ação.</p>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
