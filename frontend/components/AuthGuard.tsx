'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { fetchWithAuth } from '../lib/api';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');

    // On login page
    if (pathname === '/login') {
      if (token) {
        fetchWithAuth('/users/me')
          .then((res) => {
            if (res.ok) {
              router.push('/');
            } else {
              localStorage.removeItem('token');
              setIsAuthenticated(false);
            }
          })
          .catch(() => {
            setIsAuthenticated(false);
          });
      } else {
        setIsAuthenticated(false);
      }
      return;
    }

    // On protected pages
    if (!token) {
      setIsAuthenticated(false);
      router.push('/login');
      return;
    }

    fetchWithAuth('/users/me')
      .then((res) => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('token');
          setIsAuthenticated(false);
          router.push('/login');
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        router.push('/login');
      });
  }, [pathname, router]);

  // While checking auth status on protected route
  if (pathname !== '/login' && isAuthenticated === null) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg-main, #f8fafc)',
          color: 'var(--text-muted, #64748b)',
          gap: '1rem',
          fontFamily: 'sans-serif'
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid #cbd5e1',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}
        />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Memeriksa Sesi Login...</span>
      </div>
    );
  }

  // If unauthenticated on protected route, show blank while redirecting
  if (pathname !== '/login' && isAuthenticated === false) {
    return null;
  }

  return <>{children}</>;
}
