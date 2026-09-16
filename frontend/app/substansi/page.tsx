'use client';
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../lib/api';
import DetailModal from '../../components/DetailModal';
import { IconCheck, IconClock, IconEye } from '../../components/Icons';

export default function SubstansiPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  useEffect(() => {
    fetchWithAuth('/users/me')
      .then((res) => res.json())
      .then((user) => {
        setCurrentUser(user);
        loadProjects();
      })
      .catch(() => setLoading(false));
  }, []);

  const loadProjects = () => {
    fetchWithAuth('/projects')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const ustekProjects = data.filter((p) => 
            (p.status_project === 'Ongoing' || !p.status_project) &&
            (p.tahapan === 'Penyusunan Ustek' || p.tahapan === 'Upload Ustek')
          );
          setProjects(ustekProjects);
        }
        setLoading(false);
      });
  };

  const markSubstansiDone = async (id: number, currentStatus: boolean) => {
    const res = await fetchWithAuth(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status_selesai_substansi: !currentStatus }),
    });
    if (res.ok) {
      loadProjects();
    } else {
      const err = await res.json();
      alert(`Gagal mengubah status: ${err.detail || 'Terjadi kesalahan'}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tim Substansi (Gov & Pol)</h1>
        <p className="page-desc">
          {currentUser
            ? `Workspace divisi: ${currentUser.role} ${
                currentUser.role === 'Gov'
                  ? '(Government Projects)'
                  : currentUser.role === 'Pol'
                  ? '(Political Projects)'
                  : '(Akses Seluruh Divisi)'
              }`
            : 'Kelola dokumen dan penulisan Usulan Teknis (Ustek).'}
        </p>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Daftar Project Ustek</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {currentUser?.role === 'Gov' || currentUser?.role === 'Pol'
                ? `Menampilkan project terisolasi untuk divisi ${currentUser.role}`
                : 'Menampilkan seluruh project divisi Gov & Pol'}
            </p>
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data substansi...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nama Pekerjaan</th>
                  <th>Divisi</th>
                  <th>Status Tender (IR)</th>
                  <th>Status Substansi Ustek</th>
                  <th>Progres Ustek</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                      Belum ada project yang dialokasikan ke divisi ini.
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.nama_pekerjaan}</td>
                      <td>
                        <span className={`badge ${p.divisi_substansi === 'Gov' ? 'badge-gov' : 'badge-pol'}`}>
                          {p.divisi_substansi || '-'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            p.status_project === 'Menang'
                              ? 'badge-win'
                              : p.status_project === 'Kalah'
                              ? 'badge-loss'
                              : 'badge-potential'
                          }`}
                        >
                          {p.tahapan} ({p.status_project || 'Potensi'})
                        </span>
                      </td>
                      <td>
                        {p.status_selesai_substansi ? (
                          <span className="badge badge-done" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><IconCheck size={12} /> Selesai</span>
                        ) : (
                          <span className="badge badge-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><IconClock size={12} /> Belum Selesai</span>
                        )}
                      </td>
                      <td>
                        {p.status_selesai_substansi ? (
                          <span className="badge badge-done" style={{ cursor: 'default', padding: '0.4rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <IconCheck size={12} /> Selesai
                          </span>
                        ) : (
                          <button
                            className="btn-primary btn-sm btn-success"
                            onClick={() => markSubstansiDone(p.id, false)}
                          >
                            Tandai Selesai
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-primary btn-sm btn-secondary"
                            onClick={() => setSelectedProject(p)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <IconEye size={14} /> Detail
                          </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <DetailModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </div>
  );
}
