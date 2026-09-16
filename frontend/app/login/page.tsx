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

    const tryLogin = async (usr: string, pwd: string) => {
      const formData = new URLSearchParams();
      formData.append('username', usr);
      formData.append('password', pwd);

      const res = await fetch('http://localhost:8145/login', {
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
    'superadmin',
    'ir_user',
    'gov_user',
    'pol_user',
    'finance_user',
    'viewer'
  ];

  return (
    <div className="login-container">
      <div className="glass-card login-card" style={{ maxWidth: '420px', width: '100%', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <img 
            src="/logo.png" 
            alt="Logo" 
            style={{ 
              height: '56px', 
              width: 'auto', 
              margin: '0 auto 0.75rem', 
              display: 'block', 
              objectFit: 'contain', 
              opacity: 0.9, 
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.1))' 
            }} 
          />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>InDeTrack</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Masuk untuk mengakses sistem tracking project
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1.25rem', textAlign: 'center' }}>
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

          <div className="input-group" style={{ marginBottom: '1.25rem' }}>
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

          <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem' }}>
            {loading ? 'Memproses...' : 'Masuk ke Dashboard'}
          </button>
        </form>

        {/* QUICK LOGIN TABLE DESIGN MATCHING USER IMAGE */}
        <div style={{ marginTop: '1.75rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            QUICK LOGIN TEST AKUN:
          </div>

          <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', background: '#ffffff' }}>
            {quickUsers.map((u, idx) => (
              <button
                key={u}
                type="button"
                onClick={() => handleLogin(u, 'password')}
                disabled={loading}
                style={{
                  width: '100%',
                  display: 'block',
                  padding: '0.55rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  textAlign: 'center',
                  background: idx % 2 === 1 ? '#fff7ed' : '#ffffff',
                  border: 'none',
                  borderBottom: idx < quickUsers.length - 1 ? '1px solid #cbd5e1' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#ffedd5')}
                onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 1 ? '#fff7ed' : '#ffffff')}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
