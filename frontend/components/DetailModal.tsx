'use client';
import React, { useState } from 'react';
import { fetchWithAuth, hasDokumenLengkap, isAdministrasiSelesai, isSubstansiSelesai, isProjectSelesaiAkhir } from '../lib/api';
import SearchableSelect from './SearchableSelect';
import ClickableText from './ClickableText';
import { IconUstek, IconCalendar, IconFinance, IconClose, IconCheck, IconClock, IconTrophy, IconLink, IconTrash, IconLock, IconAlertTriangle } from './Icons';

interface ProjectDetailModalProps {
  project: any | null;
  onClose: () => void;
  onRefresh?: () => void;
  initialTab?: 'info' | 'stages' | 'billings';
}

export default function DetailModal({ project: projectProp, onClose, onRefresh, initialTab }: ProjectDetailModalProps) {
  const [project, setProject] = useState<any | null>(projectProp);
  React.useEffect(() => {
    setProject(projectProp);
  }, [projectProp]);

  // Ambil data terbaru dari server agar perubahan langsung tampil tanpa refresh halaman
  const refresh = async () => {
    const id = projectProp?.id;
    if (id) {
      try {
        const res = await fetchWithAuth('/projects');
        const data = await res.json();
        if (Array.isArray(data)) {
          const fresh = data.find((d: any) => d.id === id);
          if (fresh) setProject(fresh);
        }
      } catch (e) {
        console.error('Failed to refresh project', e);
      }
    }
    if (onRefresh) onRefresh();
  };

  const [activeTab, setActiveTab] = useState<'info' | 'stages' | 'billings'>(initialTab || 'info');
  
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, project]);
  
  // Stage Form State
  const [stageName, setStageName] = useState('');
  const [stageDate, setStageDate] = useState('');
  const [stageStatus, setStageStatus] = useState('Ongoing');
  const [stageKet, setStageKet] = useState('');
  const [stageDeadline, setStageDeadline] = useState('');
  const [editStage, setEditStage] = useState<any | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [isMeeting, setIsMeeting] = useState(false);
  const [tipeMeeting, setTipeMeeting] = useState('Online');

  // Billing Form State
  const [billingName, setBillingName] = useState('');
  const [bulkCount, setBulkCount] = useState('3');
  const [billingNominal, setBillingNominal] = useState('');
  const [billingDate, setBillingDate] = useState('');
  const [billingStatus, setBillingStatus] = useState('Belum ditagih');

  // User Role State & Confirmation Modal State
  const [userRole, setUserRole] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'stage' | 'bidding' | 'billing'; id: number; label: string } | null>(null);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const { kind, id } = deleteTarget;
    setDeleteTarget(null);
    if (kind === 'stage') await handleDeleteStage(id);
    else if (kind === 'bidding') await handleDeleteBiddingStageInModal(id);
    else await handleDeleteBilling(id);
  };
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
    const TAHAPAN_ORDER = ['Upload PQ', 'Evaluasi PQ', 'Pembuktian', 'Penawaran'];
    const getTahapanRank = (key: string) => {
      if (!key) return 99;
      const k = key.toLowerCase();
      if (k.includes('penyusunan ustek') || k.includes('upload ustek') || k.includes('penawaran')) return 3;
      const index = TAHAPAN_ORDER.findIndex((t) => k.includes(t.toLowerCase()));
      return index !== -1 ? index : 99;
    };
    if (p.bidding_stages && p.bidding_stages.length > 0) {
      const activeStage = p.bidding_stages.find((st: any) => st.status === 'Onprogress' || st.status === 'OnProgress');
      if (activeStage) {
        let name = activeStage.nama_tahapan;
        if (name === 'Penyusunan Ustek' || name === 'Upload Ustek') name = 'Penawaran';
        return name;
      }
      const selesaiStages = p.bidding_stages.filter((st: any) => st.status === 'Selesai');
      if (selesaiStages.length > 0) {
        const sorted = [...selesaiStages].sort((a: any, b: any) => {
          const rankA = getTahapanRank(a.nama_tahapan);
          const rankB = getTahapanRank(b.nama_tahapan);
          return rankB - rankA;
        });
        const highestDoneRank = getTahapanRank(sorted[0].nama_tahapan);
        if (highestDoneRank < 3) {
          return TAHAPAN_ORDER[highestDoneRank + 1];
        } else {
          return 'Penawaran';
        }
      }
    }
    let rawTahapan = p.tahapan || 'Upload PQ';
    if (rawTahapan === 'Penyusunan Ustek' || rawTahapan === 'Upload Ustek') {
      return 'Penawaran';
    }
    return rawTahapan;
  };

  const canManageFinance = userRole === 'Finance' || userRole === 'Superadmin';
  const canEditProject = !!userRole && userRole !== 'Viewer';
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
  
  const paidBillings = (project.billings || []).filter((b: any) => b.status === 'Sudah dibayarkan');
  const paidYayasan = paidBillings.reduce((sum: number, b: any) => sum + (b.nominal_yayasan || 0), 0);
  const paidPt = paidBillings.reduce((sum: number, b: any) => sum + (b.nominal_pt || 0), 0);

  const isPaidInFull = totalPaid >= (project.nilai_project_deal || project.nilai_kontrak || 0) && (project.nilai_project_deal || project.nilai_kontrak || 0) > 0;
  const hasAllDocs = hasDokumenLengkap(project);
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
    await refresh();
  };

  
  const updateProjectField = async (field: string, value: any) => {
    try {
      await fetchWithAuth(`/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: value })
      });
      await refresh();
    } catch (e) {
      console.error('Failed to update project field', e);
    }
  };

  const executeToggleStatusAdministrasi = async () => {
    setShowConfirmAdminModal(false);
    await fetchWithAuth(`/projects/${project.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status_selesai_administrasi: !isAdministrasiSelesai(project)
      })
    });
    await refresh();
  };

  // Handlers for Tahapan
  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchWithAuth(`/projects/${project.id}/stages`, {
      method: 'POST',
      body: JSON.stringify({
        nama_tahapan: stageName,
        tanggal: stageDate || null,
        deadline: stageDeadline || null,
        status: stageStatus,
        keterangan: stageKet || null,
        is_meeting: isMeeting,
        tipe_meeting: isMeeting ? tipeMeeting : null
      })
    });
    setStageName('');
    setStageDate('');
    setStageKet('');
    setStageDeadline('');
    setIsMeeting(false);
    await refresh();
  };

  const handleSaveEditStage = async () => {
    if (!editStage || !editStage.nama_tahapan?.trim()) return;
    await fetchWithAuth(`/stages/${editStage.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        nama_tahapan: editStage.nama_tahapan,
        tanggal: editStage.tanggal || null,
        deadline: editStage.deadline || null,
        status: editStage.status,
        keterangan: editStage.keterangan || null,
        is_meeting: !!editStage.is_meeting,
        tipe_meeting: editStage.is_meeting ? editStage.tipe_meeting || 'Online' : null,
      }),
    });
    setEditStage(null);
    await refresh();
  };

  const EDIT_FIELDS = [
    'nama_pekerjaan', 'nilai_kontrak', 'status_project', 'jenis_mekanisme', 'divisi_substansi', 'lokasi',
    'metode_pekerjaan', 'jenis_pekerjaan', 'pemberi_kerja', 'satuan_kerja', 'deadline_pengumuman', 'peringkat',
    'pic', 'pic_ustek', 'tim_ustek', 'tanggal_mulai_spk', 'tanggal_spk_berakhir', 'url_ustek', 'url_rab', 'url_ta',
    'link_spk', 'link_bast', 'link_referensi', 'keterangan_tender',
  ];

  const startEdit = () => {
    const f: Record<string, any> = {};
    EDIT_FIELDS.forEach((k) => {
      f[k] = project[k] ?? '';
    });
    setForm(f);
    setEditMode(true);
  };

  const handleSaveProject = async () => {
    if (!String(form.nama_pekerjaan || '').trim()) return;
    const payload: Record<string, any> = {};
    EDIT_FIELDS.forEach((k) => {
      const v = form[k];
      if (k === 'nilai_kontrak') payload[k] = parseFloat(v) || 0;
      else if (k === 'nama_pekerjaan') payload[k] = String(v).trim();
      else payload[k] = v === '' ? null : v;
    });
    await fetchWithAuth(`/projects/${project.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    setEditMode(false);
    await refresh();
  };

  const handleDeleteProject = async () => {
    setShowDeleteProject(false);
    const res = await fetchWithAuth(`/projects/${project.id}`, { method: 'DELETE' });
    if (res.ok) {
      if (onRefresh) onRefresh();
      onClose();
    }
  };

  const handleDeleteStage = async (stageId: number) => {
    await fetchWithAuth(`/stages/${stageId}`, { method: 'DELETE' });
    await refresh();
  };

  const handleUpdateBiddingStageInModal = async (stageId: number, fields: Record<string, any>) => {
    await fetchWithAuth(`/bidding-stages/${stageId}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
    await refresh();
  };

  const handleDeleteBiddingStageInModal = async (stageId: number) => {
    await fetchWithAuth(`/bidding-stages/${stageId}`, { method: 'DELETE' });
    await refresh();
  };

  // Handlers for Billings (update lokal langsung, tanpa refetch seluruh project agar cepat)
  const setLocalBillings = (fn: (list: any[]) => any[]) => {
    setProject((prev: any) => (prev ? { ...prev, billings: fn(prev.billings || []) } : prev));
  };

  const syncParent = () => {
    if (onRefresh) onRefresh();
  };

  const handleAddBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = parseFloat(billingNominal) || 0;
    const res = await fetchWithAuth(`/projects/${project.id}/billings`, {
      method: 'POST',
      body: JSON.stringify({
        nama: billingName.trim() || `Termin ${(project.billings?.length || 0) + 1}`,
        nominal,
        nominal_pt: nominal,
        nominal_yayasan: 0,
        tanggal_penagihan: billingDate || null,
        status: billingStatus
      })
    });
    if (res.ok) {
      const created = await res.json();
      setLocalBillings((list) => [...list, created]);
      setBillingName('');
      setBillingNominal('');
      setBillingDate('');
      syncParent();
    }
  };

  const handleBulkBilling = async () => {
    const jumlah = parseInt(bulkCount) || 0;
    const target = project.nilai_project_deal || project.nilai_kontrak || 0;
    const sisa = target - (project.billings || []).reduce((t: number, b: any) => t + (b.nominal || 0), 0);
    if (jumlah < 1 || jumlah > 50) return;
    const res = await fetchWithAuth(`/projects/${project.id}/billings/bulk`, {
      method: 'POST',
      body: JSON.stringify({ jumlah, total: sisa > 0 ? sisa : target })
    });
    if (res.ok) {
      const created = await res.json();
      setLocalBillings((list) => [...list, ...created]);
      syncParent();
    }
  };

  const handleUpdateBillingField = async (billingId: number, field: string, value: any, extra: Record<string, any> = {}) => {
    const fields = { [field]: value, ...extra };
    setLocalBillings((list) => list.map((b) => (b.id === billingId ? { ...b, ...fields } : b)));
    await fetchWithAuth(`/billings/${billingId}`, {
      method: 'PUT',
      body: JSON.stringify(fields)
    });
    syncParent();
  };

  // Pembagian pemasukan Yayasan / PT: mengubah salah satu otomatis menyesuaikan sisanya
  const handleSplit = (b: any, side: 'yayasan' | 'pt', raw: string) => {
    const val = Math.min(b.nominal || 0, Math.max(0, parseFloat(raw) || 0));
    const other = (b.nominal || 0) - val;
    handleUpdateBillingField(b.id, side === 'yayasan' ? 'nominal_yayasan' : 'nominal_pt', val, side === 'yayasan' ? { nominal_pt: other } : { nominal_yayasan: other });
  };

  const handleDeleteBilling = async (billingId: number) => {
    setLocalBillings((list) => list.filter((b) => b.id !== billingId));
    await fetchWithAuth(`/billings/${billingId}`, { method: 'DELETE' });
    syncParent();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: activeTab === 'billings' ? '1200px' : '850px' }}>
        
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
            {canEditProject && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {editMode ? (
                  <>
                    <button className="btn-primary btn-sm btn-secondary" onClick={() => setEditMode(false)}>Batal</button>
                    <button className="btn-primary btn-sm" onClick={handleSaveProject}>Simpan Perubahan</button>
                  </>
                ) : (
                  <>
                    <button className="btn-primary btn-sm btn-secondary" onClick={startEdit}>Edit Data</button>
                    <button className="btn-primary btn-sm" style={{ background: '#dc2626' }} onClick={() => setShowDeleteProject(true)}>Hapus Pekerjaan</button>
                  </>
                )}
              </div>
            )}

            {editMode ? (
              <div className="detail-grid">
                {([
                  ['nama_pekerjaan', 'Nama Pekerjaan', 'text'],
                  ['nilai_kontrak', 'Nilai Pekerjaan (Kontrak Awal)', 'number'],
                  ['status_project', 'Status Bidding', ['Ongoing', 'Menang', 'Kalah', 'Batal', 'Tidak Memenuhi Ambang Batas']],
                  ['jenis_mekanisme', 'Mekanisme', ['Bidding', 'PL']],
                  ['divisi_substansi', 'Divisi Substansi', ['Gov', 'Pol']],
                  ['lokasi', 'Lokasi', ['Pusat', 'Cabang Jatim', 'Cabang Jateng']],
                  ['metode_pekerjaan', 'Metode Pekerjaan', 'text'],
                  ['jenis_pekerjaan', 'Jenis Pekerjaan', 'text'],
                  ['pemberi_kerja', 'Pemberi Kerja', 'text'],
                  ['satuan_kerja', 'Satuan Kerja', 'text'],
                  ['deadline_pengumuman', 'Deadline / Pengumuman', 'date'],
                  ['peringkat', 'Peringkat', 'text'],
                  ['pic', 'PIC Project', 'text'],
                  ['pic_ustek', 'PIC Ustek', 'text'],
                  ['tim_ustek', 'Tim Ustek', 'text'],
                  ['tanggal_mulai_spk', 'Tanggal Mulai SPK', 'date'],
                  ['tanggal_spk_berakhir', 'Tanggal SPK Berakhir', 'date'],
                  ['url_ustek', 'Link Ustek', 'text'],
                  ['url_rab', 'Link RAB', 'text'],
                  ['url_ta', 'Link TA', 'text'],
                  ['link_spk', 'Link SPK', 'text'],
                  ['link_bast', 'Link BAST', 'text'],
                  ['link_referensi', 'Link Surat Referensi', 'text'],
                ] as [string, string, string | string[]][]).map(([key, label, kind]) => (
                  <div className="detail-item" key={key}>
                    <span className="detail-label">{label}</span>
                    {Array.isArray(kind) ? (
                      <SearchableSelect
                        style={{ margin: 0 }}
                        value={form[key] || ''}
                        onChange={(val) => setForm((f) => ({ ...f, [key]: val }))}
                        options={kind}
                      />
                    ) : (
                      <input
                        className="input-field"
                        type={kind}
                        style={{ margin: 0, width: '100%' }}
                        value={form[key] ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="detail-label">Keterangan</span>
                  <textarea
                    className="input-field"
                    rows={3}
                    style={{ margin: 0, width: '100%' }}
                    value={form.keterangan_tender ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, keterangan_tender: e.target.value }))}
                  />
                </div>
              </div>
            ) : (<>
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
                <span className="detail-label">Nilai Pekerjaan (Kontrak Awal)</span>
                <span className="detail-value" style={{ fontWeight: 700, color: '#34d399' }}>
                  Rp {(project.nilai_kontrak || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Nilai Project Deal (Final)</span>
                <input
                  type="number"
                  className="input-field"
                  style={{ margin: 0, padding: '0.2rem 0.4rem', width: '100%', fontWeight: 700, color: '#34d399' }}
                  defaultValue={project.nilai_project_deal || project.nilai_kontrak || 0}
                  onBlur={(e) => updateProjectField('nilai_project_deal', parseFloat(e.target.value) || 0)}
                />
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
                  <span className="detail-label">Link RAB:</span>
                  {project.url_rab ? (
                    <ClickableText text={project.url_rab} buttonLabel="Buka Link RAB" />
                  ) : <span className="text-dim">-</span>}
                </div>
                <div className="link-item">
                  <span className="detail-label">Link TA:</span>
                  {project.url_ta ? (
                    <ClickableText text={project.url_ta} buttonLabel="Buka Link TA" />
                  ) : <span className="text-dim">-</span>}
                </div>
                <div className="link-item">
                  <span className="detail-label">Link SPK:</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {project.link_spk && <ClickableText text={project.link_spk} buttonLabel="Buka Dokumen SPK" />}
                    <input
                      className="input-field"
                      placeholder="Edit URL..."
                      style={{ margin: 0, padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                      defaultValue={project.link_spk || ''}
                      onBlur={(e) => updateProjectField('link_spk', e.target.value)}
                    />
                  </div>
                </div>
                <div className="link-item">
                  <span className="detail-label">Link BAST:</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {project.link_bast && <ClickableText text={project.link_bast} buttonLabel="Buka Dokumen BAST" />}
                    <input
                      className="input-field"
                      placeholder="Edit URL..."
                      style={{ margin: 0, padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                      defaultValue={project.link_bast || ''}
                      onBlur={(e) => updateProjectField('link_bast', e.target.value)}
                    />
                  </div>
                </div>
                <div className="link-item">
                  <span className="detail-label">Link Surat Referensi:</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {project.link_referensi && <ClickableText text={project.link_referensi} buttonLabel="Buka Surat Referensi" />}
                    <input
                      className="input-field"
                      placeholder="Edit URL Referensi..."
                      style={{ margin: 0, padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                      defaultValue={project.link_referensi || ''}
                      onBlur={(e) => updateProjectField('link_referensi', e.target.value)}
                    />
                  </div>
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
            </>)}
          </div>
        )}

        {/* TAB 2: STAGES (Multi-record) */}
        {activeTab === 'stages' && (
          <div className="modal-body">
            <h4 className="detail-section-title">Tambah Tahapan Baru</h4>
            <form onSubmit={handleAddStage} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
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
                  title="Tanggal"
                />
                <input
                  className="input-field"
                  type="date"
                  style={{ margin: 0 }}
                  value={stageDeadline}
                  onChange={(e) => setStageDeadline(e.target.value)}
                  title="Deadline"
                />
                <SearchableSelect
                  style={{ margin: 0 }}
                  value={stageStatus}
                  onChange={(val) => setStageStatus(val)}
                  options={['Ongoing', 'Selesai', 'Pending']}
                />
                <button className="btn-primary btn-sm" type="submit" style={{ height: '42px' }}>+ Tambah</button>
              </div>

              <input
                className="input-field"
                style={{ margin: 0 }}
                placeholder="Keterangan (opsional)"
                value={stageKet}
                onChange={(e) => setStageKet(e.target.value)}
              />

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

            {project.bidding_stages && project.bidding_stages.length > 0 && project.status_project !== 'Menang' && project.jenis_mekanisme !== 'PL' && (
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
                              onClick={() => setDeleteTarget({ kind: 'bidding', id: bst.id, label: `tahapan bidding "${bst.nama_tahapan}"` })}
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
                    <th>Deadline</th>
                    <th>Tipe Rapat / Tahapan</th>
                    <th>Status</th>
                    <th>Keterangan</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {!project.stages || project.stages.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', opacity: 0.5, padding: '1.5rem' }}>
                        Belum ada tahapan tercatat.
                      </td>
                    </tr>
                  ) : (
                    project.stages.map((st: any, idx: number) => (
                      editStage && editStage.id === st.id ? (
                        <tr key={st.id}>
                          <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}.</td>
                          <td>
                            <input className="input-field" style={{ margin: 0, padding: '0.25rem 0.4rem', fontSize: '0.8rem' }} value={editStage.nama_tahapan || ''} onChange={(e) => setEditStage({ ...editStage, nama_tahapan: e.target.value })} />
                          </td>
                          <td>
                            <input className="input-field" type="date" style={{ margin: 0, padding: '0.25rem 0.4rem', fontSize: '0.8rem', width: '135px' }} value={editStage.tanggal || ''} onChange={(e) => setEditStage({ ...editStage, tanggal: e.target.value })} />
                          </td>
                          <td>
                            <input className="input-field" type="date" style={{ margin: 0, padding: '0.25rem 0.4rem', fontSize: '0.8rem', width: '135px' }} value={editStage.deadline || ''} onChange={(e) => setEditStage({ ...editStage, deadline: e.target.value })} />
                          </td>
                          <td>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                              <input type="checkbox" checked={!!editStage.is_meeting} onChange={(e) => setEditStage({ ...editStage, is_meeting: e.target.checked, tipe_meeting: e.target.checked ? editStage.tipe_meeting || 'Online' : null })} />
                              Meeting
                            </label>
                            {editStage.is_meeting && (
                              <SearchableSelect compact style={{ margin: '0.25rem 0 0', width: '110px' }} value={editStage.tipe_meeting || 'Online'} onChange={(val) => setEditStage({ ...editStage, tipe_meeting: val })} options={['Online', 'Offline']} />
                            )}
                          </td>
                          <td>
                            <SearchableSelect compact style={{ margin: 0, width: '110px' }} value={editStage.status || 'Ongoing'} onChange={(val) => setEditStage({ ...editStage, status: val })} options={['Ongoing', 'Selesai', 'Pending']} />
                          </td>
                          <td>
                            <input className="input-field" placeholder="Keterangan..." style={{ margin: 0, padding: '0.25rem 0.4rem', fontSize: '0.8rem', width: '100%' }} value={editStage.keterangan || ''} onChange={(e) => setEditStage({ ...editStage, keterangan: e.target.value })} />
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button className="btn-primary btn-sm" style={{ marginRight: '0.35rem' }} onClick={handleSaveEditStage}>Simpan</button>
                            <button className="btn-primary btn-sm btn-secondary" onClick={() => setEditStage(null)}>Batal</button>
                          </td>
                        </tr>
                      ) : (
                      <tr key={st.id}>
                        <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}.</td>
                        <td style={{ fontWeight: 600 }}>{st.nama_tahapan}</td>
                        <td>{st.tanggal || '-'}</td>
                        <td>{st.deadline || '-'}</td>
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
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn-primary btn-sm btn-secondary"
                            style={{ marginRight: '0.35rem' }}
                            onClick={() => setEditStage({ ...st })}
                            title="Edit Tahapan"
                          >
                            Edit
                          </button>
                          <button
                            className="btn-logout"
                            style={{ padding: '0.2rem 0.5rem', width: 'auto', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => setDeleteTarget({ kind: 'stage', id: st.id, label: `tahapan "${st.nama_tahapan}"` })}
                            title="Hapus Tahapan"
                          >
                            <IconTrash size={14} />
                          </button>
                        </td>
                      </tr>
                      )
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
                <span>Target: <strong>Rp {(project.nilai_project_deal || project.nilai_kontrak || 0).toLocaleString('id-ID')}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                <span style={{ color: '#7c3aed' }}>Masuk Yayasan: <strong>Rp {paidYayasan.toLocaleString('id-ID')}</strong></span>
                <span style={{ color: '#0369a1' }}>Masuk PT: <strong>Rp {paidPt.toLocaleString('id-ID')}</strong></span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, ((totalPaid / (project.nilai_project_deal || project.nilai_kontrak || 1)) * 100))}%`,
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
                    placeholder={`Nama Termin (kosong = Termin ${(project.billings?.length || 0) + 1})`}
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Atau buat cepat:</span>
                  <input
                    className="input-field"
                    type="number"
                    min={1}
                    max={50}
                    style={{ margin: 0, width: '80px' }}
                    value={bulkCount}
                    onChange={(e) => setBulkCount(e.target.value)}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>termin, nominal dibagi rata dari sisa nilai deal</span>
                  <button className="btn-primary btn-sm btn-secondary" type="button" onClick={handleBulkBilling}>Buat Termin Otomatis</button>
                </div>
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
                    <th>Tgl Uang Masuk</th>
                    <th>Yayasan (Rp)</th>
                    <th>PT (Rp)</th>
                    <th>BAST</th>
                    <th>Dok. Penagihan</th>
                    {canManageFinance && <th style={{ textAlign: 'right' }}>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {!project.billings || project.billings.length === 0 ? (
                    <tr>
                      <td colSpan={canManageFinance ? 10 : 9} style={{ textAlign: 'center', opacity: 0.5, padding: '1.5rem' }}>
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
                              onChange={(e) => {
                                const v = e.target.value;
                                if (!v || v.slice(0, 4) >= '2000') handleUpdateBillingField(b.id, 'tanggal_penagihan', v || null);
                              }}
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
                        <td>
                          {canManageFinance ? (
                            <input
                              className="input-field"
                              type="date"
                              style={{ margin: 0, padding: '0.25rem 0.4rem', width: '135px', fontSize: '0.8rem' }}
                              defaultValue={b.tanggal_uang_masuk || ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (!v || v.slice(0, 4) >= '2000') handleUpdateBillingField(b.id, 'tanggal_uang_masuk', v || null);
                              }}
                            />
                          ) : (
                            <span>{b.tanggal_uang_masuk || '-'}</span>
                          )}
                        </td>
                        {(['yayasan', 'pt'] as const).map((side) => {
                          const val = side === 'yayasan' ? b.nominal_yayasan : b.nominal_pt;
                          return (
                            <td key={side}>
                              {canManageFinance ? (
                                <input
                                  className="input-field"
                                  type="number"
                                  style={{ margin: 0, padding: '0.25rem 0.4rem', width: '120px', fontSize: '0.8rem' }}
                                  key={`${b.id}-${side}-${val}`}
                                  defaultValue={val || 0}
                                  onBlur={(e) => {
                                    if ((parseFloat(e.target.value) || 0) !== (val || 0)) handleSplit(b, side, e.target.value);
                                  }}
                                />
                              ) : (
                                <span>Rp {(val || 0).toLocaleString('id-ID')}</span>
                              )}
                            </td>
                          );
                        })}
                        {(['link_bast', 'link_dokumen_penagihan'] as const).map((field) => (
                          <td key={field}>
                            {b[field] && <ClickableText text={b[field]} buttonLabel={field === 'link_bast' ? 'Buka BAST' : 'Buka Dokumen'} />}
                            {canManageFinance && (
                              <input
                                className="input-field"
                                placeholder="URL..."
                                style={{ margin: 0, padding: '0.25rem 0.4rem', fontSize: '0.75rem', width: '140px' }}
                                defaultValue={b[field] || ''}
                                onBlur={(e) => {
                                  if ((e.target.value || null) !== (b[field] || null)) handleUpdateBillingField(b.id, field, e.target.value.trim() || null);
                                }}
                              />
                            )}
                            {!canManageFinance && !b[field] && <span className="text-dim">-</span>}
                          </td>
                        ))}
                        {canManageFinance && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-logout"
                              style={{ padding: '0.2rem 0.5rem', width: 'auto', display: 'inline-flex', alignItems: 'center' }}
                              onClick={() => setDeleteTarget({ kind: 'billing', id: b.id, label: 'termin penagihan ini' })}
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

      {/* CONFIRMATION POPUP UNTUK HAPUS */}
      {deleteTarget && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => setDeleteTarget(null)}>
          <div
            style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '420px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', textAlign: 'center', animation: 'modalSlide 0.2s ease' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <IconTrash size={26} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>Konfirmasi Hapus</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget.label}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-primary btn-secondary" onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '0.65rem' }}>Batal</button>
              <button className="btn-primary" onClick={executeDelete} style={{ flex: 1, padding: '0.65rem', background: '#dc2626' }}>Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteProject && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => setShowDeleteProject(false)}>
          <div
            style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '420px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.25)', textAlign: 'center', animation: 'modalSlide 0.2s ease' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <IconTrash size={26} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>Hapus Pekerjaan</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Apakah Anda yakin ingin menghapus <strong>"{project.nama_pekerjaan}"</strong> beserta seluruh tahapan dan termin penagihannya? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-primary btn-secondary" onClick={() => setShowDeleteProject(false)} style={{ flex: 1, padding: '0.65rem' }}>Batal</button>
              <button className="btn-primary" onClick={handleDeleteProject} style={{ flex: 1, padding: '0.65rem', background: '#dc2626' }}>Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

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
