export const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:8145`;
  }
  return 'http://localhost:8145';
};

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const baseUrl = getApiUrl();
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  return response;
}

export const formatCurrencySmart = (val: number) => {
  if (!val || val === 0) return 'Rp 0';
  if (Math.abs(val) >= 1000000000) {
    const miliar = val / 1000000000;
    const formatted = miliar % 1 === 0 
      ? miliar.toLocaleString('id-ID') 
      : miliar.toFixed(2).replace('.', ',').replace(/,00$/, '');
    return `Rp ${formatted} Miliar`;
  }
  if (Math.abs(val) >= 1000000) {
    const juta = val / 1000000;
    const formatted = juta % 1 === 0 
      ? juta.toLocaleString('id-ID') 
      : juta.toFixed(1).replace('.', ',').replace(/,0$/, '');
    return `Rp ${formatted} Jt`;
  }
  return `Rp ${val.toLocaleString('id-ID')}`;
};

export const isAdministrasiSelesai = (p: any) => {
  if (!p) return false;
  if (p.status_selesai_administrasi) return true;
  const totalPaid = (p.billings || [])
    .filter((b: any) => b.status === 'Sudah dibayarkan')
    .reduce((sum: number, b: any) => sum + (b.nominal || 0), 0);
  const isPaidInFull = totalPaid >= (p.nilai_kontrak || 0) && (p.nilai_kontrak || 0) > 0;
  const hasDocs = Boolean(p.link_spk && p.link_bast && p.link_referensi);
  return isPaidInFull && hasDocs;
};

export const isSubstansiSelesai = (p: any) => {
  if (!p) return false;
  return Boolean(p.status_selesai_substansi);
};

export const isProjectSelesaiAkhir = (p: any) => {
  if (!p) return false;
  return isSubstansiSelesai(p) && isAdministrasiSelesai(p);
};
