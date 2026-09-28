"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BotaoImprimir({ variante = "default" }: { variante?: "default" | "ghost" }) {
  return (
    <Button variant={variante} className="print:hidden" onClick={() => window.print()}>
      <Printer /> Imprimir
    </Button>
  );
}
