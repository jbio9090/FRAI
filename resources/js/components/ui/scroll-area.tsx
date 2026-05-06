import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  showfade = true,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & { showfade?: boolean }) {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const [showTopFade, setShowTopFade] = React.useState(false)
  const [showBottomFade, setShowBottomFade] = React.useState(false)

  const updateFades = React.useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    setShowTopFade(scrollTop > 8)
    setShowBottomFade(scrollTop + clientHeight < scrollHeight - 8)
  }, [])

  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    updateFades()
    el.addEventListener("scroll", updateFades, { passive: true })
    const ro = new ResizeObserver(updateFades)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", updateFades)
      ro.disconnect()
    }
  }, [updateFades])

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      type="hover"
      {...props}
    >
      {/* Top fade */}
      {showfade && (<div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-background to-transparent transition-opacity duration-200",
          showTopFade ? "opacity-100" : "opacity-0"
        )}
      />)}

      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className="max-h-[inherit] size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      {/* Bottom fade */}
      {showfade && (<div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-background to-transparent transition-opacity duration-200",
          showBottomFade ? "opacity-100" : "opacity-0"
        )}
      />)}

      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px select-none",
        "opacity-0 transition-opacity duration-150 ease-out",
        "data-[state=visible]:opacity-100",
        orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }