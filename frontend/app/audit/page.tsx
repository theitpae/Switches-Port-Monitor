"use client";
import React, { useState, useEffect, useCallback } from 'react';
import '../globals.css';
import { authHeaders } from '../context/AuthContext';
import RouteGuard from '../components/RouteGuard';
import Sidebar from '../components/Sidebar';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const ACTION_LABELS: Record<string, string> = {
  set_description: '✏️ Description',
  set_vlan: '🔀 VLAN',
  shutdown: '🔴 Shutdown',
  enable: '🟢 Enable',
  write_memory: '💾 Write Memory',
  backup_config: '📁 Backup Config',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [switches, setSwitches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterSwitch, setFilterSwitch] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUser, setFilterUser] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatTime = (ts: string) => {
    const d = new Date(ts + 'Z');
    return d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false });
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const h = authHeaders();
    const offset = (page - 1) * pageSize;
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    });
    if (filterSwitch !== 'all') params.set('switch_ip', filterSwitch);
    if (filterAction !== 'all') params.set('action', filterAction);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (filterUser.trim()) params.set('user', filterUser.trim());
    if (search.trim()) params.set('search', search.trim());

    try {
      const res = await fetch(`/api/audit-logs?${params}`, { headers: h });
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
        // If backend returns total in header or wrapped, handle both
        const totalHeader = res.headers.get('X-Total-Count');
        setTotal(totalHeader ? parseInt(totalHeader) : data.length < pageSize ? offset + data.length : offset + data.length + 1);
      }
    } catch (_) {}
    setLoading(false);
  }, [page, pageSize, filterSwitch, filterAction, filterStatus, filterUser, search]);

  // Fetch switches list once
  useEffect(() => {
    fetch('/api/switches', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setSwitches(Array.isArray(d) ? d : []));
  }, []);

  // Fetch logs when filters/page change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset to page 1 when filters change
  const resetPage = () => setPage(1);

  const exportCSV = () => {
    const token = JSON.parse(localStorage.getItem('cisco_auth') || '{}').token;
    const params = new URLSearchParams();
    if (filterSwitch !== 'all') params.set('switch_ip', filterSwitch);
    if (filterAction !== 'all') params.set('action', filterAction);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (filterUser.trim()) params.set('user', filterUser.trim());
    if (search.trim()) params.set('search', search.trim());
    params.set('token', token);
    window.open(`/api/audit-logs/export-csv?${params}`, '_blank');
  };

  const PaginationBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
      {/* Page size */}
      <span style={{ fontSize: '12px', color: '#64748b' }}>แสดง</span>
      <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); resetPage(); }}
        style={{ padding: '4px 8px', borderRadius: '6px', background: '#1e293b', border: '1px solid #334155', color: 'white', fontSize: '12px' }}>
        {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <span style={{ fontSize: '12px', color: '#64748b' }}>รายการ/หน้า</span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* First */}
        <button onClick={() => setPage(1)} disabled={page === 1}
          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155', background: page === 1 ? 'rgba(255,255,255,0.03)' : '#1e293b', color: page === 1 ? '#334155' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '12px' }}>
          «
        </button>
        {/* Prev */}
        <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155', background: page === 1 ? 'rgba(255,255,255,0.03)' : '#1e293b', color: page === 1 ? '#334155' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '12px' }}>
          ‹ ก่อนหน้า
        </button>
        {/* Page numbers */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p = page - 2 + i;
          if (p < 1) p = 1 + i;
          if (p > totalPages) p = totalPages - (4 - i);
          if (p < 1 || p > totalPages) return null;
          return (
            <button key={p} onClick={() => setPage(p)}
              style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                border: p === page ? 'none' : '1px solid #334155',
                background: p === page ? '#3b82f6' : '#1e293b',
                color: p === page ? 'white' : '#94a3b8',
                fontWeight: p === page ? 700 : 400,
              }}>{p}</button>
          );
        })}
        {/* Next */}
        <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155', background: page >= totalPages ? 'rgba(255,255,255,0.03)' : '#1e293b', color: page >= totalPages ? '#334155' : 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: '12px' }}>
          ถัดไป ›
        </button>
        {/* Last */}
        <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155', background: page === totalPages ? 'rgba(255,255,255,0.03)' : '#1e293b', color: page === totalPages ? '#334155' : 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '12px' }}>
          »
        </button>
        <span style={{ fontSize: '12px', color: '#475569', marginLeft: '4px' }}>
          หน้า {page} / {totalPages}
        </span>
      </div>
    </div>
  );

  return (
    <RouteGuard>
      <div className="dashboard-container">
        <Sidebar active="/audit" />
        <main className="main-content">
          <header className="header">
            <div>
              <h2>Audit Logs</h2>
              <p>ประวัติการเปลี่ยนแปลงทั้งหมดของระบบ</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={exportCSV}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'rgba(16,185,129,0.15)', color: '#10b981', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                📊 Export CSV
              </button>
              <button onClick={() => fetchLogs()}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent-blue)', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                ↻ Refresh
              </button>
            </div>
          </header>

          {/* Filter Bar */}
          <div style={{ background: 'rgba(30,41,59,0.6)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', border: '1px solid var(--border-color)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search box */}
            <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: '14px' }}>🔍</span>
              <input
                type="text"
                placeholder="ค้นหา IP, Port, ค่า..."
                value={search}
                onChange={e => { setSearch(e.target.value); resetPage(); }}
                style={{
                  width: '100%', padding: '8px 12px 8px 32px', borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid #334155',
                  color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                }}
              />
              {search && (
                <button onClick={() => { setSearch(''); resetPage(); }}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px' }}>✕</button>
              )}
            </div>

            {/* Switch filter */}
            <select value={filterSwitch} onChange={e => { setFilterSwitch(e.target.value); resetPage(); }}
              style={{ padding: '8px 12px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: 'white', fontSize: '12px' }}>
              <option value="all">🖥️ ทุก Switch</option>
              {switches.map((sw: any) => <option key={sw.id} value={sw.ip_address}>{sw.hostname} ({sw.ip_address})</option>)}
            </select>

            {/* Action filter */}
            <select value={filterAction} onChange={e => { setFilterAction(e.target.value); resetPage(); }}
              style={{ padding: '8px 12px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: 'white', fontSize: '12px' }}>
              <option value="all">⚡ ทุก Action</option>
              <option value="set_vlan">🔀 VLAN</option>
              <option value="set_description">✏️ Description</option>
              <option value="shutdown">🔴 Shutdown</option>
              <option value="enable">🟢 Enable</option>
              <option value="write_memory">💾 Write Memory</option>
              <option value="backup_config">📁 Backup</option>
            </select>

            {/* Status filter */}
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); resetPage(); }}
              style={{ padding: '8px 12px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: 'white', fontSize: '12px' }}>
              <option value="all">📋 ทุกสถานะ</option>
              <option value="success">✅ สำเร็จ</option>
              <option value="failed">❌ ล้มเหลว</option>
            </select>

            {/* User search */}
            <input
              type="text"
              placeholder="👤 ผู้ดำเนินการ..."
              value={filterUser}
              onChange={e => { setFilterUser(e.target.value); resetPage(); }}
              style={{ padding: '8px 12px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: 'white', fontSize: '12px', width: '140px', outline: 'none' }}
            />

            {/* Clear all */}
            {(search || filterSwitch !== 'all' || filterAction !== 'all' || filterStatus !== 'all' || filterUser) && (
              <button onClick={() => { setSearch(''); setFilterSwitch('all'); setFilterAction('all'); setFilterStatus('all'); setFilterUser(''); resetPage(); }}
                style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
                ✕ ล้าง filter
              </button>
            )}

            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
              {loading ? 'กำลังโหลด...' : <><strong style={{ color: 'white' }}>{logs.length}</strong> รายการ (หน้า {page})</>}
            </span>
          </div>

          {/* Table */}
          <div className="table-container">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                กำลังโหลด...
              </div>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: 'nowrap' }}>เวลา</th>
                      <th>Switch</th>
                      <th>Port</th>
                      <th>Action</th>
                      <th>ค่าเดิม</th>
                      <th>ค่าใหม่</th>
                      <th>ผู้ดำเนินการ</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log: any) => (
                      <tr key={log.id}>
                        <td style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatTime(log.timestamp)}</td>
                        <td style={{ fontSize: '12px', color: 'var(--accent-blue)' }}>{log.switch_ip}</td>
                        <td><strong style={{ fontFamily: 'monospace', fontSize: '13px' }}>{log.interface || '-'}</strong></td>
                        <td><span style={{ fontSize: '12px', fontWeight: 600 }}>{ACTION_LABELS[log.action] || log.action}</span></td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{log.old_value ?? '-'}</td>
                        <td style={{ fontSize: '12px', color: 'white' }}>{log.new_value ?? '-'}</td>
                        <td style={{ fontSize: '12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(59,130,246,0.15)', color: '#93c5fd', fontSize: '11px' }}>
                            {log.user || 'system'}
                          </span>
                        </td>
                        <td>
                          {log.status === 'success'
                            ? <span style={{ color: '#10b981', fontSize: '12px' }}>✅ สำเร็จ</span>
                            : <span style={{ color: '#ef4444', fontSize: '12px' }}>❌ ล้มเหลว</span>}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                        ไม่พบข้อมูลที่ตรงกับเงื่อนไข
                      </td></tr>
                    )}
                  </tbody>
                </table>
                <PaginationBar />
              </>
            )}
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
