'use client';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchWithAuth, formatCurrencySmart, isAdministrasiSelesai, isProjectSelesaiAkhir } from '../../lib/api';
import DetailModal from '../../components/DetailModal';
import SearchableSelect from '../../components/SearchableSelect';
import ClickableText from '../../components/ClickableText';
import { IconTrophy, IconGlobe, IconGov, IconPol, IconCheck, IconClock, IconEye, IconUstek, IconFolder, IconChevronDown, IconChevronRight, IconSearch, IconAlertTriangle, IconUser } from '../../components/Icons';

export default function PekerjaanMenangPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat Halaman Pekerjaan Menang...</div>}>
      <PekerjaanMenangContent />
    </Suspense>
  );
}

function PekerjaanMenangContent() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get('view') || 'worksheet';

  const [projects, setProjects] = useState<any[]>([]);
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTabDivisi, setActiveTabDivisi] = useState<'ALL' | 'Gov' | 'Pol'>('ALL');
  const [filterStatusSubstansi, setFilterStatusSubstansi] = useState<'ALL' | 'ONPROGRESS' | 'SELESAI'>('ALL');
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
  }, []);

  const loadProjects = () => {
    fetchWithAuth('/projects')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const wonProjects = data.filter(
            (p) => p.status_project === 'Menang' || p.jenis_mekanisme === 'PL'
          );
          setProjects(wonProjects);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  const handleUpdate = async (id: number, fields: Record<string, any>) => {
    await fetchWithAuth(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
    loadProjects();
  };

  const handleConfirmFinishProject = async (p: any) => {
    await handleUpdate(p.id, { status_selesai_substansi: true });
    setConfirmTargetProject(null);
  };

  const getLatestStage = (p: any) => {
    if (!p.stages || p.stages.length === 0) return { label: 'Belum set tahapan', color: '#64748b' };
    const activeStage = p.stages.find((s: any) => s.status === 'Ongoing') || p.stages[p.stages.length - 1];
    return {
      label: activeStage.nama_tahapan,
      color: activeStage.status === 'Selesai' ? '#10b981' : '#ea580c'
    };
  };

  const calculateUrgensiDeadline = (p: any) => {
    if (p.status_selesai_substansi) return { label: 'Selesai', color: 'badge-done' };
    if (!p.tanggal_spk_berakhir) return { label: 'Belum Upload SPK', color: 'badge-potential' };

    const today = new Date();
    const endDate = new Date(p.tanggal_spk_berakhir);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `Telat (${Math.abs(diffDays)}d)`, color: 'badge-loss' };
    if (diffDays < 14) return { label: `Urgent (${diffDays}d)`, color: 'badge-potential' };
    return { label: `Aman (${diffDays}d)`, color: 'badge-win' };
  };

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      const matchDivisi = activeTabDivisi === 'ALL' || p.divisi_substansi === activeTabDivisi || p.kategori_project === activeTabDivisi;
      const matchSubstansi = filterStatusSubstansi === 'ALL' || (filterStatusSubstansi === 'SELESAI' ? p.status_selesai_substansi : !p.status_selesai_substansi);
      const matchQuery = !q || (
        (p.nama_pekerjaan || '').toLowerCase().includes(q) ||
        (p.pemberi_kerja || '').toLowerCase().includes(q) ||
        (p.satuan_kerja || '').toLowerCase().includes(q) ||
        (p.lokasi || '').toLowerCase().includes(q) ||
        (p.pic_substansi || '').toLowerCase().includes(q)
      );
      return matchDivisi && matchSubstansi && matchQuery;
    });
  }, [projects, activeTabDivisi, filterStatusSubstansi, searchQuery]);

  const groupedByStatusSubstansi = useMemo(() => {
    const onprogress = filteredProjects.filter((p) => !p.status_selesai_substansi);
    const selesai = filteredProjects.filter((p) => p.status_selesai_substansi === true);

    const result: Record<string, any[]> = {};
    if (filterStatusSubstansi === 'ONPROGRESS') {
      if (onprogress.length > 0) result['Onprogress Substansi'] = onprogress;
    } else if (filterStatusSubstansi === 'SELESAI') {
      if (selesai.length > 0) result['Selesai Substansi'] = selesai;
    } else {
      if (onprogress.length > 0) result['Onprogress Substansi'] = onprogress;
      if (selesai.length > 0) result['Selesai Substansi'] = selesai;
    }
    return result;
  }, [filteredProjects, filterStatusSubstansi]);

  const totalNilaiMenang = filteredProjects.reduce((acc, curr) => acc + (curr.nilai_kontrak || 0), 0);
  const totalGovCount = projects.filter((p) => p.divisi_substansi === 'Gov' || p.kategori_project === 'Gov').length;
  const totalPolCount = projects.filter((p) => p.divisi_substansi === 'Pol' || p.kategori_project === 'Pol').length;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <IconTrophy size={26} color="#10b981" />
          <div>
            <h1 className="page-title">Pekerjaan Menang (Gov & Pol)</h1>
            <p className="page-desc">Monitoring pelaksanaan project per divisi dengan tahapan unik per project.</p>
          </div>
        </div>
      </div>

      {/* SUB-MENU OVERVIEW VIEW */}
      {currentView === 'overview' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="stat-card finance">
              <span className="stat-label">Total Pekerjaan Menang</span>
              <span className="stat-value">{projects.length} Project</span>
              <span className="stat-sub">Bidding Menang & PL</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Nilai Kontrak Terdaftar</span>
              <span className="stat-value">{formatCurrencySmart(totalNilaiMenang)}</span>
              <span className="stat-sub">Full: Rp {totalNilaiMenang.toLocaleString('id-ID')}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Divisi Government (Gov)</span>
              <span className="stat-value" style={{ color: '#0284c7' }}>{totalGovCount} Project</span>
              <span className="stat-sub">Proyek Instansi Pemerintah</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Divisi Political (Pol)</span>
              <span className="stat-value" style={{ color: '#8b5cf6' }}>{totalPolCount} Project</span>
              <span className="stat-sub">Proyek Politik / Lembaga</span>
            </div>
          </div>
        </div>
      ) : (
        /* LEMBAR KERJA PEKERJAAN MENANG VIEW */
        <>
          {/* FILTER TABS DIVISI (Gov vs Pol) */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button
              className={`btn-primary ${activeTabDivisi === 'ALL' ? '' : 'btn-secondary'}`}
              onClick={() => setActiveTabDivisi('ALL')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconGlobe size={15} /> Semua Divisi ({projects.length})
            </button>
            <button
              className={`btn-primary ${activeTabDivisi === 'Gov' ? '' : 'btn-secondary'}`}
              onClick={() => setActiveTabDivisi('Gov')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconGov size={15} /> Government (Gov) ({projects.filter((p) => p.divisi_substansi === 'Gov' || p.kategori_project === 'Gov').length})
            </button>
            <button
              className={`btn-primary ${activeTabDivisi === 'Pol' ? '' : 'btn-secondary'}`}
              onClick={() => setActiveTabDivisi('Pol')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconPol size={15} /> Political (Pol) ({projects.filter((p) => p.divisi_substansi === 'Pol' || p.kategori_project === 'Pol').length})
            </button>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Lembar Kerja Pekerjaan Menang</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Daftar seluruh proyek menang dan PL yang sedang berjalan atau selesai.</p>
              </div>

              <div style={{ position: 'relative', minWidth: '300px', flex: 1, maxWidth: '420px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="🔍 Cari nama pekerjaan, pemberi kerja, PIC..."
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
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data pekerjaan menang...</div>
            ) : (
              Object.keys(groupedByStatusSubstansi).map((groupTitle) => {
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
                          {groupedByStatusSubstansi[groupTitle].length} Record
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
                              <th>Mekanisme</th>
                              <th>Nilai (Rp)</th>
                              <th>Lokasi</th>
                              <th>PIC Substansi</th>
                              <th>Tahapan Saat Ini</th>
                              <th>Deadline SPK</th>
                              <th>Status Substansi</th>
                              <th style={{ textAlign: 'right' }}>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedByStatusSubstansi[groupTitle].length === 0 ? (
                              <tr>
                                <td colSpan={11} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                                  Tidak ada data di kelompok ini.
                                </td>
                              </tr>
                            ) : (
                              groupedByStatusSubstansi[groupTitle].map((p, idx) => {
                                const latestStage = getLatestStage(p);
                                const urgensi = calculateUrgensiDeadline(p);

                                return (
                                  <tr key={p.id}>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-dim)' }}>{idx + 1}</td>
                                    <td style={{ fontWeight: 600 }}>
                                      <ClickableText text={p.nama_pekerjaan} />
                                    </td>
                                    <td>
                                      <div style={{ fontSize: '0.85rem' }}><ClickableText text={p.pemberi_kerja || '-'} /></div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}><ClickableText text={p.satuan_kerja || '-'} /></div>
                                    </td>
                                    <td>
                                      <span className={`badge ${p.jenis_mekanisme === 'PL' ? 'badge-gov' : 'badge-win'}`}>
                                        {p.jenis_mekanisme || 'Bidding'}
                                      </span>
                                    </td>
                                    <td style={{ color: '#34d399', fontWeight: 700 }}>
                                      Rp {(p.nilai_kontrak || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td>{p.lokasi || 'Pusat'}</td>
                                    <td>
                                      <SearchableSelect
                                        compact
                                        style={{ margin: 0, width: '120px' }}
                                        value={p.pic_substansi || ''}
                                        onChange={(val) => handleUpdate(p.id, { pic_substansi: val })}
                                        options={userOptions}
                                        placeholder="Pilih PIC"
                                      />
                                    </td>
                                    <td>
                                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: latestStage.color }}>
                                        {latestStage.label}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={`badge ${urgensi.color}`} style={{ fontSize: '0.75rem' }}>
                                        {urgensi.label}
                                      </span>
                                    </td>
                                    <td>
                                      {p.status_selesai_substansi ? (
                                        <span className="badge badge-done" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
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

      {/* CONFIRMATION MODAL BEFORE MARKING PROJECT FINISHED */}
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
                Konfirmasi Selesai Project
              </h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Apakah Anda yakin bahwa seluruh pekerjaan & tahapan untuk <strong>"{confirmTargetProject.nama_pekerjaan}"</strong> telah <strong>SELESAI</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn-primary btn-secondary" onClick={() => setConfirmTargetProject(null)}>
                Batal
              </button>
              <button className="btn-primary btn-success" onClick={() => handleConfirmFinishProject(confirmTargetProject)}>
                Ya, Tandai Project Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      <DetailModal project={selectedProject} onClose={() => setSelectedProject(null)} onRefresh={loadProjects} />
    </div>
  );
}
