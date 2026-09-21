'use client';
import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchWithAuth, formatCurrencySmart } from '../../lib/api';
import DetailModal from '../../components/DetailModal';
import SearchableSelect from '../../components/SearchableSelect';
import ClickableText from '../../components/ClickableText';
import CalendarWidget from '../../components/CalendarWidget';
import { IconTarget, IconFileText, IconFilter, IconFolder, IconChevronDown, IconChevronRight, IconUstek, IconEye, IconSearch, IconTrophy, IconClock, IconGlobe, IconUser, IconCalendar, IconTrash } from '../../components/Icons';

export default function MarketingPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat Halaman Marketing...</div>}>
      <MarketingContent />
    </Suspense>
  );
}

function MarketingContent() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get('view') || 'worksheet';

  const [projects, setProjects] = useState<any[]>([]);
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'bidding' | 'pl'>('bidding');
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [drilldownModal, setDrilldownModal] = useState<{ title: string; subtitle?: string; projects: any[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterTahapan, setFilterTahapan] = useState<string>('ALL');
  const [groupBy, setGroupBy] = useState<'both' | 'status' | 'tahapan' | 'none'>('both');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [expandedStageProjects, setExpandedStageProjects] = useState<Record<number, boolean>>({});

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleStageExpand = (projectId: number) => {
    setExpandedStageProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const handleUpdateBiddingStage = async (stageId: number, fields: Record<string, any>) => {
    await fetchWithAuth(`/bidding-stages/${stageId}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
    loadProjects();
  };

  const handleAddBiddingStage = async (projectId: number, namaTahapan: string) => {
    if (!namaTahapan) return;
    await fetchWithAuth(`/projects/${projectId}/bidding-stages`, {
      method: 'POST',
      body: JSON.stringify({
        nama_tahapan: namaTahapan,
        status: 'Onprogress',
      }),
    });
    loadProjects();
  };

  const handleDeleteBiddingStage = async (stageId: number) => {
    await fetchWithAuth(`/bidding-stages/${stageId}`, {
      method: 'DELETE',
    });
    loadProjects();
  };

  // Common Form Fields
  const [namaPekerjaan, setNamaPekerjaan] = useState('');
  const [pemberiKerja, setPemberiKerja] = useState('');
  const [satuanKerja, setSatuanKerja] = useState('');
  const [nilaiKontrak, setNilaiKontrak] = useState('');
  const [lokasi, setLokasi] = useState('Pusat');
  const [kategoriProject, setKategoriProject] = useState('Gov');
  const [metodePekerjaan, setMetodePekerjaan] = useState('Survey');
  const [jenisPekerjaan, setJenisPekerjaan] = useState('IT');
  const [keteranganTender, setKeteranganTender] = useState('');

  // Bidding Specific Fields
  const [tahapan, setTahapan] = useState('Upload PQ');
  const [statusProject, setStatusProject] = useState('Ongoing');
  const [deadlinePengumuman, setDeadlinePengumuman] = useState('');
  const [peringkat, setPeringkat] = useState('');
  const [prioritas, setPrioritas] = useState('Priority');
  const [pic, setPic] = useState('');

  useEffect(() => {
    loadProjects();
    loadUsers();
  }, []);

  const loadProjects = () => {
    fetchWithAuth('/projects')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
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

  const metodeOptions = useMemo(() => {
    const defaults = ['Survey', 'Kajian', 'Development'];
    const custom = projects
      .map((p) => p.metode_pekerjaan)
      .filter((v): v is string => Boolean(v) && v !== '+ Tambah Baru');
    const set = new Set([...defaults, ...custom]);
    return [...Array.from(set), '+ Tambah Baru'];
  }, [projects]);

  const jenisOptions = useMemo(() => {
    const defaults = [
      'IT',
      'Bisnis Intelligence',
      'Indeks',
      'Peta Potensi',
      'Evaluasi Program',
      'Manajemen',
      'Pendampingan',
      'Survei Politik',
      'Analisa Dapil',
      'Kelola Relawan',
    ];
    const custom = projects
      .map((p) => p.jenis_pekerjaan)
      .filter((v): v is string => Boolean(v) && v !== '+ Tambah Baru');
    const set = new Set([...defaults, ...custom]);
    return [...Array.from(set), '+ Tambah Baru'];
  }, [projects]);

const TAHAPAN_ORDER = ['Upload PQ', 'Evaluasi PQ', 'Pembuktian', 'Penyusunan Ustek', 'Upload Ustek'];

const getTahapanRank = (key: string) => {
  const index = TAHAPAN_ORDER.findIndex((t) => key.toLowerCase().includes(t.toLowerCase()));
  return index !== -1 ? index : 99;
};

  const getProjectTahapan = (p: any) => {
    if (!p) return 'Upload PQ';
    if (p.bidding_stages && p.bidding_stages.length > 0) {
      const activeStage = p.bidding_stages.find((st: any) => st.status === 'Onprogress');
      if (activeStage) return activeStage.nama_tahapan;
      const selesaiStages = p.bidding_stages.filter((st: any) => st.status === 'Selesai');
      if (selesaiStages.length > 0) {
        const sorted = [...selesaiStages].sort((a: any, b: any) => {
          const rankA = getTahapanRank(a.nama_tahapan);
          const rankB = getTahapanRank(b.nama_tahapan);
          return rankB - rankA;
        });
        return sorted[0].nama_tahapan;
      }
    }
    return p.tahapan || 'Upload PQ';
  };

  // Cascading Logic: Available Tahapan options based on selected Status Bidding filter
  const availableTahapanOptions = useMemo(() => {
    const biddingOnly = projects.filter((p) => (p.jenis_mekanisme || 'Bidding') === 'Bidding');
    let tahapanList: string[] = [];
    if (filterStatus === 'ALL') {
      tahapanList = Array.from(new Set(biddingOnly.map((p) => getProjectTahapan(p))));
    } else {
      const filteredByStatus = biddingOnly.filter((p) => (p.status_project || 'Ongoing') === filterStatus);
      tahapanList = Array.from(new Set(filteredByStatus.map((p) => getProjectTahapan(p))));
    }
    tahapanList.sort((a, b) => getTahapanRank(a) - getTahapanRank(b));
    return ['ALL', ...tahapanList];
  }, [projects, filterStatus]);

  const handleStatusFilterChange = (statusVal: string) => {
    setFilterStatus(statusVal);
    setFilterTahapan('ALL');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const isPL = activeTab === 'pl';
    const payload = {
      nama_pekerjaan: namaPekerjaan,
      pemberi_kerja: pemberiKerja,
      satuan_kerja: satuanKerja,
      nilai_kontrak: parseFloat(nilaiKontrak) || 0,
      lokasi: lokasi,
      kategori_project: kategoriProject,
      divisi_substansi: kategoriProject,
      metode_pekerjaan: metodePekerjaan,
      jenis_pekerjaan: jenisPekerjaan,
      keterangan_tender: keteranganTender,
      jenis_mekanisme: isPL ? 'PL' : 'Bidding',
      tahapan: isPL ? 'Penunjukan Langsung' : 'Upload PQ',
      status_project: isPL ? 'Menang' : statusProject,
      deadline_pengumuman: null,
      peringkat: isPL ? 'PL' : '-',
      prioritas: prioritas,
      pic_bidding: pic || null,
    };

    const res = await fetchWithAuth('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setNamaPekerjaan('');
      setPemberiKerja('');
      setSatuanKerja('');
      setNilaiKontrak('');
      setKeteranganTender('');
      setDeadlinePengumuman('');
      setPeringkat('');
      setPic('');
      setMetodePekerjaan('Survey');
      setJenisPekerjaan('IT');
      loadProjects();
    } else {
      const err = await res.json();
      alert(`Gagal menambah data: ${err.detail || 'Terjadi kesalahan'}`);
    }
  };

  const handleUpdate = async (id: number, fields: Record<string, any>) => {
    await fetchWithAuth(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
    loadProjects();
  };

  const rawBiddingProjects = projects.filter((p) => (p.jenis_mekanisme || 'Bidding') === 'Bidding');
  const rawPlProjects = projects.filter((p) => p.jenis_mekanisme === 'PL');

  const filteredPlProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rawPlProjects;
    return rawPlProjects.filter((p) => (
      (p.nama_pekerjaan || '').toLowerCase().includes(q) ||
      (p.pemberi_kerja || '').toLowerCase().includes(q) ||
      (p.satuan_kerja || '').toLowerCase().includes(q) ||
      (p.lokasi || '').toLowerCase().includes(q) ||
      (p.pic_bidding || '').toLowerCase().includes(q)
    ));
  }, [rawPlProjects, searchQuery]);

  const filteredBiddingProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rawBiddingProjects.filter((p) => {
      const pTahapan = getProjectTahapan(p);
      const matchStatus = filterStatus === 'ALL' || (p.status_project || 'Ongoing') === filterStatus;
      const matchTahapan = filterTahapan === 'ALL' || pTahapan === filterTahapan;
      const matchQuery = !q || (
        (p.nama_pekerjaan || '').toLowerCase().includes(q) ||
        (p.pemberi_kerja || '').toLowerCase().includes(q) ||
        (p.satuan_kerja || '').toLowerCase().includes(q) ||
        (p.lokasi || '').toLowerCase().includes(q) ||
        (p.pic_bidding || '').toLowerCase().includes(q)
      );
      return matchStatus && matchTahapan && matchQuery;
    });
  }, [rawBiddingProjects, filterStatus, filterTahapan, searchQuery]);

  const groupedBiddingProjects = useMemo(() => {
    if (groupBy === 'none') {
      const ongoing = filteredBiddingProjects.filter((p) => (p.status_project || 'Ongoing') === 'Ongoing');
      const others = filteredBiddingProjects.filter((p) => (p.status_project || 'Ongoing') !== 'Ongoing');
      return { 'Semua Record Bidding': { default: [...ongoing, ...others] } };
    }

    if (groupBy === 'both') {
      const statusGroups: Record<string, Record<string, any[]>> = {};
      filteredBiddingProjects.forEach((p) => {
        const sKey = `Status: ${p.status_project || 'Ongoing'}`;
        const tKey = `Tahapan: ${getProjectTahapan(p)}`;
        if (!statusGroups[sKey]) statusGroups[sKey] = {};
        if (!statusGroups[sKey][tKey]) statusGroups[sKey][tKey] = [];
        statusGroups[sKey][tKey].push(p);
      });

      const sortedStatusKeys = Object.keys(statusGroups).sort((a, b) => {
        const aIsOngoing = a.toLowerCase().includes('ongoing');
        const bIsOngoing = b.toLowerCase().includes('ongoing');
        if (aIsOngoing && !bIsOngoing) return -1;
        if (!aIsOngoing && bIsOngoing) return 1;
        return a.localeCompare(b);
      });

      const sortedResult: Record<string, Record<string, any[]>> = {};
      sortedStatusKeys.forEach((sKey) => {
        const subGroup = statusGroups[sKey];
        const sortedTKeys = Object.keys(subGroup).sort((a, b) => {
          const rankA = getTahapanRank(a);
          const rankB = getTahapanRank(b);
          if (rankA !== rankB) return rankA - rankB;
          return a.localeCompare(b);
        });
        const sortedSubGroup: Record<string, any[]> = {};
        sortedTKeys.forEach((tKey) => {
          sortedSubGroup[tKey] = subGroup[tKey];
        });
        sortedResult[sKey] = sortedSubGroup;
      });

      return sortedResult;
    }

    const groups: Record<string, any[]> = {};
    filteredBiddingProjects.forEach((p) => {
      const key = groupBy === 'status' ? `Status: ${p.status_project || 'Ongoing'}` : `Tahapan: ${getProjectTahapan(p)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (groupBy === 'status') {
        const aIsOngoing = a.toLowerCase().includes('ongoing');
        const bIsOngoing = b.toLowerCase().includes('ongoing');
        if (aIsOngoing && !bIsOngoing) return -1;
        if (!aIsOngoing && bIsOngoing) return 1;
        return a.localeCompare(b);
      } else {
        const rankA = getTahapanRank(a);
        const rankB = getTahapanRank(b);
        if (rankA !== rankB) return rankA - rankB;
        return a.localeCompare(b);
      }
    });

    const sortedGroups: Record<string, Record<string, any[]>> = {};
    sortedKeys.forEach((key) => {
      sortedGroups[key] = { default: groups[key] };
    });

    return sortedGroups;
  }, [filteredBiddingProjects, groupBy]);

  // Overview Tab Data Metrics
  const overviewMetrics = useMemo(() => {
    const totalBidding = rawBiddingProjects.length;
    const ongoingBidding = rawBiddingProjects.filter((p) => (p.status_project || 'Ongoing') === 'Ongoing').length;
    const menangBidding = rawBiddingProjects.filter((p) => p.status_project === 'Menang').length;
    const kalahBidding = rawBiddingProjects.filter((p) => p.status_project === 'Kalah').length;
    const totalPL = rawPlProjects.length;
    const totalBiddingNilai = rawBiddingProjects.reduce((acc, curr) => acc + (curr.nilai_kontrak || 0), 0);
    const totalPLNilai = rawPlProjects.reduce((acc, curr) => acc + (curr.nilai_kontrak || 0), 0);
    const priorityCount = rawBiddingProjects.filter((p) => p.prioritas === 'Priority').length;
    const nonPriorityCount = rawBiddingProjects.filter((p) => p.prioritas === 'Non-Priority').length;
    const undertableCount = rawBiddingProjects.filter((p) => p.prioritas === 'Deal Undertable').length;

    return {
      totalBidding,
      ongoingBidding,
      menangBidding,
      kalahBidding,
      totalPL,
      totalBiddingNilai,
      totalPLNilai,
      priorityCount,
      nonPriorityCount,
      undertableCount,
    };
  }, [rawBiddingProjects, rawPlProjects]);

  // Tahapan Seleksi Breakdown for Overview
  const tahapanSeleksiBreakdown = useMemo(() => {
    const standardStages = ['Upload PQ', 'Evaluasi PQ', 'Pembuktian', 'Penyusunan Ustek', 'Upload Ustek'];
    const map: Record<string, { count: number; totalNilai: number; projects: any[] }> = {};

    standardStages.forEach((s) => {
      map[s] = { count: 0, totalNilai: 0, projects: [] };
    });

    rawBiddingProjects.forEach((p) => {
      const stage = p.tahapan || 'Upload PQ';
      if (!map[stage]) {
        map[stage] = { count: 0, totalNilai: 0, projects: [] };
      }
      map[stage].count += 1;
      map[stage].totalNilai += p.nilai_kontrak || 0;
      map[stage].projects.push(p);
    });

    return map;
  }, [rawBiddingProjects]);

  // Calendar events for Seleksi Deadlines
  const biddingCalendarEvents = useMemo(() => {
    return rawBiddingProjects
      .filter((p) => p.deadline_pengumuman && p.status_project === 'Ongoing')
      .map((p) => ({
        id: p.id,
        dateStr: p.deadline_pengumuman,
        project: p,
        type: 'bidding' as const,
        title: p.nama_pekerjaan,
        stageOrPic: p.tahapan || 'Seleksi',
      }));
  }, [rawBiddingProjects]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Kontrol Bidding & Penunjukan Langsung (IR)</h1>
        <p className="page-desc">Workspace Marketing untuk mengelola Kontrol Bidding (Seleksi) dan Penunjukan Langsung.</p>
      </div>

      {/* OVERVIEW SUB-MENU VIEW */}
      {currentView === 'overview' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="stat-card">
              <span className="stat-label">Total Pekerjaan Seleksi</span>
              <span className="stat-value">{overviewMetrics.totalBidding}</span>
              <span className="stat-sub">Nilai: {formatCurrencySmart(overviewMetrics.totalBiddingNilai)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Seleksi Ongoing</span>
              <span className="stat-value" style={{ color: '#f59e0b' }}>{overviewMetrics.ongoingBidding}</span>
              <span className="stat-sub">Sedang berjalan</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Seleksi Menang</span>
              <span className="stat-value" style={{ color: '#10b981' }}>{overviewMetrics.menangBidding}</span>
              <span className="stat-sub">Tender Gol</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Seleksi Kalah / Batal</span>
              <span className="stat-value" style={{ color: '#ef4444' }}>{overviewMetrics.kalahBidding}</span>
              <span className="stat-sub">Tidak berlanjut</span>
            </div>
            <div className="stat-card finance">
              <span className="stat-label">Total Penunjukan Langsung (PL)</span>
              <span className="stat-value">{overviewMetrics.totalPL}</span>
              <span className="stat-sub">Nilai: {formatCurrencySmart(overviewMetrics.totalPLNilai)}</span>
            </div>
          </div>

          {/* TAHAPAN SELESI & PRIORITAS SELEKSI OVERVIEW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            
            {/* CARD 1: BREAKDOWN TAHAPAN SELEKSI */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconUstek size={20} color="#0284c7" /> Monitoring Tahapan Seleksi
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.keys(tahapanSeleksiBreakdown).map((stageName) => {
                  const data = tahapanSeleksiBreakdown[stageName];
                  const pct = rawBiddingProjects.length > 0 ? Math.round((data.count / rawBiddingProjects.length) * 100) : 0;
                  return (
                    <div
                      key={stageName}
                      style={{
                        padding: '0.75rem',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onClick={() => setDrilldownModal({ title: `📋 Tahapan Seleksi: ${stageName}`, subtitle: `Total: ${data.count} Project (${formatCurrencySmart(data.totalNilai)})`, projects: data.projects })}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                          🔹 {stageName}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0284c7' }}>
                            {formatCurrencySmart(data.totalNilai)}
                          </span>
                          <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.8rem' }}>
                            {data.count} Proj ({pct}%)
                          </span>
                        </div>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, background: '#0284c7', height: '100%' }} title={`${stageName}: ${pct}%`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CARD 2: BREAKDOWN PRIORITAS SELEKSI */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconTarget size={20} color="#6366f1" /> Breakdown Prioritas Seleksi
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 600, color: '#4338ca' }}>🔥 Priority</span>
                  <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.9rem' }}>{overviewMetrics.priorityCount} Tender</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>☕ Non-Priority</span>
                  <span className="badge" style={{ background: '#f1f5f9', color: '#334155', fontSize: '0.9rem' }}>{overviewMetrics.nonPriorityCount} Tender</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 600, color: '#d97706' }}>🤝 Deal Undertable</span>
                  <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.9rem' }}>{overviewMetrics.undertableCount} Tender</span>
                </div>
              </div>
            </div>

          </div>

          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconUser size={20} color="#0284c7" /> Daftar Karyawan / User Management
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Jumlah Karyawan terdaftar: <strong>{internalUsers.length} Orang</strong>. Mengelola PIC untuk penugasan Seleksi & Ustek.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {internalUsers.map((u) => (
                <span key={u.id} className="badge" style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.4rem 0.6rem' }}>
                  👤 {u.nama || u.username} ({u.divisi || u.role})
                </span>
              ))}
            </div>
          </div>

          <div>
            <CalendarWidget
              title="Jadwal Deadline Pengumuman Seleksi"
              type="bidding"
              events={biddingCalendarEvents}
              onSelectProject={(p) => setSelectedProject(p)}
            />
          </div>
        </div>
      ) : (
        /* LEMBAR KERJA (WORKSHEET) VIEW */
        <>
          {/* Tabs Switcher */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <button
              className={`btn-primary ${activeTab === 'bidding' ? '' : 'btn-secondary'}`}
              onClick={() => setActiveTab('bidding')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <IconTarget size={18} /> Daftar Bidding ({rawBiddingProjects.length})
            </button>
            <button
              className={`btn-primary ${activeTab === 'pl' ? '' : 'btn-secondary'}`}
              onClick={() => setActiveTab('pl')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <IconFileText size={18} /> Penunjukan Langsung (PL) ({rawPlProjects.length})
            </button>
          </div>

          {/* FORM RECORD */}
          <div className="glass-card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
              {activeTab === 'bidding' ? '+ Tambah Pekerjaan Bidding Baru' : '+ Tambah Pekerjaan PL Baru'}
            </h2>
            
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Nama Pekerjaan</label>
                  <input
                    className="input-field"
                    placeholder="Nama Pekerjaan / Tender..."
                    value={namaPekerjaan}
                    onChange={(e) => setNamaPekerjaan(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Pemberi Kerja</label>
                  <input
                    className="input-field"
                    placeholder="Instansi / Dinas..."
                    value={pemberiKerja}
                    onChange={(e) => setPemberiKerja(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Satuan Kerja</label>
                  <input
                    className="input-field"
                    placeholder="Satker / Bidang..."
                    value={satuanKerja}
                    onChange={(e) => setSatuanKerja(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr 1.2fr 1.2fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Nilai Pekerjaan (Rp)</label>
                  <input
                    className="input-field"
                    type="number"
                    placeholder="250000000"
                    value={nilaiKontrak}
                    onChange={(e) => setNilaiKontrak(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Lokasi</label>
                  <SearchableSelect
                    value={lokasi}
                    onChange={(val) => setLokasi(val)}
                    options={['Pusat', 'Cabang Jatim', 'Cabang Jateng']}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Kategori Project</label>
                  <SearchableSelect
                    value={kategoriProject}
                    onChange={(val) => setKategoriProject(val)}
                    options={[
                      { value: 'Gov', label: 'Gov (Government)' },
                      { value: 'Pol', label: 'Pol (Political)' },
                    ]}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Metode Pekerjaan</label>
                  <SearchableSelect
                    value={metodePekerjaan}
                    onChange={(val) => setMetodePekerjaan(val)}
                    options={metodeOptions}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Jenis Pekerjaan</label>
                  <SearchableSelect
                    value={jenisPekerjaan}
                    onChange={(val) => setJenisPekerjaan(val)}
                    options={jenisOptions}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Prioritas</label>
                  <SearchableSelect
                    value={prioritas}
                    onChange={(val) => setPrioritas(val)}
                    options={[
                      { value: 'Priority', label: '🔥 Priority' },
                      { value: 'Non-Priority', label: '☕ Non-Priority' },
                      { value: 'Deal Undertable', label: '🤝 Deal Undertable' },
                    ]}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">PIC Marketing</label>
                  <SearchableSelect
                    value={pic}
                    onChange={(val) => setPic(val)}
                    options={userOptions}
                    placeholder="Pilih PIC..."
                  />
                </div>
              </div>

              {activeTab === 'bidding' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Status Bidding</label>
                    <SearchableSelect
                      value={statusProject}
                      onChange={(val) => setStatusProject(val)}
                      options={['Ongoing', 'Menang', 'Kalah', 'Batal', 'Tidak Memenuhi Ambang Batas']}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Keterangan / Link SPSE</label>
                  <input
                    className="input-field"
                    placeholder="Catatan tambahan or link..."
                    value={keteranganTender}
                    onChange={(e) => setKeteranganTender(e.target.value)}
                  />
                </div>
                <button className="btn-primary" type="submit" style={{ height: '42px', minWidth: '150px' }}>
                  + Simpan Record
                </button>
              </div>
            </form>
          </div>

          {/* CASCADING FILTER & GROUPING CONTROLS FOR BIDDING */}
          {activeTab === 'bidding' && (
            <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a5b4fc', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <IconFilter size={16} color="#a5b4fc" /> CASCADING FILTER & KELOMPOK RECORD BIDDING
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                
                {/* Filter Level 1: Status Bidding */}
                <div className="input-group">
                  <label className="input-label">1. Filter Status Bidding</label>
                  <SearchableSelect
                    style={{ margin: 0 }}
                    value={filterStatus}
                    onChange={(val) => handleStatusFilterChange(val)}
                    options={[
                      { value: 'ALL', label: 'Semua Status Bidding' },
                      'Ongoing',
                      'Menang',
                      'Kalah',
                      'Batal',
                      'Tidak Memenuhi Ambang Batas',
                    ]}
                  />
                </div>

                {/* Filter Level 2: Cascading Tahapan */}
                <div className="input-group">
                  <label className="input-label">2. Cascading Tahapan ({availableTahapanOptions.length - 1} Opsi)</label>
                  <SearchableSelect
                    style={{ margin: 0 }}
                    value={filterTahapan}
                    onChange={(val) => setFilterTahapan(val)}
                    options={availableTahapanOptions.map((opt) => ({
                      value: opt,
                      label: opt === 'ALL' ? 'Semua Tahapan' : opt,
                    }))}
                  />
                </div>

                {/* Grouping Toggle */}
                <div className="input-group">
                  <label className="input-label">Group By (Kelompokkan)</label>
                  <SearchableSelect
                    style={{ margin: 0 }}
                    value={groupBy}
                    onChange={(val) => setGroupBy(val)}
                    options={[
                      { value: 'both', label: 'Group by Status & Tahapan' },
                      { value: 'status', label: 'Group by Status Bidding' },
                      { value: 'tahapan', label: 'Group by Tahapan' },
                      { value: 'none', label: 'Tanpa Grouping' },
                    ]}
                  />
                </div>

              </div>
            </div>
          )}

          {/* TABLE DISPLAY */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                {activeTab === 'bidding' ? `Data Bidding (${filteredBiddingProjects.length} Record)` : `Data Penunjukan Langsung (${filteredPlProjects.length} Record)`}
              </h2>

              <div style={{ position: 'relative', minWidth: '300px', flex: 1, maxWidth: '420px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="🔍 Cari nama pekerjaan, pemberi kerja, lokasi, PIC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.5rem', width: '100%', margin: 0 }}
                />
                <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}>
                  <IconSearch size={16} />
                </span>
              </div>
            </div>

            {activeTab === 'bidding' ? (
              Object.keys(groupedBiddingProjects).map((groupTitle) => {
                const isCollapsed = Boolean(collapsedGroups[groupTitle]);
                const subGroups: Record<string, any[]> = (groupedBiddingProjects as any)[groupTitle] || {};
                const totalInGroup = Object.values(subGroups).reduce((sum: number, arr: any[]) => sum + (arr ? arr.length : 0), 0);

                return (
                  <div key={groupTitle} style={{ marginBottom: '1.5rem' }}>
                    {groupBy !== 'none' && (
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
                            {totalInGroup} Record
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {isCollapsed ? 'Klik untuk membuka' : 'Klik untuk menutup'}
                        </span>
                      </div>
                    )}

                    {!isCollapsed &&
                      Object.keys(subGroups).map((subTitle) => {
                        const items = subGroups[subTitle];
                        const subKey = `${groupTitle}___${subTitle}`;
                        const isSubCollapsed = Boolean(collapsedGroups[subKey]);

                        return (
                          <div key={subTitle} style={{ marginBottom: groupBy === 'both' ? '1rem' : '0' }}>
                            {groupBy === 'both' && (
                              <div
                                onClick={() => toggleGroupCollapse(subKey)}
                                style={{
                                  fontSize: '0.875rem',
                                  fontWeight: 700,
                                  color: '#334155',
                                  padding: '0.45rem 0.75rem',
                                  background: '#f8fafc',
                                  borderRadius: '6px',
                                  marginBottom: '0.5rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  userSelect: 'none',
                                  border: '1px solid #cbd5e1',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                  transition: 'all 0.15s ease-in-out'
                                }}
                              >
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                                  <span style={{ color: '#0284c7', display: 'inline-flex', alignItems: 'center' }}>
                                    {isSubCollapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
                                  </span>
                                  <IconUstek size={14} color="#0284c7" /> {subTitle} ({items.length} Record)
                                </div>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                                  {isSubCollapsed ? 'Klik untuk membuka' : 'Klik untuk menutup'}
                                </span>
                              </div>
                            )}

                            {!isSubCollapsed && (
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
                                      <th>Metode</th>
                                      <th>Jenis Pekerjaan</th>
                                      <th>Prioritas</th>
                                      <th>PIC</th>
                                      <th>Tahapan Bidding</th>
                                      <th>Status Bidding</th>
                                      <th>Peringkat</th>
                                      <th style={{ textAlign: 'right' }}>Aksi</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.length === 0 ? (
                                      <tr>
                                        <td colSpan={14} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                                          Tidak ada record di kelompok ini.
                                        </td>
                                      </tr>
                                    ) : (
                                      items.map((p: any, idx: number) => {
                                        const isStageExpanded = Boolean(expandedStageProjects[p.id]);
                                        const completedStagesCount = (p.bidding_stages || []).filter((s: any) => s.status === 'Selesai').length;
                                        const totalStagesCount = (p.bidding_stages || []).length || 5;

                                        return (
                                          <React.Fragment key={p.id}>
                                            <tr style={{ background: isStageExpanded ? '#f0f9ff' : undefined }}>
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
                                                <span className={`badge ${p.kategori_project === 'Gov' || p.divisi_substansi === 'Gov' ? 'badge-gov' : 'badge-pol'}`}>
                                                  {p.kategori_project || p.divisi_substansi || 'Gov'}
                                                </span>
                                              </td>
                                              <td>
                                                <SearchableSelect
                                                  compact
                                                  style={{ margin: 0, width: '120px' }}
                                                  value={p.metode_pekerjaan || ''}
                                                  onChange={(val) => handleUpdate(p.id, { metode_pekerjaan: val })}
                                                  options={metodeOptions}
                                                  placeholder="Metode"
                                                />
                                              </td>
                                              <td>
                                                <SearchableSelect
                                                  compact
                                                  style={{ margin: 0, width: '140px' }}
                                                  value={p.jenis_pekerjaan || ''}
                                                  onChange={(val) => handleUpdate(p.id, { jenis_pekerjaan: val })}
                                                  options={jenisOptions}
                                                  placeholder="Jenis"
                                                />
                                              </td>
                                              <td>
                                                <SearchableSelect
                                                  compact
                                                  style={{ margin: 0, width: '130px' }}
                                                  value={p.prioritas || 'Priority'}
                                                  onChange={(val) => handleUpdate(p.id, { prioritas: val })}
                                                  options={[
                                                    { value: 'Priority', label: '🔥 Priority' },
                                                    { value: 'Non-Priority', label: '☕ Non-Priority' },
                                                    { value: 'Deal Undertable', label: '🤝 Undertable' },
                                                  ]}
                                                />
                                              </td>
                                              <td>
                                                <SearchableSelect
                                                  compact
                                                  style={{ margin: 0, width: '120px' }}
                                                  value={p.pic_bidding || ''}
                                                  onChange={(val) => handleUpdate(p.id, { pic_bidding: val })}
                                                  options={userOptions}
                                                  placeholder="Pilih PIC"
                                                />
                                              </td>
                                              <td>
                                                <button
                                                  type="button"
                                                  className="btn-primary btn-sm"
                                                  style={{
                                                    background: isStageExpanded ? 'linear-gradient(135deg, #4f46e5, #4338ca)' : '#e0e7ff',
                                                    color: isStageExpanded ? '#ffffff' : '#3730a3',
                                                    border: `1px solid ${isStageExpanded ? '#4338ca' : '#c7d2fe'}`,
                                                    padding: '0.35rem 0.65rem',
                                                    fontSize: '0.775rem',
                                                    fontWeight: 700,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                    cursor: 'pointer',
                                                    borderRadius: '6px',
                                                    whiteSpace: 'nowrap'
                                                  }}
                                                  onClick={() => toggleStageExpand(p.id)}
                                                >
                                                  <IconCalendar size={14} />
                                                  <span>
                                                    {totalStagesCount} Record Tahapan ({completedStagesCount}/{totalStagesCount} Selesai)
                                                  </span>
                                                  {isStageExpanded ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
                                                </button>
                                              </td>
                                              <td>
                                                <SearchableSelect
                                                  compact
                                                  style={{ margin: 0, width: '150px' }}
                                                  value={p.status_project || 'Ongoing'}
                                                  onChange={(val) => handleUpdate(p.id, { status_project: val })}
                                                  options={[
                                                    { value: 'Ongoing', label: '🟡 Ongoing' },
                                                    { value: 'Menang', label: '🟢 Menang' },
                                                    { value: 'Kalah', label: '🔴 Kalah' },
                                                    { value: 'Batal', label: '⚪ Batal' },
                                                    { value: 'Tidak Memenuhi Ambang Batas', label: '⚠️ Ambang Batas' },
                                                  ]}
                                                />
                                              </td>
                                              <td>{p.peringkat || '-'}</td>
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

                                            {/* EXPANDABLE MULTI-RECORD TAHAPAN PANEL */}
                                            {isStageExpanded && (
                                              <tr style={{ background: '#f8fafc' }}>
                                                <td colSpan={14} style={{ padding: '1rem 1.25rem', borderBottom: '2px solid #cbd5e1' }}>
                                                  <div
                                                    style={{
                                                      background: '#ffffff',
                                                      borderRadius: '10px',
                                                      border: '1px solid #cbd5e1',
                                                      padding: '1.25rem',
                                                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                                                    }}
                                                  >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                                          📋 Record Tahapan Bidding: <strong>{p.nama_pekerjaan}</strong>
                                                        </span>
                                                        <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: 700 }}>
                                                          {totalStagesCount} Tahapan Tercatat
                                                        </span>
                                                      </div>
                                                      <button
                                                        type="button"
                                                        className="btn-primary btn-sm btn-secondary"
                                                        style={{ fontSize: '0.775rem', padding: '0.3rem 0.75rem', background: '#f1f5f9', border: '1px solid #cbd5e1' }}
                                                        onClick={() => {
                                                          const customName = prompt('Masukkan Nama Tahapan Bidding Baru:');
                                                          if (customName) handleAddBiddingStage(p.id, customName);
                                                        }}
                                                      >
                                                        + Tambah Tahapan Custom
                                                      </button>
                                                    </div>

                                                    <div className="table-container" style={{ margin: 0, boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                                      <table style={{ background: '#ffffff', margin: 0 }}>
                                                        <thead style={{ background: '#f8fafc' }}>
                                                          <tr>
                                                            <th style={{ width: '40px', textAlign: 'center', color: '#475569' }}>No.</th>
                                                            <th style={{ color: '#475569' }}>Nama Tahapan Bidding</th>
                                                            <th style={{ color: '#475569' }}>Tanggal Deadline</th>
                                                            <th style={{ color: '#475569' }}>Status Tahapan</th>
                                                            <th style={{ color: '#475569' }}>Keterangan / Notes</th>
                                                            <th style={{ width: '60px', textAlign: 'right', color: '#475569' }}>Aksi</th>
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {(!p.bidding_stages || p.bidding_stages.length === 0) ? (
                                                            <tr>
                                                              <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '1.25rem' }}>
                                                                Belum ada record tahapan untuk pekerjaan ini.
                                                              </td>
                                                            </tr>
                                                          ) : (
                                                            p.bidding_stages.map((st: any, sIdx: number) => (
                                                              <tr key={st.id || sIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{sIdx + 1}.</td>
                                                                <td style={{ fontWeight: 700, color: '#0f172a' }}>{st.nama_tahapan}</td>
                                                                <td>
                                                                  <input
                                                                    className="input-field"
                                                                    type="date"
                                                                    style={{ margin: 0, padding: '0.3rem 0.5rem', fontSize: '0.825rem', width: '150px' }}
                                                                    value={st.tanggal_deadline || ''}
                                                                    onChange={(e) => handleUpdateBiddingStage(st.id, { tanggal_deadline: e.target.value || null })}
                                                                  />
                                                                </td>
                                                                <td>
                                                                  <SearchableSelect
                                                                    compact
                                                                    style={{ margin: 0, width: '160px' }}
                                                                    value={st.status || 'Onprogress'}
                                                                    onChange={(val) => handleUpdateBiddingStage(st.id, { status: val })}
                                                                    options={[
                                                                      { value: 'Onprogress', label: '🟡 Onprogress' },
                                                                      { value: 'Selesai', label: '🟢 Selesai' },
                                                                    ]}
                                                                  />
                                                                </td>
                                                                <td>
                                                                  <input
                                                                    className="input-field"
                                                                    placeholder="Catatan / keterangan..."
                                                                    style={{ margin: 0, padding: '0.3rem 0.5rem', fontSize: '0.825rem', width: '100%' }}
                                                                    defaultValue={st.keterangan || ''}
                                                                    onBlur={(e) => handleUpdateBiddingStage(st.id, { keterangan: e.target.value || null })}
                                                                  />
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                  <button
                                                                    type="button"
                                                                    className="btn-logout"
                                                                    style={{ padding: '0.2rem 0.5rem', width: 'auto', display: 'inline-flex', alignItems: 'center' }}
                                                                    onClick={() => handleDeleteBiddingStage(st.id)}
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
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
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
                    }
                  </div>
                );
              })
            ) : (
              /* PENUNJUKAN LANGSUNG (PL) TABLE */
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
                      <th>Metode</th>
                      <th>Jenis Pekerjaan</th>
                      <th>PIC</th>
                      <th>Status Bidding</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlProjects.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                          Tidak ada data Penunjukan Langsung (PL) yang sesuai.
                        </td>
                      </tr>
                    ) : (
                      filteredPlProjects.map((p, idx) => (
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
                            <span className={`badge ${p.kategori_project === 'Gov' || p.divisi_substansi === 'Gov' ? 'badge-gov' : 'badge-pol'}`}>
                              {p.kategori_project || p.divisi_substansi || 'Gov'}
                            </span>
                          </td>
                          <td>
                            <SearchableSelect
                              compact
                              style={{ margin: 0, width: '120px' }}
                              value={p.metode_pekerjaan || ''}
                              onChange={(val) => handleUpdate(p.id, { metode_pekerjaan: val })}
                              options={metodeOptions}
                              placeholder="Metode"
                            />
                          </td>
                          <td>
                            <SearchableSelect
                              compact
                              style={{ margin: 0, width: '140px' }}
                              value={p.jenis_pekerjaan || ''}
                              onChange={(val) => handleUpdate(p.id, { jenis_pekerjaan: val })}
                              options={jenisOptions}
                              placeholder="Jenis"
                            />
                          </td>
                          <td>
                            <SearchableSelect
                              compact
                              style={{ margin: 0, width: '120px' }}
                              value={p.pic_bidding || ''}
                              onChange={(val) => handleUpdate(p.id, { pic_bidding: val })}
                              options={userOptions}
                              placeholder="Pilih PIC"
                            />
                          </td>
                          <td>
                            <span className="badge badge-win">🟢 PL (Menang)</span>
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {drilldownModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
          onClick={() => setDrilldownModal(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '850px',
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc'
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {drilldownModal.title}
                </h2>
                {drilldownModal.subtitle && (
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {drilldownModal.subtitle}
                  </p>
                )}
              </div>
              <button
                className="btn-logout"
                style={{ width: 'auto', padding: '0.4rem 0.6rem' }}
                onClick={() => setDrilldownModal(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {drilldownModal.projects.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  Tidak ada project dalam kategori ini.
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                        <th>Nama Pekerjaan</th>
                        <th>Pemberi Kerja</th>
                        <th>Nilai (Rp)</th>
                        <th>Tahapan</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drilldownModal.projects.map((p, idx) => (
                        <tr key={p.id}>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{p.nama_pekerjaan}</td>
                          <td>{p.pemberi_kerja || '-'}</td>
                          <td style={{ color: '#34d399', fontWeight: 700 }}>Rp {(p.nilai_kontrak || 0).toLocaleString('id-ID')}</td>
                          <td>{p.tahapan || 'Upload PQ'}</td>
                          <td>{p.status_project || 'Ongoing'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-primary btn-sm btn-secondary"
                              onClick={() => {
                                setSelectedProject(p);
                                setDrilldownModal(null);
                              }}
                            >
                              Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DetailModal project={selectedProject} onClose={() => setSelectedProject(null)} onRefresh={loadProjects} />
    </div>
  );
}
