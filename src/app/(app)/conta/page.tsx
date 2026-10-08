import { redirect } from "next/navigation";

// "Minha conta" virou uma janela, aberta pelo nome no menu. O endereço antigo
// leva ao Início com a janela aberta.
export default function ContaPage() {
  redirect("/inicio?conta=1");
}
