'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { fetchWithAuth } from '../lib/api';
import { IconDashboard, IconBidding, IconUstek, IconTrophy, IconFinance, IconGlobe, IconUser } from './Icons';

export default function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarContent />
    </Suspense>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentView = searchParams.get('view') || 'worksheet';
  const [user, setUser] = useState<{ username: string; role: string; level?: string } | null>(null);

  useEffect(() => {
    if (pathname === '/login') return;

    fetchWithAuth('/users/me')
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then((data) => {
        if (data.username) setUser(data);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [pathname, router]);

  if (pathname === '/login') {
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/', getIcon: (color: string) => <IconDashboard size={18} color={color} />, defaultColor: '#6366f1', roles: ['IR', 'Gov', 'Pol', 'Finance', 'Systech', 'Viewer', 'Superadmin', 'Management'] },
    {
      label: 'Kontrol Bidding',
      path: '/marketing',
      getIcon: (color: string) => <IconBidding size={18} color={color} />,
      defaultColor: '#f97316',
      roles: ['IR', 'Superadmin', 'Management'],
      subItems: [
        { label: 'Overview', tab: 'overview' },
        { label: 'Lembar Kerja Bidding', tab: 'worksheet' }
      ]
    },
    {
      label: 'Kontrol Penawaran',
      path: '/ustek',
      getIcon: (color: string) => <IconUstek size={18} color={color} />,
      defaultColor: '#0284c7',
      roles: ['Gov', 'Pol', 'IR', 'Systech', 'Superadmin', 'Viewer', 'Management'],
      subItems: [
        { label: 'Overview', tab: 'overview' },
        { label: 'Lembar Kerja Ustek', tab: 'worksheet' }
      ]
    },
    {
      label: 'Pekerjaan Menang',
      path: '/pekerjaan-menang',
      getIcon: (color: string) => <IconTrophy size={18} color={color} />,
      defaultColor: '#10b981',
      roles: ['IR', 'Gov', 'Pol', 'Finance', 'Systech', 'Viewer', 'Superadmin', 'Management'],
      subItems: [
        { label: 'Overview', tab: 'overview' },
        { label: 'Lembar Kerja', tab: 'worksheet' }
      ]
    },
    {
      label: 'Kontrol Penagihan',
      path: '/admin',
      getIcon: (color: string) => <IconFinance size={18} color={color} />,
      defaultColor: '#8b5cf6',
      roles: ['Finance', 'Superadmin', 'IR', 'Management'],
      subItems: [
        { label: 'Overview', tab: 'overview' },
        { label: 'Lembar Kerja Penagihan', tab: 'worksheet' }
      ]
    },
    { label: 'Dashboard Project', path: '/dashboards', getIcon: (color: string) => <IconGlobe size={18} color={color} />, defaultColor: '#06b6d4', roles: ['IR', 'Gov', 'Pol', 'Finance', 'Systech', 'Viewer', 'Superadmin', 'Management'] },
    { label: 'Data Karyawan', path: '/users', getIcon: (color: string) => <IconUser size={18} color={color} />, defaultColor: '#ec4899', roles: ['*'] },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0.5rem 0 1.25rem' }}>
        <img 
          src="/logo.png" 
          alt="InDeTrack Logo" 
          style={{ 
            height: '56px',
            maxHeight: '64px', 
            maxWidth: '100%',
            objectFit: 'contain', 
            display: 'block',
            margin: '0 auto',
            opacity: 0.95, 
            transition: 'all 0.2s ease',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))' 
          }} 
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.95')}
        />
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isSuperOrLeader = user?.role === 'Superadmin' || user?.level === 'CHIEF' || user?.level === 'HEAD';
          const isAllowed = isSuperOrLeader || item.roles.includes('*') || item.roles.includes(user?.role || '');
          if (user && !isAllowed) return null;

          const isParentActive = pathname === item.path;
          const iconColor = isParentActive ? '#ffffff' : item.defaultColor;

          return (
            <div key={item.path} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <Link
                href={item.subItems ? `${item.path}?view=${currentView || 'worksheet'}` : item.path}
                className={`nav-item ${isParentActive ? 'active' : ''}`}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>{item.getIcon(iconColor)}</span>
                <span>{item.label}</span>
              </Link>

              {item.subItems && isParentActive && (
                <div style={{ paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.1rem', marginBottom: '0.35rem' }}>
                  {item.subItems.map((sub) => {
                    const isSubActive = currentView === sub.tab;

                    return (
                      <Link
                        key={sub.tab}
                        href={`${item.path}?view=${sub.tab}`}
                        style={{
                          fontSize: '0.825rem',
                          fontWeight: isSubActive ? 750 : 500,
                          color: isSubActive ? item.defaultColor : 'var(--text-muted)',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          background: isSubActive ? `${item.defaultColor}18` : 'transparent',
                          borderLeft: isSubActive ? `3px solid ${item.defaultColor}` : '3px solid transparent',
                          transition: 'all 0.15s ease',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: isSubActive ? item.defaultColor : '#94a3b8' }} />
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {user ? (
          <>
            <div className="user-badge">
              <div className="avatar">{user.username.charAt(0).toUpperCase()}</div>
              <div className="user-info">
                <span className="user-name">{user.username}</span>
                <span className="user-role-badge">Role: {user.role}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          </>
        ) : (
          <Link href="/login" className="btn-primary" style={{ textAlign: 'center' }}>
            Login
          </Link>
        )}
      </div>
    </aside>
  );
}
