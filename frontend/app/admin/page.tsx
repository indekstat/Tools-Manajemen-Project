'use client';
import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchWithAuth, hasDokumenLengkap, isProjectSelesaiAkhir, isAdministrasiSelesai, formatCurrencySmart } from '../../lib/api';
import DetailModal from '../../components/DetailModal';
import SearchableSelect from '../../components/SearchableSelect';
import ClickableText from '../../components/ClickableText';
import { IconFinance, IconGlobe, IconUstek, IconClock, IconTrophy, IconEye, IconFolder, IconChevronDown, IconChevronRight, IconCheck, IconSearch, IconUser } from '../../components/Icons';

export default function FinancePage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat Halaman Penagihan...</div>}>
      <FinanceContent />
    </Suspense>
  );
}

function FinanceContent() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get('view') || 'worksheet';

  const [projects, setProjects] = useState<any[]>([]);
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAdminStatus, setFilterAdminStatus] = useState<'ALL' | 'BELUM_DOKUMEN' | 'BELUM_LUNAS' | 'SELESAI'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<'info' | 'stages' | 'billings'>('info');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [editField, setEditField] = useState<{ project: any; field: string; label: string; kind: 'currency' | 'url'; value: string; billing?: any } | null>(null);

  const openEdit = (project: any, field: string, label: string, kind: 'currency' | 'url', billing?: any) => {
    const source = billing || project;
    const current = source[field] ?? (field === 'nilai_project_deal' ? project.nilai_kontrak : '');
    setEditField({ project, field, label, kind, value: current ? String(current) : '', billing });
  };

  const saveEdit = async () => {
    if (!editField) return;
    const { project, field, kind, value, billing } = editField;
    setEditField(null);
    const val = kind === 'currency' ? parseFloat(value) || 0 : value.trim() || null;
    if (billing) {
      setProjects((prev) => prev.map((p) => p.id === project.id
        ? { ...p, billings: p.billings.map((b: any) => (b.id === billing.id ? { ...b, [field]: val } : b)) }
        : p));
      await fetchWithAuth(`/billings/${billing.id}`, { method: 'PUT', body: JSON.stringify({ [field]: val }) });
      return;
    }
    await updateLink(project.id, field, val ?? '');
  };

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

  const updateLink = async (id: number, field: string, value: any) => {
    const val = value === '' ? null : value;
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
    await fetchWithAuth(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ [field]: val }),
    });
  };

  const getAdminCategory = (p: any) => {
    const isAdminDone = isAdministrasiSelesai(p);
    if (isAdminDone) return 'Selesai Administrasi';
    
    if (!hasDokumenLengkap(p)) return 'Belum Dokumen Lengkap (SPK/BAST/Ref)';
    
    return 'Termin Belum Lunas';
  };

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      const category = getAdminCategory(p);
      const matchStatus = 
        filterAdminStatus === 'ALL' ? true :
        filterAdminStatus === 'SELESAI' ? category === 'Selesai Administrasi' :
        filterAdminStatus === 'BELUM_DOKUMEN' ? category === 'Belum Dokumen Lengkap (SPK/BAST/Ref)' :
        filterAdminStatus === 'BELUM_LUNAS' ? category === 'Termin Belum Lunas' : true;

      const matchQuery = !q || (
        (p.nama_pekerjaan || '').toLowerCase().includes(q) ||
        (p.pemberi_kerja || '').toLowerCase().includes(q) ||
        (p.satuan_kerja || '').toLowerCase().includes(q) ||
        (p.lokasi || '').toLowerCase().includes(q) ||
        (p.pic_admin || '').toLowerCase().includes(q)
      );
      return matchStatus && matchQuery;
    });
  }, [projects, filterAdminStatus, searchQuery]);

  const groupedByAdminStatus = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredProjects.forEach((p) => {
      const cat = getAdminCategory(p);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [filteredProjects]);

  const overviewMetrics = useMemo(() => {
    const totalWonValue = projects.reduce((acc, curr) => acc + (curr.nilai_project_deal || curr.nilai_kontrak || 0), 0);
    const totalPaidValue = projects.reduce((acc, curr) => {
      const paid = (curr.billings || [])
        .filter((b: any) => b.status === 'Sudah dibayarkan')
        .reduce((sum: number, b: any) => sum + (b.nominal || 0), 0);
      return acc + paid;
    }, 0);
    const outstandingValue = Math.max(0, totalWonValue - totalPaidValue);
    const completeDocsCount = projects.filter((p) => hasDokumenLengkap(p)).length;
    const completeAdminCount = projects.filter((p) => isAdministrasiSelesai(p)).length;

    return {
      totalWonValue,
      totalPaidValue,
      outstandingValue,
      completeDocsCount,
      completeAdminCount,
    };
  }, [projects]);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <IconFinance size={26} color="#8b5cf6" />
          <div>
            <h1 className="page-title">Kontrol Penagihan (Billing & Finance)</h1>
            <p className="page-desc">Pengelolaan Billing dikhususkan untuk seluruh Pekerjaan Menang & Penunjukan Langsung (PL).</p>
          </div>
        </div>
      </div>

      <div style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1.5rem',
        color: '#1e3a8a',
        fontSize: '0.9rem',
        lineHeight: 1.5
      }}>
        <strong>💡 Panduan Fitur:</strong>
        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
          <li style={{ marginBottom: '0.25rem' }}><strong>Nilai Project Deal:</strong> Silakan edit Nilai Project di kolom tabel jika ada perubahan nilai final setelah negosiasi. Semua kalkulasi termin dan dashboard otomatis akan menggunakan nilai Deal ini (atau Nilai Kontrak jika nilai Deal kosong).</li>
          <li><strong>Edit Dokumen (SPK, BAST, Ref):</strong> Anda sekarang dapat langsung menempel (*paste*) atau mengedit *link* dokumen secara langsung di kotak isian yang ada di tabel, meskipun dokumen sudah pernah di-*upload* sebelumnya.</li>
        </ul>
      </div>

      {/* SUB-MENU OVERVIEW VIEW */}
      {currentView === 'overview' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="stat-card">
              <span className="stat-label">Total Nilai Kontrak Menang</span>
              <span className="stat-value">{formatCurrencySmart(overviewMetrics.totalWonValue)}</span>
              <span className="stat-sub">Rp {overviewMetrics.totalWonValue.toLocaleString('id-ID')}</span>
            </div>
            <div className="stat-card finance">
              <span className="stat-label">Total Realisasi Lunas</span>
              <span className="stat-value" style={{ color: '#10b981' }}>{formatCurrencySmart(overviewMetrics.totalPaidValue)}</span>
              <span className="stat-sub">Sudah Masuk Rekening</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Sisa Tagihan (Outstanding)</span>
              <span className="stat-value" style={{ color: '#ef4444' }}>{formatCurrencySmart(overviewMetrics.outstandingValue)}</span>
              <span className="stat-sub">Belum Ditagih / Dibayar</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Kelengkapan Dokumen Lengkap</span>
              <span className="stat-value" style={{ color: '#8b5cf6' }}>{overviewMetrics.completeDocsCount} / {projects.length}</span>
              <span className="stat-sub">SPK, BAST, & Referensi</span>
            </div>
          </div>
        </div>
      ) : (
        /* LEMBAR KERJA KONTROL PENAGIHAN VIEW */
        <>
          {/* FILTER BUTTONS FOR ADMIN STATUS GROUPING */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button
              className={`btn-primary ${filterAdminStatus === 'ALL' ? '' : 'btn-secondary'}`}
              onClick={() => setFilterAdminStatus('ALL')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconGlobe size={15} /> Semua ({projects.length})
            </button>
            <button
              className={`btn-primary ${filterAdminStatus === 'BELUM_DOKUMEN' ? '' : 'btn-secondary'}`}
              onClick={() => setFilterAdminStatus('BELUM_DOKUMEN')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconClock size={15} /> Belum Dokumen Lengkap
            </button>
            <button
              className={`btn-primary ${filterAdminStatus === 'BELUM_LUNAS' ? '' : 'btn-secondary'}`}
              onClick={() => setFilterAdminStatus('BELUM_LUNAS')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconFinance size={15} /> Termin Belum Lunas
            </button>
            <button
              className={`btn-primary ${filterAdminStatus === 'SELESAI' ? '' : 'btn-secondary'}`}
              onClick={() => setFilterAdminStatus('SELESAI')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <IconTrophy size={15} /> Selesai & Lunas
            </button>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Lembar Kerja Kontrol Penagihan</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lengkapi periode SPK, URL dokumen, dan kelola termin pembayaran</p>
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
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data penagihan...</div>
            ) : (
              Object.keys(groupedByAdminStatus).map((groupTitle) => {
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
                          {groupedByAdminStatus[groupTitle].length} Record
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
                              <th>Nama Lembaga</th>
                              <th>Nilai Awal (Rp)</th>
                              <th>Nilai Deal (Rp)</th>
                              <th>PIC Finance</th>
                              <th>Periode SPK</th>
                              <th>Dokumen SPK</th>
                              {Array.from({ length: Math.max(1, ...groupedByAdminStatus[groupTitle].map((p) => (p.billings || []).length)) }).map((_, i) => (
                                <React.Fragment key={i}>
                                  <th>BAST Termin {i + 1}</th>
                                  <th>Dok. Penagihan Termin {i + 1}</th>
                                </React.Fragment>
                              ))}
                              <th>Dokumen Referensi</th>
                              <th>Pemasukan Yayasan / PT</th>
                              <th>Tgl Uang Masuk</th>
                              <th>Status Admin</th>
                              <th style={{ textAlign: 'right', minWidth: '220px' }}>Detail & Termin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedByAdminStatus[groupTitle].length === 0 ? (
                              <tr>
                                <td colSpan={14} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                                  Tidak ada data di kelompok ini.
                                </td>
                              </tr>
                            ) : (
                              groupedByAdminStatus[groupTitle].map((p, idx) => {
                                const isAdminDone = isAdministrasiSelesai(p);

                                return (
                                  <tr key={p.id}>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-dim)' }}>{idx + 1}</td>
                                    <td style={{ fontWeight: 600 }}>
                                      <ClickableText text={p.nama_pekerjaan} />
                                    </td>
                                    <td><ClickableText text={p.pemberi_kerja || '-'} /></td>
                                    <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                                      Rp {(p.nilai_kontrak || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td style={{ color: '#34d399', fontWeight: 700 }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <span>Rp {(p.nilai_project_deal || 0).toLocaleString('id-ID')}</span>
                                        <button
                                          className="btn-primary btn-sm btn-secondary"
                                          style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                                          onClick={() => openEdit(p, 'nilai_project_deal', 'Nilai Project Deal', 'currency')}
                                        >
                                          ✏️ Edit Nilai Deal
                                        </button>
                                      </div>
                                    </td>
                                    <td>
                                      <SearchableSelect
                                        compact
                                        style={{ margin: 0, width: '120px' }}
                                        value={p.pic_admin || ''}
                                        onChange={(val) => updateLink(p.id, 'pic_admin', val)}
                                        options={userOptions}
                                        placeholder="Pilih PIC"
                                      />
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '135px' }}>
                                        <input
                                          className="input-field"
                                          type="date"
                                          title="Tanggal SPK Mulai"
                                          style={{ margin: 0, padding: '0.2rem 0.35rem', fontSize: '0.75rem' }}
                                          defaultValue={p.tanggal_spk_mulai || ''}
                                          onBlur={(e) => updateLink(p.id, 'tanggal_spk_mulai', e.target.value)}
                                        />
                                        <input
                                          className="input-field"
                                          type="date"
                                          title="Tanggal SPK Berakhir"
                                          style={{ margin: 0, padding: '0.2rem 0.35rem', fontSize: '0.75rem' }}
                                          defaultValue={p.tanggal_spk_berakhir || ''}
                                          onBlur={(e) => updateLink(p.id, 'tanggal_spk_berakhir', e.target.value)}
                                        />
                                      </div>
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        {p.link_spk ? <ClickableText text={p.link_spk} buttonLabel="Buka SPK" /> : <span className="text-dim" style={{fontSize: '0.75rem'}}>Belum Upload</span>}
                                        <button
                                          className="btn-primary btn-sm btn-secondary"
                                          style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                                          onClick={() => openEdit(p, 'link_spk', 'URL SPK', 'url')}
                                        >
                                          ✏️ Edit URL SPK
                                        </button>
                                      </div>
                                    </td>
                                    {Array.from({ length: Math.max(1, ...groupedByAdminStatus[groupTitle].map((x) => (x.billings || []).length)) }).map((_, i) => {
                                      const b = (p.billings || [])[i];
                                      if (!b) {
                                        return (
                                          <React.Fragment key={i}>
                                            <td><span className="text-dim" style={{ fontSize: '0.75rem' }}>{i === 0 ? 'Belum ada termin' : '-'}</span></td>
                                            <td><span className="text-dim" style={{ fontSize: '0.75rem' }}>-</span></td>
                                          </React.Fragment>
                                        );
                                      }
                                      return (
                                        <React.Fragment key={i}>
                                          {([
                                            ['link_bast', `URL BAST ${b.nama}`, 'Buka BAST'],
                                            ['link_dokumen_penagihan', `URL Dokumen Penagihan ${b.nama}`, 'Buka Dokumen'],
                                          ] as const).map(([field, label, btn]) => (
                                            <td key={field}>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                {b[field] ? <ClickableText text={b[field]} buttonLabel={btn} /> : <span className="text-dim" style={{ fontSize: '0.75rem' }}>Belum Upload</span>}
                                                <button
                                                  className="btn-primary btn-sm btn-secondary"
                                                  style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                                                  onClick={() => openEdit(p, field, label, 'url', b)}
                                                >
                                                  ✏️ Edit URL
                                                </button>
                                              </div>
                                            </td>
                                          ))}
                                        </React.Fragment>
                                      );
                                    })}
                                    <td>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        {p.link_referensi ? <ClickableText text={p.link_referensi} buttonLabel="Buka Ref" /> : <span className="text-dim" style={{fontSize: '0.75rem'}}>Belum Upload</span>}
                                        <button
                                          className="btn-primary btn-sm btn-secondary"
                                          style={{ padding: '0.15rem 0.35rem', fontSize: '0.7rem' }}
                                          onClick={() => openEdit(p, 'link_referensi', 'URL Surat Referensi', 'url')}
                                        >
                                          ✏️ Edit URL Ref
                                        </button>
                                      </div>
                                    </td>
                                    <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                      {(() => {
                                        const paid = (p.billings || []).filter((b: any) => b.status === 'Sudah dibayarkan');
                                        const yy = paid.reduce((t: number, b: any) => t + (b.nominal_yayasan || 0), 0);
                                        const pt = paid.reduce((t: number, b: any) => t + (b.nominal_pt || 0), 0);
                                        return (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                            <span style={{ color: '#7c3aed' }}>Yayasan: Rp {yy.toLocaleString('id-ID')}</span>
                                            <span style={{ color: '#0369a1' }}>PT: Rp {pt.toLocaleString('id-ID')}</span>
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td style={{ fontSize: '0.8rem' }}>
                                      {(() => {
                                        const dates = (p.billings || []).map((b: any) => b.tanggal_uang_masuk).filter(Boolean).sort();
                                        return dates.length ? dates[dates.length - 1] : '-';
                                      })()}
                                    </td>
                                    <td>
                                      {isAdminDone ? (
                                        <span className="badge badge-done" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                          <IconCheck size={14} /> Selesai & Lunas
                                        </span>
                                      ) : (
                                        <span className="badge badge-potential" style={{ fontSize: '0.8rem' }}>
                                          Termin Onprogress
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                      <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                                        <button
                                          className="btn-primary btn-sm btn-secondary"
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                          onClick={() => {
                                            setModalInitialTab('info');
                                            setSelectedProject(p);
                                          }}
                                          title="Lihat Detail Informasi Pekerjaan"
                                        >
                                          <IconEye size={14} /> Detail Info
                                        </button>
                                        <button
                                          className="btn-primary btn-sm"
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#8b5cf6', borderColor: '#7c3aed', color: '#fff' }}
                                          onClick={() => {
                                            setModalInitialTab('billings');
                                            setSelectedProject(p);
                                          }}
                                          title="Kelola Termin Penagihan"
                                        >
                                          <IconFinance size={14} color="#fff" /> Termin Penagihan
                                        </button>
                                      </div>
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

      {editField && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => setEditField(null)}>
          <form
            style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', animation: 'modalSlide 0.2s ease' }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); saveEdit(); }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.25rem', color: 'var(--text-main)' }}>Edit {editField.label}</h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>{editField.project.nama_pekerjaan}</p>

            {editField.kind === 'currency' ? (
              <>
                <label className="input-label">Nilai Deal (Rp)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)' }}>Rp</span>
                  <input
                    autoFocus
                    className="input-field"
                    inputMode="numeric"
                    style={{ margin: 0, width: '100%', paddingLeft: '2.5rem', fontWeight: 700, fontSize: '1.1rem', color: '#059669' }}
                    value={editField.value ? Number(editField.value).toLocaleString('id-ID') : ''}
                    onChange={(e) => setEditField({ ...editField, value: e.target.value.replace(/\D/g, '') })}
                    placeholder="0"
                  />
                </div>
                <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Nilai kontrak awal: <strong>Rp {(editField.project.nilai_kontrak || 0).toLocaleString('id-ID')}</strong>
                  {editField.value && Number(editField.value) !== (editField.project.nilai_kontrak || 0) && (
                    <> · Selisih: <strong style={{ color: Number(editField.value) > (editField.project.nilai_kontrak || 0) ? '#059669' : '#dc2626' }}>
                      {Number(editField.value) > (editField.project.nilai_kontrak || 0) ? '+' : '-'}Rp {Math.abs(Number(editField.value) - (editField.project.nilai_kontrak || 0)).toLocaleString('id-ID')}
                    </strong></>
                  )}
                </div>
              </>
            ) : (
              <>
                <label className="input-label">{editField.label}</label>
                <input
                  autoFocus
                  className="input-field"
                  style={{ margin: 0, width: '100%' }}
                  placeholder="https://..."
                  value={editField.value}
                  onChange={(e) => setEditField({ ...editField, value: e.target.value })}
                />
              </>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn-primary btn-secondary" onClick={() => setEditField(null)} style={{ flex: 1, padding: '0.65rem' }}>Batal</button>
              <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.65rem' }}>Simpan</button>
            </div>
          </form>
        </div>
      )}

      <DetailModal 
        project={selectedProject} 
        initialTab={modalInitialTab} 
        onClose={() => setSelectedProject(null)} 
        onRefresh={loadProjects} 
      />
    </div>
  );
}
