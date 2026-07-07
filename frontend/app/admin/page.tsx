"use client";
import React, { useState, useEffect } from 'react';
import '../globals.css';
import { useAuth, authHeaders } from '../context/AuthContext';
import RouteGuard from '../components/RouteGuard';
import Sidebar from '../components/Sidebar';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'switches' | 'sites' | 'users' | 'sessions';

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
      padding: '14px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '14px',
      background: type === 'success' ? 'rgba(10,185,129,0.95)' : 'rgba(239,68,68,0.95)',
      color: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
    }}>{msg}</div>
  );
}

// ─── Input style ───────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  padding: '9px 14px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.12)', color: 'white', outline: 'none',
  width: '100%', fontSize: '13px', boxSizing: 'border-box'
};

// ─── Shared Pagination Bar ────────────────────────────────────────────────────
function PaginationBar({
  total, page, perPage, onPage, onPerPage
}: {
  total: number;
  page: number;
  perPage: number;
  onPage: (p: number) => void;
  onPerPage: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const btn = (disabled: boolean): React.CSSProperties => ({
    padding: '4px 9px', borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(15,23,42,0.7)',
    color: disabled ? '#334155' : '#94a3b8',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '12px',
  });
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
      flexWrap: 'wrap', gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '12px', color: '#64748b' }}>แสดง</span>
        <select value={perPage} onChange={e => { onPerPage(Number(e.target.value)); onPage(1); }}
          style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', outline: 'none', cursor: 'pointer' }}>
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ fontSize: '12px', color: '#64748b' }}>รายการ/หน้า</span>
        <span style={{ fontSize: '12px', color: '#475569', marginLeft: '6px' }}>(ทั้งหมด {total} รายการ)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button onClick={() => onPage(1)} disabled={page === 1} style={btn(page === 1)}>«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} style={btn(page === 1)}>‹ ก่อนหน้า</button>
        <span style={{ padding: '4px 12px', borderRadius: '6px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: 'white', fontSize: '12px', fontWeight: 700 }}>{page}</span>
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} style={btn(page === totalPages)}>ถัดไป ›</button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages} style={btn(page === totalPages)}>»</button>
        <span style={{ fontSize: '12px', color: '#475569', marginLeft: '4px' }}>หน้า {page}/{totalPages}</span>
      </div>
    </div>
  );
}


// ─── Switches Tab ──────────────────────────────────────────────────────────────
function SwitchesTab() {
  const { isAdmin, user } = useAuth();
  const [switches, setSwitches] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editSw, setEditSw] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [form, setForm] = useState({ ip_address: '', hostname: '', username: '', password: '', site_id: '', location_area: '', model: 'Cisco Catalyst 2960', tags: [] as string[] });
  const [tagInput, setTagInput] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const fetchData = () => {
    const h = authHeaders();
    fetch('/api/switches', { headers: h }).then(r => r.json()).then(d => setSwitches(Array.isArray(d) ? d : []));
    fetch('/api/sites', { headers: h }).then(r => r.json()).then(d => setSites(Array.isArray(d) ? d : []));
    fetch('/api/tags', { headers: h }).then(r => r.json()).then(d => setAllTags(Array.isArray(d) ? d : []));
  };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    const h = { ...authHeaders(), 'Content-Type': 'application/json' };
    const body = { ...form, site_id: form.site_id ? Number(form.site_id) : null, password: form.password || undefined };
    try {
      const url = editSw ? `/api/switches/${editSw.id}` : '/api/switches';
      const method = editSw ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: h, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).detail);
      showToast(editSw ? 'แก้ไข Switch สำเร็จ' : 'เพิ่ม Switch สำเร็จ');
      setShowAdd(false); setEditSw(null); setTagInput(''); fetchData();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const handleDelete = async (id: number, hostname: string) => {
    if (!window.confirm(`ยืนยันลบ Switch "${hostname}"?`)) return;
    const res = await fetch(`/api/switches/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) { showToast((await res.json()).detail, 'error'); return; }
    showToast('ลบ Switch สำเร็จ'); fetchData();
  };

  const openEdit = (sw: any) => {
    setEditSw(sw);
    setTagInput('');
    setForm({ ip_address: sw.ip_address, hostname: sw.hostname, username: sw.username, password: '', site_id: sw.site_id || '', location_area: sw.location_area || '', model: sw.model || '', tags: sw.tags || [] });
  };

  const allowedSites = isAdmin() ? sites : sites.filter(s => user?.assigned_sites?.some((as: any) => as.id === s.id));
  const q = search.toLowerCase();
  const filteredSwitches = switches.filter(sw =>
    (!tagFilter || (sw.tags || []).includes(tagFilter)) &&
    (!q ||
    sw.hostname?.toLowerCase().includes(q) ||
    sw.ip_address?.toLowerCase().includes(q) ||
    sw.site?.name?.toLowerCase().includes(q) ||
    sw.location_area?.toLowerCase().includes(q) ||
    sw.model?.toLowerCase().includes(q) ||
    (sw.tags || []).some((t: string) => t.toLowerCase().includes(q)))
  );
  const totalPages = Math.max(1, Math.ceil(filteredSwitches.length / perPage));
  const paged = filteredSwitches.slice((page - 1) * perPage, page * perPage);

  // Tag color palette (deterministic by tag name)
  const TAG_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6'];
  const tagColor = (t: string) => TAG_COLORS[t.charCodeAt(0) % TAG_COLORS.length];

  const addTag = (t: string) => {
    const tag = t.trim().toLowerCase();
    if (!tag || form.tags.includes(tag)) return;
    setForm(f => ({ ...f, tags: [...f.tags, tag] }));
    setTagInput('');
  };
  const removeTag = (t: string) => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));

  return (
    <>
      {toast && <Toast {...toast} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Switch ทั้งหมด ({filteredSwitches.length}{search ? `/${switches.length}` : ''})</h3>
        <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: '14px' }}>🔍</span>
            <input
              type="text" placeholder="ค้นหา hostname, IP, site..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inp, paddingLeft: '32px', background: '#1e293b', border: '1px solid #334155' }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px' }}>✕</button>
            )}
          </div>
          <button onClick={() => { setShowAdd(s => !s); setEditSw(null); }} style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: showAdd ? 'rgba(100,116,139,0.5)' : '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {showAdd ? '✕ ยกเลิก' : '+ เพิ่ม Switch'}
          </button>
        </div>
      </div>

      {(showAdd || editSw) && (
        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 16px 0' }}>{editSw ? `✏️ แก้ไข: ${editSw.hostname}` : '➕ เพิ่ม Switch ใหม่'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[{ l: 'IP Address *', k: 'ip_address', p: '10.x.x.x' }, { l: 'Hostname *', k: 'hostname', p: 'SW-Name' }, { l: 'Username *', k: 'username', p: 'netadmin' }, { l: editSw ? 'Password (เว้นว่างถ้าไม่เปลี่ยน)' : 'Password *', k: 'password', p: '••••••', t: 'password' }, { l: 'Location Area', k: 'location_area', p: 'IT Rack Room' }, { l: 'Model', k: 'model', p: 'Cisco Catalyst 2960' }].map(f => (
              <div key={f.k}>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>{f.l}</label>
                <input type={(f as any).t || 'text'} value={(form as any)[f.k]} placeholder={f.p} onChange={e => setForm(x => ({ ...x, [f.k]: e.target.value }))} style={inp} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Site</label>
              <select value={form.site_id} onChange={e => setForm(x => ({ ...x, site_id: e.target.value }))} style={{ ...inp }}>
                <option value="">-- ไม่ระบุ Site --</option>
                {allowedSites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {/* Tags Input */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>🏷️ Tags (พิมพ์แล้วกด Enter หรือ ,)</label>
              {/* Existing tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {form.tags.map(t => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: tagColor(t) + '22', color: tagColor(t), border: `1px solid ${tagColor(t)}55` }}>
                    {t}
                    <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tagColor(t), fontSize: '14px', lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
                  </span>
                ))}
              </div>
              {/* Tag input + suggestions */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={tagInput}
                  placeholder="พิมพ์ tag เช่น core, access, critical..."
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); } }}
                  style={{ ...inp, flex: 1 }}
                />
                <button onClick={() => addTag(tagInput)} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#334155', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>+ เพิ่ม</button>
              </div>
              {/* Suggest existing tags */}
              {allTags.filter(t => !form.tags.includes(t)).length > 0 && (
                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', marginRight: '4px' }}>แนะนำ:</span>
                  {allTags.filter(t => !form.tags.includes(t)).map(t => (
                    <button key={t} onClick={() => addTag(t)} style={{ padding: '2px 10px', borderRadius: '20px', border: `1px solid ${tagColor(t)}55`, background: tagColor(t) + '11', color: tagColor(t), cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>{t}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={handleSave} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontWeight: 700 }}>✅ บันทึก</button>
            <button onClick={() => { setShowAdd(false); setEditSw(null); setTagInput(''); }} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'rgba(100,116,139,0.4)', color: 'white', cursor: 'pointer' }}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>กรองด้วย tag:</span>
          <button
            onClick={() => { setTagFilter(null); setPage(1); }}
            style={{ padding: '3px 12px', borderRadius: '20px', border: '1px solid', borderColor: tagFilter === null ? '#4ade80' : '#334155', background: tagFilter === null ? 'rgba(74,222,128,0.15)' : 'transparent', color: tagFilter === null ? '#4ade80' : '#64748b', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >ทั้งหมด</button>
          {allTags.map(t => (
            <button key={t}
              onClick={() => { setTagFilter(tagFilter === t ? null : t); setPage(1); }}
              style={{ padding: '3px 12px', borderRadius: '20px', border: `1px solid ${tagColor(t)}55`, background: tagFilter === t ? tagColor(t) + '33' : tagColor(t) + '11', color: tagColor(t), cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s' }}
            >{t}</button>
          ))}
        </div>
      )}

      <div className="table-container">
        <table>
          <thead><tr><th>#</th><th>Hostname</th><th>IP</th><th>Tags</th><th>Site</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {paged.map((sw: any, i: number) => (
              <tr key={sw.id}>
                <td style={{ color: '#64748b' }}>{(page - 1) * perPage + i + 1}</td>
                <td><strong>{sw.hostname}</strong></td>
                <td style={{ color: '#3b82f6' }}>{sw.ip_address}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(sw.tags || []).length === 0 ? <span style={{ color: '#475569', fontSize: '11px' }}>—</span> :
                      (sw.tags || []).map((t: string) => (
                        <span key={t} onClick={() => { setTagFilter(t); setPage(1); }}
                          style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: tagColor(t) + '22', color: tagColor(t), border: `1px solid ${tagColor(t)}55`, transition: 'all 0.15s' }}>
                          {t}
                        </span>
                      ))
                    }
                  </div>
                </td>
                <td style={{ fontSize: '12px', color: '#94a3b8' }}>{sw.site?.name || '-'}</td>
                <td style={{ fontSize: '12px', color: '#94a3b8' }}>{sw.location_area || '-'}</td>
                <td>{sw.status === 'up' ? <span className="status-up"><span className="status-dot"></span>Online</span> : sw.status === 'down' ? <span className="status-down"><span className="status-dot"></span>Offline</span> : <span style={{ color: '#64748b', fontSize: '12px' }}>—</span>}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => openEdit(sw)} style={{ padding: '5px 12px', borderRadius: '5px', border: 'none', background: 'rgba(59,130,246,0.3)', color: '#93c5fd', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                    {isAdmin() && <button onClick={() => handleDelete(sw.id, sw.hostname)} style={{ padding: '5px 12px', borderRadius: '5px', border: 'none', background: 'rgba(239,68,68,0.3)', color: '#fca5a5', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>}
                  </div>
                </td>
              </tr>
            ))}
            {filteredSwitches.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#475569', padding: '30px' }}>
                {search ? `🔍 ไม่พบ Switch ที่ตรงกับ "${search}"` : 'ยังไม่มี Switch'}
              </td></tr>
            )}
          </tbody>
        </table>
        {filteredSwitches.length > 0 && (
          <PaginationBar total={filteredSwitches.length} page={page} perPage={perPage}
            onPage={p => setPage(p)} onPerPage={n => { setPerPage(n); setPage(1); }} />
        )}
      </div>
    </>
  );
}


// ─── Sites Tab (Admin only) ────────────────────────────────────────────────────
function SitesTab() {
  const [sites, setSites] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editSite, setEditSite] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  const fetchSites = () => fetch('/api/sites', { headers: authHeaders() }).then(r => r.json()).then(d => setSites(Array.isArray(d) ? d : []));
  useEffect(() => { fetchSites(); }, []);

  const handleSave = async () => {
    const h = { ...authHeaders(), 'Content-Type': 'application/json' };
    const url = editSite ? `/api/sites/${editSite.id}` : '/api/sites';
    const method = editSite ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: h, body: JSON.stringify(form) });
    if (!res.ok) { showToast((await res.json()).detail, 'error'); return; }
    showToast(editSite ? 'แก้ไข Site สำเร็จ' : 'เพิ่ม Site สำเร็จ');
    setShowAdd(false); setEditSite(null); setForm({ name: '', description: '' }); fetchSites();
  };

  const filteredSites = sites.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase())
  );
  const sitesPaged = filteredSites.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      {toast && <Toast {...toast} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>Site ทั้งหมด ({filteredSites.length}{search ? `/${sites.length}` : ''})</h3>
        <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '200px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: '14px' }}>🔍</span>
            <input type="text" placeholder="ค้นหาชื่อ Site..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inp, paddingLeft: '32px', background: '#1e293b', border: '1px solid #334155' }}
            />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px' }}>✕</button>}
          </div>
          <button onClick={() => { setShowAdd(s => !s); setEditSite(null); }} style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: showAdd ? 'rgba(100,116,139,0.5)' : '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {showAdd ? '✕ ยกเลิก' : '+ เพิ่ม Site'}
          </button>
        </div>
      </div>

      {(showAdd || editSite) && (
        <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 14px 0' }}>{editSite ? `✏️ แก้ไข: ${editSite.name}` : '➕ เพิ่ม Site ใหม่'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>ชื่อ Site *</label>
              <input value={form.name} onChange={e => setForm(x => ({ ...x, name: e.target.value }))} placeholder="e.g. Bigc-Hyper Phitsanulok" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>คำอธิบาย</label>
              <input value={form.description} onChange={e => setForm(x => ({ ...x, description: e.target.value }))} placeholder="อธิบาย Site นี้..." style={inp} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button onClick={handleSave} style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontWeight: 700 }}>✅ บันทึก</button>
            <button onClick={() => { setShowAdd(false); setEditSite(null); }} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', background: 'rgba(100,116,139,0.4)', color: 'white', cursor: 'pointer' }}>ยกเลิก</button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead><tr><th>#</th><th>ชื่อ Site</th><th>คำอธิบาย</th><th>Switch</th><th>Actions</th></tr></thead>
          <tbody>
            {sitesPaged.map((s: any, i: number) => (
              <tr key={s.id}>
                <td style={{ color: '#64748b' }}>{(page - 1) * perPage + i + 1}</td>
                <td><strong>{s.name}</strong></td>
                <td style={{ color: '#94a3b8', fontSize: '13px' }}>{s.description || '-'}</td>
                <td style={{ color: '#64748b', fontSize: '12px' }}>—</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => { setEditSite(s); setForm({ name: s.name, description: s.description || '' }); setShowAdd(false); }} style={{ padding: '5px 12px', borderRadius: '5px', border: 'none', background: 'rgba(59,130,246,0.3)', color: '#93c5fd', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                    <button onClick={async () => { if (!window.confirm(`ลบ Site "${s.name}"?`)) return; const res = await fetch(`/api/sites/${s.id}`, { method: 'DELETE', headers: authHeaders() }); if (res.ok) { showToast('ลบ Site สำเร็จ'); fetchSites(); } }} style={{ padding: '5px 12px', borderRadius: '5px', border: 'none', background: 'rgba(239,68,68,0.3)', color: '#fca5a5', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredSites.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#475569', padding: '30px' }}>
                {search ? `🔍 ไม่พบ Site ที่ตรงกับ "${search}"` : 'ยังไม่มี Site'}
              </td></tr>
            )}
          </tbody>
        </table>
        {filteredSites.length > 0 && (
          <PaginationBar total={filteredSites.length} page={page} perPage={perPage}
            onPage={p => setPage(p)} onPerPage={n => { setPerPage(n); setPage(1); }} />
        )}
      </div>
    </>
  );
}


// ─── Users Tab (Admin only) ────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [assignUser, setAssignUser] = useState<any>(null);
  const [assignedSiteIds, setAssignedSiteIds] = useState<number[]>([]);
  const [form, setForm] = useState({ username: '', full_name: '', role: 'monitor' });
  const [generatedPw, setGeneratedPw] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };
  const fetchData = () => {
    const h = authHeaders();
    fetch('/api/users', { headers: h }).then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : []));
    fetch('/api/sites', { headers: h }).then(r => r.json()).then(d => setSites(Array.isArray(d) ? d : []));
  };
  useEffect(() => { fetchData(); }, []);

  const handleAddUser = async () => {
    const h = { ...authHeaders(), 'Content-Type': 'application/json' };
    const res = await fetch('/api/users', { method: 'POST', headers: h, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) { showToast(data.detail, 'error'); return; }
    setGeneratedPw(data.generated_password);
    setShowAdd(false); fetchData();
  };

  const handleResetPw = async (userId: number, username: string) => {
    if (!window.confirm(`Reset password ของ "${username}"?`)) return;
    const res = await fetch(`/api/users/${userId}/reset-password`, { method: 'POST', headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) { showToast(data.detail, 'error'); return; }
    setGeneratedPw(data.generated_password);
    showToast(`Reset password ของ ${username} สำเร็จ`);
  };

  const handleDelete = async (id: number, username: string) => {
    if (!window.confirm(`ลบ User "${username}"?`)) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) { showToast('ลบ User สำเร็จ'); fetchData(); }
  };

  const handleAssignSites = async () => {
    const h = { ...authHeaders(), 'Content-Type': 'application/json' };
    const res = await fetch(`/api/users/${assignUser.id}/assign-sites`, { method: 'PUT', headers: h, body: JSON.stringify({ site_ids: assignedSiteIds }) });
    if (res.ok) { showToast('Assign Site สำเร็จ'); setAssignUser(null); fetchData(); }
  };

  const ROLE_COLORS: Record<string, string> = { admin: '#f59e0b', technical: '#3b82f6', monitor: '#10b981' };
  const ROLE_LABELS: Record<string, string> = { admin: 'Admin', technical: 'Technical', monitor: 'Monitor' };

  const filteredUsers = users.filter(u =>
    !search ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );
  const usersPaged = filteredUsers.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      {toast && <Toast {...toast} />}

      {/* Generated Password Modal */}
      {generatedPw && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '32px', width: '400px', border: '1px solid rgba(16,185,129,0.4)', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔑</div>
            <h3 style={{ color: 'white', margin: '0 0 8px 0' }}>Password ที่ได้รับการสร้าง</h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 20px 0' }}>กรุณา Copy แล้วแจ้ง User ทันที (จะไม่แสดงอีก)</p>
            <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '10px', padding: '16px', fontSize: '24px', fontFamily: 'monospace', color: '#10b981', letterSpacing: '3px', marginBottom: '20px', border: '1px solid rgba(16,185,129,0.3)', userSelect: 'all' }}>
              {generatedPw}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(generatedPw); }} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'rgba(16,185,129,0.3)', color: '#10b981', cursor: 'pointer', fontWeight: 600, marginRight: '10px' }}>📋 Copy</button>
            <button onClick={() => setGeneratedPw('')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'rgba(100,116,139,0.4)', color: 'white', cursor: 'pointer' }}>ปิด</button>
          </div>
        </div>
      )}

      {/* Assign Sites Modal */}
      {assignUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '32px', width: '450px', border: '1px solid rgba(59,130,246,0.4)' }}>
            <h3 style={{ color: 'white', margin: '0 0 4px 0' }}>🗂️ Assign Site ให้ {assignUser.username}</h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 20px 0' }}>เลือก Site ที่ต้องการให้ผู้ใช้นี้เข้าถึงได้</p>
            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {sites.map((s: any) => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '8px', cursor: 'pointer', marginBottom: '6px', background: assignedSiteIds.includes(s.id) ? 'rgba(59,130,246,0.15)' : 'rgba(0,0,0,0.2)', border: `1px solid ${assignedSiteIds.includes(s.id) ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.06)'}` }}>
                  <input type="checkbox" checked={assignedSiteIds.includes(s.id)}
                    onChange={e => setAssignedSiteIds(ids => e.target.checked ? [...ids, s.id] : ids.filter(id => id !== s.id))}
                    style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }} />
                  <div>
                    <div style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{s.name}</div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>{s.description || ''}</div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={handleAssignSites} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700, cursor: 'pointer' }}>✅ บันทึก</button>
              <button onClick={() => setAssignUser(null)} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: 'none', background: 'rgba(100,116,139,0.4)', color: 'white', cursor: 'pointer' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>User ทั้งหมด ({filteredUsers.length}{search ? `/${users.length}` : ''})</h3>
        <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: '14px' }}>🔍</span>
            <input type="text" placeholder="ค้นหา username, ชื่อ, role..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inp, paddingLeft: '32px', background: '#1e293b', border: '1px solid #334155' }}
            />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px' }}>✕</button>}
          </div>
          <button onClick={() => setShowAdd(s => !s)} style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: showAdd ? 'rgba(100,116,139,0.5)' : '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {showAdd ? '✕ ยกเลิก' : '+ เพิ่ม User'}
          </button>
        </div>
      </div>

      {showAdd && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 14px 0' }}>➕ เพิ่ม User ใหม่</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Username *</label>
              <input value={form.username} onChange={e => setForm(x => ({ ...x, username: e.target.value }))} placeholder="username" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>ชื่อ-นามสกุล</label>
              <input value={form.full_name} onChange={e => setForm(x => ({ ...x, full_name: e.target.value }))} placeholder="ชื่อจริง" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Role *</label>
              <select value={form.role} onChange={e => setForm(x => ({ ...x, role: e.target.value }))} style={{ ...inp }}>
                <option value="admin">👑 Admin System</option>
                <option value="technical">🔧 Technical Support</option>
                <option value="monitor">👁️ User Monitor</option>
              </select>
            </div>
          </div>
          <p style={{ color: '#f59e0b', fontSize: '12px', margin: '12px 0 0 0' }}>💡 Password จะถูก Gen อัตโนมัติ — หลังจากสร้างจะแสดงให้ Copy ไปแจ้ง User</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button onClick={handleAddUser} style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontWeight: 700 }}>✅ สร้าง User</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', background: 'rgba(100,116,139,0.4)', color: 'white', cursor: 'pointer' }}>ยกเลิก</button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead><tr><th>#</th><th>Username</th><th>ชื่อ</th><th>Role</th><th>Sites</th><th>สถานะ</th><th>Actions</th></tr></thead>
          <tbody>
            {usersPaged.map((u: any, i: number) => (
              <tr key={u.id}>
                <td style={{ color: '#64748b' }}>{(page - 1) * perPage + i + 1}</td>
                <td><strong>{u.username}</strong></td>
                <td style={{ fontSize: '13px', color: '#94a3b8' }}>{u.full_name || '-'}</td>
                <td><span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, background: `${ROLE_COLORS[u.role]}22`, color: ROLE_COLORS[u.role] }}>{ROLE_LABELS[u.role]}</span></td>
                <td style={{ fontSize: '12px', color: '#64748b' }}>
                  {u.role === 'admin' ? 'ทั้งหมด' : u.assigned_sites?.length > 0 ? u.assigned_sites.map((s: any) => s.name).join(', ') : 'ยังไม่ได้ Assign'}
                </td>
                <td>
                  {u.is_active ? <span style={{ color: '#10b981', fontSize: '12px' }}>● Active</span> : <span style={{ color: '#ef4444', fontSize: '12px' }}>● Inactive</span>}
                  {u.must_change_password && <span style={{ color: '#f59e0b', fontSize: '11px', marginLeft: '6px' }}>(ต้องเปลี่ยน PW)</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {u.role !== 'admin' && (
                      <button onClick={() => { setAssignUser(u); setAssignedSiteIds(u.assigned_sites?.map((s: any) => s.id) || []); }}
                        style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', background: 'rgba(139,92,246,0.3)', color: '#c4b5fd', cursor: 'pointer', fontSize: '11px' }}>🗂️ Sites</button>
                    )}
                    <button onClick={() => handleResetPw(u.id, u.username)}
                      style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', background: 'rgba(245,158,11,0.3)', color: '#fcd34d', cursor: 'pointer', fontSize: '11px' }}>🔑 Reset PW</button>
                    <button onClick={() => handleDelete(u.id, u.username)}
                      style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', background: 'rgba(239,68,68,0.3)', color: '#fca5a5', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#475569', padding: '30px' }}>
                {search ? `🔍 ไม่พบ User ที่ตรงกับ "${search}"` : 'ยังไม่มี User'}
              </td></tr>
            )}
          </tbody>
        </table>
        {filteredUsers.length > 0 && (
          <PaginationBar total={filteredUsers.length} page={page} perPage={perPage}
            onPage={p => setPage(p)} onPerPage={n => { setPerPage(n); setPage(1); }} />
        )}
      </div>
    </>
  );
}


// ─── Sessions Tab ──────────────────────────────────────────────────────────────────
function SessionsTab() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const fetchSessions = () => {
    setLoading(true);
    fetch('/auth/sessions', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { setSessions(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchSessions(); }, []);

  const revokeSession = async (jti: string) => {
    if (!confirm('ยกเลิก Session นี้?')) return;
    try {
      const res = await fetch(`/auth/sessions/${jti}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json()).detail);
      showToast('✅ ยกเลิก Session แล้ว');
      fetchSessions();
    } catch (e: any) { showToast(`❌ ${e.message}`, 'error'); }
  };

  const revokeAll = async () => {
    if (!confirm('ยกเลิก Session ทั้งหมดใช่ไหม?')) return;
    try {
      await fetch('/auth/sessions', { method: 'DELETE', headers: authHeaders() });
      showToast('✅ ยกเลิก Session ทั้งหมดแล้ว');
      fetchSessions();
    } catch (e: any) { showToast(`❌ ${e.message}`, 'error'); }
  };

  const ROLE_BADGE: Record<string, { label: string; color: string }> = {
    admin: { label: '👑 Admin', color: '#f59e0b' },
    technical: { label: '🔧 Technical', color: '#3b82f6' },
    monitor: { label: '👁 Monitor', color: '#64748b' },
  };

  const formatDT = (iso: string) => {
    const d = new Date(iso + 'Z');
    return d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false });
  };

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>🔒 Active Sessions ({sessions.length})</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchSessions}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'rgba(59,130,246,0.2)', color: '#93c5fd', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
            ↻ Refresh
          </button>
          <button onClick={revokeAll}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
            ❌ ยกเลิกทั้งหมด
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>🔄 กำลังโหลด...</div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔓</div>
          <p>ไม่มี Active Session</p>
        </div>
      ) : (() => {
        const sessPaged = sessions.slice((page - 1) * perPage, page * perPage);
        return (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>เข้าใช้เมื่อ</th>
                  <th>หมดอายุใน</th>
                  <th>เวลาคงเหลือ</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessPaged.map((sess: any) => (
                  <tr key={sess.jti}>
                    <td>
                      <strong>{sess.full_name || sess.username}</strong>
                      <br /><span style={{ fontSize: '11px', color: '#64748b' }}>@{sess.username}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: ROLE_BADGE[sess.role]?.color || '#64748b' }}>
                        {ROLE_BADGE[sess.role]?.label || sess.role}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#94a3b8' }}>{formatDT(sess.login_at)}</td>
                    <td style={{ fontSize: '12px', color: '#94a3b8' }}>{formatDT(sess.expires_at)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: sess.expires_in_minutes < 30 ? '#f59e0b' : '#10b981',
                          boxShadow: `0 0 6px ${sess.expires_in_minutes < 30 ? '#f59e0b' : '#10b981'}`
                        }} />
                        <span style={{ fontSize: '12px', color: sess.expires_in_minutes < 30 ? '#fcd34d' : '#10b981', fontWeight: 700 }}>
                          {sess.expires_in_minutes >= 60
                            ? `${Math.floor(sess.expires_in_minutes / 60)}h ${sess.expires_in_minutes % 60}m`
                            : `${sess.expires_in_minutes}m`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button onClick={() => revokeSession(sess.jti)}
                        style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar total={sessions.length} page={page} perPage={perPage}
              onPage={p => setPage(p)} onPerPage={n => { setPerPage(n); setPage(1); }} />
          </div>
        );
      })()}
    </div>
  );
}


// ─── Main Admin Page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { isAdmin, user } = useAuth();
  const [tab, setTab] = useState<Tab>('switches');

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
    background: tab === t ? 'var(--accent-blue)' : 'rgba(30,41,59,0.5)',
    color: tab === t ? 'white' : '#64748b', transition: 'all 0.2s'
  });

  return (
    <RouteGuard>
      <div className="dashboard-container">
        <Sidebar active="/admin" />
        <main className="main-content">
          <header className="header">
            <div>
              <h2>Admin Settings</h2>
              <p>จัดการระบบ Switch, Site และ User</p>
            </div>
          </header>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button style={tabStyle('switches')} onClick={() => setTab('switches')}>🖥️ Switches</button>
            {isAdmin() && <button style={tabStyle('sites')} onClick={() => setTab('sites')}>🏢 Sites</button>}
            {isAdmin() && <button style={tabStyle('users')} onClick={() => setTab('users')}>👥 Users</button>}
            {isAdmin() && <button style={tabStyle('sessions')} onClick={() => setTab('sessions')}>🔒 Sessions</button>}
          </div>

          {tab === 'switches' && <SwitchesTab />}
          {tab === 'sites' && isAdmin() && <SitesTab />}
          {tab === 'users' && isAdmin() && <UsersTab />}
          {tab === 'sessions' && isAdmin() && <SessionsTab />}
        </main>
      </div>
    </RouteGuard>
  );
}
