import * as React from "react"

import { cn } from "@/lib/utils"

// Campo preenchido, sem borda até o foco (classe .campo em globals.css).
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn("campo h-12 min-w-0 px-3.5", className)}
      {...props}
    />
  )
}

export { Input }
