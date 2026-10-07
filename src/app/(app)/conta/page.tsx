import type { Metadata } from "next";
import { Cartao, Pagina } from "@/components/app/pagina";
import { ReverGuias } from "@/components/conta/rever-guias";
import { TrocarSenha } from "@/components/conta/trocar-senha";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Minha conta — Emendas360" };

export default async function ContaPage() {
  const user = await getCurrentUser();
  return (
    <Pagina titulo="Minha conta" descricao={`${user.nome} · ${user.email ?? ""}`}>
      <Cartao titulo="Trocar a senha">
        <TrocarSenha />
      </Cartao>
      <Cartao titulo="Guias de ajuda">
        <ReverGuias />
      </Cartao>
    </Pagina>
  );
}
