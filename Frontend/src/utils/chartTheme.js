// Colours for Recharts, which draws with SVG attributes and cannot read CSS variables.
// Keep these in step with the tokens in styles/theme.css.
const THEMES = {
  light: { grid: "#E4E7EC", text: "#667085", surface: "#FFFFFF", border: "#E4E7EC", title: "#1A1D21", cursor: "rgba(16, 24, 40, 0.05)" },
  dark: { grid: "#2A2F3A", text: "#9AA3B2", surface: "#1D212A", border: "#394050", title: "#E8EAED", cursor: "rgba(255, 255, 255, 0.05)" },
};

export const chartTheme = (resolvedTheme) => {
  const c = THEMES[resolvedTheme] || THEMES.light;
  return {
    grid: c.grid,
    text: c.text,
    // Spread onto <Tooltip> so its box matches the theme.
    tooltip: {
      contentStyle: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, color: c.title },
      labelStyle: { color: c.title, fontWeight: 600 },
      itemStyle: { color: c.title },
      cursor: { fill: c.cursor },
    },
  };
};
