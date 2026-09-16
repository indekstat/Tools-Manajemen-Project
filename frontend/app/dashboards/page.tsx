'use client';
import { useEffect, useState, useMemo } from 'react';
import { fetchWithAuth } from '../../lib/api';
import DetailModal from '../../components/DetailModal';
import SearchableSelect from '../../components/SearchableSelect';
import { IconGlobe, IconSearch, IconClose, IconEye, IconUser, IconCheck, IconTrash, IconLink } from '../../components/Icons';

export default function ProjectDashboardsPage() {
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  
  const [search, setSearch] = useState('');
  const [filterDivisi, setFilterDivisi] = useState('ALL');

  // Modal States
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<any | null>(null);

  // Form State
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [urlDashboard, setUrlDashboard] = useState('');
  const [keterangan, setKeterangan] = useState('');

  const canManageSystech = userRole === 'Systech' || userRole === 'Superadmin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, projectsRes, dashboardsRes] = await Promise.all([
        fetchWithAuth('/users/me'),
        fetchWithAuth('/projects'),
        fetchWithAuth('/dashboards')
      ]);

      if (userRes.ok) {
        const userData = await userRes.json();
        setUserRole(userData.role || '');
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        if (Array.isArray(projectsData)) setProjects(projectsData);
      }

      if (dashboardsRes.ok) {
        const dashboardsData = await dashboardsRes.json();
        if (Array.isArray(dashboardsData)) setDashboards(dashboardsData);
      }
    } catch (err) {
      console.error('Failed loading dashboards data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingDashboard(null);
    setSelectedProjectId(projects.length > 0 ? String(projects[0].id) : '');
    setUrlDashboard('');
    setKeterangan('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingDashboard(item);
    setSelectedProjectId(String(item.project_id));
    setUrlDashboard(item.url_dashboard || '');
    setKeterangan(item.keterangan || '');
    setShowAddModal(true);
  };

  const handleSubmitDashboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !urlDashboard) return;

    let formattedUrl = urlDashboard.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    try {
      if (editingDashboard) {
        await fetchWithAuth(`/dashboards/${editingDashboard.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            url_dashboard: formattedUrl,
            keterangan
          })
        });
      } else {
        await fetchWithAuth('/dashboards', {
          method: 'POST',
          body: JSON.stringify({
            project_id: parseInt(selectedProjectId),
            url_dashboard: formattedUrl,
            keterangan
          })
        });
      }

      setShowAddModal(false);
      loadData();
    } catch (err) {
      alert('Gagal menyimpan data dashboard project');
    }
  };

  const handleDeleteDashboard = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus tautan dashboard ini?')) return;
    try {
      await fetchWithAuth(`/dashboards/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert('Gagal menghapus data dashboard');
    }
  };

  // Filtered Dashboards List
  const filteredDashboards = useMemo(() => {
    return dashboards.filter((d) => {
      const proj = d.project || projects.find((p) => p.id === d.project_id);
      if (!proj) return true;

      const matchSearch =
        proj.nama_pekerjaan.toLowerCase().includes(search.toLowerCase()) ||
        (proj.pemberi_kerja || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.keterangan || '').toLowerCase().includes(search.toLowerCase());

      const matchDivisi =
        filterDivisi === 'ALL' ||
        proj.divisi_substansi === filterDivisi ||
        proj.kategori_project === filterDivisi;

      return matchSearch && matchDivisi;
    });
  }, [dashboards, projects, search, filterDivisi]);

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <IconGlobe size={28} color="#06b6d4" /> Daftar Dashboard Project
          </h1>
          <p className="page-desc">
            Katalog tautan dashboard analitik per proyek. Hanya tim <strong>Systech</strong> & <strong>Superadmin</strong> yang dapat menambah & mengelola link dashboard.
          </p>
        </div>

        {canManageSystech && (
          <button
            className="btn-primary"
            onClick={handleOpenAddModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #06b6d4, #0284c7)' }}
          >
            + Tambah Record Dashboard
          </button>
        )}
      </div>

      {/* CONTROLS BAR */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                className="input-field"
                style={{ margin: 0, paddingLeft: '2.5rem', width: '100%' }}
                placeholder="🔍 Cari nama project, pemberi kerja, atau catatan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}>
                <IconSearch size={16} />
              </span>
            </div>
            <SearchableSelect
              style={{ width: '170px', margin: 0 }}
              value={filterDivisi}
              onChange={(val) => setFilterDivisi(val)}
              options={[
                { value: 'ALL', label: 'Semua Divisi' },
                { value: 'Gov', label: 'Gov' },
                { value: 'Pol', label: 'Pol' },
              ]}
            />
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Menampilkan <strong>{filteredDashboards.length}</strong> Dashboard Terdaftar
          </div>

        </div>
      </div>

      {/* DASHBOARDS GRID */}
      {loading ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Memuat daftar dashboard...
        </div>
      ) : filteredDashboards.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <IconGlobe size={40} color="#94a3b8" style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem' }}>Belum ada data dashboard</h3>
          <p style={{ fontSize: '0.85rem' }}>
            {canManageSystech ? 'Klik tombol "+ Tambah Record Dashboard" di atas untuk memasukkan tautan baru.' : 'Belum ada dashboard project yang ditambahkan oleh tim Systech.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {filteredDashboards.map((item) => {
            const proj = item.project || projects.find((p) => p.id === item.project_id) || {};
            const isGov = (proj.divisi_substansi || proj.kategori_project) === 'Gov';

            return (
              <div
                key={item.id}
                className="glass-card hover-card"
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.25rem', border: '1px solid var(--card-border)' }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span className={`badge ${isGov ? 'badge-gov' : 'badge-pol'}`}>
                      {proj.divisi_substansi || proj.kategori_project || 'Gov'}
                    </span>
                    <span className="badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                      {proj.jenis_mekanisme || 'Bidding'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.4, marginBottom: '0.5rem' }}>
                    {proj.nama_pekerjaan || `Project ID #${item.project_id}`}
                  </h3>

                    <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                      <div>Pemberi Kerja: <strong style={{ color: 'var(--text-main)' }}>{proj.pemberi_kerja || '-'}</strong></div>
                      {item.keterangan && (
                        <div style={{ marginTop: '4px', fontStyle: 'italic', background: '#f8fafc', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          Catatan: {item.keterangan}
                        </div>
                      )}
                    </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button
                    className="btn-primary btn-sm btn-secondary"
                    onClick={() => setSelectedProjectForDetail(proj)}
                    style={{ fontSize: '0.775rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <IconEye size={13} /> Info Project
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {canManageSystech && (
                      <>
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          style={{ border: 'none', background: '#f1f5f9', padding: '0.35rem 0.65rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                          title="Edit URL Dashboard"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDashboard(item.id)}
                          style={{ border: 'none', background: '#fee2e2', color: '#dc2626', padding: '0.35rem 0.65rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}
                          title="Hapus Record"
                        >
                          <IconTrash size={13} />
                        </button>
                      </>
                    )}
                    <a
                      href={item.url_dashboard}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
                        textDecoration: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 700
                      }}
                    >
                      <IconLink size={14} /> Buka Dashboard
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FORM MODAL SYSTECH: TAMBAH / EDIT DASHBOARD */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {editingDashboard ? '✏️ Edit Dashboard Project' : '🚀 Tambah Record Dashboard Project'}
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Form khusus tim Systech untuk memasukkan tautan dashboard analitik.
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>
                <IconClose size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitDashboard} style={{ marginTop: '1rem' }}>
              <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label">Pilih Project Pekerjaan *</label>
                <SearchableSelect
                  value={selectedProjectId}
                  onChange={(val) => setSelectedProjectId(val)}
                  disabled={Boolean(editingDashboard)}
                  placeholder="-- Pilih Pekerjaan --"
                  options={projects.map((p) => ({
                    value: p.id,
                    label: `${p.nama_pekerjaan} (${p.pemberi_kerja || '-'})`,
                  }))}
                />
              </div>

              <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                <label className="input-label">URL Link Dashboard *</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="e.g. https://dashboard.namaproject.com"
                  value={urlDashboard}
                  onChange={(e) => setUrlDashboard(e.target.value)}
                  required
                />
              </div>

              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <label className="input-label">Keterangan / Catatan (Opsional)</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="e.g. Dashboard Executive Monitoring 2026"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-primary btn-secondary" onClick={() => setShowAddModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg, #06b6d4, #0284c7)' }}>
                  {editingDashboard ? 'Simpan Perubahan' : 'Tambah Dashboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL IF CLICKED */}
      <DetailModal
        project={selectedProjectForDetail}
        onClose={() => setSelectedProjectForDetail(null)}
        onRefresh={loadData}
      />
    </div>
  );
}
