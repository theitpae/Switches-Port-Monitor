"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './globals.css';
import { useAuth, authHeaders } from './context/AuthContext';
import RouteGuard from './components/RouteGuard';
import Sidebar from './components/Sidebar';

export default function Dashboard() {
  const { isAdmin, canEdit } = useAuth();
  const [switches, setSwitches] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSite, setFilterSite] = useState('all');
  const [filterTechnical, setFilterTechnical] = useState('all');
  const [portStats, setPortStats] = useState<Record<number, { connected: number; notconnect: number; disabled: number; total: number }>>({});
  const [portStatsLoading, setPortStatsLoading] = useState(false);
  // Auto-refresh
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = off
  const [countdown, setCountdown] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const refreshRef   = useRef<NodeJS.Timeout | null>(null);
  // Ping
  const [pingingId, setPingingId] = useState<number | null>(null);
  const [pingResult, setPingResult] = useState<any | null>(null);
  // Pagination — Switch table
  const [swPage, setSwPage] = useState(1);
  const [swPerPage, setSwPerPage] = useState(10);
  // Pagination — Audit log
  const [auditPage, setAuditPage] = useState(1);
  const [auditPerPage, setAuditPerPage] = useState(10);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const h = authHeaders();
    try {
      const [sw, st, us, logs] = await Promise.all([
        fetch('/api/switches', { headers: h, cache: 'no-store' }).then(r => r.json()),
        fetch('/api/sites', { headers: h }).then(r => r.json()),
        isAdmin() ? fetch('/api/users', { headers: h }).then(r => r.json()) : Promise.resolve([]),
        canEdit() ? fetch('/api/audit-logs?limit=200', { headers: h }).then(r => r.json()) : Promise.resolve([]),
      ]);
      const swList = Array.isArray(sw) ? sw : [];
      setSwitches(swList);
      setSites(Array.isArray(st) ? st : []);
      setUsers(Array.isArray(us) ? us.filter((u: any) => u.role === 'technical') : []);
      setAuditLogs(Array.isArray(logs) ? logs : []);
      setLastRefreshed(new Date());
      fetchPortStats(swList);
    } catch (_) {}
    if (!silent) setLoading(false);
    else setRefreshing(false);
  }, [isAdmin, canEdit]);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh timer
  useEffect(() => {
    // Clear existing timers
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (refreshRef.current)   clearTimeout(refreshRef.current);
    if (autoRefreshInterval === 0) { setCountdown(0); return; }

    setCountdown(autoRefreshInterval);
    countdownRef.current = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 0), 1000);

    const scheduleRefresh = () => {
      refreshRef.current = setTimeout(async () => {
        await loadData(true);
        setCountdown(autoRefreshInterval);
        scheduleRefresh(); // reschedule
      }, autoRefreshInterval * 1000);
    };
    scheduleRefresh();

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (refreshRef.current)   clearTimeout(refreshRef.current);
    };
  }, [autoRefreshInterval, loadData]);

  const fetchPortStats = async (swList: any[]) => {
    const onlineSwitches = swList.filter(s => s.status === 'up');
    if (onlineSwitches.length === 0) return;
    setPortStatsLoading(true);
    const h = authHeaders();
    const results = await Promise.allSettled(
      onlineSwitches.map(sw =>
        fetch(`/api/switches/${sw.id}/live-ports`, { headers: h })
          .then(r => r.json())
          .then(ports => ({ id: sw.id, ports: Array.isArray(ports) ? ports : [] }))
          .catch(() => ({ id: sw.id, ports: [] }))
      )
    );
    const stats: Record<number, any> = {};
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        const { id, ports } = r.value;
        stats[id] = {
          connected: ports.filter((p: any) => p.status === 'connected').length,
          notconnect: ports.filter((p: any) => p.status === 'notconnect').length,
          disabled: ports.filter((p: any) => p.status === 'disabled' || p.status === 'err-disabled').length,
          total: ports.length,
        };
      }
    });
    setPortStats(stats);
    setPortStatsLoading(false);
  };

  const filteredSwitches = switches.filter(sw => {
    if (filterSite !== 'all' && String(sw.site_id) !== filterSite) return false;
    if (filterTechnical !== 'all') {
      const techUser = users.find((u: any) => String(u.id) === filterTechnical);
      if (!techUser) return false;
      const assignedSiteIds = techUser.assigned_sites?.map((s: any) => s.id) || [];
      if (!assignedSiteIds.includes(sw.site_id)) return false;
    }
    return true;
  });

  const upCount = filteredSwitches.filter(s => s.status === 'up').length;
  const downCount = filteredSwitches.filter(s => s.status === 'down').length;
  const unknownCount = filteredSwitches.length - upCount - downCount;

  const DonutChart = ({ up, down, unknown, total }: { up: number; down: number; unknown: number; total: number }) => {
    if (total === 0) return <div style={{ textAlign: 'center', color: '#475569', fontSize: '13px', padding: '20px' }}>ไม่มีข้อมูล</div>;
    const r = 52, cx = 70, cy = 70;
    const circumference = 2 * Math.PI * r;
    const upPct = (up / total) * circumference;
    const downPct = (down / total) * circumference;
    const unknownPct = (unknown / total) * circumference;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16" />
          {unknown > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#475569" strokeWidth="16"
            strokeDasharray={`${unknownPct} ${circumference - unknownPct}`}
            strokeDashoffset={-(upPct + downPct)} />}
          {down > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef4444" strokeWidth="16"
            strokeDasharray={`${downPct} ${circumference - downPct}`}
            strokeDashoffset={-upPct} />}
          {up > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#10b981" strokeWidth="16"
            strokeDasharray={`${upPct} ${circumference - upPct}`}
            strokeDashoffset={0} />}
          <text x={cx} y={cy - 6} textAnchor="middle"
            style={{ transform: 'rotate(90deg)', transformOrigin: `${cx}px ${cy}px` }}
            fill="white" fontSize="20" fontWeight="800">{total}</text>
          <text x={cx} y={cy + 14} textAnchor="middle"
            style={{ transform: 'rotate(90deg)', transformOrigin: `${cx}px ${cy}px` }}
            fill="#64748b" fontSize="11">Switches</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { label: 'Online', count: up, color: '#10b981' },
            { label: 'Offline', count: down, color: '#ef4444' },
            { label: 'Unknown', count: unknown, color: '#475569' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{item.label}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginLeft: 'auto' }}>{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const PortBarChart = ({ switches: swList }: { switches: any[] }) => {
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    if (swList.length === 0) return null;

    const totalPages = Math.ceil(swList.length / perPage);
    const paged = swList.slice((page - 1) * perPage, page * perPage);

    return (
      <div style={{
        background: 'rgba(30,41,59,0.6)', borderRadius: '12px',
        padding: '20px 24px', border: '1px solid var(--border-color)', marginBottom: '20px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 700, margin: 0 }}>📊 Port Status per Switch</p>
          <div style={{ display: 'flex', gap: '16px' }}>
            {[{ color: '#10b981', label: 'Connected' }, { color: '#ef4444', label: 'Not Connect' }, { color: '#475569', label: 'Disabled' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.color }} />
                <span style={{ fontSize: '11px', color: '#64748b' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {paged.map((sw: any) => {
            const s = portStats[sw.id];
            const isOffline = sw.status !== 'up';
            const total = s?.total || 0;
            const connected = s?.connected || 0;
            const notconnect = s?.notconnect || 0;
            const disabled = s?.disabled || 0;
            return (
              <div key={sw.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Switch name */}
                <div style={{ minWidth: '140px', maxWidth: '140px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sw.hostname}</div>
                  <div style={{ fontSize: '10px', color: '#475569' }}>{sw.site?.name || '-'}</div>
                </div>
                {/* Bar */}
                <div style={{ flex: 1, height: '22px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', overflow: 'hidden', display: 'flex' }}>
                  {isOffline ? (
                    <div style={{ width: '100%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600 }}>Offline</span>
                    </div>
                  ) : portStatsLoading && !s ? (
                    <div style={{ width: '100%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#475569' }}>Loading...</span>
                    </div>
                  ) : total === 0 ? (
                    <div style={{ width: '100%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#475569' }}>No data</span>
                    </div>
                  ) : (
                    <>
                      {connected > 0 && <div title={`Connected: ${connected}`} style={{ width: `${(connected/total)*100}%`, background: '#10b981', transition: 'width 0.6s ease' }} />}
                      {notconnect > 0 && <div title={`Not Connect: ${notconnect}`} style={{ width: `${(notconnect/total)*100}%`, background: '#ef4444', transition: 'width 0.6s ease' }} />}
                      {disabled > 0 && <div title={`Disabled: ${disabled}`} style={{ width: `${(disabled/total)*100}%`, background: '#475569', transition: 'width 0.6s ease' }} />}
                    </>
                  )}
                </div>
                {/* Counts */}
                {!isOffline && s && (
                  <div style={{ display: 'flex', gap: '10px', minWidth: '130px' }}>
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>✅ {connected}</span>
                    <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>❌ {notconnect}</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>⛔ {disabled}</span>
                  </div>
                )}
                {/* Link */}
                <a href={`/ports?switchId=${sw.id}`} style={{ fontSize: '11px', color: '#3b82f6', textDecoration: 'none', whiteSpace: 'nowrap' }}>View →</a>
              </div>
            );
          })}
        </div>

        {/* Pagination Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: '16px', paddingTop: '12px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexWrap: 'wrap', gap: '10px',
        }}>
          {/* Per-page selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>แสดง</span>
            <select
              value={perPage}
              onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
              style={{
                padding: '4px 8px', borderRadius: '6px', fontSize: '12px',
                background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', cursor: 'pointer', outline: 'none',
              }}
            >
              {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ fontSize: '12px', color: '#64748b' }}>รายการ/หน้า</span>
            <span style={{ fontSize: '12px', color: '#475569', marginLeft: '8px' }}>
              (ทั้งหมด {swList.length} Switch)
            </span>
          </div>

          {/* Page navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* First */}
            <button onClick={() => setPage(1)} disabled={page === 1}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.6)', color: page === 1 ? '#334155' : '#94a3b8', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '11px' }}>
              «
            </button>
            {/* Prev */}
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.6)', color: page === 1 ? '#334155' : '#94a3b8', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '11px' }}>
              ‹ ก่อนหน้า
            </button>
            {/* Page number */}
            <span style={{
              padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
              background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: 'white',
            }}>
              {page}
            </span>
            {/* Next */}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.6)', color: page === totalPages ? '#334155' : '#94a3b8', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '11px' }}>
              ถัดไป ›
            </button>
            {/* Last */}
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.6)', color: page === totalPages ? '#334155' : '#94a3b8', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '11px' }}>
              »
            </button>
            <span style={{ fontSize: '11px', color: '#475569', marginLeft: '4px' }}>หน้า {page}/{totalPages}</span>
          </div>
        </div>
      </div>
    );
  };


  const exportAuditCSV = () => {
    const token = JSON.parse(localStorage.getItem('cisco_auth') || '{}').token;
    window.open(`/api/audit-logs/export-csv?token=${token}`, '_blank');
  };

  const handlePing = async (sw: any) => {
    setPingingId(sw.id);
    setPingResult(null);
    try {
      const res = await fetch(`/api/switches/${sw.id}/ping`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      setPingResult(data);
      // Update switch status in local state
      setSwitches(prev => prev.map(s => s.id === sw.id ? { ...s, status: data.reachable ? 'up' : 'down' } : s));
    } catch (_) {
      setPingResult({ hostname: sw.hostname, ip: sw.ip_address, reachable: false, avg_ms: null, loss_pct: 100, results_ms: [] });
    }
    setPingingId(null);
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts + 'Z');
    return d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false });
  };

  const ACTION_LABELS: Record<string, string> = {
    set_description: '✏️ Description',
    set_vlan: '🔀 VLAN',
    shutdown: '🔴 Shutdown',
    enable: '🟢 Enable',
  };

  return (
    <RouteGuard>
      <div className="dashboard-container">
        <Sidebar active="/" />
        <main className="main-content">

          {/* Ping Result Modal */}
          {pingResult && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setPingResult(null)}>
              <div style={{ background: '#1e293b', borderRadius: '16px', padding: '28px 32px', minWidth: '360px', border: `1px solid ${pingResult.reachable ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>{pingResult.reachable ? '✅' : '❌'}</div>
                  <h3 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '18px' }}>{pingResult.hostname}</h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>{pingResult.ip}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { label: 'Avg RTT', value: pingResult.avg_ms != null ? `${pingResult.avg_ms} ms` : '—', color: pingResult.avg_ms != null ? (pingResult.avg_ms < 10 ? '#10b981' : pingResult.avg_ms < 50 ? '#f59e0b' : '#ef4444') : '#ef4444' },
                    { label: 'Min', value: pingResult.min_ms != null ? `${pingResult.min_ms} ms` : '—', color: '#94a3b8' },
                    { label: 'Packet Loss', value: `${pingResult.loss_pct}%`, color: pingResult.loss_pct === 0 ? '#10b981' : pingResult.loss_pct < 50 ? '#f59e0b' : '#ef4444' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {/* Individual results */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
                  {pingResult.results_ms?.map((ms: number | null, i: number) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, background: ms != null ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: ms != null ? '#10b981' : '#ef4444', border: `1px solid ${ms != null ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                        {ms != null ? `${ms}` : 'X'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>#{i+1}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setPingResult(null)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'rgba(100,116,139,0.3)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                  ปิด
                </button>
              </div>
            </div>
          )}

          <header className="header">
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                Global Overview
                {autoRefreshInterval > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 500, color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '20px', padding: '2px 10px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', animation: 'pulse 1.5s infinite', display: 'inline-block' }} />
                    Live
                  </span>
                )}
              </h2>
              <p>สถานะรวมของ Cisco Network Infrastructure แบบ Real-time</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Last refreshed */}
              {lastRefreshed && (
                <span style={{ fontSize: '12px', color: '#475569' }}>
                  {refreshing ? (
                    <span style={{ color: '#60a5fa' }}>⏳ กำลัง refresh...</span>
                  ) : (
                    <span>🕐 {lastRefreshed.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false })}</span>
                  )}
                </span>
              )}
              {/* Interval selector */}
              <select
                value={autoRefreshInterval}
                onChange={e => setAutoRefreshInterval(Number(e.target.value))}
                style={{
                  padding: '6px 10px', borderRadius: '8px',
                  background: autoRefreshInterval > 0 ? 'rgba(59,130,246,0.15)' : '#1e293b',
                  border: autoRefreshInterval > 0 ? '1px solid rgba(59,130,246,0.4)' : '1px solid #334155',
                  color: autoRefreshInterval > 0 ? '#93c5fd' : '#94a3b8',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', outline: 'none'
                }}
              >
                <option value={0}>🔄 Auto-refresh: Off</option>
                <option value={30}>🔄 ทุก 30 วินาที</option>
                <option value={60}>🔄 ทุก 1 นาที</option>
                <option value={300}>🔄 ทุก 5 นาที</option>
              </select>
              {/* Manual refresh */}
              <button
                onClick={() => loadData(true)}
                disabled={refreshing}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent-blue)', color: 'white', cursor: refreshing ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px', opacity: refreshing ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
                {refreshing ? '...' : 'Refresh'}
              </button>
            </div>
          </header>

          {/* Countdown progress bar */}
          {autoRefreshInterval > 0 && (
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginBottom: '20px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(countdown / autoRefreshInterval) * 100}%`,
                background: countdown <= 10
                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  : 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                borderRadius: '2px',
                transition: 'width 1s linear, background 0.5s ease'
              }} />
            </div>
          )}

          {/* Filter Bar */}
          <div style={{ background: 'rgba(30,41,59,0.6)', borderRadius: '12px', padding: '14px 20px', marginBottom: '20px', border: '1px solid var(--border-color)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 700 }}>🔍 กรอง:</span>

            {/* Site Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#64748b', fontSize: '12px' }}>🏢 Site:</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => setFilterSite('all')} style={{ padding: '5px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: filterSite === 'all' ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'rgba(30,41,59,0.8)', color: filterSite === 'all' ? 'white' : '#64748b' }}>ทั้งหมด</button>
                {sites.map((s: any) => (
                  <button key={s.id} onClick={() => setFilterSite(String(s.id))}
                    style={{ padding: '5px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: filterSite === String(s.id) ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'rgba(30,41,59,0.8)', color: filterSite === String(s.id) ? 'white' : '#64748b' }}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Technical Filter (Admin only) */}
            {isAdmin() && users.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '12px' }}>🔧 Technical:</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => setFilterTechnical('all')}
                    style={{ padding: '5px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: filterTechnical === 'all' ? 'linear-gradient(135deg,#0891b2,#0284c7)' : 'rgba(30,41,59,0.8)', color: filterTechnical === 'all' ? 'white' : '#64748b' }}>
                    ทั้งหมด
                  </button>
                  {users.map((u: any) => (
                    <button key={u.id} onClick={() => setFilterTechnical(String(u.id))}
                      style={{ padding: '5px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: filterTechnical === String(u.id) ? 'linear-gradient(135deg,#0891b2,#0284c7)' : 'rgba(30,41,59,0.8)', color: filterTechnical === String(u.id) ? 'white' : '#64748b' }}>
                      {u.full_name || u.username}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reset */}
            {(filterSite !== 'all' || filterTechnical !== 'all') && (
              <button onClick={() => { setFilterSite('all'); setFilterTechnical('all'); }}
                style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                ✕ ล้าง filter
              </button>
            )}

            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b' }}>
              แสดง <strong style={{ color: 'white' }}>{filteredSwitches.length}</strong> / {switches.length} Switch
            </span>
          </div>

          {/* Stats + Chart row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', alignItems: 'start', marginBottom: '20px' }}>
            <div className="stats-grid" style={{ margin: 0 }}>
              {[
                { label: 'Total Switches', val: loading ? '...' : filteredSwitches.length, color: 'white' },
                { label: 'Online', val: loading ? '...' : upCount, color: '#10b981' },
                { label: 'Offline', val: loading ? '...' : downCount, color: downCount > 0 ? 'var(--accent-red)' : 'var(--text-muted)' },
                {
                  label: 'Changes Today', color: 'var(--accent-blue)',
                  val: loading ? '...' : auditLogs.filter(l => {
                    const d = new Date(l.timestamp + 'Z');
                    const today = new Date();
                    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
                  }).length
                },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <h3>{s.label}</h3>
                  <p style={{ color: s.color }}>{s.val}</p>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(30,41,59,0.6)', borderRadius: '12px', padding: '20px 24px', border: '1px solid var(--border-color)', minWidth: '240px' }}>
              <p style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, margin: '0 0 12px 0' }}>📊 Switch Status</p>
              {loading
                ? <div style={{ color: '#475569', textAlign: 'center', padding: '20px' }}>...</div>
                : <DonutChart up={upCount} down={downCount} unknown={unknownCount} total={filteredSwitches.length} />}
            </div>
          </div>

          {/* Port Status Bar Chart per Switch */}
          {!loading && filteredSwitches.length > 0 && (
            <PortBarChart switches={filteredSwitches} />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Switch List */}
            {(() => {
              const swTotalPages = Math.max(1, Math.ceil(filteredSwitches.length / swPerPage));
              const swPaged = filteredSwitches.slice((swPage - 1) * swPerPage, swPage * swPerPage);
              return (
              <div className="table-container" style={{ margin: 0 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '15px' }}>🖥️ Switch {filterSite !== 'all' || filterTechnical !== 'all' ? '(filtered)' : 'ทั้งหมด'}</h3>
                  <a href="/admin" style={{ fontSize: '13px', color: 'var(--accent-blue)', textDecoration: 'none' }}>จัดการ →</a>
                </div>
                <table style={{ tableLayout: 'auto', width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '6px 8px 6px 12px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Switch</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Status</th>
                      <th style={{ padding: '6px 4px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Ping</th>
                      <th style={{ padding: '6px 8px 6px 4px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {swPaged.map((sw: any) => (
                      <tr key={sw.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '7px 8px 7px 12px', verticalAlign: 'middle' }}>
                          <strong style={{ display: 'block', fontSize: '13px', fontWeight: 700, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sw.hostname}
                          </strong>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--accent-blue)', lineHeight: 1.4, whiteSpace: 'nowrap' }}>
                            {sw.ip_address}
                          </span>
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sw.site?.name || '-'}
                          </span>
                        </td>
                        <td style={{ padding: '7px 8px', verticalAlign: 'middle' }}>
                          {sw.status === 'up' ? (
                            <span className="status-up"><span className="status-dot"></span>Online</span>
                          ) : sw.status === 'down' ? (
                            <span className="status-down"><span className="status-dot"></span>Offline</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '7px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <button
                            onClick={() => handlePing(sw)}
                            disabled={pingingId === sw.id}
                            title="Ping Switch"
                            style={{
                              padding: '4px 8px', borderRadius: '6px', border: 'none',
                              fontSize: '11px', fontWeight: 600,
                              cursor: pingingId === sw.id ? 'not-allowed' : 'pointer',
                              background: pingingId === sw.id ? 'rgba(100,116,139,0.2)' : 'rgba(59,130,246,0.15)',
                              color: pingingId === sw.id ? '#475569' : '#93c5fd',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {pingingId === sw.id ? '⏳' : '📡 Ping'}
                          </button>
                        </td>
                        <td style={{ padding: '7px 10px 7px 4px', verticalAlign: 'middle' }}>
                          <a href={`/ports?switchId=${sw.id}&siteId=${sw.site_id || ''}`}
                            style={{ fontSize: '12px', color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            View →
                          </a>
                        </td>
                      </tr>
                    ))}
                    {!loading && filteredSwitches.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                        {switches.length > 0 ? 'ไม่พบ Switch ตามเงื่อนไขที่เลือก' : 'ยังไม่มี Switch ในระบบ'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
                {/* Switch Pagination */}
                {filteredSwitches.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>แสดง</span>
                      <select value={swPerPage} onChange={e => { setSwPerPage(Number(e.target.value)); setSwPage(1); }}
                        style={{ padding: '3px 6px', borderRadius: '5px', fontSize: '11px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', outline: 'none', cursor: 'pointer' }}>
                        {[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>รายการ/หน้า</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <button onClick={() => setSwPage(1)} disabled={swPage===1} style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.6)', color: swPage===1?'#334155':'#94a3b8', cursor: swPage===1?'not-allowed':'pointer', fontSize: '11px' }}>«</button>
                      <button onClick={() => setSwPage(p=>Math.max(1,p-1))} disabled={swPage===1} style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.6)', color: swPage===1?'#334155':'#94a3b8', cursor: swPage===1?'not-allowed':'pointer', fontSize: '11px' }}>‹</button>
                      <span style={{ padding: '3px 10px', borderRadius: '5px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: 'white', fontSize: '11px', fontWeight: 700 }}>{swPage}</span>
                      <button onClick={() => setSwPage(p=>Math.min(swTotalPages,p+1))} disabled={swPage===swTotalPages} style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.6)', color: swPage===swTotalPages?'#334155':'#94a3b8', cursor: swPage===swTotalPages?'not-allowed':'pointer', fontSize: '11px' }}>›</button>
                      <button onClick={() => setSwPage(swTotalPages)} disabled={swPage===swTotalPages} style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.6)', color: swPage===swTotalPages?'#334155':'#94a3b8', cursor: swPage===swTotalPages?'not-allowed':'pointer', fontSize: '11px' }}>»</button>
                      <span style={{ fontSize: '11px', color: '#475569', marginLeft: '4px' }}>หน้า {swPage}/{swTotalPages}</span>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}

            {/* Recent Audit Logs */}
            {(() => {
              const auditTotalPages = Math.max(1, Math.ceil(auditLogs.length / auditPerPage));
              const auditPaged = auditLogs.slice((auditPage - 1) * auditPerPage, auditPage * auditPerPage);
              return (
              <div className="table-container" style={{ margin: 0 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '15px' }}>📋 กิจกรรมล่าสุด</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {canEdit() && (
                      <button onClick={exportAuditCSV}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'rgba(16,185,129,0.15)', color: '#10b981', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                        📊 Export CSV
                      </button>
                    )}
                    {canEdit() && <a href="/audit" style={{ fontSize: '13px', color: 'var(--accent-blue)', textDecoration: 'none' }}>ดูทั้งหมด →</a>}
                  </div>
                </div>
                <table style={{ tableLayout: 'auto', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '6px 8px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>เวลา</th>
                      <th style={{ padding: '6px 8px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Switch</th>
                      <th style={{ padding: '6px 8px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Port</th>
                      <th style={{ padding: '6px 8px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditPaged.map((log: any) => (
                      <tr key={log.id}>
                        <td style={{ padding: '6px 8px', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatTime(log.timestamp)}</td>
                        <td style={{ padding: '6px 8px', fontSize: '12px', color: 'var(--accent-blue)' }}>{log.switch_ip}</td>
                        <td style={{ padding: '6px 8px', fontSize: '12px' }}><strong>{log.interface || '-'}</strong></td>
                        <td style={{ padding: '6px 8px' }}><span style={{ fontSize: '11px', fontWeight: 600 }}>{ACTION_LABELS[log.action] || log.action}</span></td>
                      </tr>
                    ))}
                    {!loading && auditLogs.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                        {canEdit() ? 'ยังไม่มีกิจกรรม' : 'ไม่มีสิทธิ์ดู Audit Logs'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
                {/* Audit Pagination */}
                {auditLogs.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>แสดง</span>
                      <select value={auditPerPage} onChange={e => { setAuditPerPage(Number(e.target.value)); setAuditPage(1); }}
                        style={{ padding: '3px 6px', borderRadius: '5px', fontSize: '11px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', outline: 'none', cursor: 'pointer' }}>
                        {[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>รายการ/หน้า</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <button onClick={() => setAuditPage(1)} disabled={auditPage===1} style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.6)', color: auditPage===1?'#334155':'#94a3b8', cursor: auditPage===1?'not-allowed':'pointer', fontSize: '11px' }}>«</button>
                      <button onClick={() => setAuditPage(p=>Math.max(1,p-1))} disabled={auditPage===1} style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.6)', color: auditPage===1?'#334155':'#94a3b8', cursor: auditPage===1?'not-allowed':'pointer', fontSize: '11px' }}>‹</button>
                      <span style={{ padding: '3px 10px', borderRadius: '5px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: 'white', fontSize: '11px', fontWeight: 700 }}>{auditPage}</span>
                      <button onClick={() => setAuditPage(p=>Math.min(auditTotalPages,p+1))} disabled={auditPage===auditTotalPages} style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.6)', color: auditPage===auditTotalPages?'#334155':'#94a3b8', cursor: auditPage===auditTotalPages?'not-allowed':'pointer', fontSize: '11px' }}>›</button>
                      <button onClick={() => setAuditPage(auditTotalPages)} disabled={auditPage===auditTotalPages} style={{ padding: '3px 7px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.6)', color: auditPage===auditTotalPages?'#334155':'#94a3b8', cursor: auditPage===auditTotalPages?'not-allowed':'pointer', fontSize: '11px' }}>»</button>
                      <span style={{ fontSize: '11px', color: '#475569', marginLeft: '4px' }}>หน้า {auditPage}/{auditTotalPages}</span>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
