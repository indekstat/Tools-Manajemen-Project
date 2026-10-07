'use client';
import { useEffect, useRef, useState } from 'react';

export default function Toast() {
  const [toast, setToast] = useState<{ type: string; message: string; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setToast({ ...detail, key: Date.now() });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), 2500);
    };
    window.addEventListener('app:toast', handler);
    return () => {
      window.removeEventListener('app:toast', handler);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!toast) return null;
  const ok = toast.type === 'success';
  return (
    <div
      key={toast.key}
      role="status"
      style={{
        position: 'fixed',
        top: '1.25rem',
        right: '1.25rem',
        zIndex: 20000,
        background: ok ? '#059669' : '#dc2626',
        color: '#fff',
        padding: '0.75rem 1.1rem',
        borderRadius: '10px',
        fontSize: '0.875rem',
        fontWeight: 700,
        boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
        animation: 'modalSlide 0.2s ease',
      }}
    >
      {ok ? '✓ ' : '✕ '}
      {toast.message}
    </div>
  );
}
