"use client";
import React, { useState, useEffect, useRef } from 'react';
import '../globals.css';
import { useAuth, authHeaders } from '../context/AuthContext';
import RouteGuard from '../components/RouteGuard';
import Sidebar from '../components/Sidebar';

type Switch = {
  id: number;
  hostname: string;
  ip_address: string;
  model: string;
  status: string;
  site_id: number | null;
  location_area: string | null;
  site?: { id: number; name: string };
};

type NodePos = { x: number; y: number; sw: Switch };

const STATUS_COLOR: Record<string, string> = {
  up: '#10b981',
  down: '#ef4444',
  unknown: '#475569',
};

const SITE_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4',
  '#ec4899', '#10b981', '#f97316', '#6366f1',
];

export default function NetworkMapPage() {
  const { } = useAuth();
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedSw, setSelectedSw] = useState<Switch | null>(null);
  const [portCounts, setPortCounts] = useState<Record<number, { total: number; connected: number }>>({});
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const h = authHeaders();
    Promise.all([
      fetch('/api/switches', { headers: h }).then(r => r.json()),
      fetch('/api/sites', { headers: h }).then(r => r.json()),
    ]).then(([sw, si]) => {
      setSwitches(Array.isArray(sw) ? sw : []);
      setSites(Array.isArray(si) ? si : []);
      setLoading(false);
    });
  }, []);

  const filteredSwitches = selectedSite === 'all'
    ? switches
    : switches.filter(sw => String(sw.site_id) === selectedSite);

  // Layout: group by site, arrange in circles
  const computePositions = (): NodePos[] => {
    const W = 800, H = 520;
    const positions: NodePos[] = [];

    if (filteredSwitches.length === 0) return [];

    if (selectedSite !== 'all') {
      // Single site: arrange in circle
      const n = filteredSwitches.length;
      filteredSwitches.forEach((sw, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        const r = Math.min(180, n * 22);
        positions.push({
          x: W / 2 + r * Math.cos(angle),
          y: H / 2 + r * Math.sin(angle),
          sw,
        });
      });
      return positions;
    }

    // Multi-site: group by site, each group in cluster
    const groups = new Map<string, Switch[]>();
    filteredSwitches.forEach(sw => {
      const key = sw.site_id ? String(sw.site_id) : 'none';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(sw);
    });

    const groupArr = Array.from(groups.entries());
    const gcx = W / 2, gcy = H / 2;
    const groupR = Math.min(220, groupArr.length * 60);

    groupArr.forEach(([siteKey, sws], gi) => {
      const gAngle = (2 * Math.PI * gi) / groupArr.length - Math.PI / 2;
      const gx = gcx + groupR * Math.cos(gAngle);
      const gy = gcy + groupR * Math.sin(gAngle);

      const n = sws.length;
      const nodeR = Math.min(60, n * 18);
      sws.forEach((sw, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        positions.push({
          x: gx + nodeR * Math.cos(angle),
          y: gy + nodeR * Math.sin(angle),
          sw,
        });
      });
    });

    return positions;
  };

  const positions = computePositions();

  // Site color map
  const siteColorMap: Record<string, string> = {};
  sites.forEach((s, i) => { siteColorMap[String(s.id)] = SITE_COLORS[i % SITE_COLORS.length]; });

  const getNodeColor = (sw: Switch) => {
    if (sw.status === 'down') return '#ef4444';
    const siteColor = sw.site_id ? siteColorMap[String(sw.site_id)] : '#475569';
    return siteColor || '#475569';
  };

  const getSiteLabel = (sw: Switch) =>
    sw.site?.name || sites.find(s => s.id === sw.site_id)?.name || 'No Site';

  return (
    <RouteGuard>
      <div className="dashboard-container">
        <Sidebar active="/map" />
        <main className="main-content">
          <header className="header">
            <div>
              <h2>🗺️ Network Map</h2>
              <p>แผนผัง Switch ทั้งหมดในระบบ</p>
            </div>
          </header>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 700 }}>🏢 Site:</span>
            {[{ id: 'all', name: `ทั้งหมด (${switches.length})` }, ...sites.map(s => ({
              id: String(s.id), name: `${s.name} (${switches.filter(sw => sw.site_id === s.id).length})`
            }))].map(opt => (
              <button key={opt.id} onClick={() => setSelectedSite(opt.id)}
                style={{
                  padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  background: selectedSite === opt.id ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'rgba(30,41,59,0.8)',
                  color: selectedSite === opt.id ? 'white' : '#64748b',
                }}>
                {opt.name}
              </button>
            ))}
            {/* Legend */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
              {[
                { label: 'Online', color: '#10b981' },
                { label: 'Offline', color: '#ef4444' },
                { label: 'Unknown', color: '#475569' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#94a3b8' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[
              { label: 'Total', val: filteredSwitches.length, color: 'white' },
              { label: 'Online', val: filteredSwitches.filter(s => s.status === 'up').length, color: '#10b981' },
              { label: 'Offline', val: filteredSwitches.filter(s => s.status === 'down').length, color: '#ef4444' },
              { label: 'Unknown', val: filteredSwitches.filter(s => s.status !== 'up' && s.status !== 'down').length, color: '#64748b' },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(30,41,59,0.6)', borderRadius: '8px', padding: '8px 16px', border: '1px solid var(--border-color)', textAlign: 'center', minWidth: '80px' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{item.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: item.color }}>{item.val}</div>
              </div>
            ))}
          </div>

          {/* Main layout: Map + Detail panel */}
          <div style={{ display: 'grid', gridTemplateColumns: selectedSw ? '1fr 280px' : '1fr', gap: '16px', alignItems: 'start' }}>
            {/* SVG Map */}
            <div style={{ background: 'rgba(15,23,42,0.8)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', position: 'relative' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '80px', color: '#475569' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔄</div>
                  <p>กำลังโหลด...</p>
                </div>
              ) : filteredSwitches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px', color: '#475569' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗺️</div>
                  <p>ไม่มี Switch ใน Site นี้</p>
                </div>
              ) : (
                <svg ref={svgRef} viewBox="0 0 800 540" style={{ width: '100%', height: 'auto', minHeight: '420px' }}>
                  {/* Background grid */}
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    </pattern>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <rect width="800" height="540" fill="url(#grid)" />

                  {/* Site group backgrounds */}
                  {selectedSite === 'all' && (() => {
                    const groups = new Map<string, NodePos[]>();
                    positions.forEach(p => {
                      const key = p.sw.site_id ? String(p.sw.site_id) : 'none';
                      if (!groups.has(key)) groups.set(key, []);
                      groups.get(key)!.push(p);
                    });
                    return Array.from(groups.entries()).map(([siteKey, ps]) => {
                      const xs = ps.map(p => p.x);
                      const ys = ps.map(p => p.y);
                      const minX = Math.min(...xs) - 50;
                      const minY = Math.min(...ys) - 50;
                      const maxX = Math.max(...xs) + 50;
                      const maxY = Math.max(...ys) + 50;
                      const color = siteKey !== 'none' ? siteColorMap[siteKey] : '#475569';
                      const siteName = siteKey !== 'none' ? (sites.find(s => String(s.id) === siteKey)?.name || '') : 'No Site';
                      return (
                        <g key={siteKey}>
                          <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY}
                            rx={16} fill={`${color}10`} stroke={`${color}40`} strokeWidth="1" strokeDasharray="6,4" />
                          <text x={minX + 8} y={minY + 18} fill={`${color}cc`} fontSize="11" fontWeight="700">{siteName}</text>
                        </g>
                      );
                    });
                  })()}

                  {/* Connection lines between nodes in same site */}
                  {positions.map((p, i) =>
                    positions.slice(i + 1).map((q, j) => {
                      const sameSite = p.sw.site_id && p.sw.site_id === q.sw.site_id;
                      if (!sameSite) return null;
                      return (
                        <line key={`${i}-${j}`}
                          x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                          stroke="rgba(100,116,139,0.2)" strokeWidth="1" strokeDasharray="4,4" />
                      );
                    })
                  )}

                  {/* Switch nodes */}
                  {positions.map(({ x, y, sw }) => {
                    const isHovered = hoveredId === sw.id;
                    const isSelected = selectedSw?.id === sw.id;
                    const statusColor = STATUS_COLOR[sw.status] || '#475569';
                    const nodeColor = getNodeColor(sw);
                    const r = isHovered || isSelected ? 30 : 26;

                    return (
                      <g key={sw.id} style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredId(sw.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => setSelectedSw(selectedSw?.id === sw.id ? null : sw)}>

                        {/* Outer ring / glow */}
                        {(isHovered || isSelected) && (
                          <circle cx={x} cy={y} r={r + 8} fill={`${nodeColor}15`} stroke={`${nodeColor}50`} strokeWidth="1" />
                        )}

                        {/* Main circle */}
                        <circle cx={x} cy={y} r={r}
                          fill={isSelected ? nodeColor : `${nodeColor}30`}
                          stroke={nodeColor} strokeWidth={isSelected ? 2.5 : 1.5}
                          filter={isHovered || isSelected ? 'url(#glow)' : undefined} />

                        {/* Status dot */}
                        <circle cx={x + r * 0.6} cy={y - r * 0.6} r={6}
                          fill={statusColor} stroke="#0f172a" strokeWidth="2" />

                        {/* Switch icon */}
                        <text x={x} y={y + 2} textAnchor="middle" dominantBaseline="middle"
                          fill={isSelected ? 'white' : nodeColor} fontSize="16">🖥️</text>

                        {/* Label */}
                        <text x={x} y={y + r + 14} textAnchor="middle"
                          fill={isSelected ? 'white' : '#94a3b8'} fontSize="10" fontWeight={isSelected ? '700' : '400'}>
                          {sw.hostname.length > 14 ? sw.hostname.slice(0, 14) + '…' : sw.hostname}
                        </text>
                        <text x={x} y={y + r + 25} textAnchor="middle" fill="#475569" fontSize="9">
                          {sw.ip_address}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>

            {/* Detail panel */}
            {selectedSw && (
              <div style={{ background: 'rgba(30,41,59,0.9)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: 'white' }}>Switch Detail</h3>
                  <button onClick={() => setSelectedSw(null)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>×</button>
                </div>

                {/* Status badge */}
                <div style={{ marginBottom: '16px' }}>
                  {selectedSw.status === 'up' ? (
                    <span className="status-up"><span className="status-dot"></span>Online</span>
                  ) : selectedSw.status === 'down' ? (
                    <span className="status-down"><span className="status-dot"></span>Offline</span>
                  ) : (
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Unknown</span>
                  )}
                </div>

                {/* Info rows */}
                {[
                  { label: 'Hostname', val: selectedSw.hostname },
                  { label: 'IP Address', val: selectedSw.ip_address },
                  { label: 'Model', val: selectedSw.model || '-' },
                  { label: 'Site', val: getSiteLabel(selectedSw) },
                  { label: 'Location', val: selectedSw.location_area || '-' },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>{row.label}</div>
                    <div style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>{row.val}</div>
                  </div>
                ))}

                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <a href={`/ports?switchId=${selectedSw.id}&siteId=${selectedSw.site_id || ''}`}
                    style={{ display: 'block', flex: 1, padding: '9px', borderRadius: '8px', background: 'rgba(59,130,246,0.2)', color: '#93c5fd', textDecoration: 'none', fontSize: '12px', fontWeight: 700, textAlign: 'center' }}>
                    🔌 ดู Ports
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Switch list table below map */}
          {filteredSwitches.length > 0 && (
            <div className="table-container" style={{ marginTop: '20px' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '14px' }}>📋 รายการ Switch ({filteredSwitches.length})</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Hostname</th>
                    <th>IP Address</th>
                    <th>Site</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSwitches.map(sw => (
                    <tr key={sw.id} style={{ cursor: 'pointer', background: selectedSw?.id === sw.id ? 'rgba(59,130,246,0.08)' : '' }}
                      onClick={() => setSelectedSw(selectedSw?.id === sw.id ? null : sw)}>
                      <td><strong>{sw.hostname}</strong><br /><span style={{ fontSize: '11px', color: '#64748b' }}>{sw.model}</span></td>
                      <td style={{ color: '#3b82f6', fontSize: '13px' }}>{sw.ip_address}</td>
                      <td style={{ fontSize: '12px', color: '#94a3b8' }}>{getSiteLabel(sw)}</td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>{sw.location_area || '-'}</td>
                      <td>
                        {sw.status === 'up' ? <span className="status-up"><span className="status-dot"></span>Online</span>
                          : sw.status === 'down' ? <span className="status-down"><span className="status-dot"></span>Offline</span>
                          : <span style={{ color: '#64748b', fontSize: '12px' }}>—</span>}
                      </td>
                      <td>
                        <a href={`/ports?switchId=${sw.id}&siteId=${sw.site_id || ''}`}
                          style={{ padding: '4px 12px', borderRadius: '6px', background: 'rgba(59,130,246,0.2)', color: '#93c5fd', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </main>
      </div>
    </RouteGuard>
  );
}
