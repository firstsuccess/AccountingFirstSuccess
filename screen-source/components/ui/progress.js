"use client";
import { jsx } from "react/jsx-runtime";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
function Progress({
  className,
  value,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    ProgressPrimitive.Root,
    {
      "data-slot": "progress",
      value,
      className: cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsx(
        ProgressPrimitive.Indicator,
        {
          "data-slot": "progress-indicator",
          className: "h-full w-full flex-1 bg-primary transition-all",
          style: { transform: `translateX(-${100 - (value ?? 0)}%)` }
        }
      )
    }
  );
}
export {
  Progress
};
