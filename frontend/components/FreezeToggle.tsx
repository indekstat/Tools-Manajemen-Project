'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';

const STORAGE_KEY = 'worksheetFreeze';
const DEFAULT_RAW = '{}';

type FreezeState = { header: boolean; column: boolean };

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readRaw() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_RAW;
  } catch {
    return DEFAULT_RAW;
  }
}

function parse(raw: string): FreezeState {
  try {
    const saved = JSON.parse(raw);
    return { header: Boolean(saved.header), column: Boolean(saved.column) };
  } catch {
    return { header: false, column: false };
  }
}

// Pengaturan freeze lembar kerja, disimpan per browser dan berlaku di semua lembar kerja
export function useFreezePanes() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => DEFAULT_RAW);
  const freeze = parse(raw);

  const toggle = (key: keyof FreezeState) => {
    const next = { ...parse(readRaw()), [key]: !freeze[key] };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    listeners.forEach((l) => l());
  };

  const containerClass = [
    'table-container',
    freeze.header ? 'freeze-header' : '',
    freeze.column ? 'freeze-col' : '',
  ].filter(Boolean).join(' ');

  return { freeze, toggle, containerClass };
}

export default function FreezeToggle({ freeze, toggle }: Pick<ReturnType<typeof useFreezePanes>, 'freeze' | 'toggle'>) {
  const btnStyle = (active: boolean): CSSProperties => ({
    padding: '0.4rem 0.75rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    borderRadius: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    border: `1px solid ${active ? '#4338ca' : '#cbd5e1'}`,
    background: active ? '#e0e7ff' : '#ffffff',
    color: active ? '#3730a3' : '#475569',
  });

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Freeze:</span>
      <button type="button" style={btnStyle(freeze.header)} onClick={() => toggle('header')} aria-pressed={freeze.header}>
        {freeze.header ? '📌 ' : ''}Judul Kolom
      </button>
      <button type="button" style={btnStyle(freeze.column)} onClick={() => toggle('column')} aria-pressed={freeze.column}>
        {freeze.column ? '📌 ' : ''}Nama Pekerjaan
      </button>
    </div>
  );
}
