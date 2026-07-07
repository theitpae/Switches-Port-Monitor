"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { authHeaders } from "../context/AuthContext";

const RANGES = [
  { label: "1h",  hours: 1 },
  { label: "6h",  hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d",  hours: 168 },
];

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatKbps(val: number) {
  if (!val && val !== 0) return "-";
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)} Gbps`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)} Mbps`;
  return `${val} Kbps`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "10px", padding: "10px 14px", fontSize: "12px" }}>
      <p style={{ color: "#94a3b8", margin: "0 0 6px 0" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>
          {p.name === "in_rate_mbps" ? "\u2193 RX" : "\u2191 TX"}: {formatKbps(p.value)}
        </p>
      ))}
    </div>
  );
};

interface PortChartProps {
  switchId: number;
  interface_name: string;
  onClose?: () => void;
}

export default function PortChart({ switchId, interface_name, onClose }: PortChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState(24);

  const fetchStats = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ interface: interface_name, hours: String(range) });
      const res = await fetch(`/api/switches/${switchId}/port-stats?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load stats");
      const raw = await res.json();
      setData(raw.map((s: any) => ({
        ...s,
        time: formatTime(s.recorded_at),
        in_rate_mbps: s.in_rate_mbps ?? 0,
        out_rate_mbps: s.out_rate_mbps ?? 0,
      })));
    } catch (e: any) { setError(e.message || "Error"); }
    setLoading(false);
  }, [switchId, interface_name, range]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const hasData = data.length > 0;
  const last = hasData ? data[data.length - 1] : null;
  const avgIn  = hasData ? Math.round(data.reduce((a, d) => a + d.in_rate_mbps,  0) / data.length) : 0;
  const avgOut = hasData ? Math.round(data.reduce((a, d) => a + d.out_rate_mbps, 0) / data.length) : 0;
  const totalErrors = last ? ((last.in_errors || 0) + (last.out_errors || 0)) : 0;

  return (
    <div style={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "12px", padding: "16px 20px", marginTop: "8px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>
            \ud83d\udcca Traffic History
          </span>
          <span style={{ fontSize: "12px", color: "#3b82f6", marginLeft: "8px" }}>{interface_name}</span>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {RANGES.map(r => (
            <button key={r.hours} onClick={() => setRange(r.hours)} style={{
              padding: "3px 10px", borderRadius: "6px", border: "none", fontSize: "11px", fontWeight: 600, cursor: "pointer",
              background: range === r.hours ? "#3b82f6" : "rgba(51,65,85,0.8)",
              color: range === r.hours ? "white" : "#94a3b8",
            }}>{r.label}</button>
          ))}
          {onClose && (
            <button onClick={onClose} style={{ marginLeft: "6px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "18px", lineHeight: 1 }}>
              \u00d7
            </button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      {hasData && (
        <div style={{ display: "flex", gap: "20px", marginBottom: "12px", flexWrap: "wrap" }}>
          {[
            { label: "\u2193 RX \u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14", val: formatKbps(last?.in_rate_mbps),  color: "#10b981" },
            { label: "\u2191 TX \u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14", val: formatKbps(last?.out_rate_mbps), color: "#3b82f6" },
            { label: "\u2193 RX \u0e40\u0e09\u0e25\u0e35\u0e48\u0e22",    val: formatKbps(avgIn),    color: "#6ee7b7" },
            { label: "\u2191 TX \u0e40\u0e09\u0e25\u0e35\u0e48\u0e22",   val: formatKbps(avgOut),   color: "#93c5fd" },
            { label: "Errors", val: totalErrors, color: totalErrors > 0 ? "#ef4444" : "#64748b" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>{s.label}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart area */}
      <div style={{ height: "160px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#64748b", fontSize: "13px" }}>
            \u23f3 \u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...
          </div>
        ) : error ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ef4444", fontSize: "13px" }}>
            \u26a0\ufe0f {error}
          </div>
        ) : !hasData ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#475569", fontSize: "12px", gap: "6px" }}>
            <span style={{ fontSize: "28px", opacity: 0.4 }}>\ud83d\udcad</span>
            <span>\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25 traffic</span>
            <span style={{ fontSize: "11px", color: "#334155" }}>\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e30\u0e40\u0e23\u0e34\u0e48\u0e21\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e04\u0e25\u0e34\u0e01 Refresh ports</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#334155" }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}M` : `${v}K`} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8", paddingTop: "4px" }} formatter={(v: string) => v === "in_rate_mbps" ? "\u2193 RX (Kbps)" : "\u2191 TX (Kbps)"} />
              <Line type="monotone" dataKey="in_rate_mbps"  stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="out_rate_mbps" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
