import re

files_and_guides = [
    (
        "frontend/app/marketing/page.tsx",
        """
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem',
        marginBottom: '1.5rem', color: '#1e3a8a', fontSize: '0.9rem', lineHeight: 1.5
      }}>
        <strong>💡 Panduan Fitur Marketing:</strong>
        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
          <li style={{ marginBottom: '0.25rem' }}><strong>Pembuatan Project:</strong> Saat klik "+ Tambah Project", pastikan mengisi <strong>Nilai Kontrak (Awal)</strong>.</li>
          <li style={{ marginBottom: '0.25rem' }}><strong>Nilai Project:</strong> Nilai ini akan dipakai di semua dashboard. Jika nanti saat eksekusi ada negosiasi nilai, tim Admin/Finance akan meng-update-nya jadi <strong>Nilai Deal</strong>.</li>
          <li><strong>Detail Info:</strong> Klik tombol Detail pada baris tabel untuk melihat dan mengubah informasi spesifik project.</li>
        </ul>
      </div>
"""
    ),
    (
        "frontend/app/ustek/page.tsx",
        """
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem',
        marginBottom: '1.5rem', color: '#1e3a8a', fontSize: '0.9rem', lineHeight: 1.5
      }}>
        <strong>💡 Panduan Fitur Penawaran:</strong>
        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
          <li style={{ marginBottom: '0.25rem' }}><strong>Pengisian Dokumen:</strong> Lembar Kerja ini khusus untuk memonitoring dokumen Penawaran seperti Ustek, RAB, dan Tenaga Ahli (TA).</li>
          <li><strong>Update Tahapan:</strong> Untuk memperbarui persentase penyusunan dokumen, klik tombol Detail dan masuk ke tab informasi.</li>
        </ul>
      </div>
"""
    ),
    (
        "frontend/app/substansi/page.tsx",
        """
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem',
        marginBottom: '1.5rem', color: '#1e3a8a', fontSize: '0.9rem', lineHeight: 1.5
      }}>
        <strong>💡 Panduan Fitur Substansi:</strong>
        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
          <li style={{ marginBottom: '0.25rem' }}><strong>Manajemen Tahapan:</strong> Setiap project bisa memiliki daftar tahapan pekerjaan yang berbeda-beda. Klik tombol Detail dan buka tab <strong>Tahapan Pelaksanaan</strong> untuk menambah jadwal/tahapan baru.</li>
          <li><strong>Checklist Selesai:</strong> Jika sebuah project sudah sepenuhnya selesai 100%, tandai dengan tombol Selesai di tab Detail.</li>
        </ul>
      </div>
"""
    ),
    (
        "frontend/app/pekerjaan-menang/page.tsx",
        """
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem',
        marginBottom: '1.5rem', color: '#1e3a8a', fontSize: '0.9rem', lineHeight: 1.5
      }}>
        <strong>💡 Panduan Fitur Pekerjaan Menang:</strong>
        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
          <li style={{ marginBottom: '0.25rem' }}><strong>Custom Tahapan:</strong> Di sini Anda dapat memonitor pelaksanaan project. Gunakan tombol Detail Info untuk menambah tahapan kustom per project.</li>
          <li><strong>Kolaborasi Dokumen:</strong> Pastikan Anda menggunakan tautan (link) cloud (seperti Google Drive) untuk dokumen-dokumen project agar bisa diakses tim lain.</li>
        </ul>
      </div>
"""
    )
]

for filepath, guide_html in files_and_guides:
    with open(filepath, "r") as f:
        content = f.read()

    # Find where <div className="page-header">...</div> ends
    # We can search for <div className="page-header"> and then find its closing </div>
    match = re.search(r'(<div className="page-header">.*?</div>)', content, re.DOTALL)
    if match:
        header_block = match.group(1)
        if "Panduan Fitur" not in content:
            new_content = content.replace(header_block, header_block + "\n" + guide_html)
            with open(filepath, "w") as f:
                f.write(new_content)
            print(f"Updated {filepath}")
        else:
            print(f"Already updated {filepath}")
    else:
        print(f"Could not find page-header in {filepath}")
