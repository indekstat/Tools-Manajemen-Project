// Pemberitahuan dan konfirmasi yang menggantikan alert()/confirm() bawaan browser.
// Tampilannya dirender oleh <Toast /> dan <ConfirmHost /> di layout; keduanya mendengarkan event window.

export type ToastType = 'success' | 'error';

export function notify(type: ToastType, message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { type, message } }));
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Aksi merusak (hapus/lepas): tombol merah dan fokus awal di Batal. */
  danger?: boolean;
}

export type ConfirmDetail = ConfirmOptions & { resolve: (ok: boolean) => void };

let hostAktif = false;

/** Dipanggil <ConfirmHost /> saat terpasang/terlepas, agar confirmDialog tahu ada yang menampilkan modalnya. */
export function setConfirmHost(aktif: boolean) {
  hostAktif = aktif;
}

/** Pengganti confirm(): `if (!(await confirmDialog({ message: '...' }))) return;` */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  // Cadangan bila modal belum terpasang (mis. dipanggil sebelum layout selesai dimuat).
  if (!hostAktif) return Promise.resolve(window.confirm(opts.message));
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<ConfirmDetail>('app:confirm', { detail: { ...opts, resolve } }));
  });
}
