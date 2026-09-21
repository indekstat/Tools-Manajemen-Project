'use client';
import { useEffect, useState, useMemo } from 'react';
import { fetchWithAuth, formatCurrencySmart, isAdministrasiSelesai, isProjectSelesaiAkhir } from '../lib/api';
import DetailModal from '../components/DetailModal';
import CalendarWidget from '../components/CalendarWidget';
import ClickableText from '../components/ClickableText';
import { IconDashboard, IconChart, IconBidding, IconFinance, IconCalendar, IconUstek, IconCheck, IconClock, IconEye, IconClose, IconSearch, IconTrophy, IconAlertTriangle, IconGov, IconPol, IconFileText, IconTarget, IconUser } from '../components/Icons';

export default function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [drilldownModal, setDrilldownModal] = useState<{ title: string; subtitle?: string; projects: any[] } | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = () => {
    fetchWithAuth('/projects')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  // Pekerjaan Menang (Bidding Menang + Penunjukan Langsung / PL)
  const wonProjects = useMemo(() => {
    return projects.filter((p) => p.status_project === 'Menang' || p.jenis_mekanisme === 'PL');
  }, [projects]);

  const totalWonCount = wonProjects.length;
  const totalWonValue = wonProjects.reduce((sum, p) => sum + (p.nilai_kontrak || 0), 0);

  // ==========================================
  // SECTION 1: METRICS PROJECT MENANG (PERBANDINGAN JUMLAH & PERBANDINGAN NILAI)
  // ==========================================
  const sec1Metrics = useMemo(() => {
    // By Divisi (Gov vs Pol)
    const govWonList = wonProjects.filter((p) => (p.divisi_substansi || p.kategori_project) === 'Gov');
    const polWonList = wonProjects.filter((p) => (p.divisi_substansi || p.kategori_project) === 'Pol');
    
    const govWonCount = govWonList.length;
    const polWonCount = polWonList.length;
    const govWonCountPct = totalWonCount > 0 ? ((govWonCount / totalWonCount) * 100).toFixed(1) : '0';
    const polWonCountPct = totalWonCount > 0 ? ((polWonCount / totalWonCount) * 100).toFixed(1) : '0';

    const govWonNilai = govWonList.reduce((sum, p) => sum + (p.nilai_kontrak || 0), 0);
    const polWonNilai = polWonList.reduce((sum, p) => sum + (p.nilai_kontrak || 0), 0);
    const govWonNilaiPct = totalWonValue > 0 ? ((govWonNilai / totalWonValue) * 100).toFixed(1) : '0';
    const polWonNilaiPct = totalWonValue > 0 ? ((polWonNilai / totalWonValue) * 100).toFixed(1) : '0';

    // By Metode Pengadaan (Seleksi/Bidding vs PL)
    const biddingWonList = wonProjects.filter((p) => (p.jenis_mekanisme || 'Bidding') === 'Bidding');
    const plWonList = wonProjects.filter((p) => p.jenis_mekanisme === 'PL');

    const biddingWonCount = biddingWonList.length;
    const plWonCount = plWonList.length;
    const biddingWonCountPct = totalWonCount > 0 ? ((biddingWonCount / totalWonCount) * 100).toFixed(1) : '0';
    const plWonCountPct = totalWonCount > 0 ? ((plWonCount / totalWonCount) * 100).toFixed(1) : '0';

    const biddingWonNilai = biddingWonList.reduce((sum, p) => sum + (p.nilai_kontrak || 0), 0);
    const plWonNilai = plWonList.reduce((sum, p) => sum + (p.nilai_kontrak || 0), 0);
    const biddingWonNilaiPct = totalWonValue > 0 ? ((biddingWonNilai / totalWonValue) * 100).toFixed(1) : '0';
    const plWonNilaiPct = totalWonValue > 0 ? ((plWonNilai / totalWonValue) * 100).toFixed(1) : '0';

    return {
      totalWonCount,
      totalWonValue,
      govWonList,
      polWonList,
      govWonCount,
      govWonCountPct,
      polWonCount,
      polWonCountPct,
      govWonNilai,
      govWonNilaiPct,
      polWonNilai,
      polWonNilaiPct,
      biddingWonList,
      plWonList,
      biddingWonCount,
      biddingWonCountPct,
      plWonCount,
      plWonCountPct,
      biddingWonNilai,
      biddingWonNilaiPct,
      plWonNilai,
      plWonNilaiPct,
    };
  }, [wonProjects, totalWonCount, totalWonValue]);

  // ==========================================
  // SECTION 2: STATUS PROJECT (GRAPHICS & DRILLDOWNS)
  // ==========================================
  const sec2Metrics = useMemo(() => {
    // 1. By Substansi
    const substansiSelesaiList = wonProjects.filter((p) => p.status_selesai_substansi);
    const substansiOnprogressList = wonProjects.filter((p) => !p.status_selesai_substansi);
    const substansiSelesaiCount = substansiSelesaiList.length;
    const substansiOnprogressCount = substansiOnprogressList.length;
    const substansiSelesaiPct = totalWonCount > 0 ? Math.round((substansiSelesaiCount / totalWonCount) * 100) : 0;
    const substansiOnprogressPct = totalWonCount > 0 ? Math.round((substansiOnprogressCount / totalWonCount) * 100) : 0;

    // 2. By Administrasi
    const adminDoneList = wonProjects.filter((p) => isAdministrasiSelesai(p));
    const adminNoDocsList = wonProjects.filter((p) => !isAdministrasiSelesai(p) && !(p.link_spk && p.link_bast && p.link_referensi));
    const adminPendingPaidList = wonProjects.filter((p) => !isAdministrasiSelesai(p) && (p.link_spk && p.link_bast && p.link_referensi));
    const adminDoneCount = adminDoneList.length;
    const adminNoDocsCount = adminNoDocsList.length;
    const adminPendingPaidCount = adminPendingPaidList.length;
    const adminDonePct = totalWonCount > 0 ? Math.round((adminDoneCount / totalWonCount) * 100) : 0;
    const adminNoDocsPct = totalWonCount > 0 ? Math.round((adminNoDocsCount / totalWonCount) * 100) : 0;
    const adminPendingPaidPct = totalWonCount > 0 ? Math.round((adminPendingPaidCount / totalWonCount) * 100) : 0;

    // 3. By Status Akhir
    const finalDoneList = wonProjects.filter((p) => isProjectSelesaiAkhir(p));
    const finalOnprogressList = wonProjects.filter((p) => !isProjectSelesaiAkhir(p));
    const finalDoneCount = finalDoneList.length;
    const finalOnprogressCount = finalOnprogressList.length;
    const finalDonePct = totalWonCount > 0 ? Math.round((finalDoneCount / totalWonCount) * 100) : 0;
    const finalOnprogressPct = totalWonCount > 0 ? Math.round((finalOnprogressCount / totalWonCount) * 100) : 0;

    return {
      substansiSelesaiList,
      substansiOnprogressList,
      substansiSelesaiCount,
      substansiOnprogressCount,
      substansiSelesaiPct,
      substansiOnprogressPct,
      adminDoneList,
      adminNoDocsList,
      adminPendingPaidList,
      adminDoneCount,
      adminNoDocsCount,
      adminPendingPaidCount,
      adminDonePct,
      adminNoDocsPct,
      adminPendingPaidPct,
      finalDoneList,
      finalOnprogressList,
      finalDoneCount,
      finalOnprogressCount,
      finalDonePct,
      finalOnprogressPct,
    };
  }, [wonProjects, totalWonCount]);

  // ==========================================
  // SECTION 3: STATUS BILLING & FINANCE
  // ==========================================
  const sec3Metrics = useMemo(() => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    let totalSudahCair = 0;
    let totalHarusDitagihBulanIni = 0;
    const currentMonthBillings: any[] = [];
    const paidProjectsList: any[] = [];

    projects.forEach((p) => {
      let isPaid = false;
      (p.billings || []).forEach((b: any) => {
        if (b.status === 'Sudah dibayarkan') {
          totalSudahCair += b.nominal || 0;
          isPaid = true;
        }

        if (b.tanggal_penagihan) {
          const bDate = new Date(b.tanggal_penagihan);
          if (bDate.getFullYear() === currentYear && bDate.getMonth() + 1 === currentMonth) {
            totalHarusDitagihBulanIni += b.nominal || 0;
            currentMonthBillings.push({
              ...b,
              projectName: p.nama_pekerjaan,
              pemberiKerja: p.pemberi_kerja,
              project: p,
            });
          }
        }
      });
      if (isPaid) paidProjectsList.push(p);
    });

    const MONTH_NAMES_INDO = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const currentMonthName = `${MONTH_NAMES_INDO[currentMonth - 1]} ${currentYear}`;

    const sisaTagihanBelumDibayar = Math.max(0, totalWonValue - totalSudahCair);
    const unpaidProjectsList = wonProjects.filter((p) => {
      const paid = (p.billings || [])
        .filter((b: any) => b.status === 'Sudah dibayarkan')
        .reduce((sum: number, b: any) => sum + (b.nominal || 0), 0);
      return (p.nilai_kontrak || 0) - paid > 0;
    });

    return {
      totalSudahCair,
      sisaTagihanBelumDibayar,
      totalHarusDitagihBulanIni,
      currentMonthBillings,
      paidProjectsList,
      unpaidProjectsList,
      currentMonthName,
    };
  }, [projects, wonProjects, totalWonValue]);

  // ==========================================
  // SECTION METRICS: DILUAR STATISTIK NILAI & TIMELINE SPK
  // ==========================================
  const spkAndValueMetrics = useMemo(() => {
    // A. Contract Value Analysis (Min, Max, Modus Range)
    const validValueProjects = wonProjects.filter((p) => (p.nilai_kontrak || 0) > 0);
    
    let minProject: any = null;
    let maxProject: any = null;

    if (validValueProjects.length > 0) {
      minProject = validValueProjects.reduce((min, p) => (p.nilai_kontrak < min.nilai_kontrak ? p : min), validValueProjects[0]);
      maxProject = validValueProjects.reduce((max, p) => (p.nilai_kontrak > max.nilai_kontrak ? p : max), validValueProjects[0]);
    }

    // Contract Value Ranges
    const RANGES = [
      { id: 'range_1', label: '< Rp 100 Juta', min: 0, max: 100_000_000 },
      { id: 'range_2', label: 'Rp 100 Jt - 250 Jt', min: 100_000_001, max: 250_000_000 },
      { id: 'range_3', label: 'Rp 250 Jt - 500 Jt', min: 250_000_001, max: 500_000_000 },
      { id: 'range_4', label: 'Rp 500 Jt - 1 Milyar', min: 500_000_001, max: 1_000_000_000 },
      { id: 'range_5', label: '> Rp 1 Milyar', min: 1_000_000_001, max: Infinity },
    ];

    const rangeStats = RANGES.map((r) => {
      const projectsInRange = wonProjects.filter((p) => {
        const val = p.nilai_kontrak || 0;
        return val >= r.min && val <= r.max;
      });
      const totalNilai = projectsInRange.reduce((sum, p) => sum + (p.nilai_kontrak || 0), 0);
      return {
        ...r,
        count: projectsInRange.length,
        totalNilai,
        projects: projectsInRange,
      };
    });

    // Modus Range (Range with max project count)
    let modusRange = rangeStats[0];
    rangeStats.forEach((r) => {
      if (r.count > modusRange.count) {
        modusRange = r;
      }
    });

    // B & C. Monthly SPK Timeline (SPK Mulai vs SPK Berakhir)
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const currentYear = new Date().getFullYear();

    const monthlySPK = MONTH_NAMES.map((name, idx) => {
      const monthNum = idx + 1;

      const startingProjects = wonProjects.filter((p) => {
        const dStr = p.tanggal_mulai_spk || p.tanggal_spk_mulai;
        if (!dStr) return false;
        const d = new Date(dStr);
        return d.getMonth() + 1 === monthNum && d.getFullYear() === currentYear;
      });

      const endingProjects = wonProjects.filter((p) => {
        const dStr = p.tanggal_spk_berakhir;
        if (!dStr) return false;
        const d = new Date(dStr);
        return d.getMonth() + 1 === monthNum && d.getFullYear() === currentYear;
      });

      return {
        monthName: `${name} ${currentYear}`,
        monthShort: name,
        startingCount: startingProjects.length,
        startingProjects,
        endingCount: endingProjects.length,
        endingProjects,
      };
    });

    const maxStarting = Math.max(1, ...monthlySPK.map((m) => m.startingCount));
    const maxEnding = Math.max(1, ...monthlySPK.map((m) => m.endingCount));

    return {
      minProject,
      maxProject,
      rangeStats,
      modusRange,
      monthlySPK,
      maxStarting,
      maxEnding,
      currentYear,
    };
  }, [wonProjects]);

  // ==========================================
  // SECTION 4: WARNING DEADLINE SPK
  // ==========================================
  const sec4Metrics = useMemo(() => {
    let amanCount = 0;
    let urgentCount = 0;
    let telatCount = 0;
    let belumInputCount = 0;

    const amanList: any[] = [];
    const urgentList: any[] = [];
    const telatList: any[] = [];
    const belumInputList: any[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    wonProjects.forEach((p) => {
      if (p.status_selesai_substansi) {
        amanCount++;
        amanList.push(p);
        return;
      }

      if (!p.tanggal_spk_berakhir) {
        belumInputCount++;
        belumInputList.push(p);
        return;
      }

      const endDate = new Date(p.tanggal_spk_berakhir);
      endDate.setHours(0, 0, 0, 0);
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        telatCount++;
        telatList.push({ ...p, daysDiff: Math.abs(diffDays) });
      } else if (diffDays <= 14) {
        urgentCount++;
        urgentList.push({ ...p, daysDiff: diffDays });
      } else {
        amanCount++;
        amanList.push({ ...p, daysDiff: diffDays });
      }
    });

    return {
      amanCount,
      urgentCount,
      telatCount,
      belumInputCount,
      amanList,
      urgentList,
      telatList,
      belumInputList,
    };
  }, [wonProjects]);

  // Calendar events for SPK Expiration Deadlines
  const spkCalendarEvents = useMemo(() => {
    return wonProjects
      .filter((p) => p.tanggal_spk_berakhir && !p.status_selesai_substansi)
      .map((p) => ({
        id: p.id,
        dateStr: p.tanggal_spk_berakhir,
        project: p,
        type: 'ustek' as const,
        title: p.nama_pekerjaan,
        stageOrPic: `Deadline SPK (PIC: ${p.pic_substansi || 'Gov/Pol'})`,
      }));
  }, [wonProjects]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* HEADER */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <IconDashboard size={30} color="var(--primary-color)" />
          <div>
            <h1 className="page-title">Dashboard Utama</h1>
            <p className="page-desc">Monitoring Real-Time Pekerjaan Menang, Realisasi Penagihan, & Warning Deadline SPK (Klik tiap card/grafik untuk detail).</p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: RINGKASAN PROJECT MENANG                                      */}
      {/* ========================================================================= */}
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <IconTrophy size={18} color="var(--primary-color)" /> SECTION 1: METRICS PROJECT MENANG
        </div>

        {/* TOP KPI CARDS - JUMLAH & NILAI BERSANDINGAN */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: '1.25rem' }}>
          {/* Card 1: Jumlah Project Menang */}
          <div
            className="stat-card finance"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
            onClick={() => setDrilldownModal({ title: '🏆 Semua Pekerjaan Menang', subtitle: 'Daftar seluruh proyek Seleksi Menang & Penunjukan Langsung.', projects: wonProjects })}
          >
            <span className="stat-label">Total Pekerjaan Menang</span>
            <span className="stat-value">{sec1Metrics.totalWonCount} Project</span>
            <span className="stat-sub">Seleksi Menang & Penunjukan Langsung (PL)</span>
          </div>

          {/* Card 2: Total Nilai Project Menang */}
          <div
            className="stat-card"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
            onClick={() => setDrilldownModal({ title: '💰 Total Nilai Pekerjaan Menang', subtitle: `Total Nilai Kontrak: Rp ${sec1Metrics.totalWonValue.toLocaleString('id-ID')}`, projects: wonProjects })}
          >
            <span className="stat-label">Total Nilai Kontrak Menang</span>
            <span className="stat-value">{formatCurrencySmart(sec1Metrics.totalWonValue)}</span>
            <span className="stat-sub">Full: Rp {sec1Metrics.totalWonValue.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* COMPARISON CARDS: JUMLAH PROJECT & TOTAL NILAI BERSANDINGAN */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          
          {/* BREAKDOWN DIVISI (JUMLAH & NILAI BERSANDINGAN) */}
          <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🏛️ Breakdown Divisi (Gov vs Pol) — Jumlah & Nilai Bersandingan
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              {/* Left Column: Jumlah Project per Divisi */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.775rem', fontWeight: 700, color: '#475569' }}>📊 Jumlah Project</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0284c7', cursor: 'pointer' }} onClick={() => setDrilldownModal({ title: '🏛️ Pekerjaan Menang Divisi Gov', subtitle: `Total: ${sec1Metrics.govWonCount} project`, projects: sec1Metrics.govWonList })}>
                    Gov: {sec1Metrics.govWonCount} Proj ({sec1Metrics.govWonCountPct}%)
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8b5cf6', cursor: 'pointer' }} onClick={() => setDrilldownModal({ title: '🛡️ Pekerjaan Menang Divisi Pol', subtitle: `Total: ${sec1Metrics.polWonCount} project`, projects: sec1Metrics.polWonList })}>
                    Pol: {sec1Metrics.polWonCount} Proj ({sec1Metrics.polWonCountPct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', display: 'flex', marginTop: '0.25rem' }}>
                  <div style={{ width: `${sec1Metrics.govWonCountPct}%`, background: '#0284c7', height: '100%' }} title={`Gov: ${sec1Metrics.govWonCountPct}%`} />
                  <div style={{ width: `${sec1Metrics.polWonCountPct}%`, background: '#8b5cf6', height: '100%' }} title={`Pol: ${sec1Metrics.polWonCountPct}%`} />
                </div>
              </div>

              {/* Right Column: Total Nilai per Divisi */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.775rem', fontWeight: 700, color: '#475569' }}>💰 Total Nilai (Rp)</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0284c7', cursor: 'pointer' }} onClick={() => setDrilldownModal({ title: '🏛️ Nilai Kontrak Divisi Gov', subtitle: `Rp ${sec1Metrics.govWonNilai.toLocaleString('id-ID')}`, projects: sec1Metrics.govWonList })}>
                    Gov: {formatCurrencySmart(sec1Metrics.govWonNilai)} ({sec1Metrics.govWonNilaiPct}%)
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8b5cf6', cursor: 'pointer' }} onClick={() => setDrilldownModal({ title: '🛡️ Nilai Kontrak Divisi Pol', subtitle: `Rp ${sec1Metrics.polWonNilai.toLocaleString('id-ID')}`, projects: sec1Metrics.polWonList })}>
                    Pol: {formatCurrencySmart(sec1Metrics.polWonNilai)} ({sec1Metrics.polWonNilaiPct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', display: 'flex', marginTop: '0.25rem' }}>
                  <div style={{ width: `${sec1Metrics.govWonNilaiPct}%`, background: '#0284c7', height: '100%' }} title={`Gov Nilai: ${sec1Metrics.govWonNilaiPct}%`} />
                  <div style={{ width: `${sec1Metrics.polWonNilaiPct}%`, background: '#8b5cf6', height: '100%' }} title={`Pol Nilai: ${sec1Metrics.polWonNilaiPct}%`} />
                </div>
              </div>
            </div>
          </div>

          {/* BREAKDOWN METODE PENGADAAN (JUMLAH & NILAI BERSANDINGAN) */}
          <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#047857', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🎯 Breakdown Metode (Seleksi vs PL) — Jumlah & Nilai Bersandingan
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              {/* Left Column: Jumlah Project per Metode */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.775rem', fontWeight: 700, color: '#475569' }}>📊 Jumlah Project</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', cursor: 'pointer' }} onClick={() => setDrilldownModal({ title: '🎯 Project Seleksi', subtitle: `Total: ${sec1Metrics.biddingWonCount} project`, projects: sec1Metrics.biddingWonList })}>
                    Seleksi: {sec1Metrics.biddingWonCount} Proj ({sec1Metrics.biddingWonCountPct}%)
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', cursor: 'pointer' }} onClick={() => setDrilldownModal({ title: '📄 Project Penunjukan Langsung (PL)', subtitle: `Total: ${sec1Metrics.plWonCount} project`, projects: sec1Metrics.plWonList })}>
                    PL: {sec1Metrics.plWonCount} Proj ({sec1Metrics.plWonCountPct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', display: 'flex', marginTop: '0.25rem' }}>
                  <div style={{ width: `${sec1Metrics.biddingWonCountPct}%`, background: '#10b981', height: '100%' }} title={`Seleksi: ${sec1Metrics.biddingWonCountPct}%`} />
                  <div style={{ width: `${sec1Metrics.plWonCountPct}%`, background: '#f59e0b', height: '100%' }} title={`PL: ${sec1Metrics.plWonCountPct}%`} />
                </div>
              </div>

              {/* Right Column: Total Nilai per Metode */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.775rem', fontWeight: 700, color: '#475569' }}>💰 Total Nilai (Rp)</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', cursor: 'pointer' }} onClick={() => setDrilldownModal({ title: '🎯 Nilai Kontrak Seleksi', subtitle: `Rp ${sec1Metrics.biddingWonNilai.toLocaleString('id-ID')}`, projects: sec1Metrics.biddingWonList })}>
                    Seleksi: {formatCurrencySmart(sec1Metrics.biddingWonNilai)} ({sec1Metrics.biddingWonNilaiPct}%)
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', cursor: 'pointer' }} onClick={() => setDrilldownModal({ title: '📄 Nilai Kontrak Penunjukan Langsung (PL)', subtitle: `Rp ${sec1Metrics.plWonNilai.toLocaleString('id-ID')}`, projects: sec1Metrics.plWonList })}>
                    PL: {formatCurrencySmart(sec1Metrics.plWonNilai)} ({sec1Metrics.plWonNilaiPct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', display: 'flex', marginTop: '0.25rem' }}>
                  <div style={{ width: `${sec1Metrics.biddingWonNilaiPct}%`, background: '#10b981', height: '100%' }} title={`Seleksi Nilai: ${sec1Metrics.biddingWonNilaiPct}%`} />
                  <div style={{ width: `${sec1Metrics.plWonNilaiPct}%`, background: '#f59e0b', height: '100%' }} title={`PL Nilai: ${sec1Metrics.plWonNilaiPct}%`} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: STATUS PROJECT (GRAPHICS & BREAKDOWN)                         */}
      {/* ========================================================================= */}
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <IconChart size={18} color="var(--primary-color)" /> SECTION 2: GRAFIK & STATISTIK STATUS PROJECT
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {/* Grafik Status by Substansi */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <IconClock size={18} color="#0284c7" /> Status by Substansi
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                style={{ cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', transition: 'background 0.15s' }}
                onClick={() => setDrilldownModal({ title: '🟢 Project Selesai Substansi', subtitle: `Jumlah: ${sec2Metrics.substansiSelesaiCount} project (${sec2Metrics.substansiSelesaiPct}%)`, projects: sec2Metrics.substansiSelesaiList })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  <span style={{ color: '#10b981' }}>🟢 Selesai Substansi</span>
                  <span>{sec2Metrics.substansiSelesaiCount} ({sec2Metrics.substansiSelesaiPct}%)</span>
                </div>
                <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${sec2Metrics.substansiSelesaiPct}%`, background: '#10b981', height: '100%', transition: 'width 0.5s ease' }} />
                </div>
              </div>

              <div
                style={{ cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', transition: 'background 0.15s' }}
                onClick={() => setDrilldownModal({ title: '🟡 Project Onprogress Substansi', subtitle: `Jumlah: ${sec2Metrics.substansiOnprogressCount} project (${sec2Metrics.substansiOnprogressPct}%)`, projects: sec2Metrics.substansiOnprogressList })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  <span style={{ color: '#f59e0b' }}>🟡 Onprogress Substansi</span>
                  <span>{sec2Metrics.substansiOnprogressCount} ({sec2Metrics.substansiOnprogressPct}%)</span>
                </div>
                <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${sec2Metrics.substansiOnprogressPct}%`, background: '#f59e0b', height: '100%', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Grafik Status by Administrasi */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <IconFinance size={18} color="#8b5cf6" /> Status by Administrasi
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                style={{ cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}
                onClick={() => setDrilldownModal({ title: '🟢 Project Selesai & Lunas Administrasi', subtitle: `Jumlah: ${sec2Metrics.adminDoneCount} project (${sec2Metrics.adminDonePct}%)`, projects: sec2Metrics.adminDoneList })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  <span style={{ color: '#10b981' }}>🟢 Selesai & Lunas</span>
                  <span>{sec2Metrics.adminDoneCount} ({sec2Metrics.adminDonePct}%)</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: `${sec2Metrics.adminDonePct}%`, background: '#10b981', height: '100%' }} />
                </div>
              </div>

              <div
                style={{ cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}
                onClick={() => setDrilldownModal({ title: '🟡 Project Termin Belum Lunas', subtitle: `Jumlah: ${sec2Metrics.adminPendingPaidCount} project (${sec2Metrics.adminPendingPaidPct}%)`, projects: sec2Metrics.adminPendingPaidList })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  <span style={{ color: '#0284c7' }}>🟡 Termin Belum Lunas</span>
                  <span>{sec2Metrics.adminPendingPaidCount} ({sec2Metrics.adminPendingPaidPct}%)</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: `${sec2Metrics.adminPendingPaidPct}%`, background: '#0284c7', height: '100%' }} />
                </div>
              </div>

              <div
                style={{ cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}
                onClick={() => setDrilldownModal({ title: '🔴 Project Belum Dokumen Lengkap (SPK/BAST/Ref)', subtitle: `Jumlah: ${sec2Metrics.adminNoDocsCount} project (${sec2Metrics.adminNoDocsPct}%)`, projects: sec2Metrics.adminNoDocsList })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  <span style={{ color: '#ef4444' }}>🔴 Belum Dokumen Lengkap</span>
                  <span>{sec2Metrics.adminNoDocsCount} ({sec2Metrics.adminNoDocsPct}%)</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: `${sec2Metrics.adminNoDocsPct}%`, background: '#ef4444', height: '100%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Grafik Status Akhir */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <IconTrophy size={18} color="#10b981" /> Status Akhir Project
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                style={{ cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}
                onClick={() => setDrilldownModal({ title: '🏆 Project Selesai Akhir (Substansi + Admin)', subtitle: `Jumlah: ${sec2Metrics.finalDoneCount} project (${sec2Metrics.finalDonePct}%)`, projects: sec2Metrics.finalDoneList })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  <span style={{ color: '#10b981' }}>🏆 Selesai Akhir (Substansi + Admin)</span>
                  <span>{sec2Metrics.finalDoneCount} ({sec2Metrics.finalDonePct}%)</span>
                </div>
                <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${sec2Metrics.finalDonePct}%`, background: 'linear-gradient(90deg, #10b981, #059669)', height: '100%' }} />
                </div>
              </div>

              <div
                style={{ cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}
                onClick={() => setDrilldownModal({ title: '⏳ Project Masih Dalam Proses', subtitle: `Jumlah: ${sec2Metrics.finalOnprogressCount} project (${sec2Metrics.finalOnprogressPct}%)`, projects: sec2Metrics.finalOnprogressList })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  <span style={{ color: '#f59e0b' }}>⏳ Masih Dalam Proses</span>
                  <span>{sec2Metrics.finalOnprogressCount} ({sec2Metrics.finalOnprogressPct}%)</span>
                </div>
                <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${sec2Metrics.finalOnprogressPct}%`, background: '#f59e0b', height: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION BERSAMA: ANALISIS KONTRAK & TIMELINE BULANAN SPK                */}
      {/* ========================================================================= */}
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <IconChart size={18} color="var(--primary-color)" /> RINGKASAN KONTRAK & TIMELINE SPK BULANAN
        </div>

        {/* PART A: INFORMASI NILAI KONTRAK (TERENDAH, TERTINGGI, MODUS RENTANG) */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: '1.25rem' }}>
          
          {/* Card 1: Nilai Projek Terendah */}
          <div
            className="stat-card"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease', borderLeft: '4px solid #0284c7' }}
            onClick={() => spkAndValueMetrics.minProject && setDrilldownModal({ title: '📉 Project Nilai Kontrak Terendah', subtitle: `${spkAndValueMetrics.minProject.nama_pekerjaan} (Rp ${spkAndValueMetrics.minProject.nilai_kontrak?.toLocaleString('id-ID')})`, projects: [spkAndValueMetrics.minProject] })}
          >
            <span className="stat-label">Nilai Project Terendah</span>
            <span className="stat-value" style={{ color: '#0284c7' }}>
              {spkAndValueMetrics.minProject ? formatCurrencySmart(spkAndValueMetrics.minProject.nilai_kontrak) : 'Rp 0'}
            </span>
            <span className="stat-sub">
              {spkAndValueMetrics.minProject ? spkAndValueMetrics.minProject.nama_pekerjaan : 'Tidak ada data'}
            </span>
          </div>

          {/* Card 2: Nilai Projek Tertinggi */}
          <div
            className="stat-card finance"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease', borderLeft: '4px solid #10b981' }}
            onClick={() => spkAndValueMetrics.maxProject && setDrilldownModal({ title: '📈 Project Nilai Kontrak Tertinggi', subtitle: `${spkAndValueMetrics.maxProject.nama_pekerjaan} (Rp ${spkAndValueMetrics.maxProject.nilai_kontrak?.toLocaleString('id-ID')})`, projects: [spkAndValueMetrics.maxProject] })}
          >
            <span className="stat-label">Nilai Project Tertinggi</span>
            <span className="stat-value" style={{ color: '#10b981' }}>
              {spkAndValueMetrics.maxProject ? formatCurrencySmart(spkAndValueMetrics.maxProject.nilai_kontrak) : 'Rp 0'}
            </span>
            <span className="stat-sub">
              {spkAndValueMetrics.maxProject ? spkAndValueMetrics.maxProject.nama_pekerjaan : 'Tidak ada data'}
            </span>
          </div>

          {/* Card 3: Nilai Modus Tertinggi (Rentang Nilai Paling Banyak Project) */}
          <div
            className="stat-card"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease', borderLeft: '4px solid #8b5cf6' }}
            onClick={() => setDrilldownModal({ title: `📊 Modus Rentang Nilai: ${spkAndValueMetrics.modusRange.label}`, subtitle: `Total: ${spkAndValueMetrics.modusRange.count} Project (${formatCurrencySmart(spkAndValueMetrics.modusRange.totalNilai)})`, projects: spkAndValueMetrics.modusRange.projects })}
          >
            <span className="stat-label">Modus Rentang Nilai (Frekuensi Tertinggi)</span>
            <span className="stat-value" style={{ color: '#8b5cf6' }}>
              {spkAndValueMetrics.modusRange.label}
            </span>
            <span className="stat-sub">
              {spkAndValueMetrics.modusRange.count} Project ({formatCurrencySmart(spkAndValueMetrics.modusRange.totalNilai)})
            </span>
          </div>
        </div>

        {/* PART B & C: GRAFIK MULTI LINE CHART TIMELINE BULANAN SPK MULAI & SPK BERAKHIR */}
        {(() => {
          const yMax = Math.max(1, Math.ceil(Math.max(spkAndValueMetrics.maxStarting, spkAndValueMetrics.maxEnding) * 1.25));
          const svgWidth = 800;
          const svgHeight = 280;
          const padding = { top: 35, right: 30, bottom: 45, left: 45 };
          const graphWidth = svgWidth - padding.left - padding.right;
          const graphHeight = svgHeight - padding.top - padding.bottom;

          const pointsStart = spkAndValueMetrics.monthlySPK.map((m, i) => {
            const x = padding.left + (i * graphWidth) / (spkAndValueMetrics.monthlySPK.length - 1);
            const y = padding.top + graphHeight - (m.startingCount / yMax) * graphHeight;
            return { x, y, month: m.monthShort, count: m.startingCount, projects: m.startingProjects, monthName: m.monthName };
          });

          const pointsEnd = spkAndValueMetrics.monthlySPK.map((m, i) => {
            const x = padding.left + (i * graphWidth) / (spkAndValueMetrics.monthlySPK.length - 1);
            const y = padding.top + graphHeight - (m.endingCount / yMax) * graphHeight;
            return { x, y, month: m.monthShort, count: m.endingCount, projects: m.endingProjects, monthName: m.monthName };
          });

          const buildPath = (pts: typeof pointsStart) => {
            if (pts.length === 0) return '';
            let d = `M ${pts[0].x} ${pts[0].y}`;
            for (let i = 0; i < pts.length - 1; i++) {
              const curr = pts[i];
              const next = pts[i + 1];
              const cp1x = curr.x + (next.x - curr.x) / 2;
              const cp1y = curr.y;
              const cp2x = curr.x + (next.x - curr.x) / 2;
              const cp2y = next.y;
              d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
            }
            return d;
          };

          const buildArea = (pts: typeof pointsStart) => {
            if (pts.length === 0) return '';
            const lineD = buildPath(pts);
            const zeroY = padding.top + graphHeight;
            const firstX = pts[0].x;
            const lastX = pts[pts.length - 1].x;
            return `${lineD} L ${lastX} ${zeroY} L ${firstX} ${zeroY} Z`;
          };

          const pathStart = buildPath(pointsStart);
          const areaStart = buildArea(pointsStart);

          const pathEnd = buildPath(pointsEnd);
          const areaEnd = buildArea(pointsEnd);

          const totalStartCount = spkAndValueMetrics.monthlySPK.reduce((sum, m) => sum + m.startingCount, 0);
          const totalEndCount = spkAndValueMetrics.monthlySPK.reduce((sum, m) => sum + m.endingCount, 0);

          const yTicks = Array.from(new Set([0, Math.ceil(yMax / 2), yMax])).sort((a, b) => a - b);

          return (
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
              {/* Header & Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <IconChart size={20} color="var(--primary-color)" /> Timeline Bulanan Project (Multi-Line Chart)
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                    Perbandingan tren akumulasi project mulai dan project berakhir sepanjang tahun {spkAndValueMetrics.currentYear}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  {/* Legend SPK Mulai */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#0284c7', background: '#f0f9ff', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />
                    <span>SPK Mulai ({totalStartCount} Project)</span>
                  </div>

                  {/* Legend SPK Berakhir */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#d97706', background: '#fffbeb', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #fef3c7' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                    <span>SPK Berakhir ({totalEndCount} Project)</span>
                  </div>

                  <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.75rem' }}>
                    Tahun {spkAndValueMetrics.currentYear}
                  </span>
                </div>
              </div>

              {/* SVG Multi Line Chart */}
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', minWidth: '600px', height: 'auto', display: 'block' }}>
                  <defs>
                    <linearGradient id="gradientStart" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="gradientEnd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="glowStart" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0284c7" floodOpacity="0.3" />
                    </filter>
                    <filter id="glowEnd" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.3" />
                    </filter>
                  </defs>

                  {/* Horizontal Grid Lines & Y Axis Labels */}
                  {yTicks.map((tickVal) => {
                    const y = padding.top + graphHeight - (tickVal / yMax) * graphHeight;
                    return (
                      <g key={`ytick_${tickVal}`}>
                        <line x1={padding.left} y1={y} x2={svgWidth - padding.right} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                        <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="#94a3b8">
                          {tickVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* X Axis Base Line */}
                  <line x1={padding.left} y1={padding.top + graphHeight} x2={svgWidth - padding.right} y2={padding.top + graphHeight} stroke="#cbd5e1" strokeWidth="1.5" />

                  {/* Area Fills */}
                  <path d={areaStart} fill="url(#gradientStart)" />
                  <path d={areaEnd} fill="url(#gradientEnd)" />

                  {/* Line Paths */}
                  <path d={pathStart} fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#glowStart)" />
                  <path d={pathEnd} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#glowEnd)" />

                  {/* X Axis Labels (Months) */}
                  {pointsStart.map((p) => (
                    <text key={`xlabel_${p.month}`} x={p.x} y={svgHeight - 15} textAnchor="middle" fontSize="12" fontWeight="700" fill="#475569">
                      {p.month}
                    </text>
                  ))}

                  {/* Data Points SPK Mulai */}
                  {pointsStart.map((p) => (
                    <g
                      key={`pt_start_${p.month}`}
                      style={{ cursor: p.count > 0 ? 'pointer' : 'default' }}
                      onClick={() => p.count > 0 && setDrilldownModal({ title: `📅 Project Mulai Bulan ${p.monthName}`, subtitle: `Total: ${p.count} project dimulai`, projects: p.projects })}
                    >
                      <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke="#0284c7" strokeWidth="3" />
                      {p.count > 0 && (
                        <g>
                          <rect x={p.x - 10} y={p.y - 20} width="20" height="15" rx="3" fill="#0284c7" />
                          <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="10" fontWeight="800" fill="#ffffff">
                            {p.count}
                          </text>
                        </g>
                      )}
                    </g>
                  ))}

                  {/* Data Points SPK Berakhir */}
                  {pointsEnd.map((p) => (
                    <g
                      key={`pt_end_${p.month}`}
                      style={{ cursor: p.count > 0 ? 'pointer' : 'default' }}
                      onClick={() => p.count > 0 && setDrilldownModal({ title: `🏁 Project Berakhir Bulan ${p.monthName}`, subtitle: `Total: ${p.count} project berakhir`, projects: p.projects })}
                    >
                      <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke="#f59e0b" strokeWidth="3" />
                      {p.count > 0 && (
                        <g>
                          <rect x={p.x - 10} y={p.y + 7} width="20" height="15" rx="3" fill="#d97706" />
                          <text x={p.x} y={p.y + 18} textAnchor="middle" fontSize="10" fontWeight="800" fill="#ffffff">
                            {p.count}
                          </text>
                        </g>
                      )}
                    </g>
                  ))}
                </svg>
              </div>

              {/* Monthly Breakdown Interactive Cards Below Chart */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569', marginBottom: '0.65rem' }}>
                  📌 Breakdown Detail Per Bulan (Klik untuk lihat project):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                  {spkAndValueMetrics.monthlySPK.map((m) => (
                    <div
                      key={`bdown_${m.monthName}`}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.78rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem'
                      }}
                    >
                      <span style={{ fontWeight: 800, color: '#1e293b' }}>{m.monthShort}</span>
                      <span
                        style={{ color: '#0284c7', fontWeight: 700, cursor: m.startingCount > 0 ? 'pointer' : 'default' }}
                        onClick={() => m.startingCount > 0 && setDrilldownModal({ title: `📅 Project Mulai Bulan ${m.monthName}`, subtitle: `Total: ${m.startingCount} project dimulai`, projects: m.startingProjects })}
                      >
                        🔹 Mulai: {m.startingCount}
                      </span>
                      <span
                        style={{ color: '#d97706', fontWeight: 700, cursor: m.endingCount > 0 ? 'pointer' : 'default' }}
                        onClick={() => m.endingCount > 0 && setDrilldownModal({ title: `🏁 Project Berakhir Bulan ${m.monthName}`, subtitle: `Total: ${m.endingCount} project berakhir`, projects: m.endingProjects })}
                      >
                        🔸 Akhir: {m.endingCount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: STATUS BILLING & FINANCE                                      */}
      {/* ========================================================================= */}
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <IconFinance size={18} color="var(--primary-color)" /> SECTION 3: STATUS BILLING & PENAGIHAN ({sec3Metrics.currentMonthName})
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
          {/* Total Sudah Cair */}
          <div
            className="stat-card finance"
            style={{ cursor: 'pointer' }}
            onClick={() => setDrilldownModal({ title: '🟢 Project Dengan Realisasi Pembayaran (Cair)', subtitle: `Total Cair: Rp ${sec3Metrics.totalSudahCair.toLocaleString('id-ID')}`, projects: sec3Metrics.paidProjectsList })}
          >
            <span className="stat-label">Total Cair (Sudah Dibayarkan)</span>
            <span className="stat-value" style={{ color: '#10b981' }}>{formatCurrencySmart(sec3Metrics.totalSudahCair)}</span>
            <span className="stat-sub">Full: Rp {sec3Metrics.totalSudahCair.toLocaleString('id-ID')}</span>
          </div>

          {/* Sisa Tagihan Belum Dibayar */}
          <div
            className="stat-card"
            style={{ cursor: 'pointer' }}
            onClick={() => setDrilldownModal({ title: '🔴 Sisa Tagihan Belum Dibayar (Outstanding)', subtitle: `Total Sisa Tagihan: Rp ${sec3Metrics.sisaTagihanBelumDibayar.toLocaleString('id-ID')}`, projects: sec3Metrics.unpaidProjectsList })}
          >
            <span className="stat-label">Sisa Tagihan Belum Dibayar</span>
            <span className="stat-value" style={{ color: '#ef4444' }}>{formatCurrencySmart(sec3Metrics.sisaTagihanBelumDibayar)}</span>
            <span className="stat-sub">Full: Rp {sec3Metrics.sisaTagihanBelumDibayar.toLocaleString('id-ID')}</span>
          </div>

          {/* Total Seharusnya Ditagih Bulan Ini */}
          <div
            className="stat-card"
            style={{ cursor: 'pointer' }}
            onClick={() => setDrilldownModal({ title: `📅 Target Penagihan Bulan Ini (${sec3Metrics.currentMonthName})`, subtitle: `Total Target: Rp ${sec3Metrics.totalHarusDitagihBulanIni.toLocaleString('id-ID')}`, projects: sec3Metrics.currentMonthBillings.map(b => b.project) })}
          >
            <span className="stat-label">Seharusnya Ditagih Bulan Ini ({sec3Metrics.currentMonthName})</span>
            <span className="stat-value" style={{ color: '#0284c7' }}>{formatCurrencySmart(sec3Metrics.totalHarusDitagihBulanIni)}</span>
            <span className="stat-sub">Jumlah Termin Target: {sec3Metrics.currentMonthBillings.length} Termin</span>
          </div>
        </div>

        {/* Tabel Penagihan Bulan Ini */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <IconCalendar size={18} color="#0284c7" /> Jadwal Penagihan Bulan Ini ({sec3Metrics.currentMonthName})
            </h3>
            <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
              {sec3Metrics.currentMonthBillings.length} Record Penagihan
            </span>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                  <th>Nama Pekerjaan</th>
                  <th>Pemberi Kerja</th>
                  <th>Termin</th>
                  <th>Nominal (Rp)</th>
                  <th>Tgl Penagihan</th>
                  <th>Status Penagihan</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sec3Metrics.currentMonthBillings.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                      Tidak ada termin penagihan yang dijadwalkan pada bulan ini ({sec3Metrics.currentMonthName}).
                    </td>
                  </tr>
                ) : (
                  sec3Metrics.currentMonthBillings.map((b: any, idx: number) => (
                    <tr key={`${b.project.id}_${b.id}`}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-dim)' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}><ClickableText text={b.projectName} /></td>
                      <td><ClickableText text={b.pemberiKerja || '-'} /></td>
                      <td style={{ fontWeight: 600 }}>{b.nama}</td>
                      <td style={{ color: '#34d399', fontWeight: 700 }}>Rp {(b.nominal || 0).toLocaleString('id-ID')}</td>
                      <td>{b.tanggal_penagihan || '-'}</td>
                      <td>
                        <span className={`badge ${b.status === 'Sudah dibayarkan' ? 'badge-done' : b.status === 'Sudah ditagih' ? 'badge-potential' : 'badge-pending'}`}>
                          {b.status === 'Sudah dibayarkan' ? '🟢 Sudah Dibayarkan' : b.status === 'Sudah ditagih' ? '🟡 Sudah Ditagih' : '🔴 Belum Ditagih'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-primary btn-sm btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          onClick={() => setSelectedProject(b.project)}
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
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: DATA WARNING BY DEADLINE SPK                                  */}
      {/* ========================================================================= */}
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <IconAlertTriangle size={18} color="#d97706" /> SECTION 4: WARNING DEADLINE TANGGAL SPK
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
          {/* Aman Card */}
          <div
            className="glass-card"
            style={{ padding: '1.25rem', cursor: 'pointer', borderLeft: '5px solid #10b981', transition: 'all 0.2s ease' }}
            onClick={() => setDrilldownModal({ title: '🟢 Project Aman', subtitle: 'Project yang memiliki sisa masa SPK > 14 hari atau sudah selesai.', projects: sec4Metrics.amanList })}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>🟢 PROJECT AMAN</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: '0.25rem 0' }}>{sec4Metrics.amanCount} Project</div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Sisa SPK &gt; 14 Hari / Selesai</div>
          </div>

          {/* Urgent Card */}
          <div
            className="glass-card"
            style={{ padding: '1.25rem', cursor: 'pointer', borderLeft: '5px solid #f59e0b', transition: 'all 0.2s ease' }}
            onClick={() => setDrilldownModal({ title: '🟡 Project Urgent (Masa SPK &le; 2 Minggu)', subtitle: 'Project yang tanggal SPK-nya sisa 14 hari atau kurang.', projects: sec4Metrics.urgentList })}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#d97706' }}>🟡 URGENT (&le; 2 MINGGU)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: '0.25rem 0' }}>{sec4Metrics.urgentCount} Project</div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Sisa SPK 1 - 14 Hari</div>
          </div>

          {/* Telat Card */}
          <div
            className="glass-card"
            style={{ padding: '1.25rem', cursor: 'pointer', borderLeft: '5px solid #ef4444', transition: 'all 0.2s ease' }}
            onClick={() => setDrilldownModal({ title: '🔴 Project Telat (SPK Expired)', subtitle: 'Project yang tanggal SPK berakhirnya sudah melewati hari ini.', projects: sec4Metrics.telatList })}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444' }}>🔴 TELAT (SPK EXPIRED)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: '0.25rem 0' }}>{sec4Metrics.telatCount} Project</div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Masa SPK Sudah Lewat</div>
          </div>

          {/* Belum Input SPK Card */}
          <div
            className="glass-card"
            style={{ padding: '1.25rem', cursor: 'pointer', borderLeft: '5px solid #64748b', transition: 'all 0.2s ease' }}
            onClick={() => setDrilldownModal({ title: '⚪ Belum Input Tanggal SPK', subtitle: 'Project yang belum diinput tanggal berakhir SPK.', projects: sec4Metrics.belumInputList })}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>⚪ BELUM INPUT SPK</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: '0.25rem 0' }}>{sec4Metrics.belumInputCount} Project</div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Tanggal SPK Masih Kosong</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CALENDAR WIDGET: SPK EXPIRATION DEADLINES                                */}
      {/* ========================================================================= */}
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <IconCalendar size={18} color="var(--primary-color)" /> KALENDER DEADLINE TANGGAL SPK BERAKHIR
        </div>
        <CalendarWidget
          title="Jadwal Deadline Berakhir SPK"
          type="all"
          events={spkCalendarEvents}
          onSelectProject={(p) => setSelectedProject(p)}
        />
      </div>

      {/* ========================================================================= */}
      {/* DRILLDOWN MODAL                                                          */}
      {/* ========================================================================= */}
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
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <IconChart size={20} color="var(--primary-color)" /> {drilldownModal.title}
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
                <IconClose size={18} />
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
                        <th>Tgl SPK Selesai</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drilldownModal.projects.map((p, idx) => (
                        <tr key={p.id}>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-dim)' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}><ClickableText text={p.nama_pekerjaan} /></td>
                          <td><ClickableText text={p.pemberi_kerja || '-'} /></td>
                          <td style={{ color: '#34d399', fontWeight: 700 }}>
                            Rp {(p.nilai_kontrak || 0).toLocaleString('id-ID')}
                          </td>
                          <td>{p.tanggal_spk_berakhir || '-'}</td>
                          <td>
                            {p.daysDiff !== undefined ? (
                              <span className={`badge ${p.daysDiff < 0 ? 'badge-loss' : p.daysDiff <= 14 ? 'badge-potential' : 'badge-win'}`}>
                                {p.daysDiff < 0 ? `Telat ${p.daysDiff}d` : `Sisa ${p.daysDiff}d`}
                              </span>
                            ) : (
                              <span className="badge badge-done">Menang / Selesai</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-primary btn-sm btn-secondary"
                              onClick={() => {
                                setDrilldownModal(null);
                                setSelectedProject(p);
                              }}
                            >
                              <IconEye size={14} /> Detail
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

      {/* DETAIL MODAL */}
      <DetailModal project={selectedProject} onClose={() => setSelectedProject(null)} onRefresh={loadProjects} />
    </div>
  );
}
