# FOUNDRY
### Product Requirements Document (PRD)
**Personal Learning Path Builder untuk Developer**

| | |
|---|---|
| **Versi** | 1.0 — MVP |
| **Author** | mifdev0 |
| **Status** | Draft |
| **Platform** | Web App (Next.js) — Deploy ke Vercel |

---

## 1. Overview

Foundry adalah platform web personal learning path builder yang dirancang khusus untuk developer — terutama vibe coder yang bisa ship produk tapi belum solid di fundamental. Foundry bukan kurikulum yang dipaksakan dari luar, melainkan tool yang membantu user mendefinisikan sendiri learning journey-nya dan memverifikasi pemahaman lewat ujian adaptif.

### 1.1 Problem Statement

Vibe coder adalah developer yang mengandalkan AI untuk menulis kode tanpa benar-benar memahami apa yang terjadi di balik layar. Mereka menghadapi tiga tantangan utama:

- Tidak tahu urutan belajar yang tepat — materi tersebar di mana-mana tanpa struktur jelas
- Tidak ada accountability — checklist biasa mudah di-skip tanpa konsekuensi nyata
- Sulit mengukur pemahaman — tidak ada cara untuk tahu apakah mereka benar-benar paham atau hanya hafal

### 1.2 Solusi

Foundry menjawab ketiga masalah ini dengan:

- **Dependency-aware skill tree** — node hanya bisa dibuka setelah node prasyaratnya selesai
- **Forge Test** — ujian akumulatif yang di-generate AI sebelum melanjutkan ke node berikutnya
- **AI Companion** di tiap node — bukan yang menentukan path, tapi yang membantu user belajar di jalurnya

### 1.3 Target User (MVP)

Target utama MVP adalah diri sendiri (mifdev0) sebagai pilot user, dengan profil:

- Developer self-taught atau bootcamp graduate
- Sudah bisa ship produk dengan bantuan AI coding tools
- Tahu apa yang ingin dipelajari, tapi tidak tahu urutan dan kedalaman yang tepat
- Butuh struktur dan accountability tanpa jadwal kaku

---

## 2. Goals & Success Metrics

### 2.1 Goals MVP

- User bisa membuat learning roadmap sendiri dengan node dan dependency
- User bisa melengkapi tiap node dengan catatan dan sesi chat bersama AI
- Forge Test mengunci akses ke node berikutnya sampai user lulus
- Progress tersimpan secara permanen di cloud (Supabase)

### 2.2 Non-Goals (bukan untuk MVP)

- Fitur sosial / community (share roadmap, fork, leaderboard)
- Mobile app native
- Integrasi dengan platform belajar eksternal (Udemy, dll)
- Monetisasi / payment gateway

---

## 3. Tech Stack

| Layer | Teknologi | Keterangan |
|---|---|---|
| Frontend | Next.js 14 + TypeScript | App Router, SSR/CSR hybrid |
| Styling | Tailwind CSS | Utility-first, design dari Stitch export |
| Canvas / Graph | React Flow | Node graph interaktif, drag-drop, bezier lines |
| Database & Auth | Supabase | PostgreSQL + Auth + Storage |
| AI | Groq API (MVP) | Fast inference, nanti bisa pindah ke DeepSeek berbayar |
| File Storage | Supabase Storage | Upload foto profil |
| Deployment | Vercel | Auto-deploy dari GitHub |

---

## 4. Arsitektur Database (Supabase)

### `users` (via Supabase Auth + custom profile)

| Column | Type | Keterangan |
|---|---|---|
| id | uuid (PK) | Auto dari Supabase Auth |
| full_name | text | Nama lengkap, sapaan pakai kata pertama |
| username | text (unique) | Untuk login alternatif |
| email | text (unique) | Dari Supabase Auth |
| avatar_url | text | URL foto profil dari Supabase Storage |
| created_at | timestamp | Auto |

### `roadmaps`

| Column | Type | Keterangan |
|---|---|---|
| id | uuid (PK) | Auto |
| user_id | uuid (FK) | Relasi ke users |
| title | text | Judul roadmap |
| description | text | Opsional |
| created_at | timestamp | Auto |
| updated_at | timestamp | Auto update |

### `nodes`

| Column | Type | Keterangan |
|---|---|---|
| id | uuid (PK) | Auto |
| roadmap_id | uuid (FK) | Relasi ke roadmaps |
| title | text | Nama topik node |
| description | text | Deskripsi opsional |
| status | enum | `not_started` \| `in_progress` \| `completed` |
| position_x | float | Posisi X di canvas |
| position_y | float | Posisi Y di canvas |
| notes | text | Catatan pribadi user (rich text / HTML) |
| order_index | integer | Urutan untuk akumulasi Forge Test |

### `node_dependencies`

| Column | Type | Keterangan |
|---|---|---|
| id | uuid (PK) | Auto |
| from_node_id | uuid (FK) | Node prasyarat |
| to_node_id | uuid (FK) | Node yang dikunci |

### `chat_messages`

| Column | Type | Keterangan |
|---|---|---|
| id | uuid (PK) | Auto |
| node_id | uuid (FK) | Chat per node |
| user_id | uuid (FK) | Pemilik chat |
| role | enum | `user` \| `assistant` |
| content | text | Isi pesan |
| created_at | timestamp | Auto |

### `forge_tests`

| Column | Type | Keterangan |
|---|---|---|
| id | uuid (PK) | Auto |
| node_id | uuid (FK) | Test untuk node ini (sebagai "pintu masuk") |
| user_id | uuid (FK) | Peserta test |
| status | enum | `passed` \| `failed` \| `in_progress` |
| score | integer | 0–100 |
| questions_json | jsonb | Soal-soal yang di-generate AI |
| answers_json | jsonb | Jawaban user |
| feedback | text | Feedback AI setelah test |
| cooldown_until | timestamp | Null jika passed, isi jika failed (cooldown 1 jam) |
| attempted_at | timestamp | Waktu attempt |

---

## 5. Fitur Lengkap

### 5.1 Auth & Profile

**Register**
- Form: Nama lengkap, username, email, password, konfirmasi password
- Username harus unik — validasi real-time
- Setelah register → redirect ke dashboard

**Login**
- Bisa login dengan email ATAU username + password
- Session persisten via Supabase Auth

**Sapaan & Profil**
- Sapaan menggunakan kata pertama dari nama lengkap
  - Contoh: `"Muhammad Fikri Ramdhani"` → sapaan `"Muhammad"`
- Settings: edit nama, username, email, ganti password
- Upload foto profil (JPG/PNG, max 2MB) → disimpan di Supabase Storage

---

### 5.2 Layout Utama

Setelah login, user masuk ke halaman utama dengan dua area:

**Sidebar Kiri — Direktori Roadmap**
- List semua roadmap milik user (nama + tanggal terakhir diedit)
- Klik roadmap → load canvas roadmap tersebut
- Tombol `+ Roadmap Baru` di bagian atas sidebar
- Avatar + nama user di bagian bawah sidebar, klik untuk menu Settings / Logout
- Roadmap aktif diberi highlight / border

**Main Canvas — Skill Tree**
- React Flow canvas: infinite, zoomable, pannable
- Node dan garis koneksi ditampilkan di sini
- Toolbar kecil di atas canvas: tambah node manual, AI generate, auto-layout

---

### 5.3 Membuat & Mengelola Roadmap

- Buat roadmap baru → dialog: masukkan judul dan deskripsi (opsional)
- Hapus roadmap → konfirmasi dialog, data node ikut terhapus (cascade)
- Rename roadmap inline di sidebar

---

### 5.4 Node Management di Canvas

**Tambah Node Manual**
- Klik `+ Add Node` → form input: judul topik, deskripsi singkat
- Node muncul di tengah canvas, siap di-drag ke posisi yang diinginkan

**AI Generate Path**
- Klik `AI Generate` → modal input: ketik goal belajar (contoh: *"Mau ngerti backend Node.js"*)
- AI menghasilkan draft node beserta dependency yang disarankan
- User bisa review, hapus, atau tambah node dari draft sebelum confirm
- Setelah confirm → node muncul di canvas dengan layout auto

**Koneksi & Dependency**
- Drag dari output handle suatu node ke input handle node lain → terbentuk edge dependency
- Garis: bezier curve, warna ungu, dashed jika target node masih locked
- Delete edge: klik edge → tombol delete muncul

**Auto Layout**
- Tombol `Auto Layout` di toolbar → susun ulang node secara otomatis (algoritma Dagre, top-to-bottom)
- User bisa drag posisi node sesuka hati setelahnya, posisi tersimpan ke database

**Lock / Unlock Node**
- Node locked jika ada dependency node yang statusnya belum `completed` DAN Forge Test-nya belum `passed`
- Node locked: opacity reduced + ikon 🔒 di pojok kanan atas card
- Node pertama (tanpa dependency) selalu unlocked

---

### 5.5 Node Detail

Klik node → sidebar kanan (atau modal) terbuka dengan 3 tab:

**Tab 1: Overview**
- Status badge (`Not Started` / `In Progress` / `Completed`) — bisa diubah manual
- Judul & deskripsi node (editable)
- Catatan pribadi dengan rich text editor (bold, italic, bullet list, code block)

**Tab 2: AI Companion**
- Chat interface dengan AI (Groq API)
- System prompt: AI tahu konteks node ini apa, topiknya apa
- Contoh yang bisa user tanyakan:
  - *"Jelasin konsep ini ke aku"*
  - *"Rekomendasiin resource buat topik ini"*
  - *"Buatkan soal latihan"*
  - *"Aku udah baca X, langkah selanjutnya?"*
- History chat tersimpan ke database (tabel `chat_messages`)
- Tombol `Reset Chat` → hapus semua history chat node ini (konfirmasi dulu)

**Tab 3: Forge Test**
- Ditampilkan sebagai gateway sebelum node berikutnya bisa dibuka
- Tombol `Mulai Forge Test` — hanya aktif jika status node ini `completed`
- Jika sedang cooldown: tampilkan countdown timer + topik yang perlu diperkuat

---

### 5.6 Forge Test

**Mekanisme**
- Syarat untuk unlock node berikutnya
- Soal bersifat akumulatif: mencakup materi dari semua node yang sudah `completed` sampai node ini
- Soal di-generate AI (Groq) berdasarkan judul dan deskripsi node-node tersebut
- Format campuran:
  - Multiple Choice: 3–5 soal
  - Short Answer: 2–3 soal
  - Total: 5–8 soal
- Urutan soal diacak setiap attempt

**Penilaian**
- Passing score: **70%**
- Multiple choice: auto-graded
- Short answer: di-evaluasi oleh AI (apakah konsep intinya benar)

**Hasil**
- ✅ Lulus (≥70%) → node berikutnya unlock, status Forge Test → `passed`
- ❌ Gagal (<70%) → cooldown 1 jam, AI memberikan feedback spesifik: topik mana yang lemah dan apa yang perlu diulang
- Selama cooldown: tombol `Mulai Forge Test` disabled + tampilkan sisa waktu cooldown

---

### 5.7 Settings

- Edit nama lengkap, username, email
- Ganti password (perlu konfirmasi password lama)
- Upload / ganti foto profil
- Tombol logout

---

## 6. User Flow Lengkap

```
Buka Foundry
    ↓
Login / Register
    ↓
Dashboard (sidebar + canvas kosong)
    ↓
Buat Roadmap Baru → beri judul
    ↓
Tambah node (manual atau AI Generate)
    ↓
Connect dependency antar node → lock/unlock berlaku otomatis
    ↓
Klik node → buka detail → baca, catat, tanya AI Companion
    ↓
Ubah status node → "Completed" → Forge Test tersedia
    ↓
Kerjakan Forge Test
    ↓
Lulus → Node berikutnya unlock ✅
Gagal → Cooldown 1 jam → Review feedback → Coba lagi 🔄
    ↓
Canvas makin "menyala" seiring lebih banyak node completed
```

---

## 7. UI/UX Design

### 7.1 Design System

| Elemen | Value | Keterangan |
|---|---|---|
| Primary | `#7C3AED` | Violet 700 — warna aksen utama |
| Secondary | `#5B21B6` | Violet 800 — hover / active state |
| Background | `#F8F7FF` | Lavender putih, base canvas |
| Text Primary | `#1F2937` | Gray 800 |
| Text Secondary | `#6B7280` | Gray 500 |
| Success | `#10B981` | Green — node completed |
| Warning | `#F59E0B` | Amber — node in progress |
| Locked | `#D1D5DB` | Gray 300 — node locked |
| Font | Plus Jakarta Sans / Inter | Google Fonts |
| Border Radius | 16px | Node card, modal, button |

### 7.2 Canvas Visual

- **Background**: lavender-white (`#F8F7FF`) + subtle dot grid overlay
- **Gradient blobs**: violet di pojok kanan atas, lavender di kiri bawah (opacity ~30%)
- **Node cards**: white, box-shadow multi-layer, rounded 16px
- **Node In Progress**: subtle purple glow (box-shadow spread 20px, opacity 30%)
- **Node Completed**: green tint pada border
- **Node Locked**: opacity 50%, ikon 🔒 di pojok kanan atas card
- **Koneksi**: bezier curve, purple gradient stroke, dashed untuk locked connection

### 7.3 Halaman & Komponen Utama

| Route / Komponen | Keterangan |
|---|---|
| `/login` | Form login |
| `/register` | Form register |
| `/dashboard` | Layout utama (sidebar + canvas) |
| `/settings` | Halaman pengaturan profil |
| `NodeDetailPanel` | Sidebar kanan atau modal, 3 tab |
| `ForgeTestModal` | Full-screen modal saat mengerjakan test |
| `AIChatPanel` | Chat interface di tab AI Companion |

---

## 8. Integrasi AI

### 8.1 AI Companion (per Node)

| Properti | Detail |
|---|---|
| Provider | Groq API (MVP) → DeepSeek berbayar (later) |
| Model | `llama-3.1-8b-instant` atau `mixtral-8x7b` |
| System Prompt | Inject: nama topik node, deskripsi, konteks roadmap |
| History | Kirim seluruh `chat_messages` node ini di setiap request |
| Reset | User bisa hapus history chat → konfirmasi dulu |

**Contoh system prompt:**
```
Kamu adalah AI learning companion untuk topik: {node.title}.
Deskripsi topik: {node.description}.
Roadmap ini adalah: {roadmap.title}.
Bantu user memahami topik ini. Kamu bisa menjelaskan konsep, 
merekomendasikan resource, membuat soal latihan, dan membimbing 
langkah belajar berikutnya. Jawab dalam bahasa Indonesia.
```

### 8.2 AI Generate Path

| Properti | Detail |
|---|---|
| Input | Goal belajar user dalam teks bebas |
| Output | JSON: array of nodes dengan `title`, `description`, `dependencies` |
| User Action | Review draft → hapus / tambah node → confirm → tampil di canvas |

**Contoh output format:**
```json
[
  { "id": "1", "title": "HTML & CSS Dasar", "description": "...", "dependencies": [] },
  { "id": "2", "title": "JavaScript Dasar", "description": "...", "dependencies": ["1"] },
  { "id": "3", "title": "Async/Await", "description": "...", "dependencies": ["2"] }
]
```

### 8.3 Forge Test Generation

| Properti | Detail |
|---|---|
| Input | Judul + deskripsi semua node `completed` sampai node target |
| Output | JSON: array soal (type MC atau short_answer, pilihan jika MC, jawaban benar) |
| Evaluasi SA | Short answer dikirim ke AI → dinilai apakah konsep inti benar |
| Feedback | AI generate feedback: skor + topik lemah + saran review |

**Contoh format soal:**
```json
[
  {
    "type": "multiple_choice",
    "question": "Apa yang dimaksud dengan event loop di JavaScript?",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correct": "B"
  },
  {
    "type": "short_answer",
    "question": "Jelaskan perbedaan antara async/await dan Promise biasa.",
    "key_concepts": ["sintaks lebih bersih", "error handling dengan try/catch", "tetap berbasis Promise"]
  }
]
```

---

## 9. Scope MVP vs Future

| Fitur | MVP | Future |
|---|---|---|
| Auth (email/username/password) | ✅ | — |
| Edit profile + foto profil | ✅ | — |
| Buat & manage roadmap (CRUD) | ✅ | — |
| Node manual + dependency | ✅ | — |
| AI Generate Path | ✅ | — |
| Auto layout canvas (Dagre) | ✅ | — |
| Node detail + catatan rich text | ✅ | — |
| AI Companion per node + history | ✅ | — |
| Forge Test (MC + Short Answer) | ✅ | — |
| Cooldown 1 jam + AI feedback | ✅ | — |
| Share roadmap (public link) | ❌ | v2 |
| Fork roadmap orang lain | ❌ | v2 |
| Progress analytics / chart | ❌ | v2 |
| Notifikasi / reminder belajar | ❌ | v2 |
| Mobile-optimized layout | ❌ | v2 |
| Monetisasi / subscription | ❌ | v3 |

---

## 10. Rencana Build (Urutan Eksekusi)

### Phase 1 — Fondasi (Minggu 1)
1. Setup project: Next.js 14 + TypeScript + Tailwind + Supabase
2. Implementasi Auth: register, login, session, middleware proteksi route
3. Setup database schema Supabase (semua tabel + RLS policies)
4. Halaman Settings + upload foto profil ke Supabase Storage

### Phase 2 — Canvas & Roadmap (Minggu 2)
1. Install & setup React Flow
2. Sidebar direktori roadmap (CRUD roadmap)
3. Node manual: tambah, edit, hapus, drag reposition
4. Koneksi dependency antar node + lock/unlock logic
5. Auto layout dengan Dagre

### Phase 3 — Node Detail & AI Companion (Minggu 3)
1. Panel detail node (3 tab: Overview, AI Companion, Forge Test)
2. Rich text editor untuk catatan (Tiptap atau Quill)
3. Integrasi Groq API untuk AI Companion
4. Simpan & load history chat dari Supabase

### Phase 4 — AI Generate Path & Forge Test (Minggu 4)
1. AI Generate Path: prompt engineering + UI review draft
2. Forge Test: generate soal, UI pengerjaan, evaluasi MC + SA
3. Cooldown logic + feedback AI
4. Polish UI: visual node states, animasi, transisi

### Phase 5 — Deploy & Testing (Minggu 5)
1. Deploy ke Vercel
2. Setup environment variables production (Supabase, Groq API key)
3. Testing end-to-end seluruh user flow
4. Bug fixing & performance optimization

---

*Foundry PRD v1.0 — mifdev0*
