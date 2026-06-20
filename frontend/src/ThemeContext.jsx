import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    localStorage.setItem("theme", dark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  const toggle = () => setDark(d => !d);

  // Colour tokens used across all pages
  const t = dark ? {
    bg:          "#0f1117",
    card:        "#1a1d27",
    cardBorder:  "#2a2d3a",
    header:      "#1a1d27",
    text:        "#e8eaf0",
    subtext:     "#9399a8",
    border:      "#2a2d3a",
    input:       "#22263a",
    inputBorder: "#3a3f55",
    pill:        "#22263a",
    pillText:    "#9399a8",
    accent:      "#4d8bff",
    green:       "#4caf50",
    orange:      "#ff9800",
    red:         "#f44336",
  } : {
    bg:          "#f0f4f8",
    card:        "#ffffff",
    cardBorder:  "#e8ecf0",
    header:      "#1565c0",
    text:        "#1a1a2e",
    subtext:     "#666",
    border:      "#e8e8e8",
    input:       "#fafafa",
    inputBorder: "#e0e0e0",
    pill:        "#f5f7fa",
    pillText:    "#999",
    accent:      "#1565c0",
    green:       "#2e7d32",
    orange:      "#f57c00",
    red:         "#c62828",
  };

  return (
    <ThemeContext.Provider value={{ dark, toggle, t }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
