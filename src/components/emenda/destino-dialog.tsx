"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { atualizarDestino, cadastrarDestino } from "@/lib/actions/destinos";
import { buscarCnpj } from "@/lib/actions/servicos";
import { cnpjValido, formatarCnpj, formatarTelefone, somenteDigitos } from "@/lib/cnpj";
import type { DestinoTela } from "@/lib/emendas/contexto";
import { sugerirUnidades } from "@/lib/emendas/sugestao-unidade";
import { cn } from "@/lib/utils";
import { Ajuda, Campo } from "./ui";

type Form = {
  nome: string;
  endereco: string;
  unidadeCodigo: string;
  cnpj: string;
  responsavelNome: string;
  responsavelCargo: string;
  telefone: string;
  email: string;
};

// Cadastro (ou edição) de destino, aberto a partir da lista de "Para onde vai".
export function DestinoDialog({
  aberto,
  execucao,
  nomeInicial,
  editando,
  unidades,
  exercicio,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  execucao: "DIRETA" | "INDIRETA";
  nomeInicial: string;
  editando: DestinoTela | null;
  unidades: { codigo: string; nome: string }[];
  exercicio: number;
  aoFechar: () => void;
  aoSalvar: (d: DestinoTela) => void;
}) {
  const indireta = execucao === "INDIRETA";
  const [f, setF] = useState<Form>(vazio(nomeInicial));
  const [salvando, setSalvando] = useState(false);
  const [statusCnpj, setStatusCnpj] = useState<{ tipo: "ok" | "warn" | "erro" | "carregando"; texto: string } | null>(null);
  const digitados = useRef(new Set<keyof Form>());
  const ultimaConsulta = useRef("");
  const escolheuUnidade = useRef(false);

  useEffect(() => {
    if (!aberto) return;
    digitados.current = new Set();
    ultimaConsulta.current = "";
    escolheuUnidade.current = !!editando;
    // Reinicia o formulário a cada abertura.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatusCnpj(null);
    setF(
      editando
        ? {
            nome: editando.nome,
            endereco: editando.endereco,
            unidadeCodigo: editando.uo ?? "",
            cnpj: formatarCnpj(editando.cnpj),
            responsavelNome: editando.responsavel ?? "",
            responsavelCargo: editando.cargo ?? "",
            telefone: editando.telefone ?? "",
            email: editando.email ?? "",
          }
        : vazio(nomeInicial)
    );
  }, [aberto, editando, nomeInicial]);

  const sugeridas = useMemo(() => (indireta ? [] : sugerirUnidades(f.nome, unidades)), [f.nome, unidades, indireta]);
  // A primeira sugestão entra sozinha até a pessoa escolher.
  useEffect(() => {
    if (!indireta && !escolheuUnidade.current && sugeridas[0] && f.unidadeCodigo !== sugeridas[0]) {
      setF((x) => ({ ...x, unidadeCodigo: sugeridas[0] }));
    }
  }, [sugeridas, indireta, f.unidadeCodigo]);

  const mudar = (k: keyof Form, v: string) => {
    digitados.current.add(k);
    setF((x) => ({ ...x, [k]: v }));
  };

  // CNPJ completo e válido: a Receita preenche o que ainda não foi digitado.
  async function aoMudarCnpj(v: string) {
    const formatado = formatarCnpj(v);
    setF((x) => ({ ...x, cnpj: formatado }));
    const d = somenteDigitos(formatado);
    if (d.length < 14) {
      ultimaConsulta.current = "";
      setStatusCnpj(null);
      return;
    }
    if (d === ultimaConsulta.current) return;
    ultimaConsulta.current = d;
    if (!cnpjValido(d)) {
      setStatusCnpj({ tipo: "erro", texto: "CNPJ inválido." });
      return;
    }
    setStatusCnpj({ tipo: "carregando", texto: "Consultando a Receita Federal…" });
    const r = await buscarCnpj(d);
    if (ultimaConsulta.current !== d) return;
    if (!r.ok) {
      setStatusCnpj({ tipo: "erro", texto: `Não foi possível consultar: ${r.erro} Preencha os dados manualmente.` });
      return;
    }
    const x = r.dados;
    setF((atual) => {
      const novo = { ...atual };
      const por = (k: keyof Form, valor: string) => {
        if (valor && !digitados.current.has(k)) novo[k] = valor;
      };
      por("nome", x.nome);
      por("endereco", x.endereco);
      por("responsavelNome", x.responsavel);
      por("responsavelCargo", x.cargo);
      por("telefone", x.telefone);
      por("email", x.email);
      return novo;
    });
    const avisos = [
      !x.ativa && `Situação cadastral: ${x.situacao || "não informada"}.`,
      !x.semFinsLucrativos && `A natureza jurídica (${x.natureza || "não informada"}) não é de entidade sem fins lucrativos.`,
    ].filter(Boolean);
    setStatusCnpj({
      tipo: avisos.length ? "warn" : "ok",
      texto: `${avisos.length ? avisos.join(" ") : "✓ Dados preenchidos pela Receita Federal."} Confira antes de salvar.`,
    });
  }

  async function salvar() {
    setSalvando(true);
    try {
      const dados = {
        execucao,
        exercicio,
        nome: f.nome,
        endereco: f.endereco,
        unidadeCodigo: indireta ? null : f.unidadeCodigo || null,
        cnpj: indireta ? f.cnpj : null,
        responsavelNome: indireta ? f.responsavelNome : null,
        responsavelCargo: indireta ? f.responsavelCargo : null,
        telefone: indireta ? f.telefone : null,
        email: indireta ? f.email : null,
      };
      const r = editando ? await atualizarDestino(editando.id, dados) : await cadastrarDestino(dados);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast(editando ? "Cadastro do destino atualizado." : indireta ? "Entidade cadastrada." : "Órgão cadastrado.");
      aoSalvar(r.destino);
    } finally {
      setSalvando(false);
    }
  }

  const outras = unidades.filter((u) => !sugeridas.includes(u.codigo));

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent
        titulo={editando ? "Editar cadastro do destino" : indireta ? "Cadastrar entidade do terceiro setor" : "Cadastrar órgão ou equipamento público"}
        acoes={
          <>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar e usar"}
            </Button>
            <Button variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
          {indireta ? (
            <Campo rotulo="CNPJ" obrigatorio htmlFor="n-cnpj" className="col-span-full">
              <input
                id="n-cnpj"
                className="campo h-12 px-3.5 tnum"
                inputMode="numeric"
                maxLength={18}
                placeholder="00.000.000/0001-00"
                value={f.cnpj}
                onChange={(e) => aoMudarCnpj(e.target.value)}
                autoFocus
              />
              {statusCnpj ? (
                <p
                  role="status"
                  className={cn(
                    "text-xs font-semibold",
                    statusCnpj.tipo === "ok" && "text-ok-ink",
                    statusCnpj.tipo === "warn" && "text-warn",
                    statusCnpj.tipo === "erro" && "text-bad-ink",
                    statusCnpj.tipo === "carregando" && "text-muted-foreground"
                  )}
                >
                  {statusCnpj.texto}
                </p>
              ) : null}
            </Campo>
          ) : null}
          <Campo rotulo={indireta ? "Razão social da entidade" : "Nome"} obrigatorio htmlFor="n-nome" className="col-span-full">
            <input id="n-nome" className="campo h-12 px-3.5" value={f.nome} onChange={(e) => mudar("nome", e.target.value)} />
          </Campo>
          {!indireta ? (
            <Campo
              rotulo="Secretaria responsável"
              obrigatorio
              htmlFor="n-uo"
              className="col-span-full"
              ajuda="É por essa unidade orçamentária que o sistema procura a dotação. Na dúvida, escolha a secretaria que responde pelo equipamento."
              dica={
                sugeridas.length
                  ? `${sugeridas.length === 1 ? "1 unidade sugerida" : `${sugeridas.length} unidades sugeridas`} pelo nome do destino. Confirme a unidade responsável.`
                  : "Sem sugestão pelo nome: selecione a unidade responsável."
              }
            >
              <select
                id="n-uo"
                className="campo campo-select h-12 pr-9 pl-3.5"
                value={f.unidadeCodigo}
                onChange={(e) => {
                  escolheuUnidade.current = true;
                  setF((x) => ({ ...x, unidadeCodigo: e.target.value }));
                }}
              >
                <option value="">Selecione a secretaria ou órgão</option>
                {f.unidadeCodigo && !unidades.some((u) => u.codigo === f.unidadeCodigo) ? (
                  <option value={f.unidadeCodigo}>{f.unidadeCodigo} — órgão inteiro (todas as unidades)</option>
                ) : null}
                {sugeridas.length ? (
                  <>
                    <optgroup label="Sugeridas pelo nome">
                      {unidades
                        .filter((u) => sugeridas.includes(u.codigo))
                        .map((u) => (
                          <option key={u.codigo} value={u.codigo}>
                            {u.codigo} — {u.nome}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Demais unidades">
                      {outras.map((u) => (
                        <option key={u.codigo} value={u.codigo}>
                          {u.codigo} — {u.nome}
                        </option>
                      ))}
                    </optgroup>
                  </>
                ) : (
                  unidades.map((u) => (
                    <option key={u.codigo} value={u.codigo}>
                      {u.codigo} — {u.nome}
                    </option>
                  ))
                )}
              </select>
            </Campo>
          ) : null}
          <Campo rotulo="Endereço" obrigatorio htmlFor="n-end" className="col-span-full">
            <input
              id="n-end"
              className="campo h-12 px-3.5"
              placeholder="Rua, número — bairro · CEP"
              value={f.endereco}
              onChange={(e) => mudar("endereco", e.target.value)}
            />
          </Campo>
          {indireta ? (
            <>
              <Campo rotulo="Responsável legal" obrigatorio htmlFor="n-resp">
                <input
                  id="n-resp"
                  className="campo h-12 px-3.5"
                  placeholder="Nome de quem assina pela entidade"
                  value={f.responsavelNome}
                  onChange={(e) => mudar("responsavelNome", e.target.value)}
                />
              </Campo>
              <Campo rotulo="Cargo do responsável" obrigatorio htmlFor="n-cargo">
                <input
                  id="n-cargo"
                  className="campo h-12 px-3.5"
                  placeholder="Presidente, diretor, provedor..."
                  value={f.responsavelCargo}
                  onChange={(e) => mudar("responsavelCargo", e.target.value)}
                />
              </Campo>
              <Campo rotulo="Telefone de contato" htmlFor="n-tel">
                <input
                  id="n-tel"
                  type="tel"
                  inputMode="tel"
                  className="campo h-12 px-3.5"
                  placeholder="(00) 00000-0000"
                  value={f.telefone}
                  onChange={(e) => mudar("telefone", formatarTelefone(e.target.value))}
                />
              </Campo>
              <Campo rotulo="E-mail de contato" htmlFor="n-mail">
                <input
                  id="n-mail"
                  type="email"
                  className="campo h-12 px-3.5"
                  placeholder="contato@entidade.org.br"
                  value={f.email}
                  onChange={(e) => mudar("email", e.target.value)}
                />
              </Campo>
            </>
          ) : null}
        </div>
        {indireta ? (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            A secretaria que fará o repasse é definida pelo objeto da emenda, não aqui.
            <Ajuda>Entidade do terceiro setor não tem vínculo fixo com uma secretaria: o motor procura a dotação na área do objeto.</Ajuda>
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function vazio(nome: string): Form {
  return { nome, endereco: "", unidadeCodigo: "", cnpj: "", responsavelNome: "", responsavelCargo: "", telefone: "", email: "" };
}
