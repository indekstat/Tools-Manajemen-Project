'use client';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchWithAuth } from '../../lib/api';
import DetailModal from '../../components/DetailModal';
import SearchableSelect from '../../components/SearchableSelect';
import ClickableText from '../../components/ClickableText';
import { IconUstek, IconCheck, IconClock, IconEye, IconGlobe, IconFolder, IconChevronDown, IconChevronRight, IconSearch, IconAlertTriangle, IconUser, IconTarget } from '../../components/Icons';

export default function UstekPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat Halaman Ustek...</div>}>
      <UstekContent />
    </Suspense>
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

  const handleUpdateUstek = async (id: number, fields: Record<string, any>) => {
    await fetchWithAuth(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
    loadProjects();
  };

  const handleMarkUstekFinished = async (p: any) => {
    // Call submit ustek review API or update project
    await fetchWithAuth(`/projects/${p.id}/submit-ustek-review`, {
      method: 'POST',
    });
    setConfirmTargetProject(null);
    loadProjects();
  };

  const handleApproveUstek = async (id: number) => {
    await fetchWithAuth(`/projects/${id}/approve-ustek`, {
      method: 'POST',
    });
    loadProjects();
  };

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      const matchStatus = filterStatusUstek === 'ALL' || (filterStatusUstek === 'SELESAI' ? p.status_selesai_substansi : !p.status_selesai_substansi);
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

  const groupedByStatusUstek = useMemo(() => {
    const onprogress = filteredProjects.filter((p) => !p.status_selesai_substansi);
    const selesai = filteredProjects.filter((p) => p.status_selesai_substansi === true);
    
    if (filterStatusUstek === 'ONPROGRESS') return { 'Onprogress Ustek': onprogress };
    if (filterStatusUstek === 'SELESAI') return { 'Selesai Ustek': selesai };
    
    const result: Record<string, any[]> = {};
    if (onprogress.length > 0) result['Onprogress Ustek'] = onprogress;
    if (selesai.length > 0) result['Selesai Ustek'] = selesai;
    return result;
  }, [filteredProjects, filterStatusUstek]);

  const canApproveUstek = ['Superadmin', 'Gov'].includes(userRole);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <IconUstek size={28} color="#0284c7" />
          <div>
            <h1 className="page-title">Kontrol Penawaran (Ustek)</h1>
            <p className="page-desc">Monitoring & Penilaian Usulan Teknis (Ustek) untuk pekerjaan Bidding.</p>
          </div>
        </div>
      </div>

      {/* SUB-MENU OVERVIEW VIEW */}
      {currentView === 'overview' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="stat-card">
              <span className="stat-label">Total Pekerjaan Ustek</span>
              <span className="stat-value">{projects.length}</span>
              <span className="stat-sub">Penyusunan & Upload Ustek</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Onprogress Ustek</span>
              <span className="stat-value" style={{ color: '#f59e0b' }}>
                {projects.filter((p) => !p.status_selesai_substansi).length}
              </span>
              <span className="stat-sub">Sedang disusun</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Sedang Menunggu Review</span>
              <span className="stat-value" style={{ color: '#0284c7' }}>
                {projects.filter((p) => p.status_ustek_review === 'On Review').length}
              </span>
              <span className="stat-sub">Pending Approval Head/Gov</span>
            </div>
            <div className="stat-card finance">
              <span className="stat-label">Ustek Disetujui (Approved)</span>
              <span className="stat-value" style={{ color: '#10b981' }}>
                {projects.filter((p) => p.status_ustek_review === 'Approved' || p.status_selesai_substansi).length}
              </span>
              <span className="stat-sub">Siap Upload</span>
            </div>
          </div>
        </div>
      ) : (
        /* LEMBAR KERJA USTET VIEW */
        <>
          {/* FILTER BUTTONS (Status Ustek Grouping) */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <button
              className={`btn-primary ${filterStatusUstek === 'ALL' ? '' : 'btn-secondary'}`}
              onClick={() => setFilterStatusUstek('ALL')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconGlobe size={15} /> Semua Ustek ({projects.length})
            </button>
            <button
              className={`btn-primary ${filterStatusUstek === 'ONPROGRESS' ? '' : 'btn-secondary'}`}
              onClick={() => setFilterStatusUstek('ONPROGRESS')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconClock size={15} /> Onprogress Ustek ({projects.filter((p) => !p.status_selesai_substansi).length})
            </button>
            <button
              className={`btn-primary ${filterStatusUstek === 'SELESAI' ? '' : 'btn-secondary'}`}
              onClick={() => setFilterStatusUstek('SELESAI')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconCheck size={15} /> Selesai Ustek ({projects.filter((p) => p.status_selesai_substansi).length})
            </button>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Lembar Kerja Ustek</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Menampilkan pekerjaan bidding yang sedang dalam tahap penyusunan atau upload Ustek.</p>
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
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data ustek...</div>
            ) : (
              Object.keys(groupedByStatusUstek).map((groupTitle) => {
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
                          {groupedByStatusUstek[groupTitle].length} Record
                        </span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {isCollapsed ? 'Klik untuk membuka' : 'Klik untuk menutup'}
                      </span>
                    </div>

                    {!isCollapsed && (
                      <div className="table-container">
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                              <th>Nama Pekerjaan</th>
                              <th>Pemberi Kerja / Satker</th>
                              <th>Nilai (Rp)</th>
                              <th>Lokasi</th>
                              <th>Kategori</th>
                              <th>Link Ustek</th>
                              <th>PIC Ustek</th>
                              <th>Deadline Ustek</th>
                              <th>Status Review</th>
                              <th>Status Selesai</th>
                              <th style={{ textAlign: 'right' }}>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedByStatusUstek[groupTitle].length === 0 ? (
                              <tr>
                                <td colSpan={12} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                                  Tidak ada pekerjaan di kelompok ini.
                                </td>
                              </tr>
                            ) : (
                              groupedByStatusUstek[groupTitle].map((p, idx) => (
                                <tr key={p.id}>
                                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-dim)' }}>{idx + 1}</td>
                                  <td style={{ fontWeight: 600 }}>
                                    <ClickableText text={p.nama_pekerjaan} />
                                  </td>
                                  <td>
                                    <div style={{ fontSize: '0.85rem' }}><ClickableText text={p.pemberi_kerja || '-'} /></div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}><ClickableText text={p.satuan_kerja || '-'} /></div>
                                  </td>
                                  <td style={{ color: '#34d399', fontWeight: 700 }}>
                                    Rp {(p.nilai_kontrak || 0).toLocaleString('id-ID')}
                                  </td>
                                  <td>{p.lokasi || 'Pusat'}</td>
                                  <td>
                                    <span className={`badge ${p.divisi_substansi === 'Gov' || p.kategori_project === 'Gov' ? 'badge-gov' : 'badge-pol'}`}>
                                      {p.divisi_substansi || p.kategori_project || 'Gov'}
                                    </span>
                                  </td>
                                  <td>
                                      {p.url_ustek ? (
                                        <ClickableText text={p.url_ustek} buttonLabel="Buka Ustek" />
                                      ) : (
                                      <input
                                        className="input-field"
                                        style={{ margin: 0, padding: '0.35rem 0.5rem', width: '130px' }}
                                        placeholder="https://drive..."
                                        defaultValue={p.url_ustek || ''}
                                        onBlur={(e) => handleUpdateUstek(p.id, { url_ustek: e.target.value })}
                                      />
                                    )}
                                  </td>
                                  <td>
                                    <SearchableSelect
                                      compact
                                      style={{ margin: 0, width: '120px' }}
                                      value={p.pic_ustek || ''}
                                      onChange={(val) => handleUpdateUstek(p.id, { pic_ustek: val })}
                                      options={userOptions}
                                      placeholder="Pilih PIC"
                                    />
                                  </td>
                                  <td>
                                    <input
                                      className="input-field"
                                      type="date"
                                      style={{ margin: 0, padding: '0.25rem 0.4rem', width: '135px' }}
                                      defaultValue={p.deadline_penulisan_ustek || ''}
                                      onBlur={(e) => handleUpdateUstek(p.id, { deadline_penulisan_ustek: e.target.value || null })}
                                    />
                                  </td>
                                  <td>
                                    {p.status_ustek_review === 'On Review' ? (
                                      <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem' }}>
                                        🟡 On Review
                                      </span>
                                    ) : p.status_ustek_review === 'Approved' ? (
                                      <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.75rem' }}>
                                        🟢 Approved
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>-</span>
                                    )}
                                  </td>
                                  <td>
                                    {p.status_selesai_substansi ? (
                                      <span
                                        className="badge badge-done"
                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                      >
                                        <IconCheck size={14} /> Selesai
                                      </span>
                                    ) : (
                                      <button
                                        className="btn-primary btn-sm btn-success"
                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                        onClick={() => setConfirmTargetProject(p)}
                                      >
                                        <IconClock size={14} /> Tandai Selesai
                                      </button>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                                      {p.status_ustek_review === 'On Review' && canApproveUstek && (
                                        <button
                                          className="btn-primary btn-sm"
                                          style={{ background: '#10b981', padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                          onClick={() => handleApproveUstek(p.id)}
                                        >
                                          ✓ Approve
                                        </button>
                                      )}
                                      <button
                                        className="btn-primary btn-sm btn-secondary"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                        onClick={() => setSelectedProject(p)}
                                      >
                                        <IconEye size={14} /> Detail
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
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

      {/* CONFIRMATION MODAL BEFORE MARKING USTET FINISHED */}
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
                Konfirmasi Penyelesaian Ustek
              </h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Apakah Anda yakin penyusunan Ustek untuk pekerjaan <strong>"{confirmTargetProject.nama_pekerjaan}"</strong> telah selesai? Status Ustek akan diubah menjadi <strong>On Review</strong> dan memerlukan persetujuan Head.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn-primary btn-secondary" onClick={() => setConfirmTargetProject(null)}>
                Batal
              </button>
              <button className="btn-primary btn-success" onClick={() => handleMarkUstekFinished(confirmTargetProject)}>
                Ya, Tandai Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      <DetailModal project={selectedProject} onClose={() => setSelectedProject(null)} onRefresh={loadProjects} />
    </div>
  );
}
