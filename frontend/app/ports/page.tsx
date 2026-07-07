"use client";
import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import '../globals.css';
import { useAuth, authHeaders } from '../context/AuthContext';
import RouteGuard from '../components/RouteGuard';
import Sidebar from '../components/Sidebar';
import PortChart from '../components/PortChart';

function PortStatusInner() {
  const { canEdit } = useAuth();
  const searchParams = useSearchParams();
  const initSwitchId = searchParams.get('switchId');
  const [expandedChart, setExpandedChart] = useState<string | null>(null); // interface name
  const initSiteId = searchParams.get('siteId');

  // Site + Switch state
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initSiteId || 'all');
  const [switches, setSwitches] = useState<any[]>([]);
  const [selectedSwitchId, setSelectedSwitchId] = useState<string | null>(initSwitchId || null);

  // Port data
  const [ports, setPorts] = useState<any[]>([]);
  const [vlans, setVlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search & filter
  const [portSearch, setPortSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'notconnect' | 'disabled'>('all');
  const [showChart, setShowChart] = useState(false);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});

  // Multi-select
  const [selectedPorts, setSelectedPorts] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Config backup
  const [backups, setBackups] = useState<any[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [saveConfigLoading, setSaveConfigLoading] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Toggle port selection
  const togglePort = (iface: string) => {
    setSelectedPorts(prev => {
      const next = new Set(prev);
      if (next.has(iface)) next.delete(iface); else next.add(iface);
      return next;
    });
  };

  const toggleAllPorts = () => {
    if (selectedPorts.size === ports.length) {
      setSelectedPorts(new Set());
    } else {
      setSelectedPorts(new Set(ports.map((p: any) => p.interface)));
    }
  };

  // Bulk action
  const handleBulkAction = async (action: 'shutdown' | 'enable') => {
    if (selectedPorts.size === 0) return;
    if (!window.confirm(`${action === 'shutdown' ? 'Shutdown' : 'Enable'} ${selectedPorts.size} ports?`)) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`/api/switches/${selectedSwitchId}/bulk-${action}`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ interfaces: Array.from(selectedPorts) })
      });
      const data = await res.json();
      const ok = data.results?.filter((r: any) => r.success).length || 0;
      showToast(`✅ ${action === 'shutdown' ? 'Shutdown' : 'Enable'} สำเร็จ ${ok}/${selectedPorts.size} ports`);
      setSelectedPorts(new Set());
      setTimeout(() => fetchLiveData(), 1500);
    } catch (e: any) {
      showToast(`❌ ${e.message}`, 'error');
    } finally { setBulkLoading(false); }
  };

  // Export ports CSV
  const handleExportCSV = () => {
    const token = JSON.parse(localStorage.getItem('cisco_auth') || '{}').token;
    window.open(`/api/switches/${selectedSwitchId}/ports-export-csv?token=${token}`, '_blank');
  };

  // Config backup
  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch(`/api/switches/${selectedSwitchId}/backup-config`, {
        method: 'POST', headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showToast(`✅ Backup สำเร็จ (${data.lines} lines)`);
      fetchBackups();
    } catch (e: any) {
      showToast(`❌ Backup ไม่สำเร็จ: ${e.message}`, 'error');
    } finally { setBackupLoading(false); }
  };

  // Manual Save Config (write memory)
  const handleSaveConfig = async () => {
    if (!selectedSwitchId) return;
    setSaveConfigLoading(true);
    try {
      const res = await fetch(`/api/switches/${selectedSwitchId}/save-config`, {
        method: 'POST', headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showToast(`✅ ${data.message}`);
    } catch (e: any) {
      showToast(`❌ Save Config ไม่สำเร็จ: ${e.message}`, 'error');
    } finally { setSaveConfigLoading(false); }
  };

  const fetchBackups = async () => {
    if (!selectedSwitchId) return;
    const res = await fetch(`/api/switches/${selectedSwitchId}/backups`, { headers: authHeaders() });
    const data = await res.json();
    setBackups(Array.isArray(data) ? data : []);
  };

  const downloadBackup = (id: number) => {
    const token = JSON.parse(localStorage.getItem('cisco_auth') || '{}').token;
    window.open(`/api/backups/${id}/download?token=${token}`, '_blank');
  };

  // Fetch sites + switches on mount
  useEffect(() => {
    const h = authHeaders();
    fetch('/api/sites', { headers: h }).then(r => r.json()).then(d => setSites(Array.isArray(d) ? d : []));
    fetch('/api/switches', { headers: h, cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setSwitches(arr);
        // If switchId came from URL, use it; otherwise default to first switch
        if (!initSwitchId && arr.length > 0) {
          setSelectedSwitchId(String(arr[0].id));
        }
        // If siteId came from URL, set it; otherwise keep 'all'
        if (initSiteId) {
          setSelectedSiteId(initSiteId);
        }
      })
      .catch(err => console.error('Failed to fetch switches:', err));
  }, []);

  // Switches filtered by selected site
  const filteredSwitches = selectedSiteId === 'all'
    ? switches
    : switches.filter(sw => String(sw.site_id) === selectedSiteId);

  const fetchLiveData = useCallback(() => {
    if (!selectedSwitchId) return;
    setLoading(true);
    setError('');
    setPorts([]);
    setVlans([]);
    const h = authHeaders();
    Promise.all([
      fetch(`/api/switches/${selectedSwitchId}/live-ports`, { headers: h, cache: 'no-store' }).then(r => {
        if (!r.ok) throw new Error('ไม่สามารถเชื่อมต่อ Switch ได้');
        return r.json();
      }),
      fetch(`/api/switches/${selectedSwitchId}/live-vlans`, { headers: h, cache: 'no-store' }).then(r => {
        if (!r.ok) return [];
        return r.json();
      })
    ])
      .then(([portsData, vlansData]) => {
        setPorts(Array.isArray(portsData) ? portsData : []);
        setVlans(Array.isArray(vlansData) ? vlansData : []);
        const descMap: Record<string, string> = {};
        (Array.isArray(portsData) ? portsData : []).forEach((p: any) => { descMap[p.interface] = p.name || ''; });
        setDescriptions(descMap);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [selectedSwitchId]);

  useEffect(() => { fetchLiveData(); }, [selectedSwitchId]);

  // Auto-refresh
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!autoRefresh) { setCountdown(0); return; }
    setCountdown(refreshInterval);
    timerRef.current = setInterval(() => { fetchLiveData(); setCountdown(refreshInterval); }, refreshInterval * 1000);
    countdownRef.current = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 0), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefresh, refreshInterval, fetchLiveData]);

  // Actions
  const handleSaveDescription = async (iface: string) => {
    setActionLoading(`desc-${iface}`);
    try {
      const res = await fetch(`/api/switches/${selectedSwitchId}/port-description`, {
        method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ interface: iface, description: descriptions[iface] ?? '' })
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      showToast(`✅ บันทึก Description ของ ${iface} สำเร็จ`);
    } catch (e: any) {
      showToast(`❌ บันทึกไม่สำเร็จ: ${e.message}`, 'error');
    } finally { setActionLoading(null); }
  };

  const handleSetVlan = async (iface: string, vlanId: string) => {
    setActionLoading(`vlan-${iface}`);
    try {
      const res = await fetch(`/api/switches/${selectedSwitchId}/port-vlan`, {
        method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ interface: iface, vlan_id: vlanId })
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      showToast(`✅ เปลี่ยน VLAN ของ ${iface} เป็น ${vlanId} สำเร็จ`);
      // ✅ อัพเดต local state ทันที — ไม่ต้อง refresh browser
      setPorts(prev => prev.map(p =>
        p.interface === iface ? { ...p, vlan: vlanId } : p
      ));
    } catch (e: any) {
      showToast(`❌ เปลี่ยน VLAN ไม่สำเร็จ: ${e.message}`, 'error');
    } finally { setActionLoading(null); }
  };

  const handlePortAction = async (iface: string, action: 'shutdown' | 'enable') => {
    if (!window.confirm(`${action === 'shutdown' ? '⚠️ Shutdown' : '✅ Enable'} พอร์ต ${iface}?`)) return;
    setActionLoading(`${action}-${iface}`);
    try {
      const res = await fetch(`/api/switches/${selectedSwitchId}/port-${action}`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ interface: iface })
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      showToast(`✅ ${action === 'shutdown' ? 'Shutdown' : 'Enable'} พอร์ต ${iface} สำเร็จ`);
      setTimeout(() => fetchLiveData(), 1500);
    } catch (e: any) {
      showToast(`❌ ทำรายการไม่สำเร็จ: ${e.message}`, 'error');
    } finally { setActionLoading(null); }
  };

  const selectedSwitch = switches.find((s: any) => String(s.id) === selectedSwitchId);

  // Filtered ports by search + status
  const filteredPorts = ports.filter((p: any) => {
    const matchSearch = portSearch === '' || 
      p.interface?.toLowerCase().includes(portSearch.toLowerCase()) ||
      (p.name || p.description || '').toLowerCase().includes(portSearch.toLowerCase()) ||
      (descriptions[p.interface] || '').toLowerCase().includes(portSearch.toLowerCase());
    const matchStatus = statusFilter === 'all' || 
      (statusFilter === 'connected' && (p.status === 'connected' || p.status === 'up')) ||
      (statusFilter === 'notconnect' && (p.status === 'notconnect' || p.status === 'down')) ||
      (statusFilter === 'disabled' && (p.status === 'disabled' || p.status === 'err-disabled'));
    return matchSearch && matchStatus;
  });

  // Port utilization chart (SVG bar chart)
  const PortChart = () => {
    const connected = ports.filter(p => p.status === 'connected' || p.status === 'up').length;
    const notconnect = ports.filter(p => p.status === 'notconnect' || p.status === 'down').length;
    const disabled = ports.filter(p => p.status === 'disabled' || p.status === 'err-disabled').length;
    const unknown = ports.length - connected - notconnect - disabled;
    const total = ports.length || 1;

    const bars = [
      { label: 'Connected', count: connected, color: '#10b981' },
      { label: 'Not Connect', count: notconnect, color: '#f87171' },
      { label: 'Disabled', count: disabled, color: '#f59e0b' },
      { label: 'Unknown', count: unknown, color: '#475569' },
    ].filter(b => b.count > 0);

    const maxH = 80;
    const barW = 52;
    const gap = 16;
    const svgW = bars.length * (barW + gap) + gap;

    return (
      <div style={{ background: 'rgba(15,23,42,0.8)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px', fontWeight: 700 }}>📈 Port Utilization — {selectedSwitch?.hostname}</p>
          <span style={{ fontSize: '11px', color: '#475569' }}>Total {ports.length} ports</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <svg width={svgW} height={maxH + 32} style={{ overflow: 'visible' }}>
            {bars.map((b, i) => {
              const h = Math.max(4, (b.count / total) * maxH);
              const x = gap + i * (barW + gap);
              const y = maxH - h;
              return (
                <g key={b.label}>
                  <rect x={x} y={y} width={barW} height={h} rx={6} fill={b.color} opacity={0.85} />
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill={b.color} fontSize="12" fontWeight="700">{b.count}</text>
                  <text x={x + barW / 2} y={maxH + 16} textAnchor="middle" fill="#64748b" fontSize="10">{b.label}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '16px' }}>
            {[
              { label: 'Connected', pct: Math.round((connected/total)*100), color: '#10b981' },
              { label: 'Not Connect', pct: Math.round((notconnect/total)*100), color: '#f87171' },
              { label: 'Disabled', pct: Math.round((disabled/total)*100), color: '#f59e0b' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '6px', borderRadius: '3px', background: item.color }} />
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{item.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginLeft: 'auto' }}>{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderStatus = (status: string) => {
    const s = (status || '').toLowerCase().trim();
    if (s === 'connected' || s === 'up') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', fontSize: '12px', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', display: 'inline-block' }}></span>
          Connected
        </span>
      );
    }
    if (s === 'notconnect' || s === 'down') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', fontSize: '12px', fontWeight: 700, color: '#f87171', whiteSpace: 'nowrap' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f87171', display: 'inline-block' }}></span>
          Not Connect
        </span>
      );
    }
    if (s === 'disabled') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(100,116,139,0.2)', border: '1px solid rgba(100,116,139,0.4)', fontSize: '12px', fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }}></span>
          Disabled
        </span>
      );
    }
    if (s === 'err-disabled' || s === 'errdisabled') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', fontSize: '12px', fontWeight: 700, color: '#fbbf24', whiteSpace: 'nowrap' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }}></span>
          Err-Disabled
        </span>
      );
    }
    // fallback: show raw value
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.3)', fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#64748b', display: 'inline-block' }}></span>
        {status}
      </span>
    );
  };

  return (
    <RouteGuard>
      <div className="dashboard-container">

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
            padding: '14px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '14px',
            background: toast.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
            color: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
          }}>
            {toast.msg}
          </div>
        )}

        <Sidebar active="/ports" />

        <main className="main-content">
          <header className="header">
            <div>
              <h2>Switches &amp; Port Monitor</h2>
              <p>ตรวจสอบและจัดการสถานะ Port ของ Cisco Switch แบบ Real-time</p>
            </div>
          </header>

          {/* Site + Switch Selector Card */}
          <div style={{ background: 'rgba(30,41,59,0.6)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>

            {/* Row 1: Site Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 700, minWidth: '64px' }}>🏢 Site:</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => setSelectedSiteId('all')} style={{
                  padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  background: selectedSiteId === 'all' ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'rgba(30,41,59,0.9)',
                  color: selectedSiteId === 'all' ? 'white' : '#64748b',
                  boxShadow: selectedSiteId === 'all' ? '0 2px 8px rgba(124,58,237,0.4)' : 'none'
                }}>
                  🌐 ทั้งหมด ({switches.length})
                </button>
                {sites.map((site: any) => {
                  const count = switches.filter(sw => sw.site_id === site.id).length;
                  const active = selectedSiteId === String(site.id);
                  return (
                    <button key={site.id} onClick={() => {
                      setSelectedSiteId(String(site.id));
                      const swInSite = switches.filter(sw => sw.site_id === site.id);
                      if (swInSite.length > 0) setSelectedSwitchId(String(swInSite[0].id));
                    }} style={{
                      padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                      background: active ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'rgba(30,41,59,0.9)',
                      color: active ? 'white' : '#64748b',
                      boxShadow: active ? '0 2px 8px rgba(124,58,237,0.4)' : 'none'
                    }}>
                      🏢 {site.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 2: Switch Filter */}
            {filteredSwitches.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 700, minWidth: '64px' }}>🖥️ Switch:</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {filteredSwitches.map((sw: any) => {
                    const active = selectedSwitchId === String(sw.id);
                    return (
                      <button key={sw.id} onClick={() => setSelectedSwitchId(String(sw.id))} style={{
                        padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                        background: active ? 'var(--accent-blue)' : 'rgba(30,41,59,0.9)',
                        color: active ? 'white' : '#64748b',
                        boxShadow: active ? '0 2px 8px rgba(59,130,246,0.4)' : 'none'
                      }}>
                        {sw.hostname} {sw.status === 'up' ? '🟢' : sw.status === 'down' ? '🔴' : '⚪'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredSwitches.length === 0 && selectedSiteId !== 'all' && (
              <p style={{ color: '#64748b', fontSize: '13px', margin: '8px 0 0 0' }}>ไม่มี Switch ใน Site นี้</p>
            )}
          </div>

          {/* Auto-refresh controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: autoRefresh ? '6px' : '16px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {autoRefresh && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '20px', padding: '2px 10px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80', animation: 'pulse 1.5s infinite', display: 'inline-block' }} />
                Live
              </span>
            )}
            <select value={refreshInterval} onChange={e => setRefreshInterval(Number(e.target.value))}
              style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(30,41,59,0.8)', border: '1px solid var(--border-color)', color: 'white', fontSize: '12px', outline: 'none' }}>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>1m</option>
              <option value={120}>2m</option>
            </select>
            <button onClick={() => setAutoRefresh(!autoRefresh)} style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              background: autoRefresh ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.3)',
              color: autoRefresh ? '#10b981' : '#94a3b8'
            }}>
              {autoRefresh ? '⏸ หยุด' : '▶ Auto Refresh'}
            </button>
            <button onClick={() => fetchLiveData()} disabled={loading}
              style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent-blue)', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
              {loading ? '...' : 'Refresh'}
            </button>
          </div>
          {/* Countdown bar */}
          {autoRefresh && (
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginBottom: '14px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(countdown / refreshInterval) * 100}%`,
                background: countdown <= 5
                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  : 'linear-gradient(90deg, #10b981, #06b6d4)',
                borderRadius: '2px',
                transition: 'width 1s linear, background 0.5s ease'
              }} />
            </div>
          )}

          {/* Switch info cards */}
          {selectedSwitch && (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {[
                { label: 'Hostname', val: selectedSwitch.hostname },
                { label: 'IP', val: selectedSwitch.ip_address },
                { label: 'Model', val: selectedSwitch.model },
                { label: 'Site', val: selectedSwitch.site?.name || '-' },
                { label: 'Total Ports', val: ports.length },
                { label: 'Connected', val: ports.filter((p: any) => p.status === 'connected').length },
                { label: 'Not Connected', val: ports.filter((p: any) => p.status !== 'connected').length },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(30,41,59,0.6)', borderRadius: '8px', padding: '10px 16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{item.label}</div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: '14px' }}>{item.val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px', padding: '16px 20px', color: '#fca5a5', marginBottom: '16px' }}>
              ❌ {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔄</div>
              <p>กำลังดึงข้อมูล Port จาก Switch...</p>
            </div>
          )}

          {/* Port Table */}
          {!loading && ports.length > 0 && (
            <>
            {/* Search + Filter bar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search input */}
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: '15px' }}>🔍</span>
                <input
                  type="text" value={portSearch} onChange={e => setPortSearch(e.target.value)}
                  placeholder="ค้นหา Interface, Description..."
                  style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', background: 'rgba(30,41,59,0.8)', border: '1px solid var(--border-color)', color: 'white', outline: 'none', fontSize: '13px', boxSizing: 'border-box' }}
                />
                {portSearch && (
                  <button onClick={() => setPortSearch('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                )}
              </div>
              {/* Status filter chips */}
              {[
                { key: 'all', label: `All (${ports.length})`, color: '#64748b' },
                { key: 'connected', label: `🟢 Connected (${ports.filter(p => p.status === 'connected' || p.status === 'up').length})`, color: '#10b981' },
                { key: 'notconnect', label: `🔴 Not Connect (${ports.filter(p => p.status === 'notconnect' || p.status === 'down').length})`, color: '#f87171' },
                { key: 'disabled', label: `🟡 Disabled (${ports.filter(p => p.status === 'disabled' || p.status === 'err-disabled').length})`, color: '#f59e0b' },
              ].map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key as any)}
                  style={{ padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
                    background: statusFilter === f.key ? `rgba(${f.key === 'connected' ? '16,185,129' : f.key === 'notconnect' ? '248,113,113' : f.key === 'disabled' ? '245,158,11' : '100,116,139'},0.25)` : 'rgba(30,41,59,0.6)',
                    color: statusFilter === f.key ? f.color : '#64748b',
                    border: statusFilter === f.key ? `1px solid ${f.color}55` : '1px solid transparent'
                  }}>
                  {f.label}
                </button>
              ))}
              {/* Chart toggle */}
              <button onClick={() => setShowChart(!showChart)}
                style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  background: showChart ? 'rgba(59,130,246,0.25)' : 'rgba(30,41,59,0.6)', color: showChart ? '#93c5fd' : '#64748b', border: showChart ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent' }}>
                📈 Chart
              </button>
            </div>

            {/* Port Utilization Chart */}
            {showChart && ports.length > 0 && <PortChart />}

            {/* Result count */}
            {(portSearch || statusFilter !== 'all') && (
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                แสดง <strong style={{ color: 'white' }}>{filteredPorts.length}</strong> / {ports.length} ports
                {portSearch && <> ที่ตรงกับ "<strong style={{ color: '#93c5fd' }}>{portSearch}</strong>"</>}
              </div>
            )}

            <div className="table-container">
              {/* Toolbar */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Left: multi-select actions */}
                {canEdit() && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {selectedPorts.size > 0 ? `☑️ เลือกแล้ว ${selectedPorts.size} ports` : 'เลือกแล้ว 0 ports'}
                    </span>
                    {selectedPorts.size > 0 && (
                      <>
                        <button onClick={() => handleBulkAction('shutdown')} disabled={bulkLoading}
                          style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                          {bulkLoading ? '...' : '🔴 Shutdown ทั้งหมด'}
                        </button>
                        <button onClick={() => handleBulkAction('enable')} disabled={bulkLoading}
                          style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                          {bulkLoading ? '...' : '🟢 Enable ทั้งหมด'}
                        </button>
                        <button onClick={() => setSelectedPorts(new Set())}
                          style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: 'rgba(100,116,139,0.2)', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                      </>
                    )}
                  </div>
                )}
                {/* Right: export + save + backup */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {selectedSwitchId && (
                    <button onClick={handleExportCSV}
                      style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'rgba(16,185,129,0.15)', color: '#10b981', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      📊 Export CSV
                    </button>
                  )}
                  {canEdit() && selectedSwitchId && (
                    <>
                      {/* Save Config = write memory */}
                      <button
                        onClick={handleSaveConfig}
                        disabled={saveConfigLoading}
                        title="บันทึก running-config ลง startup-config (write memory)"
                        style={{
                          padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(234,179,8,0.4)',
                          background: 'rgba(234,179,8,0.12)', color: '#fbbf24',
                          cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                        {saveConfigLoading ? '⏳ กำลังบันทึก...' : '💾 Save Config'}
                      </button>
                      <button onClick={handleBackup} disabled={backupLoading}
                        style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'rgba(59,130,246,0.2)', color: '#93c5fd', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                        {backupLoading ? '...' : '🗂️ Backup Config'}
                      </button>
                      <button onClick={() => { setShowBackups(!showBackups); if (!showBackups) fetchBackups(); }}
                        style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: showBackups ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.15)', color: '#c4b5fd', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                        📁 History ({backups.length})
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Backup history panel */}
              {showBackups && (
                <div style={{ background: 'rgba(15,23,42,0.8)', borderBottom: '1px solid var(--border-color)', padding: '12px 16px' }}>
                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 8px 0', fontWeight: 700 }}>📁 Config Backup History</p>
                  {backups.length === 0 ? (
                    <p style={{ color: '#475569', fontSize: '12px', margin: 0 }}>ยังไม่มี backup</p>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {backups.map((b: any) => (
                        <div key={b.id} style={{ background: 'rgba(30,41,59,0.8)', borderRadius: '8px', padding: '8px 12px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                          <div style={{ color: 'white', fontWeight: 600 }}>{new Date(b.created_at + 'Z').toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</div>
                          <div style={{ color: '#64748b', fontSize: '11px' }}>{b.backed_up_by} · {b.lines} lines</div>
                          <button onClick={() => downloadBackup(b.id)}
                            style={{ marginTop: '4px', padding: '3px 8px', borderRadius: '4px', border: 'none', background: 'rgba(59,130,246,0.3)', color: '#93c5fd', cursor: 'pointer', fontSize: '11px' }}>
                            ⬇️ Download
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <table className="ports-table">
                <thead>
                  <tr>
                    {canEdit() && (
                      <th style={{ width: '36px' }}>
                        <input type="checkbox" checked={selectedPorts.size === ports.length && ports.length > 0}
                          onChange={toggleAllPorts}
                          style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#3b82f6' }} />
                      </th>
                    )}
                    <th>Interface</th>
                    <th>Status</th>
                    <th>VLAN</th>
                    <th>Speed / Duplex</th>
                    <th>Description</th>
                    <th style={{ width: '36px' }}>Chart</th>
                    {canEdit() && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredPorts.map((port: any) => (
                    <React.Fragment key={port.interface}>
                      <tr style={{ background: selectedPorts.has(port.interface) ? 'rgba(59,130,246,0.08)' : expandedChart === port.interface ? 'rgba(59,130,246,0.05)' : '' }}>
                        {canEdit() && (
                          <td>
                            <input type="checkbox" checked={selectedPorts.has(port.interface)}
                              onChange={() => togglePort(port.interface)}
                              style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#3b82f6' }} />
                          </td>
                        )}
                        <td><strong style={{ fontFamily: 'monospace', fontSize: '13px' }}>{port.interface}</strong></td>
                        <td>{renderStatus(port.status)}</td>
                        <td>
                          {canEdit() ? (
                            <select
                              value={port.vlan === 'trunk' || port.vlan?.toLowerCase?.() === 'trunk' ? 'trunk' : (port.vlan || '1')}
                              onChange={e => handleSetVlan(port.interface, e.target.value)}
                              disabled={!!actionLoading}
                              style={{ padding: '5px 8px', borderRadius: '6px', background: '#1e293b', border: port.vlan === 'trunk' || port.vlan?.toLowerCase?.() === 'trunk' ? '1.5px solid #7c3aed' : '1px solid #334155', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', outline: 'none', minWidth: '110px' }}
                            >
                              <option value="trunk" style={{ background: '#1e293b', color: '#a78bfa' }}>🔀 Trunk</option>
                              <option disabled style={{ background: '#0f172a', color: '#475569' }}>──────────</option>
                              {vlans.map((v: any) => (
                                <option key={v.vlan_id} value={String(v.vlan_id)} style={{ background: '#1e293b', color: 'white' }}>{v.vlan_id} - {v.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontSize: '13px' }}>{port.vlan === 'trunk' || port.vlan?.toLowerCase?.() === 'trunk' ? '🔀 Trunk' : (port.vlan || '-')}</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontSize: '10px', color: '#475569', minWidth: '42px' }}>Speed</span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: port.speed && port.speed !== 'auto' && port.speed !== '-' ? '#e2e8f0' : '#475569' }}>{port.speed || 'auto'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontSize: '10px', color: '#475569', minWidth: '42px' }}>Duplex</span>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: port.duplex === 'full' ? '#10b981' : port.duplex === 'half' ? '#f59e0b' : '#475569' }}>{port.duplex || 'auto'}</span>
                            </div>
                            {(port.type || port.media_type) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ fontSize: '10px', color: '#475569', minWidth: '42px' }}>Type</span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>{port.type || port.media_type}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          {canEdit() ? (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input type="text" value={descriptions[port.interface] ?? port.name ?? ''}
                                onChange={e => setDescriptions(d => ({ ...d, [port.interface]: e.target.value }))}
                                placeholder="คำอธิบาย..."
                                style={{ padding: '5px 8px', borderRadius: '5px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', fontSize: '12px', width: '120px' }} />
                              <button onClick={() => handleSaveDescription(port.interface)} disabled={actionLoading === `desc-${port.interface}`}
                                style={{ padding: '5px 10px', borderRadius: '5px', border: 'none', background: 'rgba(59,130,246,0.3)', color: '#93c5fd', cursor: 'pointer', fontSize: '12px' }}>
                                {actionLoading === `desc-${port.interface}` ? '...' : '💾'}
                              </button>
                            </div>
                          ) : <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{port.name || '-'}</span>}
                        </td>
                        {/* Chart toggle button */}
                        <td>
                          <button
                            onClick={() => setExpandedChart(expandedChart === port.interface ? null : port.interface)}
                            title="ดู Traffic Chart"
                            style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px', background: expandedChart === port.interface ? 'rgba(59,130,246,0.3)' : 'rgba(51,65,85,0.6)', color: expandedChart === port.interface ? '#93c5fd' : '#64748b', transition: 'all 0.15s' }}
                          >📊</button>
                        </td>
                        {canEdit() && (
                          <td>
                            {port.status !== 'disabled'
                              ? <button onClick={() => handlePortAction(port.interface, 'shutdown')} disabled={!!actionLoading}
                                  style={{ padding: '5px 10px', borderRadius: '5px', border: 'none', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                                  {actionLoading === `shutdown-${port.interface}` ? '...' : '🔴 Shutdown'}
                                </button>
                              : <button onClick={() => handlePortAction(port.interface, 'enable')} disabled={!!actionLoading}
                                  style={{ padding: '5px 10px', borderRadius: '5px', border: 'none', background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                                  {actionLoading === `enable-${port.interface}` ? '...' : '🟢 Enable'}
                                </button>}
                          </td>
                        )}
                      </tr>
                      {/* Expanded chart row */}
                      {expandedChart === port.interface && selectedSwitch && (
                        <tr>
                          <td colSpan={canEdit() ? 9 : 7} style={{ padding: '0 16px 12px', background: 'rgba(15,23,42,0.6)' }}>
                            <PortChart
                              switchId={selectedSwitch.id}
                              interface_name={port.interface}
                              onClose={() => setExpandedChart(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {!loading && filteredPorts.length === 0 && ports.length > 0 && (
                    <tr><td colSpan={canEdit() ? 9 : 7} style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>
                      🔍 ไม่พบ Port ที่ตรงกับการค้นหา
                    </td></tr>
                  )}
                </tbody>

              </table>
            </div>
            </>
          )}

          {!loading && ports.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔌</div>
              <p>เลือก Switch แล้วกด Refresh เพื่อดูข้อมูล Port</p>
            </div>
          )}

        </main>
      </div>
    </RouteGuard>
  );
}

export default function PortStatus() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: 'white' }}>กำลังโหลด...</div>}>
      <PortStatusInner />
    </Suspense>
  );
}
