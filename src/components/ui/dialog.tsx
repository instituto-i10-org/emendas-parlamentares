"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { Ajuda } from "@/components/ui/ajuda"
import { cn } from "@/lib/utils"

// Modal da Direção A: cabeçalho com título e fechar, corpo rolável, rodapé com
// as ações. Fecha no Esc e no clique fora.

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogContent({
  className,
  children,
  titulo,
  descricao,
  aviso,
  acoes,
  largura = "md",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  titulo: React.ReactNode
  // Orientação: fica no "?" ao lado do título.
  descricao?: React.ReactNode
  // Texto que precisa ser lido antes de agir (confirmações): fica visível.
  aviso?: React.ReactNode
  // Botões do rodapé.
  acoes?: React.ReactNode
  largura?: "sm" | "md" | "lg" | "xl"
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-navy-deep/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-card bg-surface text-ink shadow-modal outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          largura === "sm" && "max-w-[440px]",
          largura === "md" && "max-w-[600px]",
          largura === "lg" && "max-w-[760px]",
          largura === "xl" && "max-w-[960px]",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3 border-b border-hair px-6 py-4">
          <DialogPrimitive.Title className="min-w-0 text-lg font-bold tracking-tight">{titulo}</DialogPrimitive.Title>
          {descricao ? <Ajuda>{descricao}</Ajuda> : null}
          <span className="flex-1" />
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-page hover:text-ink focus-visible:outline-2 focus-visible:outline-cyan"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </div>
        {aviso ? (
          <DialogPrimitive.Description className="px-6 pt-4 text-sm text-muted-foreground">{aviso}</DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{descricao ?? titulo}</DialogPrimitive.Description>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {acoes ? (
          <div className="flex flex-wrap gap-2 border-t border-hair px-6 py-4 max-sm:[&>*]:flex-1">{acoes}</div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export { Dialog, DialogClose, DialogContent, DialogTrigger }
