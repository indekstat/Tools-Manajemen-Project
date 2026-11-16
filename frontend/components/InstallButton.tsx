'use client';
import { useState, useSyncExternalStore } from 'react';

// Event `beforeinstallprompt` hanya dikirim sekali dan bisa terjadi sebelum komponen tampil, jadi ditangkap di level modul.
type BipEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let tertunda: BipEvent | null = null;
const pendengar = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    tertunda = e as BipEvent;
    pendengar.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    tertunda = null;
    pendengar.forEach((fn) => fn());
  });
}

function sudahTerpasang() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function berlangganan(fn: () => void) {
  pendengar.add(fn);
  return () => {
    pendengar.delete(fn);
  };
}

// Snapshot berupa string kecil: digit pertama = sudah terpasang, digit kedua = dialog install otomatis tersedia.
const snapshotKlien = () => `${sudahTerpasang() ? 1 : 0}${tertunda ? 1 : 0}`;
const snapshotServer = () => 'ssr';

/** Tombol "Install Aplikasi": memunculkan dialog install bawaan Android/Chrome; bila belum tersedia, menampilkan cara manual. */
export default function InstallButton({ className = 'btn-install' }: { className?: string }) {
  const status = useSyncExternalStore(berlangganan, snapshotKlien, snapshotServer);
  const [panduan, setPanduan] = useState(false);

  if (status === 'ssr' || status[0] === '1') return null;   // belum di browser (hindari mismatch SSR) atau sudah terpasang
  const bisaOtomatis = status[1] === '1';

  const pasang = async () => {
    if (!tertunda) {
      setPanduan((v) => !v);
      return;
    }
    const e = tertunda;
    tertunda = null;                                  // satu event hanya bisa dipakai sekali
    pendengar.forEach((fn) => fn());
    await e.prompt();
    await e.userChoice;
  };

  const aman = window.isSecureContext;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div style={{ display: 'contents' }}>
      <button type="button" onClick={pasang} className={className}>
        {bisaOtomatis ? '⬇ Install Aplikasi' : '⬇ Pasang di layar utama'}
      </button>
      {panduan && !bisaOtomatis && (
        <p className="install-panduan" style={{ fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
          {!aman
            ? 'Install otomatis butuh alamat HTTPS. Hubungi admin, atau buka lewat alamat yang diawali https://.'
            : ios
              ? 'Di iPhone/iPad (Safari): ketuk tombol Bagikan, lalu pilih "Tambah ke Layar Utama".'
              : 'Di Android (Chrome): ketuk menu ⋮ di kanan atas, lalu pilih "Instal aplikasi" atau "Tambahkan ke layar utama".'}
        </p>
      )}
    </div>
  );
}
