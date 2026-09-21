'use client';
import React, { useState } from 'react';
import { fetchWithAuth, isAdministrasiSelesai, isSubstansiSelesai, isProjectSelesaiAkhir } from '../lib/api';
import SearchableSelect from './SearchableSelect';
import ClickableText from './ClickableText';
import { IconUstek, IconCalendar, IconFinance, IconClose, IconCheck, IconClock, IconTrophy, IconLink, IconTrash, IconLock, IconAlertTriangle } from './Icons';

interface ProjectDetailModalProps {
  project: any | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function DetailModal({ project, onClose, onRefresh }: ProjectDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'stages' | 'billings'>('info');
  
  // Stage Form State
  const [stageName, setStageName] = useState('');
  const [stageDate, setStageDate] = useState('');
  const [stageStatus, setStageStatus] = useState('Ongoing');
  const [stageKet, setStageKet] = useState('');
  const [isMeeting, setIsMeeting] = useState(false);
  const [tipeMeeting, setTipeMeeting] = useState('Online');

  // Billing Form State
  const [billingName, setBillingName] = useState('');
  const [billingNominal, setBillingNominal] = useState('');
  const [billingDate, setBillingDate] = useState('');
  const [billingStatus, setBillingStatus] = useState('Belum ditagih');

  // User Role State & Confirmation Modal State
  const [userRole, setUserRole] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showConfirmAdminModal, setShowConfirmAdminModal] = useState(false);

  React.useEffect(() => {
    fetchWithAuth('/users/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.role) setUserRole(data.role);
      })
      .catch(() => {});
  }, []);

  const getProjectTahapan = (p: any) => {
    if (!p) return 'Upload PQ';
    if (p.bidding_stages && p.bidding_stages.length > 0) {
      const activeStage = p.bidding_stages.find((st: any) => st.status === 'Onprogress');
      if (activeStage) return activeStage.nama_tahapan;
      const selesaiStages = p.bidding_stages.filter((st: any) => st.status === 'Selesai');
      if (selesaiStages.length > 0) {
        const sorted = [...selesaiStages].sort((a: any, b: any) => {
          const TAHAPAN_ORDER = ['Upload PQ', 'Evaluasi PQ', 'Pembuktian', 'Penyusunan Ustek', 'Upload Ustek'];
          const rankA = TAHAPAN_ORDER.findIndex((t) => a.nama_tahapan.toLowerCase().includes(t.toLowerCase()));
          const rankB = TAHAPAN_ORDER.findIndex((t) => b.nama_tahapan.toLowerCase().includes(t.toLowerCase()));
          return (rankB !== -1 ? rankB : 99) - (rankA !== -1 ? rankA : 99);
        });
        return sorted[0].nama_tahapan;
      }
    }
    return p.tahapan || 'Upload PQ';
  };

  const canManageFinance = userRole === 'Finance' || userRole === 'Superadmin';
  const canManageSubstansi = ['Gov', 'Pol', 'Systech', 'Superadmin'].includes(userRole);

  if (!project) return null;

  // Formula Calculations
  const calculateUrgensiDeadline = () => {
    if (project.status_selesai_substansi) return { label: 'Selesai', color: 'badge-done' };
    if (!project.tanggal_spk_berakhir) return { label: 'Belum Upload SPK', color: 'badge-potential' };
    
    const today = new Date();
    const endDate = new Date(project.tanggal_spk_berakhir);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: `Telat (${Math.abs(diffDays)} Hari)`, color: 'badge-loss' };
    if (diffDays < 14) return { label: `Urgent (${diffDays} Hari Lagi)`, color: 'badge-potential' };
    return { label: `Aman (${diffDays} Hari)`, color: 'badge-win' };
  };

  const totalPaid = (project.billings || [])
    .filter((b: any) => b.status === 'Sudah dibayarkan')
    .reduce((sum: number, b: any) => sum + (b.nominal || 0), 0);
  
  const isPaidInFull = totalPaid >= (project.nilai_kontrak || 0) && (project.nilai_kontrak || 0) > 0;
  const hasAllDocs = Boolean(project.link_spk && project.link_bast && project.link_referensi);
  const isProjectSelesai = isProjectSelesaiAkhir(project);
  const urgensi = calculateUrgensiDeadline();

  const handleOpenConfirmSubstansi = () => {
    setShowConfirmModal(true);
  };

  const executeToggleStatusSubstansi = async () => {
    setShowConfirmModal(false);
    await fetchWithAuth(`/projects/${project.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status_selesai_substansi: !project.status_selesai_substansi
      })
    });
    if (onRefresh) onRefresh();
  };

  const executeToggleStatusAdministrasi = async () => {
    setShowConfirmAdminModal(false);
    await fetchWithAuth(`/projects/${project.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status_selesai_administrasi: !isAdministrasiSelesai(project)
      })
    });
    if (onRefresh) onRefresh();
  };

  // Handlers for Tahapan
  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchWithAuth(`/projects/${project.id}/stages`, {
      method: 'POST',
      body: JSON.stringify({
        nama_tahapan: stageName,
        tanggal: stageDate || null,
        status: stageStatus,
        keterangan: stageKet,
        is_meeting: isMeeting,
        tipe_meeting: isMeeting ? tipeMeeting : null
      })
    });
    setStageName('');
    setStageDate('');
    setStageKet('');
    setIsMeeting(false);
    if (onRefresh) onRefresh();
  };

  const handleDeleteStage = async (stageId: number) => {
    await fetchWithAuth(`/stages/${stageId}`, { method: 'DELETE' });
    if (onRefresh) onRefresh();
  };

  const handleUpdateBiddingStageInModal = async (stageId: number, fields: Record<string, any>) => {
    await fetchWithAuth(`/bidding-stages/${stageId}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
    if (onRefresh) onRefresh();
  };

  const handleDeleteBiddingStageInModal = async (stageId: number) => {
    await fetchWithAuth(`/bidding-stages/${stageId}`, { method: 'DELETE' });
    if (onRefresh) onRefresh();
  };

  // Handlers for Billings
  const handleAddBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchWithAuth(`/projects/${project.id}/billings`, {
      method: 'POST',
      body: JSON.stringify({
        nama: billingName,
        nominal: parseFloat(billingNominal) || 0,
        tanggal_penagihan: billingDate || null,
        status: billingStatus
      })
    });
    setBillingName('');
    setBillingNominal('');
    setBillingDate('');
    if (onRefresh) onRefresh();
  };

  const handleUpdateBillingStatus = async (billingId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'Belum ditagih' ? 'Sudah ditagih' : currentStatus === 'Sudah ditagih' ? 'Sudah dibayarkan' : 'Belum ditagih';
    await fetchWithAuth(`/billings/${billingId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: nextStatus })
    });
    if (onRefresh) onRefresh();
  };

  const handleUpdateBillingField = async (billingId: number, field: string, value: any) => {
    await fetchWithAuth(`/billings/${billingId}`, {
      method: 'PUT',
      body: JSON.stringify({ [field]: value })
    });
    if (onRefresh) onRefresh();
  };

  const handleDeleteBilling = async (billingId: number) => {
    await fetchWithAuth(`/billings/${billingId}`, { method: 'DELETE' });
    if (onRefresh) onRefresh();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
        
        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span className={`badge ${project.divisi_substansi === 'Gov' ? 'badge-gov' : 'badge-pol'}`}>
                {project.divisi_substansi || project.kategori_project || 'Gov'}
              </span>
              <span className="badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                Mekanisme: {project.jenis_mekanisme || 'Bidding'}
              </span>
              {project.metode_pekerjaan && (
                <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                  Metode: {project.metode_pekerjaan}
                </span>
              )}
              {project.jenis_pekerjaan && (
                <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                  Jenis: {project.jenis_pekerjaan}
                </span>
              )}
              <span className={`badge ${urgensi.color}`}>
                Deadline: {urgensi.label}
              </span>
              {isProjectSelesai ? (
                <span className="badge badge-done" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <IconTrophy size={14} color="#fff" /> STATUS AKHIR: SELESAI
                </span>
              ) : (
                <span className="badge badge-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <IconClock size={14} /> STATUS AKHIR: DALAM PROSES
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{project.nama_pekerjaan}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <IconClose size={20} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--card-border)', marginBottom: '1.25rem', paddingBottom: '0.5rem' }}>
          <button
            className={`btn-primary btn-sm ${activeTab === 'info' ? '' : 'btn-secondary'}`}
            onClick={() => setActiveTab('info')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <IconUstek size={15} /> Detail Informasi
          </button>
          <button
            className={`btn-primary btn-sm ${activeTab === 'stages' ? '' : 'btn-secondary'}`}
            onClick={() => setActiveTab('stages')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <IconCalendar size={15} /> Riwayat Tahapan ({project.stages?.length || 0})
          </button>
          <button
            className={`btn-primary btn-sm ${activeTab === 'billings' ? '' : 'btn-secondary'}`}
            onClick={() => setActiveTab('billings')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <IconFinance size={15} /> Termin Penagihan ({project.billings?.length || 0})
          </button>
        </div>

        {/* TAB 1: INFORMATION */}
        {activeTab === 'info' && (
          <div className="modal-body">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Metode Pekerjaan</span>
                <span className="detail-value" style={{ fontWeight: 700, color: '#3b82f6' }}>{project.metode_pekerjaan || '-'}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Jenis Pekerjaan</span>
                <span className="detail-value" style={{ fontWeight: 700, color: '#d97706' }}>{project.jenis_pekerjaan || '-'}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Status Bidding</span>
                <span className={`badge ${
                  project.status_project === 'Menang' ? 'badge-win' : project.status_project === 'Kalah' ? 'badge-loss' : 'badge-potential'
                }`}>
                  {project.status_project || 'Ongoing'}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Nilai Pekerjaan (Rupiah)</span>
                <span className="detail-value" style={{ fontWeight: 700, color: '#34d399' }}>
                  Rp {(project.nilai_kontrak || 0).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Lokasi</span>
                <span className="detail-value">{project.lokasi || 'Pusat'}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Tahapan Current</span>
                <span className="detail-value">{getProjectTahapan(project)}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Pemberi Kerja</span>
                <span className="detail-value">{project.pemberi_kerja || '-'}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Satuan Kerja</span>
                <span className="detail-value">{project.satuan_kerja || '-'}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Deadline / Pengumuman</span>
                <span className="detail-value">{project.deadline_pengumuman || '-'}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Peringkat</span>
                <span className="detail-value">{project.peringkat || '-'}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">PIC Project</span>
                <span className="detail-value">{project.pic || '-'}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Status Substansi Pekerjaan</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  <span className={`badge ${project.status_selesai_substansi ? 'badge-done' : 'badge-pending'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    {project.status_selesai_substansi ? <><IconCheck size={14} /> Selesai</> : <><IconClock size={14} /> Belum Selesai</>}
                  </span>
                  {canManageSubstansi && (
                    <button
                      className="btn-primary btn-sm btn-secondary"
                      onClick={() => setShowConfirmModal(true)}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                    >
                      {project.status_selesai_substansi ? 'Buka Kembali Substansi' : 'Tandai Selesai Substansi'}
                    </button>
                  )}
                </div>
              </div>

              <div className="detail-item">
                <span className="detail-label">Status Administrasi Pekerjaan</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  <span className={`badge ${isAdministrasiSelesai(project) ? 'badge-done' : 'badge-pending'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    {isAdministrasiSelesai(project) ? <><IconCheck size={14} /> Selesai</> : <><IconClock size={14} /> Belum Selesai</>}
                  </span>
                  {(canManageFinance || userRole === 'IR') && (
                    <button
                      className="btn-primary btn-sm btn-secondary"
                      onClick={() => setShowConfirmAdminModal(true)}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                    >
                      {isAdministrasiSelesai(project) ? 'Buka Kembali Administrasi' : 'Tandai Selesai Administrasi'}
                    </button>
                  )}
                </div>
              </div>

              <div className="detail-item">
                <span className="detail-label">PIC Ustek</span>
                <span className="detail-value">{project.pic_ustek || '-'}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Tim Ustek</span>
                <span className="detail-value">{project.tim_ustek || '-'}</span>
              </div>
            </div>

            <div className="detail-section" style={{ marginTop: '1.25rem' }}>
              <h4 className="detail-section-title">Dokumen & Link Referensi</h4>
              <div className="link-list">
                <div className="link-item">
                  <span className="detail-label">Link Ustek:</span>
                  {project.url_ustek ? (
                    <ClickableText text={project.url_ustek} buttonLabel="Buka Link Ustek" />
                  ) : <span className="text-dim">-</span>}
                </div>
                <div className="link-item">
                  <span className="detail-label">Link SPK:</span>
                  {project.link_spk ? (
                    <ClickableText text={project.link_spk} buttonLabel="Buka Dokumen SPK" />
                  ) : <span className="text-dim">Belum Upload SPK</span>}
                </div>
                <div className="link-item">
                  <span className="detail-label">Link BAST:</span>
                  {project.link_bast ? (
                    <ClickableText text={project.link_bast} buttonLabel="Buka Dokumen BAST" />
                  ) : <span className="text-dim">Belum Upload BAST</span>}
                </div>
                <div className="link-item">
                  <span className="detail-label">Link Surat Referensi:</span>
                  {project.link_referensi ? (
                    <ClickableText text={project.link_referensi} buttonLabel="Buka Surat Referensi" />
                  ) : <span className="text-dim">Belum Upload Referensi</span>}
                </div>
              </div>
            </div>

            {project.keterangan_tender && (
              <div className="detail-section" style={{ marginTop: '1rem' }}>
                <h4 className="detail-section-title">Keterangan</h4>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <ClickableText text={project.keterangan_tender} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STAGES (Multi-record) */}
        {activeTab === 'stages' && (
          <div className="modal-body">
            <h4 className="detail-section-title">Tambah Tahapan Baru</h4>
            <form onSubmit={handleAddStage} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                <input
                  className="input-field"
                  style={{ margin: 0 }}
                  placeholder="Nama Tahapan (e.g. Kickoff Meeting / Upload Ustek)"
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  required
                />
                <input
                  className="input-field"
                  type="date"
                  style={{ margin: 0 }}
                  value={stageDate}
                  onChange={(e) => setStageDate(e.target.value)}
                />
                <SearchableSelect
                  style={{ margin: 0 }}
                  value={stageStatus}
                  onChange={(val) => setStageStatus(val)}
                  options={['Ongoing', 'Selesai', 'Pending']}
                />
                <button className="btn-primary btn-sm" type="submit" style={{ height: '42px' }}>+ Tambah</button>
              </div>

              {/* Requirement #6: Meeting vs Non-Meeting & Online/Offline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', paddingTop: '0.25rem' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={isMeeting}
                    onChange={(e) => setIsMeeting(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                  />
                  <span>Tahapan Ini Berupa Meeting / Rapat</span>
                </label>

                {isMeeting && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tipe Meeting:</span>
                    <SearchableSelect
                      compact
                      style={{ margin: 0, width: '120px' }}
                      value={tipeMeeting}
                      onChange={(val) => setTipeMeeting(val)}
                      options={['Online', 'Offline']}
                    />
                  </div>
                )}
              </div>
            </form>

            {project.bidding_stages && project.bidding_stages.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 className="detail-section-title">Record Tahapan Bidding ({project.bidding_stages.length} Tahapan)</h4>
                <div className="table-container" style={{ marginBottom: '1rem' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>No.</th>
                        <th>Nama Tahapan Bidding</th>
                        <th>Tanggal Deadline</th>
                        <th>Status Tahapan</th>
                        <th>Keterangan</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.bidding_stages.map((bst: any, idx: number) => (
                        <tr key={bst.id || idx}>
                          <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}.</td>
                          <td style={{ fontWeight: 600 }}>{bst.nama_tahapan}</td>
                          <td>
                            <input
                              className="input-field"
                              type="date"
                              style={{ margin: 0, padding: '0.25rem 0.4rem', fontSize: '0.8rem', width: '140px' }}
                              value={bst.tanggal_deadline || ''}
                              onChange={(e) => handleUpdateBiddingStageInModal(bst.id, { tanggal_deadline: e.target.value || null })}
                            />
                          </td>
                          <td>
                            <SearchableSelect
                              compact
                              style={{ margin: 0, width: '150px' }}
                              value={bst.status || 'Onprogress'}
                              onChange={(val) => handleUpdateBiddingStageInModal(bst.id, { status: val })}
                              options={[
                                { value: 'Onprogress', label: '🟡 Onprogress' },
                                { value: 'Selesai', label: '🟢 Selesai' },
                              ]}
                            />
                          </td>
                          <td>
                            <input
                              className="input-field"
                              placeholder="Notes..."
                              style={{ margin: 0, padding: '0.25rem 0.4rem', fontSize: '0.8rem', width: '100%' }}
                              defaultValue={bst.keterangan || ''}
                              onBlur={(e) => handleUpdateBiddingStageInModal(bst.id, { keterangan: e.target.value || null })}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-logout"
                              style={{ padding: '0.2rem 0.5rem', width: 'auto', display: 'inline-flex', alignItems: 'center' }}
                              onClick={() => handleDeleteBiddingStageInModal(bst.id)}
                              title="Hapus Tahapan"
                            >
                              <IconTrash size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <h4 className="detail-section-title">Daftar Tahapan Project</h4>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>No.</th>
                    <th>Tahapan</th>
                    <th>Tanggal</th>
                    <th>Tipe Rapat / Tahapan</th>
                    <th>Status</th>
                    <th>Keterangan</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {!project.stages || project.stages.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', opacity: 0.5, padding: '1.5rem' }}>
                        Belum ada tahapan tercatat.
                      </td>
                    </tr>
                  ) : (
                    project.stages.map((st: any, idx: number) => (
                      <tr key={st.id}>
                        <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}.</td>
                        <td style={{ fontWeight: 600 }}>{st.nama_tahapan}</td>
                        <td>{st.tanggal || '-'}</td>
                        <td>
                          {st.is_meeting ? (
                            <span className="badge" style={{ background: st.tipe_meeting === 'Online' ? '#eff6ff' : '#fef3c7', color: st.tipe_meeting === 'Online' ? '#1d4ed8' : '#b45309', border: `1px solid ${st.tipe_meeting === 'Online' ? '#bfdbfe' : '#fde68a'}`, fontWeight: 700 }}>
                              {st.tipe_meeting === 'Online' ? '💻 Meeting Online' : '🏢 Meeting Offline'}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Non-Meeting</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${st.status === 'Selesai' ? 'badge-done' : 'badge-pending'}`}>
                            {st.status}
                          </span>
                        </td>
                        <td><ClickableText text={st.keterangan} /></td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-logout"
                            style={{ padding: '0.2rem 0.5rem', width: 'auto', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => handleDeleteStage(st.id)}
                            title="Hapus Tahapan"
                          >
                            <IconTrash size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: BILLINGS (Termin Multi-record) */}
        {activeTab === 'billings' && (
          <div className="modal-body">
            {/* Total Paid Progress Summary */}
            <div className="glass-card" style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(15,23,42,0.6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span>Total Terbayar: <strong>Rp {totalPaid.toLocaleString('id-ID')}</strong></span>
                <span>Target: <strong>Rp {(project.nilai_kontrak || 0).toLocaleString('id-ID')}</strong></span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, ((totalPaid / (project.nilai_kontrak || 1)) * 100))}%`,
                    background: isPaidInFull ? '#10b981' : '#3b82f6',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>

            {canManageFinance ? (
              <>
                <h4 className="detail-section-title">Tambah Termin Penagihan</h4>
                <form onSubmit={handleAddBilling} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr auto', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'end' }}>
                  <input
                    className="input-field"
                    style={{ margin: 0 }}
                    placeholder="Nama Termin (e.g. Termin 1 DP 30%)"
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    required
                  />
                  <input
                    className="input-field"
                    type="number"
                    style={{ margin: 0 }}
                    placeholder="Nominal (Rp)"
                    value={billingNominal}
                    onChange={(e) => setBillingNominal(e.target.value)}
                    required
                  />
                  <input
                    className="input-field"
                    type="date"
                    style={{ margin: 0 }}
                    value={billingDate}
                    onChange={(e) => setBillingDate(e.target.value)}
                  />
                  <button className="btn-primary btn-sm" type="submit" style={{ height: '42px' }}>+ Tambah</button>
                </form>
              </>
            ) : (
              <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#64748b', fontSize: '0.825rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconLock size={16} color="#64748b" />
                <span><strong>Akses Terbatas:</strong> Penambahan & pengelolaan termin penagihan hanya dapat dilakukan oleh user <strong>Finance / Superadmin</strong>.</span>
              </div>
            )}

            <h4 className="detail-section-title">Daftar Termin Penagihan</h4>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Termin</th>
                    <th>Nominal</th>
                    <th>Tgl Penagihan</th>
                    <th>Status Penagihan</th>
                    {canManageFinance && <th style={{ textAlign: 'right' }}>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {!project.billings || project.billings.length === 0 ? (
                    <tr>
                      <td colSpan={canManageFinance ? 5 : 4} style={{ textAlign: 'center', opacity: 0.5, padding: '1.5rem' }}>
                        Belum ada termin penagihan tercatat.
                      </td>
                    </tr>
                  ) : (
                    project.billings.map((b: any) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 600 }}>{b.nama}</td>
                        <td style={{ color: '#34d399', fontWeight: 700 }}>Rp {(b.nominal || 0).toLocaleString('id-ID')}</td>
                        <td>
                          {canManageFinance ? (
                            <input
                              className="input-field"
                              type="date"
                              style={{ margin: 0, padding: '0.25rem 0.4rem', width: '135px', fontSize: '0.8rem' }}
                              defaultValue={b.tanggal_penagihan || ''}
                              onBlur={(e) => handleUpdateBillingField(b.id, 'tanggal_penagihan', e.target.value || null)}
                            />
                          ) : (
                            <span>{b.tanggal_penagihan || '-'}</span>
                          )}
                        </td>
                        <td>
                          {canManageFinance ? (
                            <SearchableSelect
                              compact
                              style={{ margin: 0, width: '160px' }}
                              value={b.status || 'Belum ditagih'}
                              onChange={(val) => handleUpdateBillingField(b.id, 'status', val)}
                              options={[
                                { value: 'Belum ditagih', label: '🔴 Belum Ditagih' },
                                { value: 'Sudah ditagih', label: '🟡 Sudah Ditagih' },
                                { value: 'Sudah dibayarkan', label: '🟢 Sudah Dibayarkan' },
                              ]}
                            />
                          ) : (
                            <span
                              className={`badge ${
                                b.status === 'Sudah dibayarkan' ? 'badge-done' : b.status === 'Sudah ditagih' ? 'badge-potential' : 'badge-pending'
                              }`}
                            >
                              {b.status === 'Sudah dibayarkan' ? 'Sudah Dibayarkan' : b.status === 'Sudah ditagih' ? 'Sudah Ditagih' : 'Belum Ditagih'}
                            </span>
                          )}
                        </td>
                        {canManageFinance && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-logout"
                              style={{ padding: '0.2rem 0.5rem', width: 'auto', display: 'inline-flex', alignItems: 'center' }}
                              onClick={() => handleDeleteBilling(b.id)}
                              title="Hapus Termin"
                            >
                              <IconTrash size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="modal-footer" style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button className="btn-primary btn-sm" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>

      {/* CONFIRMATION POPUP MODAL UNTUK STATUS SUBSTANSI */}
      {showConfirmModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowConfirmModal(false)}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              textAlign: 'center',
              animation: 'modalSlide 0.2s ease'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: project.status_selesai_substansi ? '#fef3c7' : '#dcfce7',
                color: project.status_selesai_substansi ? '#d97706' : '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                margin: '0 auto 1rem'
              }}
            >
              {project.status_selesai_substansi ? (
                <IconAlertTriangle size={28} color="#d97706" />
              ) : (
                <IconCheck size={28} color="#16a34a" />
              )}
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              {project.status_selesai_substansi ? 'Buka Kembali Substansi?' : 'Konfirmasi Selesai Substansi'}
            </h3>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              {project.status_selesai_substansi ? (
                <span>Apakah Anda yakin ingin membuka kembali status pengerjaan substansi proyek <strong>"{project.nama_pekerjaan}"</strong>?</span>
              ) : (
                <span>Apakah Anda yakin proyek <strong>"{project.nama_pekerjaan}"</strong> telah <strong>Selesai seluruh pengerjaan substansinya</strong>?</span>
              )}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn-primary btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                style={{ flex: 1, padding: '0.65rem' }}
              >
                Batal
              </button>
              <button
                className="btn-primary"
                onClick={executeToggleStatusSubstansi}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  background: project.status_selesai_substansi ? '#f59e0b' : 'linear-gradient(135deg, #10b981, #059669)'
                }}
              >
                {project.status_selesai_substansi ? 'Ya, Buka Kembali' : 'Ya, Tandai Selesai'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR ADMINISTRASI */}
      {showConfirmAdminModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              textAlign: 'center',
              animation: 'modalSlide 0.2s ease'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: isAdministrasiSelesai(project) ? '#fef3c7' : '#dcfce7',
                color: isAdministrasiSelesai(project) ? '#d97706' : '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                margin: '0 auto 1rem'
              }}
            >
              {isAdministrasiSelesai(project) ? (
                <IconAlertTriangle size={28} color="#d97706" />
              ) : (
                <IconCheck size={28} color="#16a34a" />
              )}
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              {isAdministrasiSelesai(project) ? 'Buka Kembali Status Administrasi?' : 'Konfirmasi Selesai Administrasi'}
            </h3>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              {isAdministrasiSelesai(project) ? (
                <span>Apakah Anda yakin ingin membuka kembali status administrasi proyek <strong>"{project.nama_pekerjaan}"</strong>?</span>
              ) : (
                <span>Apakah Anda yakin proyek <strong>"{project.nama_pekerjaan}"</strong> telah <strong>Selesai seluruh proses administrasinya</strong>?</span>
              )}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn-primary btn-secondary"
                onClick={() => setShowConfirmAdminModal(false)}
                style={{ flex: 1, padding: '0.65rem' }}
              >
                Batal
              </button>
              <button
                className="btn-primary"
                onClick={executeToggleStatusAdministrasi}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  background: isAdministrasiSelesai(project) ? '#f59e0b' : 'linear-gradient(135deg, #10b981, #059669)'
                }}
              >
                {isAdministrasiSelesai(project) ? 'Ya, Buka Kembali' : 'Ya, Tandai Selesai'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
