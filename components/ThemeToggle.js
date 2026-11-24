"use client";
import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./Icons.js";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");
  useEffect(() => { setTheme(document.documentElement.dataset.theme || "light"); }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("sitelens-theme", next); } catch {}
    setTheme(next);
  }
  return (
    <button className="icon-btn" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">
      {theme === "dark" ? <IconSun /> : <IconMoon />}
    </button>
  );
}
