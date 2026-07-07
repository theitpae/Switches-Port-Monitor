"use client";
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggleFab() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      className="theme-toggle-fab"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle dark/light mode"
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
