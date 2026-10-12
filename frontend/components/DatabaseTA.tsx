'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { fetchWithAuth, isProjectSelesaiAkhir } from '../lib/api';
import { IconUser, IconSearch, IconTrash, IconClose } from './Icons';

const EDIT_ROLES = ['Gov', 'Pol', 'IR', 'Systech', 'Superadmin', 'Management', 'Admin'];
const STATUS_TA = ['Internal', 'Eksternal', 'Research Associate', 'Levner', 'Tenos'];
const STATUS_PENUGASAN = ['Diajukan', 'Konfirmasi', 'Aktif', 'Selesai', 'Batal'];
const JENJANG = ['D3', 'D4', 'S1', 'S1 Terapan', 'S2', 'S2 Terapan', 'S3'];
const PAGE_SIZE = 25;

const statusColor: Record<string, { bg: string; fg: string }> = {
  Internal: { bg: '#dbeafe', fg: '#1d4ed8' },
  Eksternal: { bg: '#f1f5f9', fg: '#475569' },
  'Research Associate': { bg: '#ede9fe', fg: '#6d28d9' },
  Levner: { bg: '#ffedd5', fg: '#c2410c' },
  Tenos: { bg: '#ffedd5', fg: '#c2410c' },
};
const penugasanColor: Record<string, { bg: string; fg: string }> = {
  Diajukan: { bg: '#f1f5f9', fg: '#475569' },
  Konfirmasi: { bg: '#fef3c7', fg: '#b45309' },
  Aktif: { bg: '#dcfce7', fg: '#15803d' },
  Selesai: { bg: '#dbeafe', fg: '#1d4ed8' },
  Batal: { bg: '#fee2e2', fg: '#b91c1c' },
};

const rupiah = (v?: number | null) => (v || v === 0 ? `Rp ${Number(v).toLocaleString('id-ID')}` : '-');
const isAktif = (a: any) => a.status !== 'Batal' && a.status !== 'Selesai';

export default function DatabaseTA() {
  const [list, setList] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fKategori, setFKategori] = useState('');
  const [fPenugasan, setFPenugasan] = useState<'' | 'ditugaskan' | 'tersedia'>('');
  const [page, setPage] = useState(1);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    const res = await fetchWithAuth('/tenaga-ahli');
    if (res.ok) setList(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
    fetchWithAuth('/projects')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setProjects(d))
      .catch(() => {});
    fetchWithAuth('/users/me')
      .then((r) => r.json())
      .then((u) => {
        const lvl = (u.level || '').toUpperCase();
        setCanEdit(EDIT_ROLES.includes(u.role) || lvl === 'CHIEF' || lvl === 'HEAD');
      })
      .catch(() => {});
  }, []);

  const runningProjects = useMemo(
    () => projects.filter((p) => (p.status_project === 'Ongoing' || !p.status_project || (p.status_project === 'Menang' && !isProjectSelesaiAkhir(p)))),
    [projects]
  );

  const kategoriOptions = useMemo(
    () => Array.from(new Set(list.map((t) => t.kategori_bidang).filter(Boolean))).sort() as string[],
    [list]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...list].sort((a, b) => {
      if (!a.kategori_bidang !== !b.kategori_bidang) return a.kategori_bidang ? -1 : 1;
      return (a.kategori_bidang || '').localeCompare(b.kategori_bidang || '', 'id', { sensitivity: 'base' })
        || (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' });
    }).filter((t) => {
      if (fStatus && t.status !== fStatus) return false;
      if (fKategori && t.kategori_bidang !== fKategori) return false;
      const aktif = t.penugasan.filter(isAktif).length;
      if (fPenugasan === 'ditugaskan' && aktif === 0) return false;
      if (fPenugasan === 'tersedia' && aktif > 0) return false;
      if (!q) return true;
      const hay = [
        t.nama, t.kode, t.kategori_bidang, t.bidang_keahlian, t.domisili, t.no_hp,
        ...t.pendidikan.map((e: any) => `${e.jurusan || ''} ${e.universitas || ''}`),
        ...t.sertifikasi.map((s: any) => s.nama_sertifikasi),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [list, search, fStatus, fKategori, fPenugasan]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = list.find((t) => t.id === selectedId) || null;

  const stats = useMemo(() => {
    const ditugaskan = list.filter((t) => t.penugasan.some(isAktif)).length;
    return { total: list.length, ditugaskan, tersedia: list.length - ditugaskan, bersertifikat: list.filter((t) => t.sertifikasi.length > 0).length };
  }, [list]);

  const highest = (t: any) => {
    const order = ['S3', 'S2 Terapan', 'S2', 'S1 Terapan', 'S1', 'D4', 'D3'];
    for (const j of order) if (t.pendidikan.some((e: any) => e.jenjang === j)) return j;
    return '-';
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <IconUser size={28} color="#0284c7" />
          <div>
            <h1 className="page-title">Database Tenaga Ahli</h1>
            <p className="page-desc">Basis data tenaga ahli (pendidikan & sertifikasi) yang dapat ditugaskan ke project yang sedang berjalan.</p>
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.25rem' }}>
        <div className="stat-card"><span className="stat-label">Total Tenaga Ahli</span><span className="stat-value">{stats.total}</span></div>
        <div className="stat-card finance"><span className="stat-label">Sedang Ditugaskan</span><span className="stat-value" style={{ color: '#10b981' }}>{stats.ditugaskan}</span><span className="stat-sub">Punya penugasan aktif</span></div>
        <div className="stat-card"><span className="stat-label">Tersedia</span><span className="stat-value" style={{ color: '#0284c7' }}>{stats.tersedia}</span><span className="stat-sub">Belum ada penugasan aktif</span></div>
        <div className="stat-card"><span className="stat-label">Bersertifikasi</span><span className="stat-value" style={{ color: '#f59e0b' }}>{stats.bersertifikat}</span></div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
            <input className="input-field" style={{ paddingLeft: '2.5rem', width: '100%', margin: 0 }} placeholder="Cari nama, bidang, jurusan, universitas, sertifikasi..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}><IconSearch size={16} /></span>
          </div>
          <select className="input-field" style={{ margin: 0, width: 'auto' }} value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }}>
            <option value="">Semua Status</option>
            {STATUS_TA.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input-field" style={{ margin: 0, width: 'auto', maxWidth: '220px' }} value={fKategori} onChange={(e) => { setFKategori(e.target.value); setPage(1); }}>
            <option value="">Semua Kategori</option>
            {kategoriOptions.map((k) => <option key={k}>{k}</option>)}
          </select>
          <select className="input-field" style={{ margin: 0, width: 'auto' }} value={fPenugasan} onChange={(e) => { setFPenugasan(e.target.value as any); setPage(1); }}>
            <option value="">Semua Ketersediaan</option>
            <option value="ditugaskan">Sedang ditugaskan</option>
            <option value="tersedia">Tersedia</option>
          </select>
          {canEdit && <button className="btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Tambah TA</button>}
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat Database TA...</div>
        ) : (
          <>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{filtered.length} tenaga ahli</div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Kode</th><th>Nama</th><th>Kategori</th><th>Status</th><th>Pendidikan Tertinggi</th>
                    <th>Pengalaman</th><th>Domisili</th><th style={{ textAlign: 'center' }}>Sertifikasi</th><th>Project Aktif</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>Tidak ada tenaga ahli yang sesuai.</td></tr>
                  ) : pageRows.map((t, i) => {
                    const newGroup = i === 0 || (pageRows[i - 1].kategori_bidang || '') !== (t.kategori_bidang || '');
                    const gKey = t.kategori_bidang || '';
                    const isCollapsed = collapsed.has(gKey);
                    const aktif = t.penugasan.filter(isAktif);
                    const sc = statusColor[t.status] || statusColor.Eksternal;
                    return (
                      <Fragment key={t.id}>
                      {newGroup && (
                        <tr><td colSpan={10} onClick={() => setCollapsed((prev) => { const n = new Set(prev); if (n.has(gKey)) n.delete(gKey); else n.add(gKey); return n; })} style={{ background: '#f1f5f9', fontWeight: 800, color: '#334155', fontSize: '0.8rem', letterSpacing: '0.03em', cursor: 'pointer', userSelect: 'none' }}>
                          <span style={{ display: 'inline-block', width: '1rem' }}>{isCollapsed ? '▸' : '▾'}</span>{t.kategori_bidang || 'Tanpa Kategori'} <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>({filtered.filter((x) => (x.kategori_bidang || '') === (t.kategori_bidang || '')).length})</span>
                        </td></tr>
                      )}
                      {!isCollapsed && <tr>
                        <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{t.kode}</td>
                        <td style={{ fontWeight: 700, color: '#1e293b' }}>{t.nama}</td>
                        <td>{t.kategori_bidang || '-'}</td>
                        <td><span className="badge" style={{ background: sc.bg, color: sc.fg, fontWeight: 700 }}>{t.status}</span></td>
                        <td>{highest(t)}</td>
                        <td>{t.pengalaman_tahun != null ? `${t.pengalaman_tahun} th` : '-'}</td>
                        <td>{t.domisili || '-'}</td>
                        <td style={{ textAlign: 'center' }}>{t.sertifikasi.length || '-'}</td>
                        <td>
                          {aktif.length === 0 ? <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Tersedia</span> : (
                            <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700 }} title={aktif.map((a: any) => a.nama_pekerjaan).join('\n')}>{aktif.length} project</span>
                          )}
                        </td>
                        <td><button className="btn-secondary btn-sm" onClick={() => setSelectedId(t.id)}>Detail</button></td>
                      </tr>}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
              <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Sebelumnya</button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Halaman {page} / {totalPages}</span>
              <button className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Berikutnya ›</button>
            </div>
          </>
        )}
      </div>

      {selected && (
        <TADetailModal ta={selected} projects={runningProjects} canEdit={canEdit} onClose={() => setSelectedId(null)} reload={load} />
      )}
      {showAdd && (
        <AddTAModal onClose={() => setShowAdd(false)} onCreated={(id) => { setShowAdd(false); load().then(() => setSelectedId(id)); }} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="input-group" style={{ margin: 0 }}>
      <label className="input-label">{label}</label>
      {children}
    </div>
  );
}

function AddTAModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [f, setF] = useState<any>({ nama: '', kategori_bidang: '', status: 'Eksternal', no_hp: '', domisili: '', pengalaman_tahun: '', bidang_keahlian: '' });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.nama.trim()) return;
    const body = { ...f, pengalaman_tahun: f.pengalaman_tahun === '' ? null : Number(f.pengalaman_tahun) };
    Object.keys(body).forEach((k) => body[k] === '' && (body[k] = null));
    const res = await fetchWithAuth('/tenaga-ahli', { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) onCreated((await res.json()).id);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Tambah Tenaga Ahli</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
          <div style={{ gridColumn: '1 / -1' }}><Field label="Nama (beserta gelar)"><input className="input-field" value={f.nama} onChange={(e) => set('nama', e.target.value)} /></Field></div>
          <Field label="Kategori (Bidang)"><input className="input-field" value={f.kategori_bidang} onChange={(e) => set('kategori_bidang', e.target.value)} /></Field>
          <Field label="Status"><select className="input-field" value={f.status} onChange={(e) => set('status', e.target.value)}>{STATUS_TA.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="No. HP"><input className="input-field" value={f.no_hp} onChange={(e) => set('no_hp', e.target.value)} /></Field>
          <Field label="Domisili"><input className="input-field" value={f.domisili} onChange={(e) => set('domisili', e.target.value)} /></Field>
          <Field label="Pengalaman (tahun)"><input type="number" className="input-field" value={f.pengalaman_tahun} onChange={(e) => set('pengalaman_tahun', e.target.value)} /></Field>
          <Field label="Bidang Keahlian"><input className="input-field" value={f.bidang_keahlian} onChange={(e) => set('bidang_keahlian', e.target.value)} /></Field>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pendidikan & sertifikasi dapat ditambahkan setelah data tersimpan.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn-primary" onClick={save} disabled={!f.nama.trim()}>Simpan</button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: '0.95rem', fontWeight: 750, margin: '1.25rem 0 0.5rem', color: '#0f172a' }}>{children}</h3>;
}

function TADetailModal({ ta, projects, canEdit, onClose, reload }: { ta: any; projects: any[]; canEdit: boolean; onClose: () => void; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<any>({});
  const [edu, setEdu] = useState<any>({ jenjang: 'S1', jurusan: '', universitas: '', tahun_lulus: '' });
  const [cert, setCert] = useState<any>({ nama_sertifikasi: '', tahun: '' });
  const [asg, setAsg] = useState<any>({ project_id: '', posisi: '', fee: '', tanggal_mulai: '', tanggal_selesai: '', status: 'Diajukan', catatan: '' });
  const [err, setErr] = useState('');

  const startEdit = () => {
    setF({
      nama: ta.nama || '', kategori_bidang: ta.kategori_bidang || '', status: ta.status || 'Eksternal', no_hp: ta.no_hp || '',
      domisili: ta.domisili || '', pengalaman_tahun: ta.pengalaman_tahun ?? '', bidang_keahlian: ta.bidang_keahlian || '', catatan: ta.catatan || '',
    });
    setEditing(true);
  };

  const call = async (url: string, method: string, body?: any) => {
    const res = await fetchWithAuth(url, { method, body: body ? JSON.stringify(body) : undefined });
    if (res.ok) await reload();
    return res;
  };
  const nul = (o: any) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? null : v]));

  const saveEdit = async () => {
    const body = nul({ ...f, pengalaman_tahun: f.pengalaman_tahun === '' ? '' : Number(f.pengalaman_tahun) });
    if ((await call(`/tenaga-ahli/${ta.id}`, 'PUT', body)).ok) setEditing(false);
  };
  const removeTA = async () => {
    if (!confirm(`Hapus ${ta.nama} dari database TA beserta seluruh penugasannya?`)) return;
    if ((await call(`/tenaga-ahli/${ta.id}`, 'DELETE')).ok) onClose();
  };
  const addEdu = async () => {
    if (!edu.jenjang) return;
    const res = await call(`/tenaga-ahli/${ta.id}/pendidikan`, 'POST', nul({ ...edu, tahun_lulus: edu.tahun_lulus === '' ? '' : Number(edu.tahun_lulus) }));
    if (res.ok) setEdu({ jenjang: 'S1', jurusan: '', universitas: '', tahun_lulus: '' });
  };
  const addCert = async () => {
    if (!cert.nama_sertifikasi.trim()) return;
    const res = await call(`/tenaga-ahli/${ta.id}/sertifikasi`, 'POST', nul({ ...cert, tahun: cert.tahun === '' ? '' : Number(cert.tahun) }));
    if (res.ok) setCert({ nama_sertifikasi: '', tahun: '' });
  };
  const addAsg = async () => {
    setErr('');
    if (!asg.project_id) { setErr('Pilih project terlebih dahulu'); return; }
    const res = await call(`/tenaga-ahli/${ta.id}/penugasan`, 'POST', nul({ ...asg, project_id: Number(asg.project_id), fee: asg.fee === '' ? '' : Number(asg.fee) }));
    if (res.ok) setAsg({ project_id: '', posisi: '', fee: '', tanggal_mulai: '', tanggal_selesai: '', status: 'Diajukan', catatan: '' });
    else setErr((await res.json().catch(() => ({}))).detail || 'Gagal menugaskan');
  };

  const sc = statusColor[ta.status] || statusColor.Eksternal;
  const assignedIds = new Set(ta.penugasan.filter((a: any) => a.status !== 'Batal').map((a: any) => a.project_id));
  const available = projects.filter((p) => !assignedIds.has(p.id));
  const th: React.CSSProperties = { fontSize: '0.75rem' };
  const cell = (label: string, v: any) => (
    <div className="detail-item"><span className="detail-label">{label}</span><span className="detail-value">{v || v === 0 ? v : '-'}</span></div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" style={{ maxWidth: '880px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{ta.kode}</div>
            <h2 style={{ margin: '0.1rem 0 0.4rem', fontSize: '1.3rem' }}>{ta.nama}</h2>
            <span className="badge" style={{ background: sc.bg, color: sc.fg, fontWeight: 700 }}>{ta.status}</span>
            {ta.prioritas && <span className="badge" style={{ marginLeft: '0.4rem', background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>{ta.prioritas}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {canEdit && !editing && <button className="btn-secondary btn-sm" onClick={startEdit}>Edit</button>}
            {canEdit && <button className="btn-secondary btn-sm" style={{ color: '#b91c1c' }} onClick={removeTA}>Hapus</button>}
            <button className="modal-close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        {editing ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div style={{ gridColumn: '1 / -1' }}><Field label="Nama"><input className="input-field" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></Field></div>
              <Field label="Kategori (Bidang)"><input className="input-field" value={f.kategori_bidang} onChange={(e) => setF({ ...f, kategori_bidang: e.target.value })} /></Field>
              <Field label="Status"><select className="input-field" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUS_TA.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="No. HP"><input className="input-field" value={f.no_hp} onChange={(e) => setF({ ...f, no_hp: e.target.value })} /></Field>
              <Field label="Domisili"><input className="input-field" value={f.domisili} onChange={(e) => setF({ ...f, domisili: e.target.value })} /></Field>
              <Field label="Pengalaman (tahun)"><input type="number" className="input-field" value={f.pengalaman_tahun} onChange={(e) => setF({ ...f, pengalaman_tahun: e.target.value })} /></Field>
              <Field label="Bidang Keahlian"><input className="input-field" value={f.bidang_keahlian} onChange={(e) => setF({ ...f, bidang_keahlian: e.target.value })} /></Field>
              <div style={{ gridColumn: '1 / -1' }}><Field label="Catatan"><input className="input-field" value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} /></Field></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button className="btn-secondary" onClick={() => setEditing(false)}>Batal</button>
              <button className="btn-primary" onClick={saveEdit} disabled={!f.nama.trim()}>Simpan</button>
            </div>
          </div>
        ) : (
          <div className="detail-grid">
            {cell('Kategori (Bidang)', ta.kategori_bidang)}
            {cell('No. HP', ta.no_hp)}
            {cell('Domisili', ta.domisili)}
            {cell('Pengalaman', ta.pengalaman_tahun != null ? `${ta.pengalaman_tahun} tahun${ta.kategori_pengalaman ? ` — ${ta.kategori_pengalaman}` : ''}` : null)}
            {cell('Bidang Keahlian', ta.bidang_keahlian)}
            {cell('Catatan', ta.catatan)}
          </div>
        )}

        <SectionTitle>Pendidikan ({ta.pendidikan.length})</SectionTitle>
        <div className="table-container">
          <table>
            <thead><tr><th style={th}>Jenjang</th><th style={th}>Jurusan</th><th style={th}>Universitas</th><th style={th}>Tahun Lulus</th>{canEdit && <th />}</tr></thead>
            <tbody>
              {ta.pendidikan.length === 0 && <tr><td colSpan={5} style={{ opacity: 0.5, textAlign: 'center' }}>Belum ada data pendidikan</td></tr>}
              {ta.pendidikan.map((e: any) => (
                <tr key={e.id}>
                  <td>{e.jenjang}</td><td>{e.jurusan || '-'}</td><td>{e.universitas || '-'}</td><td>{e.tahun_lulus || '-'}</td>
                  {canEdit && <td><button title="Hapus" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => call(`/ta-pendidikan/${e.id}`, 'DELETE')}><IconTrash size={15} color="#ef4444" /></button></td>}
                </tr>
              ))}
              {canEdit && (
                <tr>
                  <td><select className="input-field" style={{ margin: 0, padding: '0.3rem' }} value={edu.jenjang} onChange={(e) => setEdu({ ...edu, jenjang: e.target.value })}>{JENJANG.map((j) => <option key={j}>{j}</option>)}</select></td>
                  <td><input className="input-field" style={{ margin: 0, padding: '0.3rem' }} placeholder="Jurusan" value={edu.jurusan} onChange={(e) => setEdu({ ...edu, jurusan: e.target.value })} /></td>
                  <td><input className="input-field" style={{ margin: 0, padding: '0.3rem' }} placeholder="Universitas" value={edu.universitas} onChange={(e) => setEdu({ ...edu, universitas: e.target.value })} /></td>
                  <td><input type="number" className="input-field" style={{ margin: 0, padding: '0.3rem', width: '90px' }} placeholder="Tahun" value={edu.tahun_lulus} onChange={(e) => setEdu({ ...edu, tahun_lulus: e.target.value })} /></td>
                  <td><button className="btn-primary btn-sm" onClick={addEdu}>+</button></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <SectionTitle>Sertifikasi ({ta.sertifikasi.length})</SectionTitle>
        <div className="table-container">
          <table>
            <thead><tr><th style={th}>Nama Sertifikasi</th><th style={th}>Tahun</th>{canEdit && <th />}</tr></thead>
            <tbody>
              {ta.sertifikasi.length === 0 && <tr><td colSpan={3} style={{ opacity: 0.5, textAlign: 'center' }}>Belum ada sertifikasi</td></tr>}
              {ta.sertifikasi.map((s: any) => (
                <tr key={s.id}>
                  <td style={{ whiteSpace: 'normal', maxWidth: '560px' }}>{s.nama_sertifikasi}</td><td>{s.tahun || '-'}</td>
                  {canEdit && <td><button title="Hapus" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => call(`/ta-sertifikasi/${s.id}`, 'DELETE')}><IconTrash size={15} color="#ef4444" /></button></td>}
                </tr>
              ))}
              {canEdit && (
                <tr>
                  <td><input className="input-field" style={{ margin: 0, padding: '0.3rem' }} placeholder="Nama sertifikasi" value={cert.nama_sertifikasi} onChange={(e) => setCert({ ...cert, nama_sertifikasi: e.target.value })} /></td>
                  <td><input type="number" className="input-field" style={{ margin: 0, padding: '0.3rem', width: '90px' }} placeholder="Tahun" value={cert.tahun} onChange={(e) => setCert({ ...cert, tahun: e.target.value })} /></td>
                  <td><button className="btn-primary btn-sm" onClick={addCert}>+</button></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <SectionTitle>Penugasan Project ({ta.penugasan.length})</SectionTitle>
        <div className="table-container">
          <table>
            <thead><tr><th style={th}>Project</th><th style={th}>Posisi</th><th style={th}>Fee</th><th style={th}>Periode</th><th style={th}>Status</th>{canEdit && <th />}</tr></thead>
            <tbody>
              {ta.penugasan.length === 0 && <tr><td colSpan={6} style={{ opacity: 0.5, textAlign: 'center' }}>Belum pernah ditugaskan</td></tr>}
              {ta.penugasan.map((a: any) => {
                const pc = penugasanColor[a.status] || penugasanColor.Diajukan;
                return (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'normal', fontWeight: 600 }}>{a.nama_pekerjaan}</td>
                    <td>{a.posisi || '-'}</td>
                    <td>{rupiah(a.fee)}</td>
                    <td style={{ fontSize: '0.8rem' }}>{a.tanggal_mulai || '-'} s/d {a.tanggal_selesai || '-'}</td>
                    <td>
                      {canEdit ? (
                        <select value={a.status} onChange={(e) => call(`/ta-penugasan/${a.id}`, 'PUT', { status: e.target.value })}
                          style={{ padding: '0.2rem 0.4rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 650, background: pc.bg, color: pc.fg, border: `1px solid ${pc.fg}33` }}>
                          {STATUS_PENUGASAN.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      ) : <span className="badge" style={{ background: pc.bg, color: pc.fg }}>{a.status}</span>}
                    </td>
                    {canEdit && <td><button title="Lepas dari project" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => confirm('Hapus penugasan ini?') && call(`/ta-penugasan/${a.id}`, 'DELETE')}><IconClose size={15} color="#ef4444" /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {canEdit && (
          <div style={{ marginTop: '0.9rem', padding: '0.9rem', border: '1px dashed #bfdbfe', borderRadius: '8px', background: '#f8fbff' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.6rem' }}>Tugaskan ke Project Berjalan</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <select className="input-field" style={{ margin: 0 }} value={asg.project_id} onChange={(e) => setAsg({ ...asg, project_id: e.target.value })}>
                  <option value="">— Pilih project —</option>
                  {available.map((p) => <option key={p.id} value={p.id}>{p.nama_pekerjaan} ({p.status_project === 'Menang' ? 'Menang' : 'Penawaran/Bidding'})</option>)}
                </select>
              </div>
              <input className="input-field" style={{ margin: 0 }} placeholder="Posisi (mis. Team Leader)" value={asg.posisi} onChange={(e) => setAsg({ ...asg, posisi: e.target.value })} />
              <input type="number" className="input-field" style={{ margin: 0 }} placeholder="Fee (Rp)" value={asg.fee} onChange={(e) => setAsg({ ...asg, fee: e.target.value })} />
              <input type="date" className="input-field" style={{ margin: 0 }} title="Tanggal mulai" value={asg.tanggal_mulai} onChange={(e) => setAsg({ ...asg, tanggal_mulai: e.target.value })} />
              <input type="date" className="input-field" style={{ margin: 0 }} title="Tanggal selesai" value={asg.tanggal_selesai} onChange={(e) => setAsg({ ...asg, tanggal_selesai: e.target.value })} />
              <select className="input-field" style={{ margin: 0 }} value={asg.status} onChange={(e) => setAsg({ ...asg, status: e.target.value })}>{STATUS_PENUGASAN.map((s) => <option key={s}>{s}</option>)}</select>
              <input className="input-field" style={{ margin: 0 }} placeholder="Catatan" value={asg.catatan} onChange={(e) => setAsg({ ...asg, catatan: e.target.value })} />
            </div>
            {err && <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '0.4rem' }}>{err}</div>}
            <div style={{ textAlign: 'right', marginTop: '0.6rem' }}><button className="btn-primary btn-sm" onClick={addAsg}>Tugaskan</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
