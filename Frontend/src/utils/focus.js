// True for a mouse or a trackpad, false for a finger.
// Landing the cursor in a field is a help with a mouse; on a phone it throws the
// keyboard up over the screen before the person has asked for it.
export const hasPointer = () =>
  typeof window === "undefined" ||
  typeof window.matchMedia !== "function" ||
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;
