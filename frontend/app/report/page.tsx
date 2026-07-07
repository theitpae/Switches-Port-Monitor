"use client";
import React, { useState, useEffect, useCallback } from "react";
import "../globals.css";
import { useAuth, authHeaders } from "../context/AuthContext";
import RouteGuard from "../components/RouteGuard";
import Sidebar from "../components/Sidebar";

type DateRange = "today" | "7d" | "30d";

function formatDT(iso: string) {
  const d = new Date(iso + "Z");
  return d.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", hour12: false,
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function isInRange(iso: string, range: DateRange): boolean {
  const d = new Date(iso + "Z");
  const now = new Date();
  if (range === "today") {
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  }
  const days = range === "7d" ? 7 : 30;
  return d >= new Date(now.getTime() - days * 86400000);
}

const ACTION_LABELS: Record<string, string> = {
  set_description: "✏️ Description",
  set_vlan: "🔀 VLAN",
  shutdown: "🔴 Shutdown",
  enable: "🟢 Enable",
  write_memory: "💾 Save Config",
  backup: "📦 Backup",
};
const ACTION_COLORS: Record<string, string> = {
  set_description: "#3b82f6", set_vlan: "#8b5cf6",
  shutdown: "#ef4444", enable: "#10b981",
  write_memory: "#f59e0b", backup: "#06b6d4",
};

function SummaryCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: string;
}) {
  return (
    <div style={{
      background: "rgba(30,41,59,0.7)", borderRadius: "14px", padding: "20px 24px",
      border: "1px solid rgba(255,255,255,0.08)", flex: "1 1 150px",
      display: "flex", flexDirection: "column", gap: "6px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
    }}>
      <div style={{ fontSize: "22px" }}>{icon}</div>
      <div style={{ fontSize: "28px", fontWeight: 800, color: color || "white", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: "11px", color: "#475569" }}>{sub}</div>}
    </div>
  );
}

function PaginationBar({ total, page, perPage, onPage, onPerPage }: {
  total: number; page: number; perPage: number;
  onPage: (p: number) => void; onPerPage: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const btn = (d: boolean): React.CSSProperties => ({
    padding: "4px 9px", borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.7)",
    color: d ? "#334155" : "#94a3b8",
    cursor: d ? "not-allowed" : "pointer", fontSize: "12px",
  });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "12px", color: "#64748b" }}>แสดง</span>
        <select value={perPage} onChange={e => { onPerPage(Number(e.target.value)); onPage(1); }}
          style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", outline: "none", cursor: "pointer" }}>
          {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize: "12px", color: "#64748b" }}>รายการ/หน้า</span>
        <span style={{ fontSize: "12px", color: "#475569", marginLeft: "4px" }}>(ทั้งหมด {total})</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <button onClick={() => onPage(1)} disabled={page === 1} style={btn(page === 1)}>«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} style={btn(page === 1)}>‹</button>
        <span style={{ padding: "4px 12px", borderRadius: "6px", background: "linear-gradient(135deg,#3b82f6,#2563eb)", color: "white", fontSize: "12px", fontWeight: 700 }}>{page}</span>
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} style={btn(page === totalPages)}>›</button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages} style={btn(page === totalPages)}>»</button>
        <span style={{ fontSize: "12px", color: "#475569", marginLeft: "4px" }}>หน้า {page}/{totalPages}</span>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const { canEdit } = useAuth();
  const [switches, setSwitches] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>("7d");
  const [search, setSearch] = useState("");
  const [swPage, setSwPage] = useState(1);
  const [swPerPage, setSwPerPage] = useState(10);

  const loadData = useCallback(async () => {
    setLoading(true);
    const h = authHeaders();
    try {
      const [sw, logs] = await Promise.all([
        fetch("/api/switches", { headers: h }).then(r => r.json()),
        fetch("/api/audit-logs?limit=500", { headers: h }).then(r => r.json()),
      ]);
      setSwitches(Array.isArray(sw) ? sw : []);
      setAuditLogs(Array.isArray(logs) ? logs : []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredLogs = auditLogs.filter(l => isInRange(l.timestamp, range));
  const onlineCount = switches.filter(s => s.status === "up").length;
  const offlineCount = switches.filter(s => s.status === "down").length;
  const todayLogs = auditLogs.filter(l => isInRange(l.timestamp, "today"));
  const weekLogs = auditLogs.filter(l => isInRange(l.timestamp, "7d"));

  const activityByIp: Record<string, number> = {};
  filteredLogs.forEach(l => { activityByIp[l.switch_ip || "Unknown"] = (activityByIp[l.switch_ip || "Unknown"] || 0) + 1; });
  const topSwitches = Object.entries(activityByIp).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const actionCounts: Record<string, number> = {};
  filteredLogs.forEach(l => { actionCounts[l.action] = (actionCounts[l.action] || 0) + 1; });

  const switchActivity: Record<string, number> = {};
  filteredLogs.forEach(l => {
    const sw = switches.find(s => s.ip_address === l.switch_ip);
    if (sw) switchActivity[sw.id] = (switchActivity[sw.id] || 0) + 1;
  });

  const lastActivity: Record<string, string> = {};
  auditLogs.forEach(l => { if (!lastActivity[l.switch_ip]) lastActivity[l.switch_ip] = l.timestamp; });

  const q = search.toLowerCase();
  const filteredSwitches = switches.filter(sw =>
    !q || sw.hostname?.toLowerCase().includes(q) ||
    sw.ip_address?.toLowerCase().includes(q) ||
    sw.site?.name?.toLowerCase().includes(q)
  );
  const swPaged = filteredSwitches.slice((swPage - 1) * swPerPage, swPage * swPerPage);

  const rangeLabel = { today: "วันนี้", "7d": "7 วันล่าสุด", "30d": "30 วันล่าสุด" }[range];

  const exportSwitchCSV = () => {
    const header = ["#", "Hostname", "IP", "Site", "Location", "Status", `Changes (${range})`];
    const rows = filteredSwitches.map((sw, i) => [
      i + 1, sw.hostname, sw.ip_address, sw.site?.name || "-",
      sw.location_area || "-",
      sw.status === "up" ? "Online" : sw.status === "down" ? "Offline" : "Unknown",
      switchActivity[sw.id] || 0,
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `switch-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportAuditCSV = () => {
    const token = JSON.parse(localStorage.getItem("cisco_auth") || "{}").token;
    window.open(`/api/audit-logs/export-csv?token=${token}`, "_blank");
  };

  const box: React.CSSProperties = {
    background: "rgba(30,41,59,0.6)", borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.08)", marginBottom: "20px", overflow: "hidden",
  };
  const boxHeader: React.CSSProperties = {
    padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
    display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px",
  };

  return (
    <RouteGuard>
      <div className="dashboard-container">
        <Sidebar active="/report" />
        <main className="main-content">
          <header className="header">
            <div>
              <h2>📊 Network Summary Report</h2>
              <p>สรุปสถานะ Switch และกิจกรรมในระบบ</p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {(["today", "7d", "30d"] as DateRange[]).map(r => (
                <button key={r} onClick={() => { setRange(r); setSwPage(1); }}
                  style={{
                    padding: "8px 16px", borderRadius: "8px", border: "none",
                    fontWeight: 600, fontSize: "13px", cursor: "pointer",
                    background: range === r ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "rgba(30,41,59,0.8)",
                    color: range === r ? "white" : "#64748b", transition: "all 0.2s",
                  }}>
                  {r === "today" ? "วันนี้" : r === "7d" ? "7 วัน" : "30 วัน"}
                </button>
              ))}
              <button onClick={exportSwitchCSV}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "rgba(16,185,129,0.15)", color: "#10b981", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
                📥 Export Switch CSV
              </button>
              {canEdit() && (
                <button onClick={exportAuditCSV}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "rgba(59,130,246,0.15)", color: "#93c5fd", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
                  📋 Export Audit CSV
                </button>
              )}
            </div>
          </header>

          {loading ? (
            <div style={{ textAlign: "center", padding: "80px", color: "#475569" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>⏳</div>
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : (<>
            {/* Summary Cards */}
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "20px" }}>
              <SummaryCard icon="🖥️" label="Switch ทั้งหมด" value={switches.length} color="white" />
              <SummaryCard icon="🟢" label="Online" value={onlineCount} color="#10b981"
                sub={`${switches.length > 0 ? Math.round(onlineCount / switches.length * 100) : 0}% ของทั้งหมด`} />
              <SummaryCard icon="🔴" label="Offline" value={offlineCount}
                color={offlineCount > 0 ? "#ef4444" : "#475569"} sub={offlineCount > 0 ? "ต้องตรวจสอบ" : "ปกติ"} />
              <SummaryCard icon="📋" label="Changes วันนี้" value={todayLogs.length} color="#f59e0b" />
              <SummaryCard icon="📈" label="Changes 7 วัน" value={weekLogs.length} color="#3b82f6"
                sub={`เฉลี่ย ${Math.round(weekLogs.length / 7)} ครั้ง/วัน`} />
              <SummaryCard icon="🔄" label={`Changes (${rangeLabel})`} value={filteredLogs.length} color="#8b5cf6" />
            </div>

            {/* Switch Status Table */}
            <div style={box}>
              <div style={boxHeader}>
                <h3 style={{ margin: 0, fontSize: "15px" }}>🖥️ Switch Status ({filteredSwitches.length})</h3>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#475569" }}>🔍</span>
                  <input type="text" placeholder="ค้นหา hostname, IP, site..."
                    value={search} onChange={e => { setSearch(e.target.value); setSwPage(1); }}
                    style={{ padding: "7px 32px", borderRadius: "7px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.7)", color: "white", outline: "none", fontSize: "13px", minWidth: "220px" }} />
                  {search && <button onClick={() => { setSearch(""); setSwPage(1); }}
                    style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#475569", cursor: "pointer" }}>✕</button>}
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["#", "Switch", "Site", "Status", `Changes (${rangeLabel})`, "Last Activity"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {swPaged.map((sw: any, i: number) => {
                    const acts = switchActivity[sw.id] || 0;
                    const last = lastActivity[sw.ip_address];
                    return (
                      <tr key={sw.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "10px 14px", color: "#475569", fontSize: "12px" }}>{(swPage - 1) * swPerPage + i + 1}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 700, fontSize: "13px" }}>{sw.hostname}</div>
                          <div style={{ fontSize: "11px", color: "#3b82f6" }}>{sw.ip_address}</div>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "12px", color: "#94a3b8" }}>{sw.site?.name || "-"}</td>
                        <td style={{ padding: "10px 14px" }}>
                          {sw.status === "up" ? <span className="status-up"><span className="status-dot"></span>Online</span>
                            : sw.status === "down" ? <span className="status-down"><span className="status-dot"></span>Offline</span>
                            : <span style={{ color: "#64748b", fontSize: "12px" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {acts > 0 ? (
                            <span style={{
                              padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 700,
                              background: acts >= 10 ? "rgba(239,68,68,0.15)" : acts >= 5 ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)",
                              color: acts >= 10 ? "#ef4444" : acts >= 5 ? "#f59e0b" : "#93c5fd",
                            }}>{acts} ครั้ง</span>
                          ) : <span style={{ color: "#334155", fontSize: "12px" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "11px", color: "#64748b" }}>{last ? formatDT(last) : "—"}</td>
                      </tr>
                    );
                  })}
                  {filteredSwitches.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#475569" }}>
                      {search ? `ไม่พบ Switch ที่ตรงกับ "${search}"` : "ไม่มีข้อมูล"}
                    </td></tr>
                  )}
                </tbody>
              </table>
              {filteredSwitches.length > swPerPage && (
                <PaginationBar total={filteredSwitches.length} page={swPage} perPage={swPerPage}
                  onPage={setSwPage} onPerPage={n => { setSwPerPage(n); setSwPage(1); }} />
              )}
            </div>

            {/* 2-col: Top Switches + Action Breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div style={box}>
                <div style={boxHeader}>
                  <h3 style={{ margin: 0, fontSize: "15px" }}>🏆 Top Switch — Change บ่อยที่สุด</h3>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>{rangeLabel}</span>
                </div>
                {topSwitches.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#475569" }}>ไม่มีกิจกรรมในช่วงนี้</div>
                ) : (
                  <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {topSwitches.map(([ip, count], i) => {
                      const sw = switches.find(s => s.ip_address === ip);
                      const pct = topSwitches[0][1] > 0 ? (count / topSwitches[0][1]) * 100 : 0;
                      return (
                        <div key={ip} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "12px", color: i < 3 ? ["#f59e0b","#94a3b8","#cd7f32"][i] : "#475569", minWidth: "20px", textAlign: "right", fontWeight: 800 }}>
                            {i + 1}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                              {sw?.hostname || ip}
                              <span style={{ fontSize: "10px", color: "#3b82f6", marginLeft: "6px" }}>{ip}</span>
                            </div>
                            <div style={{ height: "6px", borderRadius: "3px", background: "rgba(0,0,0,0.3)" }}>
                              <div style={{ height: "100%", width: `${pct}%`, borderRadius: "3px", transition: "width 0.6s",
                                background: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#3b82f6" }} />
                            </div>
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: 700, minWidth: "55px", textAlign: "right",
                            color: i === 0 ? "#f59e0b" : "#94a3b8" }}>{count} ครั้ง</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={box}>
                <div style={boxHeader}>
                  <h3 style={{ margin: 0, fontSize: "15px" }}>⚡ Action Breakdown</h3>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>{rangeLabel} · {filteredLogs.length} ครั้ง</span>
                </div>
                {Object.keys(actionCounts).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#475569" }}>ไม่มีกิจกรรมในช่วงนี้</div>
                ) : (
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).map(([action, count]) => {
                      const pct = filteredLogs.length > 0 ? Math.round(count / filteredLogs.length * 100) : 0;
                      const col = ACTION_COLORS[action] || "#64748b";
                      return (
                        <div key={action}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 600 }}>{ACTION_LABELS[action] || action}</span>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: col }}>{count} ครั้ง ({pct}%)</span>
                          </div>
                          <div style={{ height: "8px", borderRadius: "4px", background: "rgba(0,0,0,0.3)" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: "4px", transition: "width 0.6s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div style={box}>
              <div style={boxHeader}>
                <h3 style={{ margin: 0, fontSize: "15px" }}>📋 กิจกรรมล่าสุด ({rangeLabel})</h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>{filteredLogs.length} รายการ</span>
              </div>
              {filteredLogs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#475569" }}>ไม่มีกิจกรรมในช่วงนี้</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["เวลา", "Switch", "Port", "Action", "ผู้ดำเนินการ"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.slice(0, 50).map((log: any) => (
                      <tr key={log.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "9px 14px", fontSize: "11px", color: "#64748b", whiteSpace: "nowrap" }}>{formatDT(log.timestamp)}</td>
                        <td style={{ padding: "9px 14px", fontSize: "12px", color: "#3b82f6", fontWeight: 600 }}>{log.switch_ip}</td>
                        <td style={{ padding: "9px 14px", fontSize: "12px", fontWeight: 700 }}>{log.interface || "—"}</td>
                        <td style={{ padding: "9px 14px", fontSize: "12px", fontWeight: 600 }}>{ACTION_LABELS[log.action] || log.action}</td>
                        <td style={{ padding: "9px 14px", fontSize: "12px", color: "#94a3b8" }}>{log.username || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {filteredLogs.length > 50 && (
                <div style={{ textAlign: "center", padding: "12px", color: "#475569", fontSize: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  แสดง 50 รายการล่าสุด จากทั้งหมด {filteredLogs.length} — Export CSV เพื่อดูทั้งหมด
                </div>
              )}
            </div>
          </>)}
        </main>
      </div>
    </RouteGuard>
  );
}
