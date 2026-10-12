import { jsx } from "react/jsx-runtime";
import { cn } from "@/lib/utils";
function Skeleton({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-slot": "skeleton",
      className: cn("animate-pulse rounded-md bg-accent", className),
      ...props
    }
  );
}
export {
  Skeleton
};
