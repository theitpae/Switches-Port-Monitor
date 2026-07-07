"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  isDark: true,
});

// Browser normalizes rgba(30,41,59) → rgba(30, 41, 59) with spaces
// So we target BOTH formats to be safe
const LIGHT_CSS = `
/* ═══ BASE RESET ═══════════════════════════════════════════════════ */
[data-theme="light"] body { background:#e2e8f0 !important; color:#0f172a !important; }

/* ═══ DARK PANEL BACKGROUNDS → LIGHT ═══════════════════════════════ */
/* rgba(30, 41, 59, ...) — the main panel color, browser-normalized format */
[data-theme="light"] [style*="rgba(30, 41, 59"] {
  background: rgba(248,250,252,0.97) !important;
  border-color: #cbd5e1 !important;
}
/* non-normalized format (source code format) */
[data-theme="light"] [style*="rgba(30,41,59"] {
  background: rgba(248,250,252,0.97) !important;
  border-color: #cbd5e1 !important;
}

/* rgba(15, 23, 42, ...) — even darker panels */
[data-theme="light"] [style*="rgba(15, 23, 42"] {
  background: rgba(241,245,249,0.97) !important;
  border-color: #cbd5e1 !important;
}
[data-theme="light"] [style*="rgba(15,23,42"] {
  background: rgba(241,245,249,0.97) !important;
  border-color: #cbd5e1 !important;
}

/* #1e293b hardcoded hex */
[data-theme="light"] [style*="background: #1e293b"],
[data-theme="light"] [style*="background:#1e293b"] {
  background: #f8fafc !important;
  border-color: #e2e8f0 !important;
}
[data-theme="light"] [style*="background: #0f172a"],
[data-theme="light"] [style*="background:#0f172a"] {
  background: #f1f5f9 !important;
}

/* rgba(0,0,0,...) semi-transparent overlays */
[data-theme="light"] [style*="rgba(0, 0, 0, 0.2)"],
[data-theme="light"] [style*="rgba(0,0,0,0.2)"] {
  background: rgba(226,232,240,0.6) !important;
}
[data-theme="light"] [style*="rgba(0, 0, 0, 0.3)"],
[data-theme="light"] [style*="rgba(0,0,0,0.3)"] {
  background: rgba(213,220,230,0.7) !important;
}
[data-theme="light"] [style*="rgba(0, 0, 0, 0.4)"],
[data-theme="light"] [style*="rgba(0,0,0,0.4)"] {
  background: rgba(203,213,225,0.8) !important;
}
[data-theme="light"] [style*="rgba(0, 0, 0, 0.5)"],
[data-theme="light"] [style*="rgba(0,0,0,0.5)"] {
  background: rgba(203,213,225,0.85) !important;
}

/* rgba(100,116,139,...) — gray buttons/tabs */
[data-theme="light"] [style*="rgba(100, 116, 139"],
[data-theme="light"] [style*="rgba(100,116,139"] {
  background: rgba(226,232,240,0.85) !important;
  border-color: #cbd5e1 !important;
}

/* ═══ TEXT COLORS → DARK ═══════════════════════════════════════════ */
/* White text */
[data-theme="light"] [style*="color: white"]   { color: #1e293b !important; }
[data-theme="light"] [style*="color:white"]    { color: #1e293b !important; }
[data-theme="light"] [style*="color: #fff"]    { color: #1e293b !important; }
[data-theme="light"] [style*="color: #f8fafc"] { color: #374151 !important; }
[data-theme="light"] [style*="color: #e2e8f0"] { color: #374151 !important; }
[data-theme="light"] [style*="color: #f1f5f9"] { color: #374151 !important; }

/* Light-gray muted text */
[data-theme="light"] [style*="color: #94a3b8"] { color: #475569 !important; }
[data-theme="light"] [style*="color: #64748b"] { color: #334155 !important; }
[data-theme="light"] [style*="color: #475569"] { color: #1e293b !important; }
[data-theme="light"] [style*="color: #334155"] { color: #0f172a !important; }
[data-theme="light"] [style*="color: #1e293b"] { color: #0f172a !important; }

/* ═══ INPUTS / SELECTS ══════════════════════════════════════════════ */
[data-theme="light"] input  {
  background: #ffffff !important;
  color: #0f172a !important;
  border-color: #94a3b8 !important;
}
[data-theme="light"] select {
  background: #ffffff !important;
  color: #0f172a !important;
  border-color: #94a3b8 !important;
}
[data-theme="light"] textarea {
  background: #ffffff !important;
  color: #0f172a !important;
}
[data-theme="light"] input::placeholder  { color: #9ca3af !important; }
[data-theme="light"] textarea::placeholder { color: #9ca3af !important; }

/* ═══ ACCENT / STATUS COLORS — RESTORE VIVID TONES ═════════════════ */
[data-theme="light"] [style*="color: #10b981"],
[data-theme="light"] [style*="color: #4ade80"] { color: #15803d !important; }

[data-theme="light"] [style*="color: #ef4444"],
[data-theme="light"] [style*="color: #f87171"],
[data-theme="light"] [style*="color: #fca5a5"] { color: #b91c1c !important; }

[data-theme="light"] [style*="color: #3b82f6"],
[data-theme="light"] [style*="color: #60a5fa"],
[data-theme="light"] [style*="color: #93c5fd"] { color: #1d4ed8 !important; }

[data-theme="light"] [style*="color: #f59e0b"],
[data-theme="light"] [style*="color: #fcd34d"],
[data-theme="light"] [style*="color: #fbbf24"] { color: #92400e !important; }

[data-theme="light"] [style*="color: #c4b5fd"],
[data-theme="light"] [style*="color: #a78bfa"] { color: #5b21b6 !important; }

/* ═══ NETWORK MAP CANVAS AREA ════════════════════════════════════════ */
[data-theme="light"] [style*="background: linear-gradient"][style*="0f172a"] {
  background: linear-gradient(135deg, #dde4ee 0%, #e8edf5 100%) !important;
}

/* ═══ MODAL DIALOGS — keep dark bg for focus ════════════════════════ */
[data-theme="light"] [style*="position: fixed"][style*="rgba(0, 0, 0, 0.7)"] > div,
[data-theme="light"] [style*="position: fixed"][style*="rgba(0,0,0,0.7)"] > div {
  background: #ffffff !important;
  color: #0f172a !important;
  border-color: #e2e8f0 !important;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2) !important;
}

/* ═══ STAT-CARD NUMBERS — restore correct accent color ══════════════ */
[data-theme="light"] .stat-card p { color: #0f172a !important; }

/* ═══ TAB BUTTONS & CHIP PILLS — unselected ════════════════════════ */

/* All unselected dark-bg buttons → visible light gray with border */
[data-theme="light"] button[style*="rgba(30, 41, 59"],
[data-theme="light"] button[style*="rgba(30,41,59"],
[data-theme="light"] button[style*="rgba(15, 23, 42"],
[data-theme="light"] button[style*="rgba(15,23,42"],
[data-theme="light"] button[style*="rgba(100, 116, 139"],
[data-theme="light"] button[style*="rgba(100,116,139"] {
  background: #d1d5db !important;
  color: #1e293b !important;
  border: 1px solid #94a3b8 !important;
}

/* Unselected anchor/div chips (site/switch selectors) */
[data-theme="light"] a[style*="rgba(30, 41, 59"],
[data-theme="light"] a[style*="rgba(30,41,59"],
[data-theme="light"] div[style*="rgba(100, 116, 139"][style*="border-radius"],
[data-theme="light"] div[style*="rgba(100,116,139"][style*="border-radius"] {
  background: #d1d5db !important;
  color: #1e293b !important;
  border: 1px solid #94a3b8 !important;
}

/* span chips (network map stat boxes & filter pills) */
[data-theme="light"] span[style*="rgba(30, 41, 59"],
[data-theme="light"] span[style*="rgba(30,41,59"],
[data-theme="light"] span[style*="rgba(100, 116, 139"],
[data-theme="light"] span[style*="rgba(100,116,139"] {
  background: #d1d5db !important;
  color: #1e293b !important;
  border: 1px solid #94a3b8 !important;
}

/* ═══ CHIP PANELS that hold site/switch selector rows ══════════════ */
[data-theme="light"] [style*="rgba(30, 41, 59"][style*="border-radius"],
[data-theme="light"] [style*="rgba(30,41,59"][style*="border-radius"] {
  background: #f1f5f9 !important;
  border: 1px solid #cbd5e1 !important;
}


/* Active tab button (blue) stays blue */
[data-theme="light"] button[style*="#3b82f6"],
[data-theme="light"] button[style*="background: #3b82f6"] {
  background: #2563eb !important;
  color: #ffffff !important;
}

/* ═══ CHIP / BADGE text ══════════════════════════════════════════════ */
[data-theme="light"] span[style*="background"][style*="rgba(30, 41, 59"],
[data-theme="light"] span[style*="background"][style*="rgba(30,41,59"] {
  background: #e2e8f0 !important;
  color: #0f172a !important;
}
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  const applyTheme = (t: Theme) => {
    document.documentElement.setAttribute('data-theme', t);
    let styleEl = document.getElementById('cisco-light-overrides');
    if (t === 'light') {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'cisco-light-overrides';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = LIGHT_CSS;
    } else {
      styleEl?.remove();
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('cisco_theme') as Theme | null;
    const preferred = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    applyTheme(preferred);
    setTheme(preferred);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('cisco_theme', next);
      applyTheme(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
