// Props for a card or row that opens something when clicked, so it also works with the
// keyboard (Tab to it, then Enter or Space). Keys pressed on buttons inside it are left alone.
export const clickable = (action) => ({
  role: "button",
  tabIndex: 0,
  onClick: action,
  onKeyDown: (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action(e);
    }
  },
});
