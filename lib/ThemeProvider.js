// lib/ThemeProvider.js
import React, { createContext, useState } from "react";

export const ThemeContext = createContext({
  theme: "system",
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("system");
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
