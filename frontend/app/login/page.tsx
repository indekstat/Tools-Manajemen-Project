'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

    const formData = new URLSearchParams();
    formData.append('username', u);
    formData.append('password', p);

    try {
      const res = await fetch('http://localhost:8145/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Username atau Password salah');
      }

      const data = await res.json();
      localStorage.setItem('token', data.access_token);
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
              placeholder="e.g. gov_user"
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

        <div className="demo-account-grid">
          <div style={{ gridColumn: '1 / -1', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            QUICK LOGIN AKUN TEST:
          </div>
          <button className="demo-btn" onClick={() => handleLogin('superadmin', 'password')}>
            <strong>Superadmin</strong>
            <span>Full Control</span>
          </button>
          <button className="demo-btn" onClick={() => handleLogin('ir_user', 'password')}>
            <strong>IR (Marketing)</strong>
            <span>Add Projects</span>
          </button>
          <button className="demo-btn" onClick={() => handleLogin('gov_user', 'password')}>
            <strong>Gov User</strong>
            <span>Divisi Govt</span>
          </button>
          <button className="demo-btn" onClick={() => handleLogin('pol_user', 'password')}>
            <strong>Pol User</strong>
            <span>Divisi Political</span>
          </button>
          <button className="demo-btn" onClick={() => handleLogin('finance_user', 'password')}>
            <strong>Finance User</strong>
            <span>SPK & BAST</span>
          </button>
          <button className="demo-btn" onClick={() => handleLogin('systech_user', 'password')}>
            <strong>Systech User</strong>
            <span>Dashboard Links</span>
          </button>
          <button className="demo-btn" onClick={() => handleLogin('viewer', 'password')}>
            <strong>Viewer</strong>
            <span>Read-Only</span>
          </button>
        </div>
      </div>
    </div>
  );
}
