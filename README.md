# NOC NAS/BNG Finder (Chrome Extension)

Extension Chrome untuk mengambil data **NAS** dan **BNG** dari Google Sheet berdasarkan **VLAN** dan **REGION** pada halaman web aktif.

## Sumber Data
- Spreadsheet: `1XYkB8jX4X321SUYiQ7jMj2Mvra44VWT54AQh0-X2iEA`
- Menggunakan tab `Sheet1` dengan kolom: `Region`, `VLAN`, `BNG`, `NAS`

## Mapping REGION
- RJKT = JAKARTA
- RJBB = JAWA BARAT
- RJBTG = JAWA TENGAH
- RJBT = JAWA TIMUR
- RBNT = BALI
- RSBU = SUMATERA BAGIAN UTARA
- RSBT = SUMATERA BAGIAN TENGAH
- RSBS = SUMATERA BAGIAN SELATAN
- RKAL = KALIMANTAN
- RINT = SULAWESI

## Cara Pakai
1. Buka `chrome://extensions`
2. Aktifkan **Developer mode**
3. Klik **Load unpacked** lalu pilih folder ini (`Plugin`)
4. Buka halaman web provisioning
5. Klik icon extension **NOC NAS/BNG Finder**
6. Klik **Deteksi dari halaman** (otomatis isi VLAN/REGION jika ditemukan)
7. Klik **Cari NAS / BNG**
8. Jika hasil ketemu, klik **Set ke halaman** untuk isi field NAS/BNG di form web

## Catatan
- Extension membaca kolom yang mengandung kata `REGION`, `VLAN`, `NAS`, dan `BNG` pada `Sheet1`.
- Pastikan Google Sheet bisa diakses (minimal view/public untuk akun browser yang dipakai).
- Jika deteksi otomatis gagal, isi VLAN manual dan pilih REGION lalu cari data.
