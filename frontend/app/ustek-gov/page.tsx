'use client';
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../lib/api';
import DetailModal from '../../components/DetailModal';
import { IconGov, IconCheck, IconClock, IconEye } from '../../components/Icons';

export default function UstekGovPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = () => {
    fetchWithAuth('/projects')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Filter khusus divisi Gov, tahapan Ustek, dan status bidding Ongoing
          const govProjects = data.filter((p) => 
            (p.status_project === 'Ongoing' || !p.status_project) &&
            (p.divisi_substansi === 'Gov' || p.kategori_project === 'Gov') &&
            (p.tahapan === 'Penyusunan Ustek' || p.tahapan === 'Upload Ustek')
          );
          setProjects(govProjects);
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
      alert(`Gagal merubah status: ${err.detail || 'Terjadi kesalahan'}`);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <IconGov size={32} color="var(--primary-color)" />
          <div>
            <h1 className="page-title">Tracking Ustek (Khusus Divisi Gov)</h1>
            <p className="page-desc">Monitoring khusus progres penyusunan Usulan Teknis untuk project Government.</p>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Daftar Project Ustek Government</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Progres penyelesaian dokumen teknis divisi Gov</p>
          </div>
          <span className="badge badge-gov" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
            Gov Only
          </span>
        </div>

        <div className="table-container">
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data Ustek Gov...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nama Pekerjaan</th>
                  <th>Nilai Kontrak</th>
                  <th>Status Tender (IR)</th>
                  <th>Tahapan</th>
                  <th>Status Ustek</th>
                  <th>Progres Ustek</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                      Belum ada project Ustek untuk divisi Government.
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.nama_pekerjaan}</td>
                      <td>Rp {(p.nilai_kontrak || 0).toLocaleString('id-ID')}</td>
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
                          {p.status_project || 'Potensi'}
                        </span>
                      </td>
                      <td>{p.tahapan || '-'}</td>
                      <td>
                        {p.status_selesai_substansi ? (
                          <span className="badge badge-done" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><IconCheck size={12} /> Selesai</span>
                        ) : (
                          <span className="badge badge-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><IconClock size={12} /> Proses</span>
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
