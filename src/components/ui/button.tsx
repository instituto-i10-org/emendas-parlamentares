import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Botões da Direção A: sem borda, cantos de 12px, peso 700. O primário é navy;
// o secundário ("ghost") é a cor da página; "ok" (verde) só para submeter.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-field border-0 font-bold whitespace-nowrap transition-[background,color,box-shadow,filter] outline-none select-none focus-visible:ring-3 focus-visible:ring-cyan/40 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-navy text-white hover:bg-navy-soft",
        ghost: "bg-page text-ink hover:bg-hover",
        ok: "bg-ok text-navy-deep hover:brightness-95",
        surface: "bg-surface text-ink shadow-pop hover:shadow-[0_2px_10px_rgba(10,36,99,.16)]",
        outline: "border border-line-3 bg-surface text-ink hover:border-line-2",
        destructive: "bg-bad-bg text-bad-ink hover:bg-bad-line",
        link: "h-auto px-0 text-navy underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-[22px] text-sm",
        // Ações principais da emenda (protótipo aprovado em 08/10/2026).
        lg: "h-[52px] rounded-[14px] px-6 text-[13.5px]",
        sm: "h-9 px-3.5 text-sm",
        xs: "h-8 rounded-md px-3 text-xs",
        icon: "size-9 rounded-md",
        "icon-sm": "size-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
