'use client';
import { useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '../lib/api';
import { IconSearch, IconClose } from './Icons';

const EDIT_ROLES = ['Gov', 'Pol', 'IR', 'Systech', 'Superadmin', 'Management', 'Admin'];
const STATUS_PENUGASAN = ['Diajukan', 'Konfirmasi', 'Aktif', 'Selesai', 'Batal'];

export default function AssignTAModal({ project, onClose, onChanged }: { project: any; onClose: () => void; onChanged?: () => void }) {
  const [assigned, setAssigned] = useState<any[]>([]);
  const [tas, setTas] = useState<any[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [f, setF] = useState({ posisi: '', status: 'Diajukan' });
  const [err, setErr] = useState('');

  const loadAssigned = async () => {
    const res = await fetchWithAuth(`/projects/${project.id}/tenaga-ahli`);
    if (res.ok) setAssigned(await res.json());
  };

  useEffect(() => {
    loadAssigned();
    fetchWithAuth('/tenaga-ahli').then((r) => r.json()).then((d) => Array.isArray(d) && setTas(d)).catch(() => {});
    fetchWithAuth('/users/me').then((r) => r.json()).then((u) => {
      const lvl = (u.level || '').toUpperCase();
      setCanEdit(EDIT_ROLES.includes(u.role) || lvl === 'CHIEF' || lvl === 'HEAD');
    }).catch(() => {});
  }, [project.id]);

  const assignedIds = useMemo(() => new Set(assigned.filter((a) => a.status !== 'Batal').map((a) => a.ta_id)), [assigned]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tas
      .filter((t) => !assignedIds.has(t.id))
      .filter((t) => !q || [t.nama, t.kode, t.kategori_bidang, t.bidang_keahlian, t.domisili].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' }))
      .slice(0, 50);
  }, [tas, search, assignedIds]);

  const picked = tas.find((t) => t.id === pickedId);

  const assign = async () => {
    if (!picked) return;
    setErr('');
    const body = { project_id: project.id, posisi: f.posisi || null, status: f.status };
    const res = await fetchWithAuth(`/tenaga-ahli/${picked.id}/penugasan`, { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      setPickedId(null); setF({ posisi: '', status: 'Diajukan' });
      await loadAssigned(); onChanged?.();
    } else setErr((await res.json().catch(() => ({}))).detail || 'Gagal menugaskan');
  };

  const update = async (id: number, status: string) => {
    const res = await fetchWithAuth(`/ta-penugasan/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (res.ok) { await loadAssigned(); onChanged?.(); }
  };

  const remove = async (id: number) => {
    if (!confirm('Lepas TA ini dari project?')) return;
    const res = await fetchWithAuth(`/ta-penugasan/${id}`, { method: 'DELETE' });
    if (res.ok) { await loadAssigned(); onChanged?.(); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" style={{ maxWidth: '760px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Tenaga Ahli — {project.nama_pekerjaan}</h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Sudah ditugaskan ({assigned.length})</div>
            <div className="table-container">
              <table>
                <thead><tr><th>Kode</th><th>Nama</th><th>Posisi</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {assigned.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', opacity: 0.5, padding: '1rem' }}>Belum ada TA.</td></tr>
                  ) : assigned.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{a.kode_ta}</td>
                      <td style={{ fontWeight: 600 }}>{a.nama_ta}</td>
                      <td>{a.posisi || '-'}</td>
                      <td>
                        {canEdit ? (
                          <select className="input-field" style={{ margin: 0, padding: '0.2rem' }} value={a.status} onChange={(e) => update(a.id, e.target.value)}>
                            {STATUS_PENUGASAN.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        ) : a.status}
                      </td>
                      {canEdit && <td><button title="Lepas dari project" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => remove(a.id)}><IconClose size={15} color="#ef4444" /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {canEdit && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Tambah dari Database TA</div>
              <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}><IconSearch size={16} /></span>
                <input className="input-field" style={{ paddingLeft: '2.5rem', width: '100%', margin: 0 }} placeholder="Cari nama, kode, kategori, bidang..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                {candidates.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.5 }}>Tidak ada TA yang cocok.</div>
                ) : candidates.map((t) => (
                  <div key={t.id} onClick={() => setPickedId(t.id)} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', background: t.id === pickedId ? '#ffedd5' : 'transparent', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <span style={{ fontWeight: 600 }}>{t.nama}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.kategori_bidang || '-'} · {t.status}</span>
                  </div>
                ))}
              </div>
              {picked && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'end' }}>
                  <div className="input-group" style={{ margin: 0 }}><label className="input-label">Posisi</label><input className="input-field" value={f.posisi} onChange={(e) => setF({ ...f, posisi: e.target.value })} /></div>
                  <div className="input-group" style={{ margin: 0 }}><label className="input-label">Status</label>
                    <select className="input-field" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUS_PENUGASAN.map((s) => <option key={s}>{s}</option>)}</select>
                  </div>
                  <button className="btn-primary" onClick={assign}>Tugaskan</button>
                </div>
              )}
              {picked && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Dipilih: <strong>{picked.nama}</strong></div>}
              {err && <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '0.4rem' }}>{err}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
