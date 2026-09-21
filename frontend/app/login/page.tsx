'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '../../lib/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (userToLogin?: string, passToLogin?: string) => {
    setError('');
    setLoading(true);

    const u = userToLogin || username;
    const p = passToLogin || password;

    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });

      const data = await res.json();

      if (!res.ok || !data || !data.token) {
        throw new Error(data?.detail || 'Username atau Password salah (terverifikasi via pnc.indekstat.cloud)');
      }

      localStorage.setItem('token', data.token);
      if (data.user) {
        localStorage.setItem('user_info', JSON.stringify(data.user));
      }
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="glass-card login-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img 
            src="/logo.png" 
            alt="Logo" 
            style={{ 
              height: '60px', 
              width: 'auto', 
              margin: '0 auto 1rem', 
              display: 'block', 
              objectFit: 'contain', 
              opacity: 0.88, 
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.1))' 
            }} 
          />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>InDeTrack</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Masuk dengan Akun HRIS <strong>pnc.indekstat.cloud</strong>
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
        >
          <div className="input-group" style={{ marginBottom: '1rem' }}>
            <label className="input-label">Username HRIS</label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g. wiicaantales"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label className="input-label">Password HRIS</label>
            <input
              className="input-field"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '0.85rem' }}>
            {loading ? 'Memproses HRIS Auth...' : 'Masuk ke Dashboard'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.1)', border: '1px solid rgba(2, 132, 199, 0.3)', color: '#0284c7', fontSize: '0.8rem', textAlign: 'center' }}>
          🔒 Autentikasi terhubung langsung dengan <strong>pnc.indekstat.cloud</strong>.
        </div>
      </div>
    </div>
  );
}
