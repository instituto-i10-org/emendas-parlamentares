"use client";

import { useState } from "react";
import { Cartao } from "@/components/app/pagina";
import { Campo } from "@/components/emenda/ui";
import { Button } from "@/components/ui/button";
import { salvarMunicipio } from "@/lib/actions/cadastros";
import { UFS, type DadosMunicipio } from "@/lib/cadastros/municipio";
import { useAcao } from "./comum";

// Dados do município: nome, UF, código IBGE, Câmara e Prefeitura. Só o
// Administrador Geral altera; os demais perfis de Configurações só veem.
export function AbaMunicipio({ dados, podeEditar }: { dados: DadosMunicipio; podeEditar: boolean }) {
  const [f, setF] = useState<DadosMunicipio>(dados);
  const { pendente, executar } = useAcao();
  const muda = (k: keyof DadosMunicipio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Cartao guia="config.municipio.dados"
      titulo="Município"
      ajuda="Identificam a Câmara e a Prefeitura nas telas, no portal público e nos documentos impressos. Num sistema recém-iniciado, o portal mostra “Município não configurado” até o nome ser preenchido."
    >
      {!dados.nome ? <p className="mb-4 rounded-md bg-soft p-3 text-sm">O município ainda não foi configurado. Preencha os dados abaixo.</p> : null}
      <fieldset disabled={!podeEditar || pendente} className="grid gap-4">
        <div className="grid grid-cols-[1fr_120px_180px] gap-4 max-md:grid-cols-1">
          <Campo rotulo="Nome do município" obrigatorio htmlFor="mu-nome">
            <input id="mu-nome" className="campo h-12 px-3.5" maxLength={120} value={f.nome} onChange={muda("nome")} />
          </Campo>
          <Campo rotulo="UF" obrigatorio htmlFor="mu-uf">
            <select id="mu-uf" className="campo h-12 px-3" value={f.uf} onChange={muda("uf")}>
              <option value="">—</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Código IBGE" htmlFor="mu-ibge" dica="7 dígitos.">
            <input id="mu-ibge" className="campo h-12 px-3.5 tnum" inputMode="numeric" maxLength={7} value={f.codigoIbge} onChange={muda("codigoIbge")} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <Campo guia="config.municipio.nomes" rotulo="Nome da Câmara" htmlFor="mu-camara" dica="Ex.: Câmara Municipal de …">
            <input id="mu-camara" className="campo h-12 px-3.5" maxLength={200} value={f.nomeCamara} onChange={muda("nomeCamara")} />
          </Campo>
          <Campo rotulo="Nome da Prefeitura" htmlFor="mu-prefeitura" dica="Ex.: Prefeitura Municipal de …">
            <input id="mu-prefeitura" className="campo h-12 px-3.5" maxLength={200} value={f.nomePrefeitura} onChange={muda("nomePrefeitura")} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <Campo rotulo="Endereço da Câmara" htmlFor="mu-endereco" dica="Sai na capa do processo do documento da emenda.">
            <input id="mu-endereco" className="campo h-12 px-3.5" maxLength={200} value={f.enderecoCamara ?? ""} onChange={muda("enderecoCamara")} />
          </Campo>
          <Campo rotulo="Rodapé dos documentos" htmlFor="mu-rodape" dica="Endereço completo, telefone e e-mail, no pé de cada página.">
            <textarea id="mu-rodape" className="campo min-h-[70px] p-3.5" maxLength={400} value={f.rodapeDocumentos ?? ""} onChange={muda("rodapeDocumentos")} />
          </Campo>
        </div>
      </fieldset>
      {podeEditar ? (
        <div className="mt-5 flex gap-2">
          <Button data-guia="config.municipio.salvar" disabled={pendente} onClick={() => executar(() => salvarMunicipio(f))}>
            Salvar dados do município
          </Button>
          <Button variant="ghost" disabled={pendente} onClick={() => setF(dados)}>
            Desfazer
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Somente o Administrador Geral altera estes dados.</p>
      )}
    </Cartao>
  );
}
