# API Login Kepegawaian (untuk Aplikasi Lain)

API ini dipakai supaya aplikasi lain bisa login dengan akun HRIS yang sama dan mengambil data kepegawaian user yang login, menggunakan token (bukan session cookie).

Base URL: `https://pnc.indekstat.cloud/api/auth/`

Autentikasi memakai token DRF. Setelah login, kirim token di setiap request lewat header:

```
Authorization: Token <token>
```

---

## 1. Login

```
POST /api/auth/login/
Content-Type: application/json
```

Body:

```json
{
  "username": "budi.santoso",
  "password": "rahasia123"
}
```

Response `200 OK`:

```json
{
  "token": "ab5b838411e2636025c30a6968e0ffaa4d20e88b",
  "user": {
    "id": 42,
    "username": "budi.santoso",
    "email": "budi@example.com",
    "first_name": "Budi",
    "last_name": "Santoso",
    "is_active": true,
    "is_staff": false,
    "is_superuser": false,
    "karyawan": {
      "id": 10,
      "nik": "3201xxxxxxxx",
      "nip": "EMP-0010",
      "status": "Tetap",
      "status_karyawan": "Tetap",
      "tipe_kontrak": "PKWTT",
      "tanggal_gabung": "2022-01-10",
      "departemen": "IT",
      "divisi": "Engineering",
      "jabatan": "Staff",
      "level_jabatan": "Staff",
      "lokasi_kerja": "Jakarta",
      "foto": "https://<domain-hris>/media/employee_photos/budi-santoso.jpg"
    }
  }
}
```

Kalau user belum punya profil karyawan (misal admin murni), `karyawan` bernilai `null`.

Error kemungkinan:

| Status | Kondisi |
|---|---|
| `400` | `username`/`password` kosong |
| `401` | username/password salah |
| `403` | akun tidak aktif |

---

## 2. Ambil Profil User yang Login

Dipakai untuk verifikasi token dan mengambil data terbaru kapan saja (tanpa perlu login ulang).

```
GET /api/auth/me/
Authorization: Token <token>
```

Response `200 OK`: sama persis dengan field `user` di respons login.

Kalau token salah/kadaluarsa/tidak dikirim → `401 Unauthorized`.

---

## 3. Logout

Menghapus token yang sedang dipakai (harus login ulang untuk dapat token baru).

```
POST /api/auth/logout/
Authorization: Token <token>
```

Response: `204 No Content`.

---

## 4. List Semua User

Mengambil daftar semua user beserta data kepegawaian. Hanya bisa diakses oleh user `is_staff` atau `is_superuser`.

```
GET /api/auth/users/
Authorization: Token <token>
```

Response `200 OK`: array, tiap elemen sama persis dengan field `user` di respons login.

Error kemungkinan:

| Status | Kondisi |
|---|---|
| `401` | token salah/kadaluarsa/tidak dikirim |
| `403` | user yang login bukan staff/superuser |

---

## Contoh Pemakaian (curl)

```bash
# Login
curl -X POST https://<domain-hris>/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"budi.santoso","password":"rahasia123"}'

# Ambil profil
curl https://<domain-hris>/api/auth/me/ \
  -H "Authorization: Token ab5b838411e2636025c30a6968e0ffaa4d20e88b"

# Logout
curl -X POST https://<domain-hris>/api/auth/logout/ \
  -H "Authorization: Token ab5b838411e2636025c30a6968e0ffaa4d20e88b"

# List semua user (staff/superuser saja)
curl https://<domain-hris>/api/auth/users/ \
  -H "Authorization: Token ab5b838411e2636025c30a6968e0ffaa4d20e88b"
```

## Catatan

- Token tidak pernah kadaluarsa otomatis — hanya hilang kalau di-`logout` (dihapus) atau user login lagi (token lama dipakai ulang, karena satu user = satu token aktif).
- Simpan token di sisi aplikasi lain dengan aman (jangan disimpan di localStorage untuk web publik, lebih aman di server/HTTP-only storage).
- Endpoint ini pakai HTTPS di production — jangan kirim username/password lewat HTTP biasa.
- Kalau butuh field kepegawaian tambahan (misal nomor HP, alamat, dll), bisa ditambahkan ke `KaryawanProfileSerializer` di `employees/serializers.py`.
