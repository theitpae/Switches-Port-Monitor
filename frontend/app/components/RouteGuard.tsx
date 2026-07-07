"use client";
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

const PUBLIC_PATHS = ['/login', '/change-password'];
const MONITOR_BLOCKED = ['/admin', '/audit', '/report'];

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isMonitorBlocked = () =>
    user?.role === 'monitor' &&
    MONITOR_BLOCKED.some(p => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    if (loading) return;
    if (!user && !PUBLIC_PATHS.includes(pathname)) {
      router.push('/login');
      return;
    }
    if (user?.must_change_password && pathname !== '/change-password') {
      router.push('/change-password');
      return;
    }
    // Monitor role: read-only — can only access / and /ports and /map
    if (isMonitorBlocked()) {
      router.push('/');
      return;
    }
    // If logged in and going to login, redirect to home
    if (user && pathname === '/login') {
      router.push('/');
    }
  }, [user, loading, pathname]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: 'white', fontSize: '18px' }}>
      กำลังโหลด...
    </div>
  );
  // Not logged in on protected page → blank (redirect pending)
  if (!user && !PUBLIC_PATHS.includes(pathname)) return null;
  // Monitor trying to access blocked page → blank (redirect pending)
  if (isMonitorBlocked()) return null;

  return <>{children}</>;
}
