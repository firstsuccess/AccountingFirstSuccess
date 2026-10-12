"use client";
import { jsx } from "react/jsx-runtime";
import { Direction } from "radix-ui";
function DirectionProvider({
  dir,
  direction,
  children
}) {
  return /* @__PURE__ */ jsx(Direction.DirectionProvider, { dir: direction ?? dir, children });
}
const useDirection = Direction.useDirection;
export {
  DirectionProvider,
  useDirection
};
