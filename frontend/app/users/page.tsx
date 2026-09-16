'use client';
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../lib/api';
import SearchableSelect from '../../components/SearchableSelect';
import { IconUser, IconSearch, IconTrash, IconAlertTriangle, IconCheck } from '../../components/Icons';

export default function UsersManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Selection State
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  // Form State for creating new user/karyawan
  const [nama, setNama] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Gov');
  const [divisi, setDivisi] = useState('Government');
  const [level, setLevel] = useState('STAFF');

  // Delete confirmation state (single vs bulk)
  const [deleteTargetUsers, setDeleteTargetUsers] = useState<any[] | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [meRes, usersRes] = await Promise.all([
        fetchWithAuth('/users/me'),
        fetchWithAuth('/users')
      ]);

      if (meRes.ok) {
        const me = await meRes.json();
        setCurrentUser(me);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        if (Array.isArray(data)) setUsers(data);
      }
    } catch (err) {
      console.error('Failed loading users', err);
    } finally {
      setLoading(false);
      setSelectedUserIds([]);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    const res = await fetchWithAuth('/users', {
      method: 'POST',
      body: JSON.stringify({
        nama: nama || username,
        username,
        password,
        role,
        divisi,
        level
      })
    });

    if (res.ok) {
      setNama('');
      setUsername('');
      setPassword('');
      loadData();
    } else {
      const err = await res.json();
      alert(`Gagal menambah user: ${err.detail || 'Terjadi kesalahan'}`);
    }
  };

  const executeBulkDelete = async () => {
    if (!deleteTargetUsers || deleteTargetUsers.length === 0) return;

    const targetIds = deleteTargetUsers.map((u) => u.id);
    const res = await fetchWithAuth('/users/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: targetIds }),
    });

    if (res.ok) {
      setDeleteTargetUsers(null);
      setSelectedUserIds([]);
      loadData();
    } else {
      const err = await res.json();
      alert(`Gagal menghapus user: ${err.detail || 'Terjadi kesalahan'}`);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.nama || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.divisi || '').toLowerCase().includes(q)
    );
  });

  // Toggle selection for all filtered users
  const isAllFilteredSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedUserIds.includes(u.id));

  const toggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredSet = new Set(filteredUsers.map((u) => u.id));
      setSelectedUserIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const combined = new Set([...selectedUserIds, ...filteredUsers.map((u) => u.id)]);
      setSelectedUserIds(Array.from(combined));
    }
  };

  const toggleSelectUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const canManage = currentUser?.role === 'Superadmin' || currentUser?.role === 'Admin' || currentUser?.role === 'IR' || currentUser?.role === 'Gov';

  const selectedUsersObjects = users.filter((u) => selectedUserIds.includes(u.id));

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <IconUser size={28} color="#f97316" />
          <div>
            <h1 className="page-title">User Management / Data Karyawan</h1>
            <p className="page-desc">Kelola daftar akun karyawan & personil internal. Gunakan fitur centang (bulk selection) untuk menghapus banyak user sekaligus.</p>
          </div>
        </div>
      </div>

      {/* FORM INPUT KARYAWAN BARU */}
      {canManage && (
        <div className="glass-card" style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>+ Tambah User / Karyawan Baru</h2>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr', gap: '0.75rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Nama Lengkap Karyawan</label>
                <input
                  className="input-field"
                  style={{ margin: 0 }}
                  placeholder="e.g. Titis Pratiknyo"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  required
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Username</label>
                <input
                  className="input-field"
                  style={{ margin: 0 }}
                  placeholder="e.g. titis_pratiknyo"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Password</label>
                <input
                  type="password"
                  className="input-field"
                  style={{ margin: 0 }}
                  placeholder="Masukkan password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Role Akses</label>
                <SearchableSelect
                  style={{ margin: 0 }}
                  value={role}
                  onChange={(val) => setRole(val)}
                  options={['IR', 'Gov', 'Pol', 'Finance', 'Systech', 'Viewer', 'Superadmin']}
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Divisi</label>
                <SearchableSelect
                  style={{ margin: 0 }}
                  value={divisi}
                  onChange={(val) => setDivisi(val)}
                  options={['Government', 'Politics', 'Finance', 'Systech', 'Pusat', 'Management']}
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Level Jabatan</label>
                <SearchableSelect
                  style={{ margin: 0 }}
                  value={level}
                  onChange={(val) => setLevel(val)}
                  options={['CHIEF', 'HEAD', 'STAFF']}
                />
              </div>

              <button className="btn-primary" type="submit" style={{ height: '42px', minWidth: '140px' }}>
                + Simpan User
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TABLE DATA KARYAWAN */}
      <div className="glass-card">
        {/* HEADER & BULK ACTION BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              Daftar Karyawan / Users ({filteredUsers.length} Personil)
            </h2>

            {/* BULK ACTION BUTTON */}
            {canManage && selectedUserIds.length > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#fef2f2', border: '1px solid #fca5a5', padding: '0.35rem 0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#991b1b' }}>
                  {selectedUserIds.length} User Terpilih
                </span>
                <button
                  className="btn-primary btn-sm"
                  style={{ background: '#dc2626', color: '#fff', padding: '0.25rem 0.6rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  onClick={() => setDeleteTargetUsers(selectedUsersObjects)}
                >
                  <IconTrash size={14} /> Bulk Delete ({selectedUserIds.length})
                </button>
                <button
                  className="btn-primary btn-sm btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  onClick={() => setSelectedUserIds([])}
                >
                  Batal
                </button>
              </div>
            )}
          </div>

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
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat data karyawan...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {canManage && (
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={toggleSelectAll}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#dc2626' }}
                        title="Pilih Semua / Batal Pilih Semua"
                      />
                    </th>
                  )}
                  <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                  <th>Nama Lengkap Karyawan</th>
                  <th>Username</th>
                  <th>Role Hak Akses</th>
                  <th>Divisi</th>
                  <th>Level</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 8 : 6} style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                      Tidak ada karyawan yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u, idx) => {
                    const isSelected = selectedUserIds.includes(u.id);

                    return (
                      <tr key={u.id} style={{ background: isSelected ? '#fef2f2' : undefined }}>
                        {canManage && (
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectUser(u.id)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#dc2626' }}
                            />
                          </td>
                        )}
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-dim)' }}>{idx + 1}.</td>
                        <td style={{ fontWeight: 700, color: '#1e293b' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                            <IconUser size={16} color="#f97316" /> {u.nama || u.username}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>@{u.username}</td>
                        <td>
                          <span className="badge" style={{ background: '#ffedd5', color: '#c2410c', fontWeight: 700 }}>
                            {u.role}
                          </span>
                        </td>
                        <td>{u.divisi || '-'}</td>
                        <td>{u.level || 'STAFF'}</td>
                        {canManage && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-logout"
                              style={{ padding: '0.3rem 0.6rem', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                              onClick={() => setDeleteTargetUsers([u])}
                              title="Hapus User"
                            >
                              <IconTrash size={14} /> Hapus
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL FOR SINGLE OR BULK DELETE */}
      {deleteTargetUsers && deleteTargetUsers.length > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div className="glass-card" style={{ maxWidth: '480px', width: '90%', padding: '1.5rem', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#dc2626' }}>
              <IconAlertTriangle size={26} color="#dc2626" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
                {deleteTargetUsers.length > 1 ? `Konfirmasi Bulk Delete (${deleteTargetUsers.length} User)` : 'Konfirmasi Hapus User'}
              </h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              {deleteTargetUsers.length > 1 ? (
                <span>Apakah Anda yakin ingin menghapus <strong>{deleteTargetUsers.length} akun karyawan</strong> berikut secara bersamaan?</span>
              ) : (
                <span>Apakah Anda yakin ingin menghapus akun karyawan <strong>"{deleteTargetUsers[0].nama || deleteTargetUsers[0].username}"</strong> (@{deleteTargetUsers[0].username})?</span>
              )}
            </p>

            {/* LIST OF TARGET USERS */}
            {deleteTargetUsers.length > 1 && (
              <div style={{ maxHeight: '140px', overflowY: 'auto', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                {deleteTargetUsers.map((u, i) => (
                  <div key={u.id} style={{ padding: '0.2rem 0', color: '#334155', fontWeight: 600 }}>
                    {i + 1}. {u.nama || u.username} (@{u.username})
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn-primary btn-secondary" onClick={() => setDeleteTargetUsers(null)}>
                Batal
              </button>
              <button
                className="btn-primary"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={executeBulkDelete}
              >
                {deleteTargetUsers.length > 1 ? `Ya, Hapus ${deleteTargetUsers.length} User` : 'Ya, Hapus User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
