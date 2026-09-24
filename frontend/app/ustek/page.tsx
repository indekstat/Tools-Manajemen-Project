'use client';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '../../lib/api';
import DetailModal from '../../components/DetailModal';
import SearchableSelect from '../../components/SearchableSelect';
import ClickableText from '../../components/ClickableText';
import { IconUstek, IconCheck, IconClock, IconEye, IconGlobe, IconFolder, IconChevronDown, IconChevronRight, IconSearch, IconAlertTriangle, IconUser, IconTarget, IconFinance } from '../../components/Icons';

export default function UstekPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat Halaman Penawaran...</div>}>
      <UstekContent />
    </Suspense>
  );
}

// Helper to check if overall Penawaran (all 3 aspects: Ustek, RAB, TA) is Selesai
function isPenawaranSelesai(p: any) {
  const ustekDone = p.status_ustek === 'Selesai' || p.status_penulisan_ustek === 'Selesai';
  const rabDone = p.status_rab === 'Selesai';
  const taDone = p.status_ta === 'Selesai';
  return ustekDone && rabDone && taDone;
}

// Count how many of the 3 aspects are completed
function getAspectsDoneCount(p: any) {
  let count = 0;
  if (p.status_ustek === 'Selesai' || p.status_penulisan_ustek === 'Selesai') count++;
  if (p.status_rab === 'Selesai') count++;
  if (p.status_ta === 'Selesai') count++;
  return count;
}

// Status select badge component for Ustek, RAB, TA
function StatusBadgeSelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const currentVal = value || 'Belum';
  let bg = '#f1f5f9';
  let color = '#64748b';
  let border = '1px solid #cbd5e1';

  if (currentVal === 'Selesai') {
    bg = '#dcfce7';
    color = '#15803d';
    border = '1px solid #86efac';
  } else if (currentVal === 'On Progress') {
    bg = '#fef3c7';
    color = '#b45309';
    border = '1px solid #fde68a';
  }

  return (
    <select
      value={currentVal}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '0.25rem 0.4rem',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 650,
        background: bg,
        color: color,
        border: border,
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      <option value="Belum" style={{ background: '#fff', color: '#334155' }}>Belum</option>
      <option value="On Progress" style={{ background: '#fff', color: '#334155' }}>On Progress</option>
      <option value="Selesai" style={{ background: '#fff', color: '#334155' }}>Selesai</option>
    </select>
  );
}

// Interactive Link Cell Component
function LinkCell({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (val: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');

  useEffect(() => {
    setVal(value || '');
  }, [value]);

  if (editing) {
    return (
      <input
        autoFocus
        className="input-field"
        style={{ margin: 0, padding: '0.25rem 0.4rem', width: '130px', fontSize: '0.75rem' }}
        placeholder={placeholder}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onSave(val);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setEditing(false);
            onSave(val);
          }
        }}
      />
    );
  }

  if (val) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <ClickableText text={val} buttonLabel="Link" />
        <button
          onClick={() => setEditing(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.7rem' }}
          title="Edit Link"
        >
          ✏️
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      style={{
        background: 'rgba(241, 245, 249, 0.7)',
        border: '1px dashed #cbd5e1',
        borderRadius: '6px',
        padding: '0.2rem 0.4rem',
        fontSize: '0.725rem',
        color: '#64748b',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left'
      }}
    >
      + Edit Link
    </button>
  );
}

function UstekContent() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get('view') || 'worksheet';

  const [projects, setProjects] = useState<any[]>([]);
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [filterStatusUstek, setFilterStatusUstek] = useState<'ALL' | 'ONPROGRESS' | 'SELESAI'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Confirmation Modal State
  const [confirmTargetProject, setConfirmTargetProject] = useState<any | null>(null);

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    loadProjects();
    loadUsers();
    fetchUserRole();
  }, []);

  const fetchUserRole = () => {
    fetchWithAuth('/users/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.role) setUserRole(data.role);
      })
      .catch(() => {});
  };

  const loadProjects = () => {
    fetchWithAuth('/projects')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Filter pekerjaan yang masuk tahapan Ustek DAN status bidding Ongoing
          const ustekProjects = data.filter((p) => 
            (p.status_project === 'Ongoing' || !p.status_project) &&
            (p.tahapan === 'Penyusunan Ustek' || p.tahapan === 'Upload Ustek')
          );
          setProjects(ustekProjects);
        }
        setLoading(false);
      });
  };

  const loadUsers = () => {
    fetchWithAuth('/users')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setInternalUsers(data);
      });
  };

  const userOptions = useMemo(() => {
    return internalUsers.map((u) => u.nama || u.username);
  }, [internalUsers]);

  const handleUpdatePenawaran = async (id: number, fields: Record<string, any>) => {
    await fetchWithAuth(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
    loadProjects();
  };

  const handleMarkUstekFinished = async (p: any) => {
    // Submit review or mark all 3 aspects finished
    await fetchWithAuth(`/projects/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status_ustek: 'Selesai',
        status_rab: 'Selesai',
        status_ta: 'Selesai',
        status_selesai_substansi: true
      }),
    });
    setConfirmTargetProject(null);
    loadProjects();
  };

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      const isSelesai = isPenawaranSelesai(p);
      const matchStatus = filterStatusUstek === 'ALL' || (filterStatusUstek === 'SELESAI' ? isSelesai : !isSelesai);
      const matchQuery = !q || (
        (p.nama_pekerjaan || '').toLowerCase().includes(q) ||
        (p.pemberi_kerja || '').toLowerCase().includes(q) ||
        (p.satuan_kerja || '').toLowerCase().includes(q) ||
        (p.pic_ustek || '').toLowerCase().includes(q) ||
        (p.lokasi || '').toLowerCase().includes(q)
      );
      return matchStatus && matchQuery;
    });
  }, [projects, filterStatusUstek, searchQuery]);

  const groupedByStatusPenawaran = useMemo(() => {
    const onprogress = filteredProjects.filter((p) => !isPenawaranSelesai(p));
    const selesai = filteredProjects.filter((p) => isPenawaranSelesai(p));
    
    if (filterStatusUstek === 'ONPROGRESS') return { 'Onprogress Penawaran': onprogress };
    if (filterStatusUstek === 'SELESAI') return { 'Selesai Penawaran': selesai };
    
    const result: Record<string, any[]> = {};
    if (onprogress.length > 0) result['Onprogress Penawaran'] = onprogress;
    if (selesai.length > 0) result['Selesai Penawaran'] = selesai;
    return result;
  }, [filteredProjects, filterStatusUstek]);

  // Overview calculated statistics
  const totalCount = projects.length;
  const selesaiCount = useMemo(() => projects.filter(isPenawaranSelesai).length, [projects]);
  const onprogressCount = totalCount - selesaiCount;
  const completionRate = totalCount > 0 ? Math.round((selesaiCount / totalCount) * 100) : 0;

  // Breakdown for each aspect
  const ustekStats = useMemo(() => {
    const selesai = projects.filter((p) => p.status_ustek === 'Selesai' || p.status_penulisan_ustek === 'Selesai').length;
    const onProgress = projects.filter((p) => p.status_ustek === 'On Progress' || p.status_penulisan_ustek === 'Sedang Disusun').length;
    const belum = totalCount - selesai - onProgress;
    return { selesai, onProgress, belum: Math.max(0, belum) };
  }, [projects, totalCount]);

  const rabStats = useMemo(() => {
    const selesai = projects.filter((p) => p.status_rab === 'Selesai').length;
    const onProgress = projects.filter((p) => p.status_rab === 'On Progress').length;
    const belum = totalCount - selesai - onProgress;
    return { selesai, onProgress, belum: Math.max(0, belum) };
  }, [projects, totalCount]);

  const taStats = useMemo(() => {
    const selesai = projects.filter((p) => p.status_ta === 'Selesai').length;
    const onProgress = projects.filter((p) => p.status_ta === 'On Progress').length;
    const belum = totalCount - selesai - onProgress;
    return { selesai, onProgress, belum: Math.max(0, belum) };
  }, [projects, totalCount]);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <IconUstek size={28} color="#0284c7" />
          <div>
            <h1 className="page-title">Kontrol Penawaran</h1>
            <p className="page-desc">Monitoring & Pengelolaan Penawaran (Ustek, RAB, TA) untuk pekerjaan Bidding.</p>
          </div>
        </div>
      </div>

      {/* SUB-MENU OVERVIEW VIEW */}
      {currentView === 'overview' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* STATS GRID */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="stat-card">
              <span className="stat-label">Total Pekerjaan Penawaran</span>
              <span className="stat-value">{totalCount}</span>
              <span className="stat-sub">Tahap Ustek & Bidding</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Penawaran Selesai (3/3 Aspect)</span>
              <span className="stat-value" style={{ color: '#10b981' }}>
                {selesaiCount}
              </span>
              <span className="stat-sub">Ustek, RAB, & TA Lengkap</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Penawaran On Progress</span>
              <span className="stat-value" style={{ color: '#f59e0b' }}>
                {onprogressCount}
              </span>
              <span className="stat-sub">Dalam proses kelengkapan</span>
            </div>
            <div className="stat-card finance">
              <span className="stat-label">Tingkat Penyelesaian</span>
              <span className="stat-value" style={{ color: '#0284c7' }}>
                {completionRate}%
              </span>
              <span className="stat-sub">Rata-rata kesiapan dokumen</span>
            </div>
          </div>

          {/* 3 ASPECTS BREAKDOWN SECTION */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {/* Ustek Card */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <IconUstek size={20} color="#0284c7" /> Usulan Teknis (Ustek)
                </span>
                <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                  {ustekStats.selesai}/{totalCount} Selesai
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🟢 Selesai:</span> <strong>{ustekStats.selesai} Pekerjaan</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🟡 On Progress:</span> <strong>{ustekStats.onProgress} Pekerjaan</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>⚪ Belum:</span> <strong>{ustekStats.belum} Pekerjaan</strong>
                </div>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '8px', width: '100%', marginTop: '1rem', overflow: 'hidden' }}>
                <div style={{ background: '#0284c7', height: '100%', width: `${totalCount > 0 ? (ustekStats.selesai / totalCount) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
              </div>
            </div>

            {/* RAB Card */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <IconFinance size={20} color="#10b981" /> Rencana Anggaran (RAB)
                </span>
                <span className="badge" style={{ background: '#dcfce7', color: '#15803d' }}>
                  {rabStats.selesai}/{totalCount} Selesai
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🟢 Selesai:</span> <strong>{rabStats.selesai} Pekerjaan</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🟡 On Progress:</span> <strong>{rabStats.onProgress} Pekerjaan</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>⚪ Belum:</span> <strong>{rabStats.belum} Pekerjaan</strong>
                </div>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '8px', width: '100%', marginTop: '1rem', overflow: 'hidden' }}>
                <div style={{ background: '#10b981', height: '100%', width: `${totalCount > 0 ? (rabStats.selesai / totalCount) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
              </div>
            </div>

            {/* TA Card */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <IconUser size={20} color="#8b5cf6" /> Tenaga Ahli (TA)
                </span>
                <span className="badge" style={{ background: '#f3e8ff', color: '#6b21a8' }}>
                  {taStats.selesai}/{totalCount} Selesai
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🟢 Selesai:</span> <strong>{taStats.selesai} Pekerjaan</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🟡 On Progress:</span> <strong>{taStats.onProgress} Pekerjaan</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>⚪ Belum:</span> <strong>{taStats.belum} Pekerjaan</strong>
                </div>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '8px', width: '100%', marginTop: '1rem', overflow: 'hidden' }}>
                <div style={{ background: '#8b5cf6', height: '100%', width: `${totalCount > 0 ? (taStats.selesai / totalCount) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
              </div>
            </div>
          </div>

          {/* OVERVIEW MATRIX TABLE */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Matriks Status Penawaran Pekerjaan</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                    <th>Nama Pekerjaan</th>
                    <th>Pemberi Kerja</th>
                    <th>Nilai Kontrak</th>
                    <th>Status Ustek</th>
                    <th>Status RAB</th>
                    <th>Status TA</th>
                    <th>Status Selesai Penawaran</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>Tidak ada data pekerjaan.</td>
                    </tr>
                  ) : (
                    projects.map((p, idx) => {
                      const isDone = isPenawaranSelesai(p);
                      const countDone = getAspectsDoneCount(p);
                      return (
                        <tr key={p.id}>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}><ClickableText text={p.nama_pekerjaan} /></td>
                          <td><ClickableText text={p.pemberi_kerja || '-'} /></td>
                          <td style={{ color: '#34d399', fontWeight: 700 }}>
                            Rp {(p.nilai_kontrak || 0).toLocaleString('id-ID')}
                          </td>
                          <td>
                            <span className={`badge ${p.status_ustek === 'Selesai' || p.status_penulisan_ustek === 'Selesai' ? 'badge-done' : p.status_ustek === 'On Progress' ? 'badge-pending' : ''}`}>
                              {p.status_ustek || p.status_penulisan_ustek || 'Belum'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${p.status_rab === 'Selesai' ? 'badge-done' : p.status_rab === 'On Progress' ? 'badge-pending' : ''}`}>
                              {p.status_rab || 'Belum'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${p.status_ta === 'Selesai' ? 'badge-done' : p.status_ta === 'On Progress' ? 'badge-pending' : ''}`}>
                              {p.status_ta || 'Belum'}
                            </span>
                          </td>
                          <td>
                            {isDone ? (
                              <span className="badge badge-done" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                <IconCheck size={14} /> Selesai (3/3)
                              </span>
                            ) : (
                              <span className="badge badge-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                <IconClock size={14} /> On Progress ({countDone}/3)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* LEMBAR KERJA PENAWARAN VIEW */
        <>
          {/* FILTER BUTTONS (Status Penawaran Grouping) */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button
              className={`btn-primary ${filterStatusUstek === 'ALL' ? '' : 'btn-secondary'}`}
              onClick={() => setFilterStatusUstek('ALL')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconGlobe size={15} /> Semua Penawaran ({projects.length})
            </button>
            <button
              className={`btn-primary ${filterStatusUstek === 'ONPROGRESS' ? '' : 'btn-secondary'}`}
              onClick={() => setFilterStatusUstek('ONPROGRESS')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconClock size={15} /> Onprogress Penawaran ({projects.filter((p) => !isPenawaranSelesai(p)).length})
            </button>
            <button
              className={`btn-primary ${filterStatusUstek === 'SELESAI' ? '' : 'btn-secondary'}`}
              onClick={() => setFilterStatusUstek('SELESAI')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconCheck size={15} /> Selesai Penawaran ({projects.filter(isPenawaranSelesai).length})
            </button>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Lembar Kerja Penawaran</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Menampilkan dan mengelola status kelengkapan Penawaran (Ustek, RAB, TA) untuk pekerjaan bidding.
                </p>
              </div>

              <div style={{ position: 'relative', minWidth: '300px', flex: 1, maxWidth: '420px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="🔍 Cari nama pekerjaan, PIC, pemberi kerja..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.5rem', width: '100%', margin: 0 }}
                />
                <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}>
                  <IconSearch size={16} />
                </span>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data penawaran...</div>
            ) : (
              Object.keys(groupedByStatusPenawaran).map((groupTitle) => {
                const isCollapsed = Boolean(collapsedGroups[groupTitle]);
                return (
                  <div key={groupTitle} style={{ marginBottom: '1.5rem' }}>
                    <div
                      onClick={() => toggleGroupCollapse(groupTitle)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        padding: '0.6rem 0.85rem',
                        background: 'rgba(255,255,255,0.85)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        marginBottom: '0.75rem',
                        userSelect: 'none',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', color: '#f97316' }}>
                          {isCollapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
                        </span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <IconFolder size={18} color="#f97316" /> {groupTitle}
                        </span>
                        <span className="badge" style={{ background: '#ffedd5', color: '#c2410c' }}>
                          {groupedByStatusPenawaran[groupTitle].length} Record
                        </span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {isCollapsed ? 'Klik untuk membuka' : 'Klik untuk menutup'}
                      </span>
                    </div>

                    {!isCollapsed && (
                      <div className="table-container" style={{ overflowX: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: '35px', textAlign: 'center' }}>No.</th>
                              <th>Nama Pekerjaan</th>
                              <th>Pemberi Kerja</th>
                              <th>Nilai (Rp)</th>
                              <th>PIC Ustek</th>
                              <th>Status Ustek</th>
                              <th>Link RAB</th>
                              <th>Status RAB</th>
                              <th>Link TA</th>
                              <th>Status TA</th>
                              <th>Status Selesai</th>
                              <th style={{ textAlign: 'right' }}>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedByStatusPenawaran[groupTitle].length === 0 ? (
                              <tr>
                                <td colSpan={12} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                                  Tidak ada pekerjaan di kelompok ini.
                                </td>
                              </tr>
                            ) : (
                              groupedByStatusPenawaran[groupTitle].map((p, idx) => {
                                const isDone = isPenawaranSelesai(p);
                                const doneCount = getAspectsDoneCount(p);

                                return (
                                  <tr key={p.id}>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-dim)' }}>{idx + 1}</td>
                                    <td style={{ fontWeight: 600, minWidth: '180px' }}>
                                      <ClickableText text={p.nama_pekerjaan} />
                                    </td>
                                    <td style={{ minWidth: '140px' }}>
                                      <div style={{ fontSize: '0.85rem' }}><ClickableText text={p.pemberi_kerja || '-'} /></div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}><ClickableText text={p.satuan_kerja || '-'} /></div>
                                    </td>
                                    <td style={{ color: '#34d399', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      Rp {(p.nilai_kontrak || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td>
                                      <SearchableSelect
                                        compact
                                        style={{ margin: 0, width: '110px' }}
                                        value={p.pic_ustek || ''}
                                        onChange={(val) => handleUpdatePenawaran(p.id, { pic_ustek: val })}
                                        options={userOptions}
                                        placeholder="PIC Ustek"
                                      />
                                    </td>
                                    <td>
                                      <StatusBadgeSelect
                                        value={p.status_ustek || p.status_penulisan_ustek || 'Belum'}
                                        onChange={(val) => handleUpdatePenawaran(p.id, { status_ustek: val, status_penulisan_ustek: val })}
                                      />
                                    </td>
                                    <td>
                                      <LinkCell
                                        value={p.url_rab || ''}
                                        placeholder="https://drive..."
                                        onSave={(val) => handleUpdatePenawaran(p.id, { url_rab: val })}
                                      />
                                    </td>
                                    <td>
                                      <StatusBadgeSelect
                                        value={p.status_rab || 'Belum'}
                                        onChange={(val) => handleUpdatePenawaran(p.id, { status_rab: val })}
                                      />
                                    </td>
                                    <td>
                                      <LinkCell
                                        value={p.url_ta || ''}
                                        placeholder="https://drive..."
                                        onSave={(val) => handleUpdatePenawaran(p.id, { url_ta: val })}
                                      />
                                    </td>
                                    <td>
                                      <StatusBadgeSelect
                                        value={p.status_ta || 'Belum'}
                                        onChange={(val) => handleUpdatePenawaran(p.id, { status_ta: val })}
                                      />
                                    </td>
                                    <td>
                                      {isDone ? (
                                        <span
                                          className="badge badge-done"
                                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                                        >
                                          <IconCheck size={14} /> Selesai (3/3)
                                        </span>
                                      ) : (
                                        <button
                                          className="btn-primary btn-sm btn-secondary"
                                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
                                          onClick={() => setConfirmTargetProject(p)}
                                          title="Klik untuk tandai semua 3 aspek Selesai"
                                        >
                                          <IconClock size={14} /> On Progress ({doneCount}/3)
                                        </button>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <button
                                        className="btn-primary btn-sm btn-secondary"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                        onClick={() => setSelectedProject(p)}
                                      >
                                        <IconEye size={14} /> Detail
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* CONFIRMATION MODAL BEFORE MARKING ALL ASPECTS FINISHED */}
      {confirmTargetProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div className="glass-card" style={{ maxWidth: '450px', width: '90%', padding: '1.5rem', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#d97706' }}>
              <IconAlertTriangle size={24} color="#d97706" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                Konfirmasi Penyelesaian Penawaran
              </h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin menandai seluruh aspek penawaran (<strong>Ustek, RAB, & TA</strong>) untuk pekerjaan <strong>"{confirmTargetProject.nama_pekerjaan}"</strong> sebagai <strong>Selesai</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn-primary btn-secondary" onClick={() => setConfirmTargetProject(null)}>
                Batal
              </button>
              <button className="btn-primary btn-success" onClick={() => handleMarkUstekFinished(confirmTargetProject)}>
                Ya, Tandai Selesai (3/3)
              </button>
            </div>
          </div>
        </div>
      )}

      <DetailModal project={selectedProject} onClose={() => setSelectedProject(null)} onRefresh={loadProjects} />
    </div>
  );
}
