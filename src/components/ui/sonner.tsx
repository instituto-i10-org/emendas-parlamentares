"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

// Aviso curto, navy, centralizado no rodapé — como no protótipo.
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="bottom-center"
    duration={2600}
    toastOptions={{
      unstyled: true,
      classNames: {
        toast:
          "flex max-w-[520px] items-center gap-2 rounded-field bg-navy px-4 py-3 text-sm font-bold text-white shadow-modal",
        error: "!bg-bad-ink",
      },
    }}
    {...props}
  />
)

export { Toaster }
