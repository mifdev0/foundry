"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/avatar";
import BrandLogo from "@/components/brand-logo";
import { getAuthHeaders, getCurrentUserId, scopedKey } from "@/lib/auth-client";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import clsx from "clsx";
import {
  AlertTriangle,
  Bot,
  Brain,
  CalendarClock,
  CheckCircle2,
  Circle,
  GitBranch,
  LayoutGrid,
  Lock,
  LogOut,
  MessageSquare,
  PanelRight,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Settings,
  Sparkles,
  SquareCheck,
  Trash2,
  Unlock,
  X
} from "lucide-react";

type Status = "not_started" | "in_progress" | "completed";
type Tab = "overview" | "tasks" | "chat" | "forge";

type TaskItem = {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ForgeCaseStudy = {
  title: string;
  scenario: string;
  requirements: string[];
  expectedOutput?: string;
  evaluationCriteria: string[];
};

type ForgeEvaluation = {
  score: number;
  passed: boolean;
  feedback: string;
  issues: string[];
  nextSteps: string[];
};

type GeneratedPathNode = {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  tasks?: string[];
};

type SkillData = {
  title: string;
  description: string;
  status: Status;
  notes: string;
  orderIndex: number;
  locked: boolean;
  forgePassed: boolean;
  forgeCaseStudy?: ForgeCaseStudy;
  forgeStartedAt?: number;
  forgeExpiresAt?: number;
  forgeAttempt?: number;
  forgeSubmission?: string;
  forgeEvaluation?: ForgeEvaluation;
  feedback?: string;
  cooldownUntil?: number;
  messages: ChatMessage[];
  tasks: TaskItem[];
};

type SkillNode = Node<SkillData, "skill">;
type Roadmap = {
  id: string;
  title: string;
  description: string;
  updatedAt: string;
  nodes: SkillNode[];
  edges: Edge[];
};

const maxTasksPerNode = 10;
const forgeDurationMs = 24 * 60 * 60 * 1000;

const statusMeta: Record<Status, { label: string; className: string; icon: typeof Circle }> = {
  not_started: { label: "Not Started", className: "bg-slate-100 text-slate-600", icon: Circle },
  in_progress: { label: "In Progress", className: "bg-violet-100 text-primary", icon: Brain },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 }
};

const makeEdge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  type: "smoothstep",
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#7C3AED" },
  style: { stroke: "#7C3AED", strokeWidth: 2, strokeDasharray: "8 8" }
});

function makeDefaultTasks(title: string, description = ""): TaskItem[] {
  const normalized = `${title} ${description}`.toLowerCase();

  if (normalized.includes("javascript")) {
    return [
      { id: crypto.randomUUID(), title: "Mengerti jenis-jenis variabel di JavaScript (var, let, const)", completed: false },
      { id: crypto.randomUUID(), title: "Mengerti tipe data di JavaScript (string, number, boolean, null, undefined, object)", completed: false },
      { id: crypto.randomUUID(), title: "Mengerti operator di JavaScript (aritmatika, perbandingan, logika)", completed: false },
      { id: crypto.randomUUID(), title: "Mengerti kontrol alir di JavaScript (if/else, switch, ternary)", completed: false },
      { id: crypto.randomUUID(), title: "Mengerti fungsi di JavaScript (declaration, expression, arrow function)", completed: false },
      { id: crypto.randomUUID(), title: "Praktik array dan method-nya (push, map, filter, reduce)", completed: false },
      { id: crypto.randomUUID(), title: "Praktik object dan cara akses propertinya", completed: false }
    ];
  }

  return [
    { id: crypto.randomUUID(), title: `Pelajari konsep inti ${title}`, completed: false },
    { id: crypto.randomUUID(), title: "Buat catatan ringkas dari materi utama", completed: false },
    { id: crypto.randomUUID(), title: "Cari dan pelajari contoh kode/implementasi", completed: false },
    { id: crypto.randomUUID(), title: "Selesaikan latihan kecil untuk validasi pemahaman", completed: false },
    { id: crypto.randomUUID(), title: "Review ulang dan catat poin yang masih belum paham", completed: false }
  ];
}

function taskReminder(task: TaskItem) {
  if (task.completed || !task.dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${task.dueDate}T00:00:00`);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return { label: `Lewat ${Math.abs(diffDays)} hari`, tone: "danger" };
  if (diffDays === 0) return { label: "Deadline hari ini", tone: "danger" };
  if (diffDays === 1) return { label: "H-1", tone: "danger" };
  if (diffDays <= 3) return { label: `H-${diffDays}`, tone: "warning" };
  return null;
}

function nodeDeadline(tasks: TaskItem[], now = Date.now()) {
  const dueDates = tasks
    .filter((task) => task.dueDate)
    .map((task) => new Date(`${task.dueDate}T00:00:00`))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  const latest = dueDates[0];
  if (!latest) return null;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  latest.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((latest.getTime() - today.getTime()) / 86_400_000);
  const dateLabel = latest.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  if (diffDays < 0) return { label: `Telat ${Math.abs(diffDays)} hari`, dateLabel, tone: "overdue" };
  if (diffDays === 0) return { label: "Deadline hari ini", dateLabel, tone: "today" };
  if (diffDays === 1) return { label: "H-1", dateLabel, tone: "h1" };
  if (diffDays === 2) return { label: "H-2", dateLabel, tone: "h2" };
  if (diffDays === 3) return { label: "H-3", dateLabel, tone: "h3" };
  return { label: `H-${diffDays}`, dateLabel, tone: "neutral" };
}

function nodeDeadlineStatus(tasks: TaskItem[], nodeCompleted: boolean, now = Date.now()) {
  const deadline = nodeDeadline(tasks, now);
  if (!deadline) return null;
  const allTasksCompleted = tasks.length > 0 && tasks.every((task) => task.completed);
  if (allTasksCompleted || nodeCompleted) {
    return { ...deadline, label: "Selesai", tone: "done" };
  }
  return deadline;
}

function forgeExpired(node?: SkillNode | null) {
  return Boolean(node?.data.forgeExpiresAt && node.data.forgeExpiresAt <= Date.now());
}

function forgeCaseLooksValid(node?: SkillNode | null) {
  if (!node?.data.forgeCaseStudy) return false;
  const nodeText = `${node.data.title} ${node.data.description} ${node.data.tasks.map((task) => task.title).join(" ")}`.toLowerCase();
  const caseText = `${node.data.forgeCaseStudy.title} ${node.data.forgeCaseStudy.scenario} ${node.data.forgeCaseStudy.requirements.join(" ")} ${node.data.forgeCaseStudy.evaluationCriteria.join(" ")}`.toLowerCase();
  if (nodeText.includes("javascript") && (caseText.includes("node.js") || caseText.includes("built-in node") || caseText.includes("modul built-in node"))) return false;
  return true;
}

function formatForgeDeadline(expiresAt?: number) {
  if (!expiresAt) return "Belum dimulai";
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  if (hours <= 0) return `${minutes} menit lagi`;
  return minutes > 0 ? `${hours} jam ${minutes} menit lagi` : `${hours} jam lagi`;
}

function ensureNodeTasks(node: SkillNode): SkillNode {
  if (Array.isArray(node.data.tasks)) return node;
  return {
    ...node,
    data: {
      ...node.data,
      tasks: makeDefaultTasks(node.data.title, node.data.description)
    }
  };
}

function normalizeRoadmap(roadmap: Roadmap): Roadmap {
  return {
    ...roadmap,
    nodes: (roadmap.nodes ?? []).map(ensureNodeTasks),
    edges: roadmap.edges ?? []
  };
}

const makeNode = (id: string, title: string, description: string, x: number, y: number, orderIndex: number, status: Status = "not_started", taskTitles?: string[]): SkillNode => ({
  id,
  type: "skill",
  position: { x, y },
  data: {
    title,
    description,
    status,
    notes: "",
    orderIndex,
    locked: false,
    forgePassed: status === "completed",
    messages: [],
    tasks: taskTitles !== undefined
      ? taskTitles.slice(0, maxTasksPerNode).map((task) => ({ id: crypto.randomUUID(), title: task, completed: false }))
      : makeDefaultTasks(title, description)
  }
});

function makeLocalDraft(goal = ""): GeneratedPathNode[] {
  const normalized = goal.toLowerCase();

  // 1. English Writing / Writing English
  if (normalized.includes("writing") && (normalized.includes("english") || normalized.includes("inggris") || normalized.includes("bahasa"))) {
    return [
      { id: "1", title: "English Grammar Foundations", description: "Menguasai tenses dasar, parts of speech, dan subjek-predikat agreement untuk tulisan terstruktur.", dependencies: [], tasks: ["Mengerti 5 tenses dasar (Simple Present, Past, Future, Present Continuous, Present Perfect)", "Latihan parts of speech (noun, verb, adjective, adverb)", "Memahami subject-verb agreement", "Membuat 10 kalimat sederhana dengan variasi tenses"] },
      { id: "2", title: "Sentence Structure & Cohesion", description: "Menghubungkan ide menggunakan konjungsi dan transisi kalimat agar mengalir dengan baik.", dependencies: ["1"], tasks: ["Latihan menggunakan conjunctions (and, but, or, so, because)", "Mengerti perbedaan simple, compound, dan complex sentences", "Praktik menulis compound sentences", "Menggunakan transitions (however, therefore, in addition)"] },
      { id: "3", title: "Paragraph Development", description: "Menyusun paragraf yang kuat dengan kalimat topik, pendukung, dan kesimpulan.", dependencies: ["2"], tasks: ["Menulis topic sentence yang jelas", "Menambahkan supporting sentences dengan bukti/contoh", "Menulis concluding sentence untuk merangkum paragraf", "Menulis 1 paragraf utuh (150 kata) dengan struktur yang benar"] },
      { id: "4", title: "Essay Writing & Types", description: "Memahami struktur esai lengkap (pendahuluan, isi, kesimpulan) dan jenis-jenis esai.", dependencies: ["3"], tasks: ["Mengerti struktur essay (introduction, body, conclusion)", "Menulis thesis statement yang kuat", "Latihan menulis Argumentative essay", "Latihan menulis Expository/Descriptive essay"] },
      { id: "5", title: "Proofreading & Refinement", description: "Mengoreksi kesalahan tata bahasa secara mandiri dan memparafrase kalimat.", dependencies: ["4"], tasks: ["Latihan mengoreksi grammar error mandiri", "Menggunakan tools (Grammarly/Hemingway) untuk cek readability", "Parafrase kalimat agar lebih variatif", "Finalisasi essay 500 kata dengan format akademis/formal"] }
    ];
  }

  // 2. English Speaking / Speaking English / Conversational
  if (normalized.includes("speaking") || (normalized.includes("english") || normalized.includes("inggris")) && (normalized.includes("bicara") || normalized.includes("percakapan") || normalized.includes("conversation"))) {
    return [
      { id: "1", title: "Pronunciation & Sounds", description: "Melatih pelafalan huruf, penekanan kata, dan intonasi kalimat bahasa Inggris.", dependencies: [], tasks: ["Latihan vowel dan consonant sounds dasar", "Mengerti word stress pada kata panjang", "Latihan intonasi kalimat tanya vs pernyataan", "Record suara sendiri membaca paragraf pendek dan dengerin ulang"] },
      { id: "2", title: "Basic Conversational English", description: "Belajar kalimat percakapan sehari-hari, ekspresi umum, dan cara memperkenalkan diri.", dependencies: ["1"], tasks: ["Latihan greeting & introduction (perkenalan diri)", "Membuat percakapan sehari-hari (order makanan, nanya jalan)", "Latihan roleplay situasi formal vs informal", "Menghafal 50 daily idioms & expression"] },
      { id: "3", title: "Active Listening & Shadowing", description: "Meningkatkan pemahaman mendengarkan aksen asli dan meniru cara bicara native speaker.", dependencies: ["2"], tasks: ["Menonton video/podcast tanpa subtitle lalu rangkum isinya", "Latihan shadowing (mengikuti pembicara asli setelah mereka bicara)", "Mengidentifikasi kata-kata yang di-link/disambung (connected speech)", "Mengikuti kuis listening online"] },
      { id: "4", title: "Fluency & Confidence", description: "Melatih kelancaran berbicara tanpa ragu, mengurangi jeda, dan membangun rasa percaya diri.", dependencies: ["3"], tasks: ["Latihan berbicara tanpa jeda selama 1 menit tentang topik acak", "Latihan berbicara di depan cermin", "Mengurangi filter words (like, um, er)", "Membaca nyaring (reading aloud) artikel berita"] },
      { id: "5", title: "Advanced Presentation & Debate", description: "Belajar menyampaikan ide secara formal, presentasi terstruktur, dan berargumen.", dependencies: ["4"], tasks: ["Merancang presentasi 5 menit dalam bahasa Inggris", "Latihan menyampaikan pendapat & menyanggah dengan sopan", "Latihan Q&A session spontan", "Mendiskusikan isu sosial terkini"] }
    ];
  }

  // 3. UI/UX Design / Graphic Design / Figma
  if (normalized.includes("design") || normalized.includes("desain") || normalized.includes("ux") || normalized.includes("figma")) {
    return [
      { id: "1", title: "UI/UX Foundations", description: "Mempelajari dasar-dasar desain visual, teori warna, tipografi, dan tata letak.", dependencies: [], tasks: ["Mempelajari 7 prinsip desain (Hierarchy, Contrast, Alignment, dll)", "Mengerti perbedaan UI dan UX", "Mempelajari basic color theory & color palette creation", "Mempelajari grid systems dan layout"] },
      { id: "2", title: "UX Research & Wireframing", description: "Memahami pengguna melalui riset, pemetaan perjalanan, dan pembuatan sketsa kasar.", dependencies: ["1"], tasks: ["Membuat user persona berdasarkan interview singkat", "Merancang user flow/journey map", "Menggambar low-fidelity wireframe di kertas", "Belajar information architecture & sitemap"] },
      { id: "3", title: "Figma Mastery", description: "Menguasai tools utama Figma untuk membuat mockup UI dengan fidelitas tinggi.", dependencies: ["2"], tasks: ["Belajar auto-layout & constraints di Figma", "Membuat reusable components & variants", "Latihan membuat design system sederhana (typography, buttons, colors)", "Membuat high-fidelity UI mockup"] },
      { id: "4", title: "Prototyping & Interaction", description: "Menghubungkan antar layar dan menambahkan animasi interaksi mikro.", dependencies: ["3"], tasks: ["Menghubungkan screen di Figma untuk prototype", "Membuat interactive components (hover, active states)", "Latihan micro-animations (Smart Animate)", "Setup transisi antar halaman yang smooth"] },
      { id: "5", title: "Usability Testing & Portfolio", description: "Menguji desain ke pengguna nyata dan menyusun studi kasus portofolio.", dependencies: ["4"], tasks: ["Melakukan usability testing ke 3 calon pengguna", "Menganalisis hasil feedback & revisi desain", "Menulis UX case study terstruktur", "Publish design portfolio di Behance/Dribbble/Framer"] }
    ];
  }

  // 4. Machine Learning / Data Science / AI
  if (normalized.includes("machine learning") || normalized.includes("data science") || normalized.includes("artificial intelligence") || normalized.includes(" ai ") || normalized.includes(" ml ") || normalized.startsWith("ai ") || normalized.endsWith(" ai") || normalized.startsWith("ml ") || normalized.endsWith(" ml")) {
    return [
      { id: "1", title: "Python & Math Foundations", description: "Menguasai dasar Python, aljabar linear, kalkulus, dan statistik untuk Machine Learning.", dependencies: [], tasks: ["Kuasai Python syntax dasar (variables, loops, functions, lists)", "Mengerti linear algebra dasar (matrix, vector)", "Mengerti kalkulus dasar (derivatives, gradients)", "Mengerti basic probability & statistics (mean, median, std dev, distributions)"] },
      { id: "2", title: "Data Preprocessing & EDA", description: "Membersihkan data, menangani nilai kosong, dan memvisualisasikan data dengan Python.", dependencies: ["1"], tasks: ["Import data menggunakan Pandas & NumPy", "Menangani missing values & outliers", "Latihan visualisasi data dengan Matplotlib/Seaborn", "Feature engineering (encoding, scaling, normalization)"] },
      { id: "3", title: "Supervised Learning", description: "Menerapkan algoritma regresi dan klasifikasi serta mengevaluasi performa model.", dependencies: ["2"], tasks: ["Implementasi Linear & Logistic Regression", "Latihan Decision Trees & Random Forest", "Mengerti evaluasi model (Accuracy, Precision, Recall, F1-Score, ROC-AUC)", "Latihan train-test split & cross-validation"] },
      { id: "4", title: "Unsupervised Learning & Tuning", description: "Membuat pengelompokan data tanpa label dan mengoptimalkan parameter model.", dependencies: ["3"], tasks: ["Implementasi K-Means Clustering", "Belajar dimensionality reduction dengan PCA", "Latihan hyperparameter tuning (GridSearchCV/RandomizedSearchCV)", "Mengerti konsep overfitting vs underfitting"] },
      { id: "5", title: "Model Deployment & Inference", description: "Menyimpan model terlatih dan mengeksposnya sebagai API sederhana.", dependencies: ["4"], tasks: ["Menyimpan model terlatih menggunakan pickle/joblib", "Buat API sederhana dengan Flask/FastAPI untuk model inference", "Deploy model ke Hugging Face atau Render", "Tulis dokumentasi model & performanya"] }
    ];
  }

  // 5. Fullstack / Frontend Web Development
  if (normalized.includes("fullstack") || normalized.includes("front end") || normalized.includes("frontend") || normalized.includes("web dev") || normalized.includes("react")) {
    return [
      { id: "1", title: "JavaScript Fundamentals", description: "Variabel, tipe data, function, scope, closure, array/object, dan module.", dependencies: [], tasks: ["Mengerti jenis variabel (var, let, const)", "Mengerti tipe data (string, number, boolean, null, undefined)", "Mengerti operator aritmatika dan perbandingan", "Latihan function declaration dan arrow function", "Praktik scope dan closure", "Praktik array dan method-nya (map, filter, reduce)", "Praktik object dan destructuring"] },
      { id: "2", title: "Async JavaScript & Fetch", description: "Promise, async/await, fetch, error handling, dan event loop untuk aplikasi web.", dependencies: ["1"], tasks: ["Mengerti konsep synchronous vs asynchronous", "Latihan callback dan masalahnya", "Latihan Promise chain (.then/.catch)", "Menguasai async/await syntax", "Fetch data dari API publik", "Tangani error dengan try/catch di async"] },
      { id: "3", title: "DOM & Browser APIs", description: "Manipulasi DOM, event, form handling, localStorage, dan lifecycle browser.", dependencies: ["2"], tasks: ["Mengerti DOM tree dan seleksi elemen", "Buat manipulasi DOM (createElement, appendChild)", "Buat event listener untuk klik, input, submit", "Buat form interaktif dengan validasi", "Simpan dan ambil data dari localStorage"] },
      { id: "4", title: "React Fundamentals", description: "Component, props, state, hooks, rendering, dan struktur aplikasi frontend.", dependencies: ["3"], tasks: ["Mengerti JSX dan cara kerjanya", "Buat functional component dengan props", "Latihan useState untuk state management", "Latihan useEffect untuk side effects", "Buat list rendering dari array data", "Buat component reusable minimal 3 buah"] },
      { id: "5", title: "Frontend Data Flow", description: "Form, validation, client routing, API integration, loading/error state.", dependencies: ["4"], tasks: ["Buat form dengan controlled components", "Implementasi validasi form", "Setup client-side routing", "Tampilkan loading state saat fetch data", "Tampilkan error state dengan pesan jelas", "Integrasikan endpoint API ke UI"] },
      { id: "6", title: "Backend Node.js & HTTP", description: "HTTP, routing, middleware, REST API, controller, dan error response.", dependencies: ["5"], tasks: ["Mengerti HTTP method (GET, POST, PUT, DELETE)", "Buat server Node.js dasar", "Buat endpoint CRUD lengkap", "Pisahkan route dan controller", "Buat middleware autentikasi", "Buat middleware error handler"] },
      { id: "7", title: "Database & Auth", description: "Schema database, CRUD, relational data, password hashing, session/JWT.", dependencies: ["6"], tasks: ["Desain schema database dan relasi", "Implement CRUD operations ke database", "Mengerti dan praktik password hashing (bcrypt)", "Implement session atau JWT authentication", "Buat login dan register endpoint"] },
      { id: "8", title: "Fullstack Deployment", description: "Environment variables, production build, deployment, logging, dan debugging.", dependencies: ["7"], tasks: ["Setup environment variables (.env)", "Buat production build frontend", "Deploy frontend ke hosting (Vercel/Netlify)", "Deploy backend ke cloud (Railway/Render)", "Setup logging dan monitoring dasar"] }
    ];
  }

  // 6. Generic Smart Fallback based on User's Goal
  let topic = goal
    .replace(/^(buatkan|buat|bikin|tampilkan|minta)\s+/i, "")
    .replace(/^(roadmap|learning path|path|panduan)\s+(belajar|untuk)?\s*/i, "")
    .replace(/^(belajar)\s+/i, "")
    .trim();
  
  if (!topic) {
    topic = "Topik Pilihan";
  } else {
    topic = topic.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }

  return [
    {
      id: "1",
      title: `Fondasi & Konsep Dasar ${topic}`,
      description: `Mempelajari istilah penting, konsep awal, dan pemahaman dasar tentang ${topic}.`,
      dependencies: [],
      tasks: [
        `Mempelajari definisi dasar dan sejarah singkat ${topic}`,
        `Mengidentifikasi pilar utama dalam ${topic}`,
        `Memahami alat, bahan, atau persiapan yang dibutuhkan`,
        `Mengikuti tutorial/bacaan pengantar dasar`,
        `Membuat rangkuman/catatan pribadi dari konsep dasar`
      ]
    },
    {
      id: "2",
      title: `Prinsip & Teori Utama ${topic}`,
      description: `Mendalami aturan, teori dasar, best practices, dan kerangka kerja dalam ${topic}.`,
      dependencies: ["1"],
      tasks: [
        `Menganalisis studi kasus atau contoh sukses ${topic}`,
        `Mempelajari aturan main dan standardisasi yang berlaku`,
        `Memahami kesalahan umum (common mistakes) dan cara menghindarinya`,
        `Melakukan latihan terstruktur untuk menguji pemahaman teori`,
        `Diskusi atau membaca review dari expert tentang materi ini`
      ]
    },
    {
      id: "3",
      title: `Praktik Terbimbing & Latihan Dasar`,
      description: `Mulai mempraktikkan konsep secara langsung dengan bimbingan atau instruksi langkah-demi-langkah.`,
      dependencies: ["2"],
      tasks: [
        `Mengikuti latihan terbimbing (guided practice) langkah demi langkah`,
        `Menyelesaikan masalah atau mini-project sederhana`,
        `Membandingkan hasil pekerjaan dengan solusi standar`,
        `Mencatat kendala yang dihadapi saat praktik`,
        `Melakukan iterasi perbaikan berdasarkan feedback`
      ]
    },
    {
      id: "4",
      title: `Penerapan Mandiri & Proyek Menengah`,
      description: `Menerapkan ilmu secara mandiri dengan membuat proyek, latihan bebas, atau memecahkan masalah nyata.`,
      dependencies: ["3"],
      tasks: [
        `Menentukan ruang lingkup proyek atau target latihan mandiri`,
        `Merancang alur kerja atau outline dari awal`,
        `Menyelesaikan proyek/latihan tanpa bantuan template penuh`,
        `Melakukan self-review terhadap hasil pekerjaan`,
        `Mempublikasikan atau membagikan hasil karya untuk mendapat masukan`
      ]
    },
    {
      id: "5",
      title: `Evaluasi Akhir & Langkah Lanjutan`,
      description: `Menguji kemampuan secara akumulatif, melakukan review menyeluruh, dan menentukan langkah belajar berikutnya.`,
      dependencies: ["4"],
      tasks: [
        `Melakukan evaluasi mandiri terhadap seluruh materi yang dipelajari`,
        `Mengikuti ujian, test, atau tantangan akhir`,
        `Mengidentifikasi area yang masih memerlukan perbaikan`,
        `Menyusun rencana belajar lanjutan untuk tingkat advanced`,
        `Bergabung dengan komunitas atau forum diskusi terkait`
      ]
    }
  ];
}

function renderMessageContent(content: string) {
  const normalized = content
    .replace(/\s+\*\*/g, "\n\n**")
    .replace(/\s+\*\s+/g, "\n- ")
    .replace(/\*\*/g, "")
    .trim();

  return normalized.split(/\n+/).map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const isBullet = trimmed.startsWith("- ");
    const isModule = /^Modul\s+\d+/i.test(trimmed);

    return (
      <p key={`${trimmed}-${index}`} className={clsx("leading-6", isBullet && "pl-4 before:mr-2 before:content-['•']", isModule && "mt-3 font-bold text-on-surface")}>
        {isBullet ? trimmed.slice(2) : trimmed}
      </p>
    );
  });
}

const starterRoadmap = (): Roadmap => {
  const nodes = [
    makeNode("n1", "Frontend Fundamentals", "HTML semantic, CSS layout, dan JavaScript runtime dasar.", 80, 120, 1, "completed"),
    makeNode("n2", "Advanced React", "Hooks, state composition, performance, dan server components.", 470, 270, 2, "in_progress"),
    makeNode("n3", "Backend Node.js", "HTTP, routing, database access, auth, dan API contract.", 870, 140, 3),
    makeNode("n4", "System Design", "Scalability, availability, caching, queue, dan tradeoff arsitektur.", 870, 430, 4)
  ];
  return {
    id: "roadmap-1",
    title: "Software Architecture Mastery",
    description: "Roadmap personal untuk menguatkan fundamental developer.",
    updatedAt: new Date().toISOString(),
    nodes,
    edges: [makeEdge("n1", "n2"), makeEdge("n2", "n3"), makeEdge("n2", "n4")]
  };
};

function applyLocks(nodes: SkillNode[], edges: Edge[]) {
  return nodes.map((node) => {
    const prerequisites = edges.filter((edge) => edge.target === node.id).map((edge) => nodes.find((item) => item.id === edge.source));
    const locked = prerequisites.some((item) => !item || item.data.status !== "completed" || !item.data.forgePassed);
    return { ...node, data: { ...node.data, locked } };
  });
}

function SkillCard({ data, selected }: NodeProps<SkillNode>) {
  const [now, setNow] = useState(Date.now());
  const meta = statusMeta[data.status];
  const Icon = data.locked ? Lock : meta.icon;
  const tasks = data.tasks ?? [];
  const completedTasks = tasks.filter((task) => task.completed).length;
  const nodeDone = data.status === "completed" && data.forgePassed;
  const urgentTasks = nodeDone ? 0 : tasks.filter((task) => taskReminder(task)?.tone === "danger").length;
  const deadline = nodeDeadlineStatus(tasks, nodeDone, now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className={clsx(
        "w-80 rounded-2xl border bg-white p-5 shadow-ambient transition duration-200",
        selected && "border-primary-container shadow-glow",
        !selected && data.status === "completed" && "border-emerald-200",
        !selected && data.status === "in_progress" && "border-primary-container/70 shadow-glow",
        !selected && data.status === "not_started" && "border-outline-variant",
        data.locked && "opacity-60 grayscale"
      )}
    >
      <Handle type="target" position={Position.Left} />
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className={clsx("rounded-full px-2.5 py-1 font-geist text-[10px] font-bold uppercase tracking-[0.08em]", data.locked ? "bg-slate-100 text-slate-500" : meta.className)}>
          {data.locked ? "Locked" : meta.label}
        </span>
        <Icon className={clsx(data.locked ? "text-slate-500" : data.status === "completed" ? "text-emerald-600" : "text-primary")} size={20} />
      </div>
      <h3 className="text-lg font-bold text-on-surface">{data.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-on-variant">{data.description}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-container">
        <div
          className={clsx("h-full rounded-full", data.status === "completed" ? "bg-emerald-500" : data.status === "in_progress" ? "bg-primary-container" : "bg-outline-variant")}
          style={{ width: data.status === "completed" ? "100%" : data.status === "in_progress" ? "48%" : "0%" }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between font-geist text-[11px] font-semibold text-on-variant">
        <span>{data.forgePassed ? "Forge passed" : "Forge pending"}</span>
        <span>Order {data.orderIndex}</span>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-low px-3 py-2 text-xs font-semibold text-on-variant">
        <span className="inline-flex items-center gap-1">
          <SquareCheck size={14} /> {completedTasks}/{tasks.length} tasks
        </span>
        {urgentTasks > 0 && (
          <span className="inline-flex items-center gap-1 text-red-600">
            <AlertTriangle size={14} /> {urgentTasks} due
          </span>
        )}
      </div>
      {deadline && (
        <div
          className={clsx(
            "mt-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold",
            deadline.tone === "overdue" && "border-red-300 bg-red-100 text-red-800",
            deadline.tone === "today" && "border-rose-300 bg-rose-50 text-rose-700",
            deadline.tone === "h1" && "border-orange-300 bg-orange-50 text-orange-700",
            deadline.tone === "h2" && "border-amber-300 bg-amber-50 text-amber-700",
            deadline.tone === "h3" && "border-yellow-300 bg-yellow-50 text-yellow-700",
            deadline.tone === "done" && "border-emerald-200 bg-emerald-50 text-emerald-700",
            deadline.tone === "neutral" && "border-outline-variant bg-white text-on-variant"
          )}
        >
          <span className="inline-flex items-center gap-1">
            <CalendarClock size={14} /> {deadline.dateLabel}
          </span>
          <span>{deadline.label}</span>
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { skill: SkillCard };

export default function FoundryDashboard() {
  const router = useRouter();
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [activeId, setActiveId] = useState("roadmap-1");
  const [nodes, setNodes, onNodesChange] = useNodesState<SkillNode>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [roadmapModalOpen, setRoadmapModalOpen] = useState(false);
  const [roadmapTitle, setRoadmapTitle] = useState("");
  const [roadmapDescription, setRoadmapDescription] = useState("");
  const [deleteRoadmapId, setDeleteRoadmapId] = useState<string | null>(null);
  const [renameRoadmapId, setRenameRoadmapId] = useState<string | null>(null);
  const [renameRoadmapTitle, setRenameRoadmapTitle] = useState("");
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [nodeTitle, setNodeTitle] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");
  const [nodeTasksText, setNodeTasksText] = useState("");
  const [goal, setGoal] = useState("");
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftNodes, setDraftNodes] = useState<GeneratedPathNode[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [testOpen, setTestOpen] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [caseStudy, setCaseStudy] = useState<ForgeCaseStudy | null>(null);
  const [submission, setSubmission] = useState("");
  const [evaluation, setEvaluation] = useState<ForgeEvaluation | null>(null);
  const [profileName, setProfileName] = useState("");
  const [currentUserId, setCurrentUserId] = useState("guest");
  const hydratedRef = useRef(false);

  useEffect(() => {
    const hydrate = async () => {
      const userId = await getCurrentUserId();
      setCurrentUserId(userId);
      const storageKey = scopedKey(userId, "roadmaps");
      const stored = window.localStorage.getItem(storageKey);
      const local = stored ? (JSON.parse(stored) as Roadmap[]).map(normalizeRoadmap) : [];

      let next = local;
      try {
        const response = await fetch("/api/roadmaps", { headers: await getAuthHeaders() });
        if (response.ok) {
          const body = (await response.json()) as { roadmaps: Roadmap[] | null };
          if (body.roadmaps?.length) {
            next = body.roadmaps.map(normalizeRoadmap);
            window.localStorage.setItem(storageKey, JSON.stringify(next));
          }
        }
      } catch {
        next = local;
      }

      const first = next[0];
      setRoadmaps(next);
      setActiveId(first?.id ?? "roadmap-1");
      setNodes(first ? applyLocks(first.nodes, first.edges) : []);
      setEdges(first?.edges ?? []);
      hydratedRef.current = true;
    };

    void hydrate();
  }, [setEdges, setNodes]);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user || !data.user.email_confirmed_at) {
        router.push('/login');
      }
    };
    void checkAuth();
  }, [router]);

  useEffect(() => {
    const syncProfile = async () => {
      const userId = await getCurrentUserId();
      const localName = window.localStorage.getItem(scopedKey(userId, "full-name"));
      if (localName) {
        setProfileName(localName);
        return;
      }

      try {
        const response = await fetch("/api/profile", { cache: "no-store", headers: await getAuthHeaders() });
        if (response.ok) {
          const body = (await response.json()) as { profile?: { full_name?: string } };
          const name = body.profile?.full_name ?? "User";
          setProfileName(name);
          window.localStorage.setItem(scopedKey(userId, "full-name"), name);
          return;
        }
      } catch {
        // Use local fallback below.
      }
      setProfileName(window.localStorage.getItem(scopedKey(userId, "full-name")) ?? "User");
    };
    const handleProfileSync = () => void syncProfile();
    handleProfileSync();
    window.addEventListener("storage", syncProfile);
    window.addEventListener("foundry-profile-updated", handleProfileSync);
    return () => {
      window.removeEventListener("storage", syncProfile);
      window.removeEventListener("foundry-profile-updated", handleProfileSync);
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || !roadmaps.length) return;
    setRoadmaps((items) => {
      const next = items.map((roadmap) =>
        roadmap.id === activeId ? { ...roadmap, nodes: applyLocks(nodes, edges), edges, updatedAt: new Date().toISOString() } : roadmap
      );
      window.localStorage.setItem(scopedKey(currentUserId, "roadmaps"), JSON.stringify(next));
      void getAuthHeaders().then((headers) => fetch("/api/roadmaps", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ roadmaps: next })
      })).catch(() => undefined);
      return next;
    });
  }, [nodes, edges, activeId, currentUserId]);

  const activeRoadmap = roadmaps.find((roadmap) => roadmap.id === activeId);
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedNodeTasks = selectedNode?.data.tasks ?? [];
  const progress = nodes.length ? Math.round((nodes.filter((node) => node.data.status === "completed").length / nodes.length) * 100) : 0;

  const buildGeneratedGraph = useCallback(
    (generated: GeneratedPathNode[], base = 0) => {
      const idMap = new Map(generated.map((item) => [item.id, crypto.randomUUID()]));
      const nextNodes = generated.map((item, index) =>
        makeNode(idMap.get(item.id)!, item.title, item.description, 120 + index * 370, 180 + (index % 2) * 230, base + index + 1, "not_started", item.tasks)
      );
      const nextEdges = generated.flatMap((item, index) => {
        const dependencies = item.dependencies.length || index === 0 ? item.dependencies : [generated[index - 1].id];
        return dependencies
          .map((dependency) => {
            const source = idMap.get(dependency);
            const target = idMap.get(item.id);
            return source && target ? makeEdge(source, target) : null;
          })
          .filter((edge): edge is Edge => Boolean(edge));
      });

      return { nextNodes, nextEdges };
    },
    []
  );

  const fetchGeneratedPath = useCallback(async (inputGoal: string) => {
    try {
      const response = await fetch("/api/ai/generate-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: inputGoal })
      });
      const body = (await response.json()) as { nodes: GeneratedPathNode[] };
      return response.ok && Array.isArray(body.nodes) && body.nodes.length ? body.nodes : makeLocalDraft(inputGoal);
    } catch {
      return makeLocalDraft(inputGoal);
    }
  }, []);

  const updateNodeData = useCallback(
    (id: string, patch: Partial<SkillData>) => {
      setNodes((items) => applyLocks(items.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)), edges));
    },
    [edges, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof applyEdgeChanges<Edge>>[0]) => {
      setEdges((items) => {
        const next = applyEdgeChanges(changes, items);
        setNodes((nodeItems) => applyLocks(nodeItems, next));
        setSelectedEdgeId((current) => current && next.some((edge) => edge.id === current) ? current : null);
        return next;
      });
    },
    [setEdges, setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((items) => {
        const next = addEdge({ ...connection, type: "smoothstep", animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: "#7C3AED" }, style: { stroke: "#7C3AED", strokeWidth: 2, strokeDasharray: "8 8" } }, items);
        setNodes((nodeItems) => applyLocks(nodeItems, next));
        return next;
      });
    },
    [setEdges, setNodes]
  );

  const deleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    setEdges((items) => {
      const next = items.filter((edge) => edge.id !== selectedEdgeId);
      setNodes((nodeItems) => applyLocks(nodeItems, next));
      return next;
    });
    setSelectedEdgeId(null);
  };

  const selectRoadmap = (id: string) => {
    const roadmap = roadmaps.find((item) => item.id === id);
    if (!roadmap) return;
    const normalized = normalizeRoadmap(roadmap);
    setActiveId(id);
    setNodes(applyLocks(normalized.nodes, normalized.edges));
    setEdges(normalized.edges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSidebarOpen(false);
  };

  const addRoadmap = () => {
    const title = roadmapTitle.trim();
    if (!title) return;

    const roadmap: Roadmap = {
      id: crypto.randomUUID(),
      title,
      description: roadmapDescription.trim(),
      updatedAt: new Date().toISOString(),
      nodes: [],
      edges: []
    };
    setRoadmaps((items) => {
      const next = [roadmap, ...items];
      window.localStorage.setItem(scopedKey(currentUserId, "roadmaps"), JSON.stringify(next));
      return next;
    });
    setActiveId(roadmap.id);
    setNodes(applyLocks(roadmap.nodes, roadmap.edges));
    setEdges(roadmap.edges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setRoadmapTitle("");
    setRoadmapDescription("");
    setRoadmapModalOpen(false);
  };

  const deleteRoadmap = () => {
    if (!deleteRoadmapId) return;

    const finalRoadmaps = roadmaps.filter((roadmap) => roadmap.id !== deleteRoadmapId);
    const nextActiveRaw = activeId === deleteRoadmapId ? finalRoadmaps[0] : roadmaps.find((roadmap) => roadmap.id === activeId) ?? finalRoadmaps[0];
    const nextActive = nextActiveRaw ? normalizeRoadmap(nextActiveRaw) : undefined;

    setRoadmaps(finalRoadmaps);
    setActiveId(nextActive?.id ?? "");
    setNodes(nextActive ? applyLocks(nextActive.nodes, nextActive.edges) : []);
    setEdges(nextActive?.edges ?? []);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    window.localStorage.setItem(scopedKey(currentUserId, "roadmaps"), JSON.stringify(finalRoadmaps));
    void getAuthHeaders().then((headers) => fetch(`/api/roadmaps?id=${encodeURIComponent(deleteRoadmapId)}`, { method: "DELETE", headers })).catch(() => undefined);

    setDeleteRoadmapId(null);
  };

  const startRename = (roadmapId: string, currentTitle: string) => {
    setRenameRoadmapId(roadmapId);
    setRenameRoadmapTitle(currentTitle);
  };

  const confirmRename = () => {
    if (!renameRoadmapId || !renameRoadmapTitle.trim()) {
      setRenameRoadmapId(null);
      return;
    }
    const updated = roadmaps.map((r) => r.id === renameRoadmapId ? { ...r, title: renameRoadmapTitle.trim(), updatedAt: new Date().toISOString() } : r);
    setRoadmaps(updated);
    window.localStorage.setItem(scopedKey(currentUserId, "roadmaps"), JSON.stringify(updated));
    setRenameRoadmapId(null);
    setRenameRoadmapTitle("");
  };

  const addManualNode = () => {
    const title = nodeTitle.trim();
    if (!title) return;
    const id = crypto.randomUUID();
    const customTasks = nodeTasksText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    setNodes((items) => [...items, makeNode(id, title, nodeDescription.trim(), 260 + items.length * 36, 180 + items.length * 28, items.length + 1, "not_started", customTasks)]);
    setNodeTitle("");
    setNodeDescription("");
    setNodeTasksText("");
    setNodeModalOpen(false);
  };

  const deleteSelected = () => {
    if (!selectedNodeId) return;
    setNodes((items) => items.filter((node) => node.id !== selectedNodeId));
    setEdges((items) => items.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
    setSelectedNodeId(null);
  };

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    window.localStorage.removeItem("foundry-active-user-id");
    router.push("/login");
  };

  const autoLayout = () => {
    const levels = new Map<string, number>();
    const resolveLevel = (id: string): number => {
      if (levels.has(id)) return levels.get(id)!;
      const incoming = edges.filter((edge) => edge.target === id);
      const level = incoming.length ? Math.max(...incoming.map((edge) => resolveLevel(edge.source) + 1)) : 0;
      levels.set(id, level);
      return level;
    };
    const grouped = new Map<number, SkillNode[]>();
    nodes.forEach((node) => {
      const level = resolveLevel(node.id);
      grouped.set(level, [...(grouped.get(level) ?? []), node]);
    });
    setNodes((items) =>
      items.map((node) => {
        const level = resolveLevel(node.id);
        const index = grouped.get(level)?.findIndex((item) => item.id === node.id) ?? 0;
        return { ...node, position: { x: 80 + level * 390, y: 110 + index * 230 } };
      })
    );
  };

  const confirmDraft = async () => {
    const base = nodes.length;
    let generated = draftNodes;

    if (!generated.length) {
      try {
        const response = await fetch("/api/ai/generate-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal })
        });
        const body = (await response.json()) as { nodes: GeneratedPathNode[] };
        generated = Array.isArray(body.nodes) ? body.nodes : [];
      } catch {
        generated = [];
      }
    }

    if (!generated.length) {
      generated = makeLocalDraft(goal);
    }

    const { nextNodes: newNodes, nextEdges: newEdges } = buildGeneratedGraph(generated, base);

    if (!activeRoadmap) {
      const title = goal.trim().split(/\s+/).slice(0, 5).join(" ") || "AI Generated Roadmap";
      const roadmap: Roadmap = {
        id: crypto.randomUUID(),
        title,
        description: goal.trim(),
        updatedAt: new Date().toISOString(),
        nodes: newNodes,
        edges: newEdges
      };
      setRoadmaps((items) => {
        const next = [roadmap, ...items];
        window.localStorage.setItem(scopedKey(currentUserId, "roadmaps"), JSON.stringify(next));
        return next;
      });
      setActiveId(roadmap.id);
      setNodes(applyLocks(newNodes, newEdges));
      setEdges(newEdges);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setDraftOpen(false);
      setDraftNodes([]);
      setDraftError("");
      setGoal("");
      return;
    }

    setNodes((items) => applyLocks([...items, ...newNodes], [...edges, ...newEdges]));
    setEdges((items) => [...items, ...newEdges]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setDraftOpen(false);
    setDraftNodes([]);
    setDraftError("");
    setGoal("");
  };

  const requestDraft = async () => {
    if (draftLoading || !goal.trim()) return;
    setDraftLoading(true);
    setDraftError("");
    try {
      setDraftNodes(await fetchGeneratedPath(goal));
    } catch {
      setDraftError("Preview AI gagal dimuat. Saya tampilkan fallback lokal supaya flow tetap bisa lanjut.");
      setDraftNodes(makeLocalDraft(goal));
    } finally {
      setDraftLoading(false);
    }
  };

  const sendChat = async () => {
    if (!selectedNode || !chatInput.trim()) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: chatInput.trim() };
    const nextMessages = [...selectedNode.data.messages, userMessage];
    updateNodeData(selectedNode.id, { messages: nextMessages });
    setChatInput("");

    let content = `Untuk topik ${selectedNode.data.title}, mulai dari definisi inti, buat contoh kecil, lalu validasi pemahamanmu dengan latihan.`;
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roadmapTitle: activeRoadmap?.title,
          nodeTitle: selectedNode.data.title,
          nodeDescription: selectedNode.data.description,
          messages: nextMessages
        })
      });
      const body = (await response.json()) as { content?: string };
      content = body.content ?? content;
    } catch {
      content = `${content} API AI belum tersedia, jadi ini jawaban fallback lokal.`;
    }

    const assistant: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content
    };
    updateNodeData(selectedNode.id, { messages: [...nextMessages, assistant] });
  };

  const addTask = () => {
    if (!selectedNode || !taskTitle.trim()) return;
    const currentTasks = selectedNode.data.tasks ?? [];
    if (currentTasks.length >= maxTasksPerNode) return;
    updateNodeData(selectedNode.id, {
      tasks: [
        ...currentTasks,
        {
          id: crypto.randomUUID(),
          title: taskTitle.trim(),
          completed: false,
          dueDate: taskDueDate || undefined
        }
      ],
      status: selectedNode.data.status === "not_started" ? "in_progress" : selectedNode.data.status
    });
    setTaskTitle("");
    setTaskDueDate("");
  };

  const patchTask = (taskId: string, patch: Partial<TaskItem>) => {
    if (!selectedNode) return;
    const tasks = (selectedNode.data.tasks ?? []).map((task) => (task.id === taskId ? { ...task, ...patch } : task));
    const allDone = tasks.length > 0 && tasks.every((task) => task.completed);
    updateNodeData(selectedNode.id, {
      tasks,
      status: allDone ? "completed" : selectedNode.data.status === "completed" ? "in_progress" : selectedNode.data.status,
      forgePassed: allDone ? selectedNode.data.forgePassed : false
    });
  };

  const deleteTask = (taskId: string) => {
    if (!selectedNode) return;
    const tasks = (selectedNode.data.tasks ?? []).filter((task) => task.id !== taskId);
    updateNodeData(selectedNode.id, { tasks });
  };

  const startForgeTest = async (forceNew = false) => {
    if (!selectedNode) return;
    const existingExpired = forgeExpired(selectedNode);
    const existingCaseValid = forgeCaseLooksValid(selectedNode);
    const nextAttempt = forceNew ? Date.now() + Math.floor(Math.random() * 100_000) : selectedNode.data.forgeAttempt ?? Date.now();
    if (!forceNew && selectedNode.data.forgeCaseStudy && !existingExpired && existingCaseValid) {
      setCaseStudy(selectedNode.data.forgeCaseStudy);
      setSubmission(selectedNode.data.forgeSubmission ?? "");
      setEvaluation(selectedNode.data.forgeEvaluation ?? null);
      setTestOpen(true);
      return;
    }

    setTestLoading(true);
    setCaseStudy(null);
    setSubmission("");
    setEvaluation(null);
    setTestOpen(true);

    if (forceNew || existingExpired || (selectedNode.data.forgeCaseStudy && !existingCaseValid)) {
      updateNodeData(selectedNode.id, {
        forgeCaseStudy: undefined,
        forgeStartedAt: undefined,
        forgeExpiresAt: undefined,
        forgeAttempt: nextAttempt,
        forgeSubmission: "",
        forgeEvaluation: undefined,
        forgePassed: false,
        feedback: forceNew ? "Forge case baru sedang dibuat." : existingExpired ? "Forge case sebelumnya expired setelah 24 jam. Case baru sedang dibuat." : "Forge case sebelumnya tidak sesuai materi node. Case baru sedang dibuat."
      });
    }

    const prerequisiteNodes = nodes
      .filter((node) => node.id !== selectedNode.id && node.data.status === "completed" && node.data.orderIndex < selectedNode.data.orderIndex)
      .sort((a, b) => a.data.orderIndex - b.data.orderIndex)
      .map((node) => ({ title: node.data.title, description: node.data.description, tasks: (node.data.tasks ?? []).map((t) => t.title) }));
    const targetNode = { title: selectedNode.data.title, description: selectedNode.data.description, tasks: (selectedNode.data.tasks ?? []).map((t) => t.title) };

    try {
      const response = await fetch("/api/ai/forge-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generate", nodes: prerequisiteNodes, targetNode, variantSeed: nextAttempt })
      });
      const body = (await response.json()) as { caseStudy?: ForgeCaseStudy };
      if (body.caseStudy) {
        const now = Date.now();
        setCaseStudy(body.caseStudy);
        updateNodeData(selectedNode.id, {
          forgeCaseStudy: body.caseStudy,
          forgeStartedAt: now,
          forgeExpiresAt: now + forgeDurationMs,
          forgeAttempt: nextAttempt,
          forgeSubmission: "",
          forgeEvaluation: undefined,
          forgePassed: false,
          feedback: `Forge case aktif sampai ${new Date(now + forgeDurationMs).toLocaleString("id-ID")}.`
        });
      }
    } catch {
      const fallbackCaseStudy = {
        title: `Studi Kasus ${selectedNode.data.title}`,
        scenario: `Project mini untuk node "${selectedNode.data.title}": buat solusi sederhana yang hanya memakai konsep dari task node ini. Jelaskan input, proses, dan output dari solusi kamu.`,
        requirements: [
          "Gunakan konsep utama dari task node ini.",
          "Tulis kode atau pseudocode yang rapi dan mudah dibaca.",
          "Tambahkan output atau contoh penggunaan solusi."
        ],
        expectedOutput: "Solusi berjalan sesuai requirement tanpa error logika utama.",
        evaluationCriteria: ["Kelengkapan requirement", "Ketepatan konsep", "Kerapian kode", "Kesiapan lanjut ke node berikutnya"]
      };
      const now = Date.now();
      setCaseStudy(fallbackCaseStudy);
      updateNodeData(selectedNode.id, {
        forgeCaseStudy: fallbackCaseStudy,
        forgeStartedAt: now,
        forgeExpiresAt: now + forgeDurationMs,
        forgeAttempt: nextAttempt,
        forgeSubmission: "",
        forgeEvaluation: undefined,
        forgePassed: false,
        feedback: `Forge case aktif sampai ${new Date(now + forgeDurationMs).toLocaleString("id-ID")}.`
      });
    } finally {
      setTestLoading(false);
    }
  };

  const submitTest = async () => {
    if (!selectedNode || !caseStudy || !submission.trim() || evaluation) return;
    setTestLoading(true);

    if (forgeExpired(selectedNode)) {
      setEvaluation({
        score: 0,
        passed: false,
        feedback: "Forge case sudah expired karena melewati batas 24 jam. Tutup modal lalu mulai Forge lagi untuk membuat studi kasus baru.",
        issues: ["Batas waktu pengerjaan sudah habis."],
        nextSteps: ["Mulai Forge lagi untuk mendapatkan case baru."]
      });
      setTestLoading(false);
      return;
    }

    const prerequisiteNodes = nodes
      .filter((node) => node.id !== selectedNode.id && node.data.status === "completed" && node.data.orderIndex < selectedNode.data.orderIndex)
      .sort((a, b) => a.data.orderIndex - b.data.orderIndex)
      .map((node) => ({ title: node.data.title, description: node.data.description, tasks: (node.data.tasks ?? []).map((t) => t.title) }));
    const targetNode = { title: selectedNode.data.title, description: selectedNode.data.description, tasks: (selectedNode.data.tasks ?? []).map((t) => t.title) };

    let result: ForgeEvaluation;
    try {
      const response = await fetch("/api/ai/forge-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "evaluate", nodes: prerequisiteNodes, targetNode, caseStudy, submission })
      });
      const body = (await response.json()) as { evaluation?: ForgeEvaluation };
      result = body.evaluation ?? {
        score: 0,
        passed: false,
        feedback: "Evaluasi belum tersedia. Coba submit ulang.",
        issues: ["Response evaluator kosong."],
        nextSteps: ["Cek koneksi/API lalu coba lagi."]
      };
    } catch {
      result = {
        score: 60,
        passed: false,
        feedback: "Submission sudah diterima, tapi evaluator AI sedang tidak tersedia. Review manual dulu lalu coba lagi.",
        issues: ["Evaluator gagal dipanggil."],
        nextSteps: ["Pastikan kode memenuhi semua requirement.", "Coba submit ulang setelah API aktif."]
      };
    }

    updateNodeData(selectedNode.id, {
      forgePassed: result.passed,
      feedback: `Skor ${result.score}. ${result.feedback}`,
      forgeSubmission: submission,
      forgeEvaluation: result,
      cooldownUntil: undefined
    });
    setEvaluation(result);
    setTestLoading(false);
  };

  const retryForgeTest = async () => {
    if (!selectedNode) return;
    updateNodeData(selectedNode.id, {
      forgeCaseStudy: undefined,
      forgeStartedAt: undefined,
      forgeExpiresAt: undefined,
      forgeAttempt: (selectedNode.data.forgeAttempt ?? 0) + 1,
      forgeSubmission: "",
      forgeEvaluation: undefined,
      forgePassed: false,
      cooldownUntil: undefined,
      feedback: "Forge case baru sedang dibuat."
    });
    setCaseStudy(null);
    setSubmission("");
    setEvaluation(null);
    await startForgeTest(true);
  };

  const closeTestReview = () => {
    if (selectedNode) {
      updateNodeData(selectedNode.id, {
        forgeSubmission: submission,
        forgeEvaluation: evaluation ?? selectedNode.data.forgeEvaluation
      });
    }
    setTestOpen(false);
    setCaseStudy(null);
    setSubmission("");
    setEvaluation(null);
  };

  return (
    <main className="flex h-screen overflow-hidden bg-background text-on-surface">
      <aside className={clsx("z-20 flex w-72 shrink-0 flex-col border-r border-outline-variant bg-white/90 px-3 py-5 backdrop-blur fixed inset-y-0 left-0 transition-transform duration-300 lg:relative lg:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="mb-7 px-3">
          <div className="flex items-center gap-3">
            <BrandLogo size={44} className="shadow-lg shadow-primary-container/20" />
            <div>
              <h1 className="text-2xl font-bold text-primary">Foundry</h1>
              <p className="text-xs font-medium text-on-variant">Learning Path Builder</p>
            </div>
          </div>
        </div>
        <button onClick={() => setRoadmapModalOpen(true)} className="mb-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary-container/20">
          <Plus size={17} /> Roadmap Baru
        </button>
        <nav className="flex-1 space-y-2 overflow-auto pr-1">
          {roadmaps.length === 0 && (
            <div className="rounded-xl border border-dashed border-outline-variant bg-surface-low/70 p-4 text-sm leading-6 text-on-variant">
              Belum ada roadmap. Klik `Roadmap Baru` untuk mulai.
            </div>
          )}
          {roadmaps.map((roadmap) => (
            <div
              key={roadmap.id}
              className={clsx("group flex items-start gap-2 rounded-xl border p-3 transition", roadmap.id === activeId ? "border-primary-container bg-primary-container/10" : "border-transparent hover:bg-surface-low")}
            >
              {renameRoadmapId === roadmap.id ? (
                <input
                  autoFocus
                  value={renameRoadmapTitle}
                  onChange={(e) => setRenameRoadmapTitle(e.target.value)}
                  onBlur={confirmRename}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setRenameRoadmapId(null); }}
                  className="min-w-0 flex-1 rounded-lg border border-primary-container bg-white px-2 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary-container/50"
                />
              ) : (
                <button onClick={() => selectRoadmap(roadmap.id)} className="min-w-0 flex-1 text-left">
                  <div className="truncate font-semibold">{roadmap.title}</div>
                  <div className="mt-1 font-geist text-xs text-on-variant">{new Date(roadmap.updatedAt).toLocaleDateString("id-ID")}</div>
                </button>
              )}
              <button
                type="button"
                onClick={() => startRename(roadmap.id, roadmap.title)}
                className="rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-violet-50 hover:text-primary group-hover:opacity-100"
                aria-label={`Rename ${roadmap.title}`}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteRoadmapId(roadmap.id)}
                className="rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                aria-label={`Hapus ${roadmap.title}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </nav>
        <div className="mt-5 border-t border-outline-variant pt-4">
          <Link href="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-surface-low">
            <Avatar size={36} />
            <span className="flex-1 truncate">{profileName}</span>
            <Settings size={17} />
          </Link>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-on-variant hover:bg-slate-100 text-left"
          >
            <LogOut size={17} /> Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-10 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <section className="relative flex min-w-0 flex-1 flex-col">
        <div className="absolute inset-0 dot-grid opacity-80" />
        <header className="z-10 flex items-center justify-between border-b border-outline-variant bg-white/75 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-lg p-2 hover:bg-surface-low lg:hidden">
              <LayoutGrid size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold truncate">{activeRoadmap?.title ?? "Foundry Canvas"}</h2>
              <p className="text-xs sm:text-sm text-on-variant truncate">
                {activeRoadmap ? `${progress}% progress. Dependency-aware canvas dengan Forge Test gateway.` : "Pilih atau buat roadmap untuk mulai menyusun learning path."}
              </p>
            </div>
          </div>
          {activeRoadmap && (
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button onClick={() => setNodeModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm font-semibold hover:border-primary-container">
                <Plus size={15} className="sm:hidden" /><Plus size={17} className="hidden sm:block" /> <span className="hidden sm:inline">Add Node</span>
              </button>
              <button onClick={() => setDraftOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm font-semibold hover:border-primary-container">
                <Sparkles size={15} className="sm:hidden" /><Sparkles size={17} className="hidden sm:block" /> <span className="hidden sm:inline">AI Generate</span>
              </button>
              <button onClick={autoLayout} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm font-bold text-white">
                <LayoutGrid size={15} className="sm:hidden" /><LayoutGrid size={17} className="hidden sm:block" /> <span className="hidden sm:inline">Auto Layout</span>
              </button>
            </div>
          )}
        </header>

        <div className="relative min-h-0 flex-1">
          {!activeRoadmap && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="max-w-md rounded-2xl border border-outline-variant bg-white/90 p-6 text-center shadow-ambient backdrop-blur">
                <h3 className="text-xl font-bold">Belum ada roadmap aktif</h3>
                <p className="mt-2 text-sm leading-6 text-on-variant">Buat roadmap dulu. Setelah itu canvas akan menampilkan pilihan Add Node, AI Generate, dan Auto Layout.</p>
                <button onClick={() => setRoadmapModalOpen(true)} className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-3 text-sm font-bold text-white">
                  <Plus size={17} /> Roadmap Baru
                </button>
              </div>
            </div>
          )}
          <ReactFlow
            className="foundry-flow"
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
              if (node.data.locked) {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                return;
              }
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
              setTab("overview");
              setSidebarOpen(false);
            }}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(edge.id);
              setSelectedNodeId(null);
              setSidebarOpen(false);
            }}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#ccc3d8" />
            <MiniMap nodeStrokeColor="#7C3AED" nodeColor="#F2F3FF" maskColor="rgba(248, 247, 255, .65)" />
            <Controls />
          </ReactFlow>
        </div>
      </section>

      {selectedNode && (
        <aside className="z-30 flex w-full sm:w-[420px] shrink-0 flex-col border-l border-outline-variant bg-white shadow-ambient fixed inset-y-0 right-0 sm:relative">
          <div className="flex items-start justify-between border-b border-outline-variant p-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-primary">
                <PanelRight size={15} /> Node Detail
              </div>
              <h3 className="text-xl font-bold">{selectedNode.data.title}</h3>
            </div>
            <button onClick={() => setSelectedNodeId(null)} className="rounded-lg p-2 hover:bg-surface-low">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-4 border-b border-outline-variant p-2">
            {(["overview", "tasks", "chat", "forge"] as Tab[]).map((item) => (
              <button key={item} onClick={() => setTab(item)} className={clsx("rounded-lg px-3 py-2 text-sm font-semibold capitalize", tab === item ? "bg-primary-container text-white" : "text-on-variant hover:bg-surface-low")}>
                {item}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-5">
            {tab === "overview" && (
              <div className="space-y-4">
                <label className="block">
                  <span className="font-geist text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Status</span>
                  <select
                    value={selectedNode.data.status}
                    onChange={(event) => updateNodeData(selectedNode.id, { status: event.target.value as Status, forgePassed: event.target.value === "completed" ? selectedNode.data.forgePassed : false })}
                    className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:ring-2 focus:ring-primary-container/20"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <label className="block">
                  <span className="font-geist text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Judul</span>
                  <input value={selectedNode.data.title} onChange={(event) => updateNodeData(selectedNode.id, { title: event.target.value })} className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:ring-2 focus:ring-primary-container/20" />
                </label>
                <label className="block">
                  <span className="font-geist text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Deskripsi</span>
                  <textarea value={selectedNode.data.description} onChange={(event) => updateNodeData(selectedNode.id, { description: event.target.value })} className="mt-2 min-h-24 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:ring-2 focus:ring-primary-container/20" />
                </label>
                <div>
                  <span className="font-geist text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Catatan pribadi</span>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Tulis catatan, bullet, atau potongan kode di sini..."
                    onBlur={(event) => updateNodeData(selectedNode.id, { notes: event.currentTarget.innerHTML })}
                    className="content-editable mt-2 min-h-36 rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-primary-container/20"
                    dangerouslySetInnerHTML={{ __html: selectedNode.data.notes }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={deleteSelected} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">
                    <Trash2 size={16} /> Delete
                  </button>
                  <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-container px-3 py-2 text-sm font-bold text-white">
                    <Save size={16} /> Saved
                  </button>
                </div>
              </div>
            )}

            {tab === "tasks" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-outline-variant bg-surface-low p-4">
                  <div className="mb-1 flex items-center gap-2 font-bold">
                    <SquareCheck size={18} className="text-primary" /> Task Node
                  </div>
                  <p className="text-sm leading-6 text-on-variant">
                    Checklist semua task untuk menandai node siap diselesaikan. Deadline H-1 atau lewat deadline akan diberi tanda merah.
                  </p>
                </div>

                <div className="space-y-2">
                  {selectedNodeTasks.length === 0 && (
                    <div className="rounded-xl border border-dashed border-outline-variant p-4 text-sm text-on-variant">Belum ada task untuk node ini.</div>
                  )}
                  {selectedNodeTasks.map((task) => {
                    const reminder = taskReminder(task);
                    return (
                      <div key={task.id} className={clsx("rounded-xl border p-3", reminder?.tone === "danger" ? "border-red-200 bg-red-50" : reminder?.tone === "warning" ? "border-amber-200 bg-amber-50" : "border-outline-variant bg-white")}>
                        <div className="flex items-start gap-3">
                          <input
                            checked={task.completed}
                            onChange={(event) => patchTask(task.id, { completed: event.target.checked })}
                            type="checkbox"
                            className="mt-1 rounded border-outline-variant text-primary-container focus:ring-primary-container/20"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={clsx("text-sm font-semibold leading-6", task.completed && "text-on-variant line-through")}>{task.title}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <label className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-white px-2 py-1 text-xs text-on-variant">
                                <CalendarClock size={14} />
                                <input
                                  value={task.dueDate ?? ""}
                                  onChange={(event) => patchTask(task.id, { dueDate: event.target.value || undefined })}
                                  type="date"
                                  className="border-0 bg-transparent p-0 text-xs outline-none focus:ring-0"
                                />
                              </label>
                              {reminder && (
                                <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold", reminder.tone === "danger" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                                  <AlertTriangle size={13} /> {reminder.label}
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={() => deleteTask(task.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-outline-variant p-3">
                  <label className="block">
                    <span className="font-geist text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Task baru</span>
                    <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20" placeholder="Contoh: Buat latihan function sederhana" />
                  </label>
                  <label className="mt-3 block">
                    <span className="font-geist text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Deadline opsional</span>
                    <input value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} type="date" className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20" />
                  </label>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">{selectedNodeTasks.length}/{maxTasksPerNode} tasks</span>
                    <button onClick={addTask} disabled={!taskTitle.trim() || selectedNodeTasks.length >= maxTasksPerNode} className="rounded-lg bg-primary-container px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                      Tambah Task
                    </button>
                  </div>
                  {selectedNodeTasks.length >= maxTasksPerNode && <p className="mt-2 text-xs text-red-600">Batas maksimal 10 task per node. Hapus task yang kurang penting dulu.</p>}
                </div>
              </div>
            )}

            {tab === "chat" && (
              <div className="flex h-full min-h-[520px] flex-col">
                <div className="flex-1 space-y-3 overflow-auto rounded-xl bg-surface-low p-3">
                  {selectedNode.data.messages.length === 0 && (
                    <div className="rounded-xl border border-outline-variant bg-white p-4 text-sm text-on-variant">
                      Tanya AI Companion tentang {selectedNode.data.title}. History tersimpan di data node lokal.
                    </div>
                  )}
                  {selectedNode.data.messages.map((message) => (
                    <div key={message.id} className={clsx("rounded-xl p-3 text-sm leading-6", message.role === "user" ? "ml-8 bg-primary-container text-white" : "mr-8 border border-outline-variant bg-white")}>
                      {message.role === "assistant" ? renderMessageContent(message.content) : message.content}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendChat()} className="min-w-0 flex-1 rounded-lg border border-outline-variant px-3 py-2 text-sm" placeholder="Jelasin konsep ini..." />
                  <button onClick={sendChat} className="rounded-lg bg-primary-container px-3 text-white">
                    <Send size={18} />
                  </button>
                </div>
                <button onClick={() => updateNodeData(selectedNode.id, { messages: [] })} className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold">
                  <RefreshCcw size={16} /> Reset Chat
                </button>
              </div>
            )}

            {tab === "forge" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-outline-variant bg-surface-low p-4">
                  <div className="mb-2 flex items-center gap-2 font-bold">
                    {selectedNode.data.forgePassed ? <Unlock className="text-emerald-600" size={19} /> : <Lock className="text-primary" size={19} />}
                    Forge Test Gateway
                  </div>
                  <p className="text-sm leading-6 text-on-variant">Studi kasus coding ini menjadi syarat untuk membuka node yang bergantung pada topik ini.</p>
                  <div className={clsx("mt-3 rounded-lg border px-3 py-2 text-xs font-semibold", forgeExpired(selectedNode) ? "border-red-200 bg-red-50 text-red-700" : "border-outline-variant bg-white text-on-variant")}>
                    {selectedNode.data.forgeCaseStudy && forgeCaseLooksValid(selectedNode)
                      ? `Deadline pengerjaan: ${formatForgeDeadline(selectedNode.data.forgeExpiresAt)}`
                      : selectedNode.data.forgeCaseStudy
                        ? "Case tersimpan tidak sesuai materi node. Klik mulai untuk membuat case baru."
                        : "Saat mulai Forge, case akan aktif 24 jam dan tersimpan di node ini."}
                  </div>
                </div>
                {selectedNode.data.feedback && <div className="rounded-xl border border-outline-variant bg-white p-4 text-sm leading-6">{selectedNode.data.feedback}</div>}
                <button
                  disabled={selectedNode.data.status !== "completed"}
                  onClick={() => void startForgeTest()}
                  className="w-full rounded-lg bg-primary-container px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {testLoading ? "Menyiapkan Studi Kasus..." : selectedNode.data.forgeCaseStudy && !forgeExpired(selectedNode) && forgeCaseLooksValid(selectedNode) ? "Lanjutkan Studi Kasus" : "Mulai Studi Kasus"}
                </button>
                {selectedNode.data.status !== "completed" && <p className="text-sm text-on-variant">Ubah status node menjadi Completed untuk mengaktifkan test.</p>}
              </div>
            )}
          </div>
        </aside>
      )}

      {selectedEdgeId && !selectedNode && (
        <aside className="z-30 flex w-full sm:w-[420px] shrink-0 flex-col border-l border-outline-variant bg-white shadow-ambient fixed inset-y-0 right-0 sm:relative">
          <div className="flex items-start justify-between border-b border-outline-variant p-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-primary">
                <GitBranch size={15} /> Dependency Detail
              </div>
              <h3 className="text-xl font-bold">Koneksi Prasyarat</h3>
            </div>
            <button onClick={() => setSelectedEdgeId(null)} className="rounded-lg p-2 hover:bg-surface-low">
              <X size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-5 space-y-4">
            <div className="rounded-xl border border-outline-variant bg-surface-low p-4">
              <p className="text-sm leading-6 text-on-variant">
                Hubungan ini menandakan bahwa topik asal harus diselesaikan terlebih dahulu sebelum topik tujuan dapat diakses (unlocked).
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Topik Asal</div>
              <div className="text-sm font-semibold">
                {nodes.find(n => n.id === edges.find(e => e.id === selectedEdgeId)?.source)?.data.title ?? "Unknown Node"}
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-on-variant mt-3">Topik Tujuan</div>
              <div className="text-sm font-semibold">
                {nodes.find(n => n.id === edges.find(e => e.id === selectedEdgeId)?.target)?.data.title ?? "Unknown Node"}
              </div>
            </div>
            <button
              onClick={deleteSelectedEdge}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
            >
              <Trash2 size={16} /> Lepas Koneksi
            </button>
          </div>
        </aside>
      )}

      {roadmapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-6">
          <section className="w-full max-w-lg rounded-2xl border border-outline-variant bg-white p-6 shadow-ambient">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 font-geist text-xs font-bold uppercase tracking-[0.08em] text-primary">
                  <GitBranch size={15} /> Roadmap Baru
                </div>
                <h3 className="text-xl font-bold">Buat Learning Roadmap</h3>
                <p className="mt-1 text-sm text-on-variant">Mulai dari satu workspace kosong, lalu isi node manual atau generate dengan AI.</p>
              </div>
              <button onClick={() => setRoadmapModalOpen(false)} className="rounded-lg p-2 hover:bg-surface-low">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="font-geist text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Judul roadmap</span>
                <input
                  value={roadmapTitle}
                  onChange={(event) => setRoadmapTitle(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addRoadmap()}
                  className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20"
                  placeholder="Backend Node.js Mastery"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="font-geist text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Deskripsi opsional</span>
                <textarea
                  value={roadmapDescription}
                  onChange={(event) => setRoadmapDescription(event.target.value)}
                  className="mt-2 min-h-24 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20"
                  placeholder="Tujuan, batasan, atau konteks belajar..."
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setRoadmapModalOpen(false)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">
                Batal
              </button>
              <button
                onClick={addRoadmap}
                disabled={!roadmapTitle.trim()}
                className="rounded-lg bg-primary-container px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Buat Roadmap
              </button>
            </div>
          </section>
        </div>
      )}

      {deleteRoadmapId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-6">
          <section className="w-full max-w-md rounded-2xl border border-outline-variant bg-white p-6 shadow-ambient">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-xl font-bold">Hapus Roadmap?</h3>
                <p className="mt-1 text-sm leading-6 text-on-variant">
                  Roadmap "{roadmaps.find((roadmap) => roadmap.id === deleteRoadmapId)?.title}" beserta node dan dependency-nya akan dihapus.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteRoadmapId(null)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">
                Batal
              </button>
              <button type="button" onClick={deleteRoadmap} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white">
                Hapus
              </button>
            </div>
          </section>
        </div>
      )}

      {nodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-6">
          <section className="w-full max-w-lg rounded-2xl border border-outline-variant bg-white p-6 shadow-ambient">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 font-geist text-xs font-bold uppercase tracking-[0.08em] text-primary">
                  <Plus size={15} /> Add Node
                </div>
                <h3 className="text-xl font-bold">Tambah Topik Manual</h3>
                <p className="mt-1 text-sm text-on-variant">Node akan muncul di canvas dan bisa langsung kamu drag atau hubungkan.</p>
              </div>
              <button onClick={() => setNodeModalOpen(false)} className="rounded-lg p-2 hover:bg-surface-low">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="font-geist text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Topik node</span>
                <input
                  value={nodeTitle}
                  onChange={(event) => setNodeTitle(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addManualNode()}
                  className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20"
                  placeholder="Async/Await"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="font-geist text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Deskripsi singkat</span>
                <textarea
                  value={nodeDescription}
                  onChange={(event) => setNodeDescription(event.target.value)}
                  className="mt-2 min-h-20 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20"
                  placeholder="Konsep yang perlu dipahami di node ini..."
                />
              </label>
              <label className="block">
                <span className="font-geist text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Daftar Task (Opsional, satu per baris)</span>
                <textarea
                  value={nodeTasksText}
                  onChange={(event) => setNodeTasksText(event.target.value)}
                  className="mt-2 min-h-24 w-full resize-none rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-container/20"
                  placeholder="Contoh:&#10;Pelajari konsep dasar&#10;Buat latihan mini project&#10;Review pemahaman teori"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setNodeModalOpen(false)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">
                Batal
              </button>
              <button onClick={addManualNode} disabled={!nodeTitle.trim()} className="rounded-lg bg-primary-container px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                Tambah Node
              </button>
            </div>
          </section>
        </div>
      )}

      {draftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 sm:p-6">
          <section className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-ambient">
            <div className="border-b border-outline-variant p-5 pb-4">
              <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">AI Generate Path</h3>
                <p className="text-sm text-on-variant">Groq AI akan menyusun draft node dan dependency sesuai goal belajar kamu.</p>
              </div>
              <button type="button" onClick={() => setDraftOpen(false)} className="rounded-lg p-2 hover:bg-surface-low"><X size={18} /></button>
              </div>
              <textarea value={goal} onChange={(event) => setGoal(event.target.value)} className="mt-4 min-h-24 w-full resize-none rounded-lg border border-outline-variant p-3 text-sm outline-none focus:ring-2 focus:ring-primary-container/20" placeholder="Contoh: Mau ngerti backend Node.js dari fundamental sampai production" />
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    void requestDraft();
                  }}
                  disabled={draftLoading || !goal.trim()}
                  className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <Sparkles size={16} /> {draftLoading ? "Generating..." : "Generate Preview"}
                </button>
                {draftNodes.length > 0 && (
                  <span className="font-geist text-xs font-semibold uppercase tracking-[0.08em] text-on-variant">
                    {draftNodes.length} nodes
                  </span>
                )}
              </div>
              {draftError && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{draftError}</div>}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!draftNodes.length && (
                <div className="rounded-xl border border-dashed border-outline-variant bg-surface-low p-4 text-sm leading-6 text-on-variant">
                  Tulis goal belajar lalu klik Generate Preview untuk melihat draft node.
                </div>
              )}
              <div className="space-y-2">
                {draftNodes.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-[32px_1fr] gap-3 rounded-xl border border-outline-variant bg-white p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container/10 text-primary">
                      <GitBranch size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-semibold leading-6">{index + 1}. {item.title}</span>
                        {item.dependencies.length > 0 && (
                          <span className="shrink-0 rounded-full bg-surface-low px-2 py-1 font-geist text-[10px] font-semibold uppercase tracking-[0.08em] text-on-variant">
                            {item.dependencies.length} deps
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-on-variant">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-outline-variant bg-white p-5">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                void confirmDraft();
              }}
              className="mt-5 w-full rounded-lg bg-primary-container px-4 py-3 text-sm font-bold text-white"
            >
              Confirm Draft ke Canvas
            </button>
            </div>
          </section>
        </div>
      )}

      {testOpen && selectedNode && (
        <div className="fixed inset-0 z-50 overflow-auto bg-slate-950/50 p-6">
          <section className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-ambient">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">Forge Case Study: {selectedNode.data.title}</h3>
                <p className="text-sm text-on-variant">
                  {evaluation ? `Skor: ${evaluation.score}/100 - ${evaluation.passed ? "Lulus" : "Belum lulus"}` : "Passing score 70%. Submit kode atau pseudocode dari studi kasus, lalu AI akan menilai kecocokan solusi."}
                </p>
                <p className={clsx("mt-1 text-xs font-semibold", forgeExpired(selectedNode) ? "text-red-600" : "text-on-variant")}>
                  Deadline: {formatForgeDeadline(selectedNode.data.forgeExpiresAt)}
                </p>
              </div>
              <button onClick={closeTestReview} className="rounded-lg p-2 hover:bg-surface-low"><X size={18} /></button>
            </div>

            {testLoading && !caseStudy && <div className="rounded-xl border border-outline-variant bg-surface-low p-4 text-sm text-on-variant">Sedang membuat studi kasus sesuai task node...</div>}
            {!testLoading && !caseStudy && <div className="rounded-xl border border-outline-variant bg-surface-low p-4 text-sm text-on-variant">Studi kasus belum tersedia. Tutup modal lalu mulai lagi.</div>}

            {caseStudy && (
              <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="space-y-4">
                  {forgeExpired(selectedNode) && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                      Case ini sudah expired karena melewati batas 24 jam. Tutup modal lalu mulai Forge lagi untuk membuat studi kasus baru.
                    </div>
                  )}
                  <div className="rounded-xl border border-outline-variant bg-surface-low p-4">
                    <h4 className="text-lg font-bold">{caseStudy.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-on-variant">{caseStudy.scenario}</p>
                  </div>
                  <div className="rounded-xl border border-outline-variant p-4">
                    <p className="mb-3 font-semibold">Requirement</p>
                    <ul className="space-y-2 text-sm leading-6 text-on-variant">
                      {caseStudy.requirements.map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={15} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {caseStudy.expectedOutput && (
                    <div className="rounded-xl border border-outline-variant p-4">
                      <p className="mb-2 font-semibold">Expected Output</p>
                      <p className="text-sm leading-6 text-on-variant">{caseStudy.expectedOutput}</p>
                    </div>
                  )}
                  <div className="rounded-xl border border-outline-variant p-4">
                    <p className="mb-3 font-semibold">Dinilai dari</p>
                    <ul className="space-y-2 text-sm leading-6 text-on-variant">
                      {caseStudy.evaluationCriteria.map((item) => (
                        <li key={item} className="flex gap-2">
                          <Circle className="mt-1 shrink-0 text-primary" size={14} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="font-geist text-xs font-bold uppercase tracking-[0.08em] text-on-variant">Submission kode / pseudocode</span>
                    <textarea
                      value={submission}
                      onChange={(event) => setSubmission(event.target.value)}
                      spellCheck={false}
                      className="mt-2 min-h-[320px] w-full resize-y rounded-xl border border-outline-variant bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none focus:ring-2 focus:ring-primary-container/30"
                      placeholder={`// Tempel kode JavaScript atau pseudocode kamu di sini\n// AI akan cek requirement, typo/syntax jelas, dan logika solusi`}
                    />
                  </label>

                  {evaluation && (
                    <div className={`rounded-xl border-2 p-4 ${evaluation.passed ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
                      <div className="flex items-start gap-3">
                        {evaluation.passed ? <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={22} /> : <AlertTriangle className="mt-1 shrink-0 text-red-500" size={22} />}
                        <div>
                          <p className="font-bold" style={{ color: evaluation.passed ? "#059669" : "#dc2626" }}>
                            {evaluation.passed ? "Lulus, bisa lanjut" : "Belum cocok untuk lanjut"} - {evaluation.score}/100
                          </p>
                          <p className="mt-1 text-sm leading-6 text-on-variant">{evaluation.feedback}</p>
                        </div>
                      </div>
                      {evaluation.issues.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold">Yang perlu diperbaiki</p>
                          <ul className="mt-2 space-y-1 text-sm leading-6 text-on-variant">
                            {evaluation.issues.map((issue) => <li key={issue}>- {issue}</li>)}
                          </ul>
                        </div>
                      )}
                      {evaluation.nextSteps.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold">Langkah berikutnya</p>
                          <ul className="mt-2 space-y-1 text-sm leading-6 text-on-variant">
                            {evaluation.nextSteps.map((step) => <li key={step}>- {step}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    {evaluation ? (
                      evaluation.passed ? (
                        <button disabled className="flex-1 rounded-lg bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-700">
                          Sudah Lulus
                        </button>
                      ) : (
                        <button onClick={() => void retryForgeTest()} disabled={testLoading} className="flex-1 rounded-lg bg-primary-container px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                          {testLoading ? "Membuat Case Baru..." : "Test Ulang"}
                        </button>
                      )
                    ) : (
                      <button onClick={() => void submitTest()} disabled={testLoading || !submission.trim() || forgeExpired(selectedNode)} className="flex-1 rounded-lg bg-primary-container px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                        {testLoading ? "Menilai Submission..." : "Submit untuk Dinilai"}
                      </button>
                    )}
                    <button onClick={closeTestReview} className="rounded-lg border border-outline-variant px-4 py-3 text-sm font-bold">
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
