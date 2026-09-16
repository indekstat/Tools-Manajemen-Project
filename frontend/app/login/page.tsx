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

    const tryLogin = async (usr: string, pwd: string) => {
      const formData = new URLSearchParams();
      formData.append('username', usr);
      formData.append('password', pwd);

      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!res.ok) return null;
      return await res.json();
    };

    try {
      let data = await tryLogin(u, p);
      
      // Fallback try with default password if quick login
      if (!data && userToLogin) {
        data = await tryLogin(u, 'password');
      }

      if (!data) {
        throw new Error('Username atau Password salah');
      }

      localStorage.setItem('token', data.access_token);
      router.push('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickUsers = [
    { username: 'superadmin', role: 'Superadmin', label: 'Full Access' },
    { username: 'ir_user', role: 'IR (Marketing)', label: 'Bidding & PL' },
    { username: 'gov_user', role: 'Gov User', label: 'Government' },
    { username: 'pol_user', role: 'Pol User', label: 'Political' },
    { username: 'finance_user', role: 'Finance User', label: 'Keuangan' },
    { username: 'viewer', role: 'Viewer', label: 'Read Only' },
  ];

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
            Masuk untuk mengakses sistem tracking project
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
            <label className="input-label">Username</label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g. superadmin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label className="input-label">Password</label>
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
            {loading ? 'Memproses...' : 'Masuk ke Dashboard'}
          </button>
        </form>

        {/* QUICK LOGIN CARDS GRID */}
        <div className="demo-account-grid">
          <div style={{ gridColumn: '1 / -1', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            QUICK LOGIN AKUN TEST:
          </div>
          {quickUsers.map((item) => (
            <button
              key={item.username}
              className="demo-btn"
              onClick={() => handleLogin(item.username, 'password')}
              disabled={loading}
            >
              <strong>{item.username}</strong>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
