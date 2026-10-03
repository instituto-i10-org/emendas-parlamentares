import Link from "next/link";
import type { ReactNode } from "react";
import { SeletorExercicio } from "@/components/app/seletor-exercicio";
import { LogoEmendas360 } from "@/components/logo-emendas360";
import { rotuloExercicio } from "@/lib/ciclo";
import { getSeletorExercicio } from "@/lib/exercicio";
import { prisma } from "@/lib/prisma";

// Portal público: consulta sem login (transparência ativa — ADPF 854, art.
// 163-A da CF). Só dados de emendas já submetidas.
export default async function LayoutPublico({ children }: { children: ReactNode }) {
  const [municipio, exercicio] = await Promise.all([prisma.municipio.findFirst(), getSeletorExercicio()]);
  return (
    <div className="min-h-dvh bg-page">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
          <Link href="/">
            <LogoEmendas360 />
          </Link>
          <span className="text-sm text-on-navy">{municipio ? `${municipio.nome}/${municipio.uf}` : ""} · Portal das emendas impositivas</span>
          <nav className="ml-auto flex flex-wrap items-center gap-1 text-sm font-semibold">
            {exercicio && exercicio.anos.length > 1 ? (
              <label className="mr-1 flex items-center gap-1.5 rounded-md bg-white/6 px-3 py-1.5 text-on-navy">
                {rotuloExercicio(exercicio)}
                <SeletorExercicio {...exercicio} />
              </label>
            ) : null}
            <Link href="/publica" className="rounded-md px-3 py-2 hover:bg-white/10">
              Visão geral
            </Link>
            <Link href="/publica/emendas" className="rounded-md px-3 py-2 hover:bg-white/10">
              Emendas
            </Link>
            <Link href="/publica/manual" className="rounded-md px-3 py-2 hover:bg-white/10">
              Como funciona
            </Link>
            <Link href="/login" className="rounded-md bg-white/10 px-3 py-2 hover:bg-white/20">
              Entrar
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 max-sm:px-4">{children}</main>
      <footer className="mx-auto max-w-6xl px-6 pb-10 text-xs text-muted-foreground">
        Dados publicados pelo sistema Emendas360. As emendas apresentadas fora do sistema foram lidas por OCR do documento oficial da Câmara.
      </footer>
    </div>
  );
}
