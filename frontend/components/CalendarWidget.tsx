'use client';
import { useState, useMemo, useEffect } from 'react';
import { IconChevronLeft, IconChevronRight, IconSearch, IconCalendar, IconUstek, IconClose, IconEye, IconGov, IconProject } from './Icons';

interface CalendarEvent {
  id: number;
  dateStr: string; // YYYY-MM-DD
  project: any;
  type: 'bidding' | 'ustek';
  title: string;
  stageOrPic: string;
}

interface CalendarWidgetProps {
  title: string;
  type: 'bidding' | 'ustek' | 'all';
  events: CalendarEvent[];
  onSelectProject: (project: any) => void;
  accentColor?: string;
}

export default function CalendarWidget({
  title,
  type,
  events,
  onSelectProject,
  accentColor = '#f97316'
}: CalendarWidgetProps) {
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(8); // 0-indexed (Sept)
  const [popupData, setPopupData] = useState<{ dateStr: string; events: CalendarEvent[] } | null>(null);

  useEffect(() => {
    if (events.length > 0) {
      const sorted = [...events].sort(
        (a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
      );
      const d = new Date(sorted[0].dateStr);
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getFullYear());
        setCurrentMonth(d.getMonth());
      }
    }
  }, [events]);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Group events by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((ev) => {
      if (!ev.dateStr) return;
      const dateKey = ev.dateStr.trim().split('T')[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(ev);
    });
    return map;
  }, [events]);

  // Compute calendar grid days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    // Prev month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const prevDate = daysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevDate).padStart(2, '0')}`;
      days.push({
        dayNum: prevDate,
        dateStr,
        isCurrentMonth: false,
        events: eventsByDate[dateStr] || []
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        events: eventsByDate[dateStr] || []
      });
    }

    // Next month padding
    const totalSlots = days.length > 35 ? 42 : 35;
    const remainingSlots = totalSlots - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dayNum: i,
        dateStr,
        isCurrentMonth: false,
        events: eventsByDate[dateStr] || []
      });
    }

    return days;
  }, [currentYear, currentMonth, eventsByDate]);

  const todayStr = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  const currentMonthEvents = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    return events.filter((ev) => ev.dateStr && ev.dateStr.startsWith(prefix));
  }, [events, currentYear, currentMonth]);

  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      {/* HEADER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {type === 'ustek' ? (
            <IconUstek size={20} color={accentColor} />
          ) : (
            <IconCalendar size={20} color={accentColor} />
          )}
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{title}</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={handleToday}
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid var(--card-border)',
              background: '#f8fafc',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            Bulan Ini
          </button>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '6px', padding: '0.15rem' }}>
            <button
              onClick={handlePrevMonth}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '0.3rem 0.5rem',
                cursor: 'pointer',
                fontWeight: 800,
                color: 'var(--text-main)',
                display: 'inline-flex',
                alignItems: 'center'
              }}
              title="Bulan Sebelumnya"
            >
              <IconChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.825rem', fontWeight: 800, padding: '0 0.5rem', minWidth: '130px', textAlign: 'center' }}>
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '0.3rem 0.5rem',
                cursor: 'pointer',
                fontWeight: 800,
                color: 'var(--text-main)',
                display: 'inline-flex',
                alignItems: 'center'
              }}
              title="Bulan Berikutnya"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* CALENDAR MONTH GRID */}
      <div style={{ marginBottom: '1rem' }}>
        {/* DAY NAMES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '0.35rem' }}>
          {dayNames.map((day, idx) => (
            <div key={day} style={{ fontSize: '0.725rem', fontWeight: 800, color: idx === 0 || idx === 6 ? '#ef4444' : 'var(--text-muted)', padding: '0.25rem 0' }}>
              {day}
            </div>
          ))}
        </div>

        {/* DAYS MATRIX */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {calendarDays.map((item, idx) => {
            const hasEvents = item.events.length > 0;
            const isToday = item.dateStr === todayStr;

            return (
              <div
                key={`${item.dateStr}-${idx}`}
                onClick={() => {
                  if (hasEvents) {
                    setPopupData({ dateStr: item.dateStr, events: item.events });
                  }
                }}
                style={{
                  height: '52px',
                  padding: '4px 6px',
                  borderRadius: '8px',
                  border: isToday
                    ? '1.5px solid #3b82f6'
                    : hasEvents
                    ? `1.5px solid ${accentColor}80`
                    : '1px solid #e2e8f0',
                  background: !item.isCurrentMonth
                    ? '#f8fafc'
                    : hasEvents
                    ? `${accentColor}0D`
                    : '#ffffff',
                  opacity: !item.isCurrentMonth ? 0.4 : 1,
                  cursor: hasEvents ? 'pointer' : 'default',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  minWidth: 0
                }}
                title={hasEvents ? `Klik untuk buka popup ${item.events.length} deadline project` : ''}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: isToday || hasEvents ? 800 : 600,
                      color: isToday ? '#2563eb' : hasEvents ? 'var(--text-main)' : 'var(--text-muted)',
                      background: isToday ? '#dbeafe' : 'transparent',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {item.dayNum}
                  </span>
                  {hasEvents && (
                    <span
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        background: accentColor,
                        color: '#fff',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        boxShadow: `0 2px 6px ${accentColor}40`,
                        flexShrink: 0
                      }}
                    >
                      {item.events.length} DL
                    </span>
                  )}
                </div>

                {/* COMPACT CLEAN TAG IN CELL WITH STRICT CLIPPING */}
                {hasEvents && (
                  <div
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      color: accentColor,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                      marginTop: '2px',
                      padding: '1px 3px',
                      borderRadius: '3px',
                      background: `${accentColor}1A`,
                      display: 'block'
                    }}
                  >
                    ● {item.events[0].title}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MONTHLY SUMMARY LIST */}
      <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <IconCalendar size={15} color="var(--primary-color)" /> Summary Deadline Bulan {monthNames[currentMonth]} {currentYear} ({currentMonthEvents.length} Total)
          </div>
        </div>

        <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '4px' }}>
          {currentMonthEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '0.85rem', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Tidak ada agenda deadline pada bulan {monthNames[currentMonth]} {currentYear}.
            </div>
          ) : (
            currentMonthEvents.slice(0, 5).map((ev) => (
              <div
                key={ev.id}
                onClick={() => onSelectProject(ev.project)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ flex: 1, paddingRight: '0.5rem', overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.title}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {ev.stageOrPic}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge ${ev.type === 'bidding' ? 'badge-potential' : 'badge-gov'}`} style={{ fontSize: '0.7rem' }}>
                    {ev.dateStr}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* POPUP MODAL UNTUK DEADLINE TANGGAL YANG DIKLIK */}
      {popupData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
          onClick={() => setPopupData(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'modalSlide 0.25s ease'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* POPUP HEADER */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: `linear-gradient(135deg, ${accentColor}15, #ffffff)`
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <IconCalendar size={18} color={accentColor} /> Deadline Project ({popupData.dateStr})
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Terdapat {popupData.events.length} agenda deadline pada tanggal ini. Klik item untuk lihat detail lengkap.
                </p>
              </div>
              <button
                onClick={() => setPopupData(null)}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <IconClose size={18} color="#64748b" />
              </button>
            </div>

            {/* POPUP BODY LIST WITH WRAPPED TEXT */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {popupData.events.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => {
                    setPopupData(null);
                    onSelectProject(ev.project);
                  }}
                  style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: `1.5px solid ${ev.type === 'bidding' ? '#ffedd5' : '#e0f2fe'}`,
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                  className="hover-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {/* WRAPPED TITLE */}
                    <h4 style={{ fontSize: '0.925rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.4, wordBreak: 'break-word', flex: 1 }}>
                      {ev.title}
                    </h4>
                    <span className={`badge ${ev.type === 'bidding' ? 'badge-potential' : 'badge-gov'}`} style={{ fontSize: '0.725rem', whiteSpace: 'nowrap' }}>
                      {ev.stageOrPic}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', paddingTop: '0.4rem', borderTop: '1px dashed #cbd5e1' }}>
                    <div>Pemberi Kerja: <strong style={{ color: 'var(--text-main)' }}>{ev.project.pemberi_kerja || '-'}</strong></div>
                    <div>Divisi: <strong style={{ color: 'var(--text-main)' }}>{ev.project.divisi_substansi || 'Gov'}</strong></div>
                  </div>

                  <div style={{ marginTop: '0.65rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.775rem', fontWeight: 800, color: accentColor, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <IconEye size={14} color={accentColor} /> Lihat Detail Pekerjaan →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
