"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BotaoImprimir({ variante = "default", rotulo = "Imprimir" }: { variante?: "default" | "ghost"; rotulo?: string }) {
  return (
    <Button variant={variante} className="print:hidden" onClick={() => window.print()}>
      <Printer /> {rotulo}
    </Button>
  );
}
