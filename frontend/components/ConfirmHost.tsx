'use client';
import { useEffect, useRef, useState } from 'react';
import { setConfirmHost, type ConfirmDetail } from '../lib/notify';

export default function ConfirmHost() {
  const [dialog, setDialog] = useState<ConfirmDetail | null>(null);
  const dialogRef = useRef<ConfirmDetail | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dialogRef.current = dialog;
  }, [dialog]);

  useEffect(() => {
    const handler = (e: Event) => {
      // Konfirmasi baru menggantikan yang masih terbuka (dianggap dibatalkan).
      dialogRef.current?.resolve(false);
      setDialog((e as CustomEvent<ConfirmDetail>).detail);
    };
    window.addEventListener('app:confirm', handler);
    setConfirmHost(true);
    return () => {
      window.removeEventListener('app:confirm', handler);
      setConfirmHost(false);
      dialogRef.current?.resolve(false);
    };
  }, []);

  // Fokus awal: Batal untuk aksi merusak supaya Enter tidak menghapus tanpa sengaja.
  useEffect(() => {
    if (!dialog) return;
    (dialog.danger ? cancelRef : okRef).current?.focus();
  }, [dialog]);

  if (!dialog) return null;

  const tutup = (ok: boolean) => {
    dialog.resolve(ok);
    setDialog(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      tutup(false);
    } else if (e.key === 'Tab') {
      // Fokus berputar di antara dua tombol agar tidak keluar dari dialog.
      e.preventDefault();
      const aktif = document.activeElement;
      (aktif === cancelRef.current ? okRef : cancelRef).current?.focus();
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 30000 }} onClick={() => tutup(false)} onKeyDown={onKeyDown}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="modal-content glass-card"
        style={{ maxWidth: '420px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
          {dialog.title || 'Konfirmasi'}
        </h3>
        <p id="confirm-desc" style={{ margin: '0.6rem 0 1.4rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          {dialog.message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button ref={cancelRef} type="button" className="btn-primary btn-secondary" onClick={() => tutup(false)}>
            {dialog.cancelText || 'Batal'}
          </button>
          <button
            ref={okRef}
            type="button"
            className="btn-primary"
            style={dialog.danger ? { background: '#dc2626' } : undefined}
            onClick={() => tutup(true)}
          >
            {dialog.confirmText || 'Ya'}
          </button>
        </div>
      </div>
    </div>
  );
}
