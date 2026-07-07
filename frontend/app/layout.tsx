import React from 'react';
import './globals.css';
import { AuthProvider } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import { ThemeProvider } from './context/ThemeContext';
import { VpnProvider } from './context/VpnContext';
import ThemeToggleFab from './components/ThemeToggleFab';
import VpnGlobalWatcher from './components/VpnGlobalWatcher';

export const metadata = {
  title: 'Cisco Monitor',
  description: 'Enterprise Cisco Switch Monitoring System',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <AlertProvider>
              <VpnProvider>
                {children}
                {/* VPN warning popup watcher */}
                <VpnGlobalWatcher />
              </VpnProvider>
            </AlertProvider>
          </AuthProvider>
          {/* Floating theme toggle — always visible on all pages */}
          <ThemeToggleFab />
        </ThemeProvider>
      </body>
    </html>
  );
}
