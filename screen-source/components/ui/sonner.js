"use client";
import { jsx } from "react/jsx-runtime";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
const Toaster = ({ ...props }) => {
  const { theme = "system" } = useTheme();
  return /* @__PURE__ */ jsx(
    Sonner,
    {
      theme,
      className: "toaster group",
      icons: {
        success: /* @__PURE__ */ jsx(CircleCheckIcon, { className: "size-4" }),
        info: /* @__PURE__ */ jsx(InfoIcon, { className: "size-4" }),
        warning: /* @__PURE__ */ jsx(TriangleAlertIcon, { className: "size-4" }),
        error: /* @__PURE__ */ jsx(OctagonXIcon, { className: "size-4" }),
        loading: /* @__PURE__ */ jsx(Loader2Icon, { className: "size-4 animate-spin" })
      },
      style: {
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)"
      },
      ...props
    }
  );
};
export {
  Toaster
};
