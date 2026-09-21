'use client';
import { useEffect, useState, useMemo } from 'react';
import { fetchWithAuth } from '../../lib/api';
import { IconUser, IconSearch } from '../../components/Icons';

export default function UsersManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      let usersRes = await fetchWithAuth('/api/auth/users/');
      if (!usersRes.ok) {
        usersRes = await fetchWithAuth('/users');
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        if (Array.isArray(data)) setUsers(data);
      }
    } catch (err) {
      console.error('Failed loading users', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const seen = new Set<string>();
    const uniqueList: any[] = [];
    for (const u of users) {
      const nameKey = (`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.nama || u.username || '').toLowerCase();
      if (!seen.has(nameKey)) {
        seen.add(nameKey);
        uniqueList.push(u);
      }
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return uniqueList;
    return uniqueList.filter((u) => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.nama || '';
      const dept = u.karyawan?.divisi || u.karyawan?.departemen || u.divisi || '';
      const roleStr = u.karyawan?.jabatan || u.role || '';
      return (
        fullName.toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        roleStr.toLowerCase().includes(q) ||
        dept.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <IconUser size={28} color="#f97316" />
          <div>
            <h1 className="page-title">User Management / Data Karyawan</h1>
            <p className="page-desc">
              Daftar akun karyawan & personil internal terintegrasi terpusat dari HRIS <strong>pnc.indekstat.cloud</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* TABLE DATA KARYAWAN */}
      <div className="glass-card">
        {/* HEADER BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Daftar Karyawan / Users ({filteredUsers.length} Personil)
          </h2>

          <div style={{ position: 'relative', minWidth: '280px', flex: 1, maxWidth: '400px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="🔍 Cari nama karyawan, username, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem', width: '100%', margin: 0 }}
            />
            <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}>
              <IconSearch size={16} />
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data karyawan dari HRIS...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                  <th>Nama Lengkap Karyawan</th>
                  <th>Username</th>
                  <th>Role / Jabatan HRIS</th>
                  <th>Divisi / Departemen</th>
                  <th>Level Jabatan</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                      Tidak ada karyawan yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, idx) => {
                    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.nama || u.username;
                    let userRole = u.karyawan?.jabatan || u.role || (u.is_superuser ? 'Superadmin' : u.is_staff ? 'Staff' : 'Karyawan');
                    if (userRole === 'IR') userRole = 'Institutional Relationship';
                    let userDivisi = u.karyawan?.divisi || u.karyawan?.departemen || u.divisi || '-';
                    if (userDivisi === 'IR') userDivisi = 'Institutional Relationship';
                    const rawLevel = u.karyawan?.level_jabatan || u.level || 'STAFF';
                    const isLeader = ['CHIEF', 'HEAD'].includes(rawLevel.toUpperCase());

                    return (
                      <tr key={u.id}>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-dim)' }}>{idx + 1}.</td>
                        <td style={{ fontWeight: 700, color: '#1e293b' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                            <IconUser size={16} color="#f97316" /> {fullName}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>@{u.username}</td>
                        <td>
                          <span className="badge" style={{ background: isLeader ? '#dbeafe' : '#ffedd5', color: isLeader ? '#1d4ed8' : '#c2410c', fontWeight: 700 }}>
                            {userRole}
                          </span>
                        </td>
                        <td>{userDivisi}</td>
                        <td>
                          {isLeader ? (
                            <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                              {rawLevel} (Superadmin)
                            </span>
                          ) : (
                            rawLevel
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
