import requests
import pandas as pd
import json
import os

def fetch_and_export():
    login_url = "http://localhost:8145/api/auth/login/"
    users_url = "http://localhost:8145/api/auth/users/"

    print("1. Logging in to fetch auth token...")
    resp = requests.post(login_url, json={"username": "alif", "password": "13111999"})
    if resp.status_code != 200:
        print("Login error:", resp.status_code, resp.text)
        return

    data = resp.json()
    token = data.get("token")
    print(f"Token obtained: {token}")

    print("2. Fetching full users list from /api/auth/users/...")
    headers = {"Authorization": f"Token {token}"}
    users_resp = requests.get(users_url, headers=headers)

    if users_resp.status_code != 200:
        print("Fetch users error:", users_resp.status_code, users_resp.text)
        return

    users_list = users_resp.json()
    print(f"Total users fetched: {len(users_list)}")

    # Flatten users response
    flattened_data = []
    for idx, u in enumerate(users_list, start=1):
        karyawan = u.get("karyawan") or {}
        row = {
            "No": idx,
            "User ID": u.get("id"),
            "Username": u.get("username"),
            "Email": u.get("email"),
            "Nama Depan": u.get("first_name"),
            "Nama Belakang": u.get("last_name"),
            "Nama Lengkap": f"{u.get('first_name', '')} {u.get('last_name', '')}".strip() or u.get("username"),
            "Status Active": "Aktif" if u.get("is_active") else "Non-Aktif",
            "Is Staff": u.get("is_staff"),
            "Is Superuser": u.get("is_superuser"),
            # Karyawan Profile Fields
            "Karyawan ID": karyawan.get("id"),
            "NIK": karyawan.get("nik"),
            "NIP": karyawan.get("nip"),
            "Status Kepegawaian": karyawan.get("status_karyawan") or karyawan.get("status"),
            "Tipe Kontrak": karyawan.get("tipe_kontrak"),
            "Tanggal Gabung": karyawan.get("tanggal_gabung"),
            "Departemen": karyawan.get("departemen"),
            "Divisi": karyawan.get("divisi"),
            "Jabatan": karyawan.get("jabatan"),
            "Level Jabatan": karyawan.get("level_jabatan"),
            "Lokasi Kerja": karyawan.get("lokasi_kerja"),
            "Foto URL": karyawan.get("foto"),
        }
        flattened_data.append(row)

    df = pd.DataFrame(flattened_data)
    
    output_excel = "Daftar_User_HRIS.xlsx"
    output_csv = "Daftar_User_HRIS.csv"

    # Export to Excel with auto column width formatting
    with pd.ExcelWriter(output_excel, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Daftar User HRIS")
        worksheet = writer.sheets["Daftar User HRIS"]
        for col in worksheet.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            worksheet.column_dimensions[col_letter].width = max(max_len + 3, 12)

    df.to_csv(output_csv, index=False, encoding="utf-8-sig")

    print(f"✅ Export Successful!")
    print(f"- Excel file: {os.path.abspath(output_excel)}")
    print(f"- CSV file:   {os.path.abspath(output_csv)}")

if __name__ == "__main__":
    fetch_and_export()
