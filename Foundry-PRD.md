# FOUNDRY
### Product Requirements Document (PRD)
**Personal Learning Path Builder untuk Siapa Saja**

| | |
|---|---|
| **Versi** | 1.1 — Generalization |
| **Author** | mifdev0 |
| **Status** | Active |
| **Platform** | Web App (Next.js) — Deploy ke Vercel |

---

## 1. Overview

Foundry adalah platform web personal learning path builder yang dirancang untuk membantu siapa saja mendefinisikan dan menguasai jalur belajarnya sendiri. Foundry bukan sekadar kurikulum pasif, melainkan tool yang membantu user menyusun journey yang terstruktur, memiliki ketergantungan antar topik, dan memverifikasi pemahaman lewat ujian adaptif berbasis AI.

### 1.1 Problem Statement

Banyak orang ingin mempelajari hal baru (bahasa, hobi, skill profesional) secara mandiri, namun menghadapi tiga tantangan utama:

- **Kebingungan Struktur:** Tidak tahu urutan belajar yang tepat — materi tersebar di mana-mana tanpa hierarki yang jelas.
- **Kurangnya Accountability:** Checklist biasa mudah di-skip tanpa ada verifikasi nyata apakah suatu materi sudah benar-benar dikuasai.
- **Ilusi Pemahaman:** Sulit mengukur pemahaman secara obyektif — merasa sudah paham padahal baru di permukaan.

### 1.2 Solusi

Foundry menjawab masalah ini dengan:

- **Dependency-aware skill tree:** Topik/node hanya bisa dibuka setelah prasyaratnya selesai (membangun fondasi yang kuat).
- **Forge Test:** Ujian berbasis studi kasus atau tugas praktis yang di-generate AI untuk memvalidasi pemahaman sebelum lanjut.
- **AI Companion:** Pendamping belajar di tiap node yang membantu menjelaskan konsep dan menjawab pertanyaan secara spesifik.

### 1.3 Target User

- **Self-learners:** Siapa saja yang sedang mendalami topik tertentu secara otodidak.
- **Students/Professionals:** Orang yang ingin merapikan pengetahuan mereka yang masih berantakan/sporadis.
- **Curious Minds:** Mereka yang ingin belajar hal baru dengan struktur yang jelas dan menantang.

---

## 2. Goals & Success Metrics

### 2.1 Goals MVP

- User bisa membuat learning roadmap untuk topik apa pun dengan node dan dependency.
- User bisa melengkapi tiap node dengan catatan, tugas (tasks), dan sesi chat bersama AI.
- Forge Test mengunci akses ke node berikutnya sampai user lulus evaluasi AI.
- Progress tersimpan secara permanen di cloud (Supabase).

---

## 3. Tech Stack

| Layer | Teknologi | Keterangan |
|---|---|---|
| Frontend | Next.js 14 + TypeScript | App Router |
| Styling | Tailwind CSS | Utility-first |
| Canvas / Graph | React Flow | Node graph interaktif |
| Database & Auth | Supabase | PostgreSQL + Auth + Storage |
| AI | Groq API | Inference untuk Chat, Path Generation, & Evaluation |
| Deployment | Vercel | Auto-deploy |

---

## 4. Arsitektur Database (Supabase)

*(Arsitektur tetap sama, fokus pada fleksibilitas data node dan roadmap)*

- `roadmaps`: Judul dan deskripsi roadmap (misal: "Belajar Bahasa Jepang", "Mastering Digital Photography").
- `nodes`: Berisi topik spesifik, catatan, dan status.
- `forge_tests`: Menyimpan hasil evaluasi AI terhadap tugas yang dikerjakan user.

---

## 5. Fitur Utama

### 5.1 AI Generate Path
- User memasukkan goal (misal: "Mau belajar main piano") → AI menghasilkan draft roadmap lengkap dengan dependency dan tugas-tugas di setiap node.

### 5.2 Forge Test (The Gateway)
- Mekanisme validasi: AI memberikan tugas praktis sesuai topik node.
- Contoh: Jika belajar "Grammar Bahasa Inggris", tugasnya mungkin menulis paragraf dengan aturan tertentu. Jika belajar "Masak", tugasnya mungkin menjelaskan teknik *braising*.
- Evaluasi dilakukan AI berdasarkan kriteria yang relevan dengan topik tersebut.

### 5.3 AI Companion
- Chat interface yang paham konteks node yang sedang dipelajari.

---

## 6. UI/UX Design

Foundry menggunakan tema **Violet & Lavender** yang modern dan bersih, memberikan kesan kreatif namun terstruktur. Visualisasi node di canvas memberikan kepuasan visual saat melihat jalur belajar yang "menyala" seiring progres.

---

*Foundry PRD v1.1 — mifdev0*
