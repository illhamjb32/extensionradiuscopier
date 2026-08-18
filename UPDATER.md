# Panduan Self-Hosted Auto-Update

## Skema

```
User Chrome (tiap ~5 jam)
  → GET https://illhamjb32.github.io/extensionradiuscopier/dist/update.xml
  → bandingkan versi di XML vs versi terinstall
  → kalau lebih baru: download dist/extension.crx → auto-update
```

## Setup Awal (sekali saja)

### 1. Dapatkan Extension ID

1. Buka `chrome://extensions`
2. Aktifkan **Developer mode**
3. Klik **Load unpacked** → pilih folder `extensionradiuscopier`
4. Catat **ID** yang muncul (32 karakter, contoh: `abcdefghijklmnopabcdefghijklmnop`)

### 2. Isi Extension ID di update.xml

Edit `dist/update.xml`, ganti `EXTENSION_ID_PLACEHOLDER` dengan ID tadi:

```xml
<app appid='abcdefghijklmnopabcdefghijklmnop'>
```

### 3. Pack Extension Pertama Kali

Jalankan script pack:

```powershell
.\pack.ps1 -Version "1.1.0"
```

Script akan:
- Generate `extension.pem` (private key — **jangan di-commit!**)
- Generate `dist/extension.crx`
- Update `dist/update.xml`

### 4. Tambahkan .gitignore untuk key

Pastikan `.gitignore` berisi:

```
extension.pem
```

### 5. Setup GitHub Pages

1. Buka repo di GitHub → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main`, Folder: `/ (root)`
4. Klik **Save**

URL update akan aktif di:
`https://illhamjb32.github.io/extensionradiuscopier/dist/update.xml`

### 6. Push semua file

```bash
git add manifest.json dist/update.xml dist/extension.crx
git commit -m "release: v1.1.0"
git push
```

### 7. Distribusi ke user (sekali saja)

Bagikan file `dist/extension.crx` ke semua user.
User install dengan drag & drop ke `chrome://extensions`.

---

## Cara Update (setiap rilis baru)

```powershell
.\pack.ps1 -Version "1.2.0"
```

Lalu:

```bash
git add manifest.json dist/update.xml dist/extension.crx
git commit -m "release: v1.2.0"
git push
```

Chrome user akan auto-update dalam **maksimal 5 jam**.

---

## Catatan Penting

| File | Keterangan |
|------|-----------|
| `extension.pem` | Private key — **JANGAN di-commit**, simpan aman |
| `dist/update.xml` | Dibaca Chrome untuk cek versi |
| `dist/extension.crx` | File extension yang didownload Chrome |

- Extension ID akan **berubah** jika `extension.pem` hilang/beda → user harus install ulang
- Simpan `extension.pem` di tempat aman (OneDrive, password manager, dll)
- Chrome cek update otomatis tiap ~5 jam, tidak bisa dipaksa lebih cepat
