"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  Brain,
  CalendarClock,
  CheckCircle2,
  Circle,
  GitBranch,
  LayoutGrid,
  Lock,
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

const statusMeta: Record<Status, { label: string; className: string; color: string; icon: typeof Circle }> = {
  not_started: { label: "NOT STARTED", className: "bg-surface-dim/20 text-on-surface-variant", color: "#94a3b8", icon: Circle },
  in_progress: { label: "IN PROGRESS", className: "bg-amber-100/50 text-amber-700", color: "#f59e0b", icon: Brain },
  completed: { label: "COMPLETED", className: "bg-emerald-100/50 text-emerald-700", color: "#10b981", icon: CheckCircle2 }
};

const makeEdge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  type: "smoothstep",
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#8127cf" },
  style: { stroke: "#8127cf", strokeWidth: 2, strokeDasharray: "8 8" }
});

function makeDefaultTasks(title: string, _description = ""): TaskItem[] {
  void _description;
  return [
    { id: crypto.randomUUID(), title: `Pelajari konsep inti ${title}`, completed: false },
    { id: crypto.randomUUID(), title: "Buat catatan ringkas dari materi utama", completed: false },
    { id: crypto.randomUUID(), title: "Cari dan pelajari contoh atau studi kasus", completed: false },
    { id: crypto.randomUUID(), title: "Selesaikan latihan praktis untuk validasi", completed: false },
    { id: crypto.randomUUID(), title: "Review ulang poin-poin yang masih membingungkan", completed: false }
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

function applyLocks(nodes: SkillNode[], edges: Edge[]) {
  return nodes.map((node) => {
    const prerequisites = edges.filter((edge) => edge.target === node.id).map((edge) => nodes.find((item) => item.id === edge.source));
    const locked = prerequisites.some((item) => !item || item.data.status !== "completed" || !item.data.forgePassed);
    return { ...node, data: { ...node.data, locked } };
  });
}

const DeadlineNowContext = createContext(Date.now());

function SkillCard({ data, selected }: NodeProps<SkillNode>) {
  const now = useContext(DeadlineNowContext);
  const meta = statusMeta[data.status];
  const tasks = data.tasks ?? [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.completed).length;
  const nodeDone = data.status === "completed" && data.forgePassed;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : nodeDone ? 100 : 0;
  const urgentTasks = nodeDone ? 0 : tasks.filter((task) => taskReminder(task)?.tone === "danger").length;
  const deadline = nodeDeadlineStatus(tasks, nodeDone, now);

  return (
    <div
      className={clsx(
        "glass-card relative w-[320px] overflow-hidden rounded-[20px] p-6 transition-all duration-300",
        selected && "ring-2 ring-secondary ring-offset-4 ring-offset-transparent shadow-secondary-glow",
        data.locked && "opacity-60 grayscale-[0.5]"
      )}
    >
      <div className="node-accent" style={{ backgroundColor: meta.color }} />
      
      {/* Profile Indicator for In Progress nodes */}
      {data.status === "in_progress" && (
        <div className="absolute top-4 right-4 z-10 animate-bounce">
          <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-secondary shadow-lg">
             <Avatar size={40} />
          </div>
        </div>
      )}

      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-[3px] !border-white !bg-secondary !shadow-sm" />
      
      <div className="mb-4 flex items-center justify-between">
        <div className={clsx("rounded-full px-3 py-1 text-[10px] font-bold tracking-widest uppercase", meta.className)}>
          {data.locked ? "LOCKED" : meta.label}
        </div>
        {data.locked && <Lock size={14} className="text-on-surface-variant" />}
      </div>

      <h3 className="mb-2 line-clamp-2 text-xl font-extrabold leading-tight text-on-surface">
        {data.title}
      </h3>
      <p className="mb-6 line-clamp-2 text-sm font-medium leading-relaxed text-on-surface-variant">
        {data.description || "No description provided."}
      </p>

      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1">
             <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Progress</span>
             <span className="text-lg font-extrabold text-secondary leading-none">{progressPercent}%</span>
          </div>
          <div className="flex flex-col items-end gap-1">
             <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Status</span>
             <span className="text-[10px] font-extrabold text-on-surface">{data.forgePassed ? "FORGE PASSED" : "PENDING"}</span>
          </div>
        </div>
        
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
          <div 
            className="h-full rounded-full transition-all duration-700 ease-out" 
            style={{ width: `${progressPercent}%`, backgroundColor: meta.color }} 
          />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-surface-container-low/50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
              <SquareCheck size={14} className="text-secondary" /> {completedTasks}/{tasks.length}
            </div>
            {urgentTasks > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-error">
                <AlertTriangle size={14} /> {urgentTasks}
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold text-on-surface-variant opacity-60">ORDER {data.orderIndex}</span>
        </div>

        {deadline && (
          <div
            className={clsx(
              "flex items-center justify-between rounded-xl border px-3 py-2.5 text-[11px] font-bold transition-colors",
              deadline.tone === "overdue" && "border-error/20 bg-error/5 text-error",
              deadline.tone === "today" && "border-rose-300 bg-rose-50 text-rose-700",
              deadline.tone === "h1" && "border-orange-300 bg-orange-50 text-orange-700",
              deadline.tone === "h2" && "border-amber-300 bg-amber-50 text-amber-700",
              deadline.tone === "h3" && "border-yellow-300 bg-yellow-50 text-yellow-700",
              deadline.tone === "neutral" && "border-outline-variant bg-white/50 text-on-surface-variant",
              deadline.tone === "done" && "border-emerald-200 bg-emerald-50 text-emerald-700"
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock size={14} /> {deadline.dateLabel}
            </span>
            <span className="uppercase tracking-wider">{deadline.label}</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-[3px] !border-white !bg-secondary !shadow-sm" />
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
  const [deadlineNow, setDeadlineNow] = useState(Date.now());
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setDeadlineNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
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
    }, 900);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [nodes, edges, activeId, currentUserId, roadmaps.length]);

  const activeRoadmap = roadmaps.find((roadmap) => roadmap.id === activeId);
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedNodeTasks = selectedNode?.data.tasks ?? [];
  const progress = nodes.length ? Math.round((nodes.filter((node) => node.data.status === "completed").length / nodes.length) * 100) : 0;
  const roadmapProgress = useCallback((roadmap: Roadmap) => {
    const total = roadmap.nodes.length;
    if (!total) return 0;
    return Math.round((roadmap.nodes.filter((node) => node.data.status === "completed").length / total) * 100);
  }, []);
  const canvasTags = useMemo(() => {
    const source = nodes.length ? nodes : activeRoadmap?.nodes ?? [];
    const tags = source
      .slice(0, 6)
      .map((node) => node.data.title.split(/\s+/).find((word) => word.length > 3) ?? node.data.title)
      .map((word) => `#${word.toLowerCase().replace(/[^a-z0-9]/gi, "")}`)
      .filter((tag) => tag.length > 1);
    return tags.length ? tags : ["#foundry", "#learning", "#roadmap", "#mastery"];
  }, [activeRoadmap?.nodes, nodes]);

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
    <main className="foundry-canvas-bg relative flex h-screen overflow-hidden text-on-surface">
      <div className="pointer-events-none absolute inset-0 canvas-grid opacity-70" />
      <div className="pointer-events-none absolute -left-44 -top-44 hidden h-[520px] w-[520px] rounded-full bg-primary-fixed-dim/45 blur-[90px] sm:block" />
      <div className="pointer-events-none absolute -bottom-48 left-1/3 hidden h-[600px] w-[600px] rounded-full bg-tertiary-fixed/35 blur-[100px] sm:block" />
      <div className="pointer-events-none absolute -right-40 top-1/4 hidden h-[480px] w-[480px] rounded-full bg-secondary/12 blur-[90px] sm:block" />

      <aside className={clsx("foundry-glass fixed inset-x-3 bottom-24 z-40 mx-auto flex max-h-[72vh] w-[min(980px,calc(100vw-24px))] shrink-0 flex-col rounded-[32px] px-4 py-5 transition-all duration-300 sm:bottom-28 sm:px-5", sidebarOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0")}>
        <div className="mb-5 flex items-center justify-between gap-4 px-2">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLogo size={52} />
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight text-on-surface">Foundry</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Learning Path Builder</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-on-surface-variant transition hover:bg-black hover:text-white">
            <X size={18} />
          </button>
        </div>
        
        <div className="mb-5 px-2">
          <button onClick={() => setRoadmapModalOpen(true)} className="foundry-action w-full py-3 text-sm sm:w-auto sm:px-6">
            <Plus size={18} /> Roadmap Baru
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          <span>My Roadmaps</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/10 text-secondary">{roadmaps.length}</span>
        </div>

        <nav className="custom-scrollbar grid flex-1 gap-3 overflow-auto px-1 sm:grid-cols-2 lg:grid-cols-3">
          {roadmaps.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-outline-variant bg-white/40 p-5 text-center">
               <p className="text-xs font-medium leading-relaxed text-on-surface-variant">Belum ada roadmap. Mulai perjalananmu sekarang.</p>
            </div>
          )}
          {roadmaps.map((roadmap) => {
            const percent = roadmapProgress(roadmap);
            const completedTasks = roadmap.nodes.reduce((total, node) => total + (node.data.tasks ?? []).filter((task) => task.completed).length, 0);
            const totalTasks = roadmap.nodes.reduce((total, node) => total + (node.data.tasks ?? []).length, 0);
            return (
              <div
                key={roadmap.id}
                className={clsx("group relative overflow-hidden rounded-[24px] border p-4 transition-all", roadmap.id === activeId ? "border-secondary/30 bg-white/80 shadow-secondary-glow" : "border-white/50 bg-white/45 hover:-translate-y-0.5 hover:bg-white/75")}
              >
                {roadmap.id === activeId && <div className="absolute left-0 top-0 h-full w-1.5 bg-secondary" />}
                
                {renameRoadmapId === roadmap.id ? (
                  <input
                    autoFocus
                    value={renameRoadmapTitle}
                    onChange={(e) => setRenameRoadmapTitle(e.target.value)}
                    onBlur={confirmRename}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setRenameRoadmapId(null); }}
                    className="min-w-0 flex-1 rounded-xl border border-secondary/30 bg-white px-3 py-2 text-sm font-bold text-on-surface outline-none ring-4 ring-secondary/10"
                  />
                ) : (
                  <button onClick={() => { selectRoadmap(roadmap.id); setSidebarOpen(false); }} className="min-w-0 flex-1 text-left">
                    <div className="truncate pr-16 text-base font-black text-on-surface">{roadmap.title}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{new Date(roadmap.updatedAt).toLocaleDateString("id-ID")}</div>
                    <div className="mt-4 flex items-end justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Progress</span>
                      <span className="text-xl font-black text-secondary">{percent}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-highest">
                      <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${percent}%` }} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      <span>{roadmap.nodes.length} nodes</span>
                      <span>•</span>
                      <span>{completedTasks}/{totalTasks} tasks</span>
                    </div>
                  </button>
                )}
                
                <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => startRename(roadmap.id, roadmap.title)} className="rounded-full bg-white/70 p-1.5 text-on-surface-variant hover:text-secondary">
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => setDeleteRoadmapId(roadmap.id)} className="rounded-full bg-white/70 p-1.5 text-on-surface-variant hover:text-error">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </nav>

      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-primary-container/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

      <section className="relative flex min-w-0 flex-1 flex-col transition-all duration-500">
        <div className="pointer-events-none absolute inset-0" />
        
        {canvasTags.slice(0, 6).map((tag, index) => (
          <div
            key={`${tag}-${index}`}
            className={clsx("pointer-events-none fixed hidden rounded-full border border-white/30 bg-white/25 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-secondary/35 backdrop-blur-md sm:block", index % 2 === 0 && "animate-float")}
            style={{
              top: ["16%", "42%", "72%", "24%", "62%", "82%"][index],
              left: ["28%", "12%", "45%", "76%", "66%", "22%"][index],
              animationDelay: `${index * 0.5}s`
            }}
          >
            {tag}
          </div>
        ))}

        <header className="pointer-events-none fixed left-0 right-0 top-4 z-20 flex justify-center px-3 sm:top-6">
          <div className="foundry-pill pointer-events-auto flex w-full max-w-[760px] items-center justify-between gap-3 px-4 py-3 sm:w-auto sm:min-w-[620px] sm:px-6">
            <button onClick={() => setSidebarOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white shadow-secondary-glow" aria-label="Open roadmaps">
              <GitBranch size={19} />
            </button>
            <div className="min-w-0 flex-1 sm:min-w-[220px]">
              <h2 className="truncate text-sm font-black tracking-tight text-on-surface sm:text-base">{activeRoadmap?.title ?? "Foundry Canvas"}</h2>
              <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-widest text-on-surface-variant">{activeRoadmap ? `${progress}% progress - synced` : "Pilih roadmap untuk mulai"}</p>
            </div>
            {activeRoadmap && (
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => setDraftOpen(true)} className="foundry-action hidden sm:inline-flex">
                  <Sparkles size={16} /> AI Generate
                </button>
                <button onClick={() => setNodeModalOpen(true)} className="foundry-ghost-action h-11 w-11 rounded-full p-0" aria-label="Add Node">
                  <Plus size={20} />
                </button>
                <button onClick={autoLayout} className="foundry-ghost-action hidden h-11 w-11 rounded-full p-0 sm:inline-flex" aria-label="Auto Layout">
                  <LayoutGrid size={18} />
                </button>
              </div>
            )}
          </div>
        </header>

        {activeRoadmap && (
          <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-20 flex justify-center px-4 sm:bottom-6">
            <div className="foundry-pill pointer-events-auto flex items-center gap-2 px-3 py-3">
              <button onClick={() => setSidebarOpen(true)} className="foundry-action">
                <GitBranch size={16} /> My Roadmaps
              </button>
              <button onClick={() => setDraftOpen(true)} className="foundry-ghost-action sm:hidden">
                <Sparkles size={16} /> AI
              </button>
              <button onClick={() => router.push("/settings")} className="foundry-ghost-action max-w-[190px] px-2 py-1.5">
                <Avatar size={28} />
                <span className="hidden max-w-[110px] truncate sm:inline">{profileName || "User"}</span>
                <Settings size={15} />
              </button>
            </div>
          </div>
        )}

        <div className="relative min-h-0 flex-1 pt-20">
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
          <DeadlineNowContext.Provider value={deadlineNow}>
            <ReactFlow
              className="foundry-flow"
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onlyRenderVisibleElements
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
              <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="#d9cfe0" />
              <MiniMap nodeStrokeColor="#7C3AED" nodeColor="#F2F3FF" maskColor="rgba(248, 247, 255, .65)" />
              <Controls />
            </ReactFlow>
          </DeadlineNowContext.Provider>
        </div>
      </section>

      {selectedNode && (
        <aside className="glass-card z-30 flex w-full sm:w-[420px] shrink-0 flex-col rounded-l-[32px] border-r-0 fixed inset-y-0 right-0 sm:relative shadow-2xl">
          <div className="flex items-start justify-between p-8">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary">
                <PanelRight size={14} /> Node Explorer
              </div>
              <h3 className="truncate text-2xl font-black tracking-tight text-on-surface">{selectedNode.data.title}</h3>
            </div>
            <button onClick={() => setSelectedNodeId(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-all hover:bg-secondary hover:text-white">
              <X size={20} />
            </button>
          </div>
          
          <div className="mx-8 mb-6 grid grid-cols-4 gap-1 rounded-full bg-surface-container-low p-1.5">
            {(["overview", "tasks", "chat", "forge"] as Tab[]).map((item) => (
              <button key={item} onClick={() => setTab(item)} className={clsx("rounded-full py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all", tab === item ? "bg-secondary text-white shadow-lg shadow-secondary/20" : "text-on-surface-variant hover:bg-white/50")}>
                {item}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-8 pb-8 custom-scrollbar">
            {tab === "overview" && (
              <div className="space-y-6">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Node Status</span>
                  <select
                    value={selectedNode.data.status}
                    onChange={(event) => updateNodeData(selectedNode.id, { status: event.target.value as Status, forgePassed: event.target.value === "completed" ? selectedNode.data.forgePassed : false })}
                    className="mt-2 w-full rounded-xl border border-outline-variant bg-white/50 px-4 py-3 text-sm font-medium outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Topik Utama</span>
                  <input value={selectedNode.data.title} onChange={(event) => updateNodeData(selectedNode.id, { title: event.target.value })} className="mt-2 w-full rounded-xl border border-outline-variant bg-white/50 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Deskripsi Singkat</span>
                  <textarea value={selectedNode.data.description} onChange={(event) => updateNodeData(selectedNode.id, { description: event.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-outline-variant bg-white/50 px-4 py-3 text-sm font-medium outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10 resize-none" />
                </label>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Catatan Personal</span>
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Tulis insight atau materi penting di sini..."
                    onBlur={(event) => updateNodeData(selectedNode.id, { notes: event.currentTarget.innerHTML })}
                    className="content-editable mt-2 min-h-[200px] rounded-2xl border border-outline-variant bg-white px-4 py-4 text-sm leading-relaxed outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10"
                    dangerouslySetInnerHTML={{ __html: selectedNode.data.notes }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button onClick={deleteSelected} className="flex h-12 items-center justify-center gap-2 rounded-full border border-error/20 bg-error/5 text-sm font-bold text-error transition-all hover:bg-error/10">
                    <Trash2 size={18} /> Delete Node
                  </button>
                  <button className="flex h-12 items-center justify-center gap-2 rounded-full bg-secondary text-sm font-bold text-white shadow-secondary-glow hover:bg-secondary/90">
                    <Save size={18} /> Simpan
                  </button>
                </div>
              </div>
            )}

            {tab === "tasks" && (
              <div className="space-y-6">
                <div className="rounded-[20px] border border-secondary/10 bg-secondary/5 p-6 backdrop-blur-sm shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-sm font-black text-secondary uppercase tracking-tight">
                    <SquareCheck size={20} /> Task Checklist
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-on-surface-variant opacity-80">
                    Selesaikan semua tugas di bawah untuk membuka kunci Forge Test. Fokus pada kualitas pemahaman.
                  </p>
                </div>

                <div className="space-y-3">
                  {selectedNodeTasks.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-outline-variant p-8 text-center">
                       <p className="text-xs font-bold text-on-surface-variant opacity-40 uppercase tracking-widest">Belum ada task aktif</p>
                    </div>
                  )}
                  {selectedNodeTasks.map((task) => {
                    const reminder = taskReminder(task);
                    return (
                      <div key={task.id} className={clsx("rounded-2xl border p-4 transition-all", reminder?.tone === "danger" ? "border-error/20 bg-error/5 shadow-ambient" : reminder?.tone === "warning" ? "border-amber-200 bg-amber-50/50" : "border-outline-variant bg-white/50 hover:bg-white")}>
                        <div className="flex items-start gap-4">
                          <input
                            checked={task.completed}
                            onChange={(event) => patchTask(task.id, { completed: event.target.checked })}
                            type="checkbox"
                            className="mt-1 h-5 w-5 rounded-full border-outline-variant text-secondary focus:ring-secondary/20 transition-all cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={clsx("text-sm font-bold leading-relaxed", task.completed ? "text-on-surface-variant/40 line-through" : "text-on-surface")}>{task.title}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <label className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white px-3 py-1.5 text-[10px] font-bold text-on-surface-variant">
                                <CalendarClock size={14} className="text-secondary" />
                                <input
                                  value={task.dueDate ?? ""}
                                  onChange={(event) => patchTask(task.id, { dueDate: event.target.value || undefined })}
                                  type="date"
                                  className="border-0 bg-transparent p-0 text-[10px] font-bold outline-none focus:ring-0 uppercase"
                                />
                              </label>
                              {reminder && (
                                <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider", reminder.tone === "danger" ? "bg-error/10 text-error" : "bg-amber-100 text-amber-700")}>
                                  <AlertTriangle size={12} /> {reminder.label}
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={() => deleteTask(task.id)} className="rounded-full p-2 text-on-surface-variant opacity-40 transition-all hover:bg-error/10 hover:text-error hover:opacity-100">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-[20px] border border-outline-variant bg-white/30 p-6 backdrop-blur-sm shadow-sm">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Task Baru</span>
                    <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-outline-variant bg-white/50 px-4 py-3 text-sm font-medium outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10" placeholder="Apa yang harus dikerjakan?" />
                  </label>
                  <label className="mt-4 block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Target Selesai</span>
                    <input value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} type="date" className="mt-2 w-full rounded-xl border border-outline-variant bg-white/50 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10 uppercase" />
                  </label>
                  <div className="mt-6 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-secondary">{selectedNodeTasks.length}/{maxTasksPerNode} tasks</span>
                    <button onClick={addTask} disabled={!taskTitle.trim() || selectedNodeTasks.length >= maxTasksPerNode} className="flex h-10 items-center justify-center rounded-full bg-secondary px-6 text-xs font-black uppercase tracking-widest text-white shadow-secondary-glow disabled:cursor-not-allowed disabled:bg-surface-dim disabled:text-on-surface-variant disabled:shadow-none">
                      Tambah Task
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "chat" && (
              <div className="flex h-full min-h-[520px] flex-col space-y-4">
                <div className="flex-1 space-y-4 overflow-auto rounded-[24px] bg-surface-container-low/50 p-4 shadow-inner custom-scrollbar">
                  {selectedNode.data.messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                       <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                          <Sparkles size={32} />
                       </div>
                       <p className="max-w-[200px] text-xs font-bold leading-relaxed text-on-surface-variant opacity-60 uppercase tracking-widest">Tanya AI Companion untuk memperdalam pemahamanmu.</p>
                    </div>
                  )}
                  {selectedNode.data.messages.map((message) => (
                    <div key={message.id} className={clsx("rounded-2xl p-4 text-sm leading-relaxed shadow-ambient", message.role === "user" ? "ml-8 bg-secondary text-white font-bold" : "mr-8 border border-white/40 bg-white/80 backdrop-blur-sm font-medium text-on-surface")}>
                      {message.role === "assistant" ? renderMessageContent(message.content) : message.content}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") sendChat(); }}
                    placeholder="Tanya sesuatu..."
                    className="flex-1 rounded-full border border-outline-variant bg-white px-6 py-4 text-sm font-medium outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10 shadow-sm"
                  />
                  <button onClick={sendChat} disabled={!chatInput.trim()} className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-white shadow-secondary-glow transition-all hover:bg-secondary/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-dim disabled:shadow-none">
                    <Send size={20} />
                  </button>
                </div>
                <button onClick={() => updateNodeData(selectedNode.id, { messages: [] })} className="flex h-10 items-center justify-center gap-2 rounded-full border border-outline-variant bg-white/50 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:bg-white hover:text-secondary transition-all">
                  <RefreshCcw size={14} /> Reset Chat History
                </button>
              </div>
            )}

            {tab === "forge" && (
              <div className="space-y-6">
                <div className="rounded-[24px] border border-secondary/10 bg-secondary/5 p-6 backdrop-blur-sm shadow-sm">
                  <div className="mb-3 flex items-center gap-3 text-sm font-black text-on-surface uppercase tracking-tight">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-ambient">
                       {selectedNode.data.forgePassed ? <Unlock className="text-emerald-600" size={20} /> : <Lock className="text-secondary" size={20} />}
                    </div>
                    Forge Test Gateway
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-on-surface-variant opacity-80">
                    Studi kasus adaptif untuk memverifikasi penguasaan materi sebelum membuka node prasyarat berikutnya.
                  </p>
                  <div className={clsx("mt-4 rounded-xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest", forgeExpired(selectedNode) ? "border-error/20 bg-error/5 text-error" : "border-outline-variant bg-white/80 text-on-surface-variant shadow-sm")}>
                    {selectedNode.data.forgeCaseStudy && forgeCaseLooksValid(selectedNode)
                      ? `DEADLINE: ${formatForgeDeadline(selectedNode.data.forgeExpiresAt)}`
                      : "SIAP UNTUK DIGENERATE"}
                  </div>
                </div>

                {selectedNode.data.feedback && (
                  <div className="rounded-[24px] border border-white bg-white/80 p-6 shadow-ambient">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60 mb-3">AI Evaluation Feedback</p>
                    <div className="text-sm font-medium leading-relaxed text-on-surface">{selectedNode.data.feedback}</div>
                  </div>
                )}

                <div className="space-y-3">
                   <button
                    disabled={selectedNode.data.status !== "completed"}
                    onClick={() => void startForgeTest()}
                    className="flex w-full h-14 items-center justify-center rounded-full bg-secondary text-sm font-black uppercase tracking-widest text-white shadow-secondary-glow transition-all hover:bg-secondary/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-dim disabled:text-on-surface-variant disabled:shadow-none"
                  >
                    {testLoading ? "Generating..." : selectedNode.data.forgeCaseStudy && !forgeExpired(selectedNode) && forgeCaseLooksValid(selectedNode) ? "Lanjutkan Studi Kasus" : "Mulai Forge Test"}
                  </button>
                  {selectedNode.data.status !== "completed" && (
                    <p className="text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60 px-4">
                      Selesaikan semua task untuk mengaktifkan Forge.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {selectedEdgeId && !selectedNode && (
        <aside className="glass-card z-30 flex w-full sm:w-[420px] shrink-0 flex-col rounded-l-[32px] border-r-0 fixed inset-y-0 right-0 sm:relative shadow-2xl">
          <div className="flex items-start justify-between p-8">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary">
                <GitBranch size={14} /> Connection Info
              </div>
              <h3 className="truncate text-2xl font-black tracking-tight text-on-surface">Koneksi Prasyarat</h3>
            </div>
            <button onClick={() => setSelectedEdgeId(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-all hover:bg-secondary hover:text-white">
              <X size={20} />
            </button>
          </div>
          
          <div className="min-h-0 flex-1 overflow-auto px-8 pb-8 space-y-6">
            <div className="rounded-[24px] border border-secondary/10 bg-secondary/5 p-6 backdrop-blur-sm shadow-sm">
              <p className="text-xs font-medium leading-relaxed text-on-surface-variant opacity-80">
                Alur ini memastikan pemahaman terstruktur. Node tujuan tetap terkunci hingga node asal dinyatakan selesai dan lulus Forge Test.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="rounded-2xl border border-outline-variant bg-white/50 p-6 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60 block mb-2">Node Prasyarat</span>
                <div className="text-lg font-black tracking-tight text-on-surface">
                  {nodes.find(n => n.id === edges.find(e => e.id === selectedEdgeId)?.source)?.data.title ?? "Unknown Node"}
                </div>
              </div>
              
              <div className="flex justify-center">
                 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                    <Sparkles size={20} />
                 </div>
              </div>

              <div className="rounded-2xl border border-outline-variant bg-white/50 p-6 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60 block mb-2">Node Terkunci</span>
                <div className="text-lg font-black tracking-tight text-on-surface">
                  {nodes.find(n => n.id === edges.find(e => e.id === selectedEdgeId)?.target)?.data.title ?? "Unknown Node"}
                </div>
              </div>
            </div>

            <button
              onClick={deleteSelectedEdge}
              className="flex w-full h-14 items-center justify-center gap-3 rounded-full border border-error/20 bg-error/5 text-sm font-black uppercase tracking-widest text-error transition-all hover:bg-error/10 active:scale-95"
            >
              <Trash2 size={18} /> Putus Koneksi
            </button>
          </div>
        </aside>
      )}

      {roadmapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-container/40 p-4 sm:p-6 backdrop-blur-sm">
          <section className="glass-card w-full max-w-md rounded-[28px] p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                  <Plus size={24} />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-on-surface">Buat Roadmap Baru</h3>
                <p className="text-sm font-medium text-on-surface-variant opacity-80">Rancang jalur belajar barumu dengan struktur yang jelas.</p>
              </div>
              <button onClick={() => setRoadmapModalOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant hover:bg-secondary hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Judul Roadmap</span>
                <input
                  value={roadmapTitle}
                  onChange={(event) => setRoadmapTitle(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && roadmapTitle.trim() && addRoadmap()}
                  className="mt-2 w-full rounded-2xl border border-outline-variant bg-white/50 px-5 py-4 text-sm font-bold outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10"
                  placeholder="Misal: Belajar Bahasa Jepang"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Deskripsi (Opsional)</span>
                <textarea
                  value={roadmapDescription}
                  onChange={(event) => setRoadmapDescription(event.target.value)}
                  className="mt-2 min-h-24 w-full rounded-2xl border border-outline-variant bg-white/50 px-5 py-4 text-sm font-medium outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10 resize-none"
                  placeholder="Tujuan, batasan, atau konteks belajar..."
                />
              </label>
            </div>
            <div className="mt-7 flex gap-3">
              <button onClick={() => setRoadmapModalOpen(false)} className="h-12 flex-1 rounded-full border border-outline-variant px-6 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-all">
                Batal
              </button>
              <button
                onClick={addRoadmap}
                disabled={!roadmapTitle.trim()}
                className="h-12 flex-1 rounded-full bg-secondary px-6 text-sm font-black uppercase tracking-widest text-white shadow-secondary-glow transition-all hover:bg-secondary/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-dim disabled:text-on-surface-variant disabled:shadow-none"
              >
                Buat Sekarang
              </button>
            </div>
          </section>
        </div>
      )}

      {deleteRoadmapId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-error-container/40 p-4 sm:p-6 backdrop-blur-sm">
          <section className="glass-card w-full max-w-sm rounded-[28px] p-6 text-center shadow-2xl">
            <div className="mb-6 flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-on-surface">Hapus Roadmap?</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-on-surface-variant">
                Roadmap <strong className="text-on-surface">&quot;{roadmaps.find((r) => r.id === deleteRoadmapId)?.title}&quot;</strong> akan dihapus permanen beserta seluruh node didalamnya.
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteRoadmapId(null)} className="h-12 flex-1 rounded-full border border-outline-variant px-6 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-all">
                Batal
              </button>
              <button type="button" onClick={deleteRoadmap} className="h-12 flex-1 rounded-full bg-error px-6 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-error/20 hover:bg-error/90 active:scale-95">
                Ya, Hapus
              </button>
            </div>
          </section>
        </div>
      )}

      {nodeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary-container/40 p-4 sm:p-6 backdrop-blur-sm">
          <section className="glass-card w-full max-w-md rounded-[28px] p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                  <Plus size={24} />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-on-surface">Tambah Topik Manual</h3>
                <p className="text-sm font-medium text-on-surface-variant opacity-80">Node akan muncul di canvas, siap untuk dihubungkan.</p>
              </div>
              <button onClick={() => setNodeModalOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant hover:bg-secondary hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Topik Node</span>
                <input
                  value={nodeTitle}
                  onChange={(event) => setNodeTitle(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addManualNode()}
                  className="mt-2 w-full rounded-2xl border border-outline-variant bg-white/50 px-5 py-4 text-sm font-bold outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10"
                  placeholder="Misal: State Management"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Deskripsi Singkat</span>
                <textarea
                  value={nodeDescription}
                  onChange={(event) => setNodeDescription(event.target.value)}
                  className="mt-2 min-h-20 w-full rounded-2xl border border-outline-variant bg-white/50 px-5 py-4 text-sm font-medium outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10 resize-none"
                  placeholder="Konsep utama yang perlu dipahami..."
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Daftar Task (Opsional, satu per baris)</span>
                <textarea
                  value={nodeTasksText}
                  onChange={(event) => setNodeTasksText(event.target.value)}
                  className="mt-2 min-h-32 w-full rounded-2xl border border-outline-variant bg-white/50 px-5 py-4 text-sm font-medium outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10 resize-none"
                  placeholder="Contoh:&#10;Pelajari konsep dasar&#10;Buat latihan mini project&#10;Review pemahaman teori"
                />
              </label>
            </div>
            <div className="mt-10 flex gap-3">
              <button onClick={() => setNodeModalOpen(false)} className="h-12 flex-1 rounded-full border border-outline-variant px-6 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-all">
                Batal
              </button>
              <button onClick={addManualNode} disabled={!nodeTitle.trim()} className="h-12 flex-1 rounded-full bg-secondary px-6 text-sm font-black uppercase tracking-widest text-white shadow-secondary-glow transition-all hover:bg-secondary/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-dim disabled:text-on-surface-variant disabled:shadow-none">
                Tambah Node
              </button>
            </div>
          </section>
        </div>
      )}

      {draftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-container/40 p-3 sm:p-6 backdrop-blur-sm">
          <section className="glass-card flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] shadow-2xl">
            <div className="border-b border-outline-variant/50 bg-white/50 p-4 sm:p-5 backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                   <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                      <Sparkles size={20} />
                   </div>
                   <h3 className="text-xl font-black tracking-tight text-on-surface">AI Generate Path</h3>
                   <p className="text-xs font-medium text-on-surface-variant opacity-80">Groq AI akan merancang roadmap belajar berdasarkan goal kamu.</p>
                </div>
                <button type="button" onClick={() => setDraftOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant hover:bg-secondary hover:text-white transition-all"><X size={20} /></button>
              </div>
              
              <div className="mt-4">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60 ml-2 block mb-2">Apa Goal Belajarmu?</span>
                 <textarea value={goal} onChange={(event) => setGoal(event.target.value)} className="min-h-[76px] w-full resize-none rounded-[18px] border border-secondary/20 bg-white px-4 py-3 text-sm font-medium outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10 shadow-sm" placeholder="Contoh: Saya ingin belajar machine learning dari nol." />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    void requestDraft();
                  }}
                  disabled={draftLoading || !goal.trim()}
                  className="flex h-10 items-center gap-2 rounded-full border border-secondary/30 bg-secondary/5 px-5 text-xs font-black uppercase tracking-widest text-secondary transition-all hover:bg-secondary/10 active:scale-95 disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-surface-dim disabled:text-on-surface-variant"
                >
                  <Sparkles size={18} /> {draftLoading ? "Generating..." : "Generate Preview"}
                </button>
                {draftNodes.length > 0 && (
                  <span className="rounded-full bg-secondary px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                    {draftNodes.length} Nodes Generated
                  </span>
                )}
              </div>
              {draftError && <div className="mt-4 rounded-xl border border-error/20 bg-error/5 p-4 text-sm font-bold text-error">{draftError}</div>}
            </div>

            <div className="custom-scrollbar min-h-[220px] flex-1 overflow-y-auto bg-surface-container-lowest/40 px-4 py-4 sm:px-5">
              {!draftNodes.length && (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-outline-variant p-10 text-center">
                  <div className="mb-4 text-on-surface-variant opacity-40"><Sparkles size={32} /></div>
                  <p className="text-sm font-bold text-on-surface-variant opacity-60 uppercase tracking-widest">Tulis goal belajar lalu klik Generate Preview</p>
                </div>
              )}
              <div className="space-y-2.5">
                {draftNodes.map((item, index) => (
                  <div key={item.id} className="group flex gap-3 rounded-[18px] border border-outline-variant bg-white p-3 shadow-ambient transition-all hover:-translate-y-0.5 hover:border-secondary/30">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-black text-white shadow-sm">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                        <span className="text-sm font-black tracking-tight text-on-surface">{item.title}</span>
                        {item.dependencies.length > 0 && (
                          <span className="shrink-0 rounded-full border border-outline-variant bg-surface-container-low px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
                            {item.dependencies.length} Prasyarat
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium leading-5 text-on-surface-variant">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-outline-variant/50 bg-white/80 p-4 backdrop-blur-md">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  void confirmDraft();
                }}
                disabled={draftNodes.length === 0}
                className="flex h-12 w-full items-center justify-center rounded-full bg-secondary text-xs font-black uppercase tracking-widest text-white shadow-secondary-glow transition-all hover:bg-secondary/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-dim disabled:text-on-surface-variant disabled:shadow-none"
              >
                Confirm Draft ke Canvas
              </button>
            </div>
          </section>
        </div>

      )}

      {testOpen && selectedNode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-auto bg-primary-container/40 p-4 sm:p-6 backdrop-blur-sm">
          <section className="glass-card mx-auto w-full max-w-5xl rounded-[32px] p-8 shadow-2xl my-auto">
            <div className="mb-8 flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-black tracking-tight text-on-surface">Forge Gateway: {selectedNode.data.title}</h3>
                <p className="text-sm font-medium text-on-surface-variant opacity-80">
                  {evaluation ? `Skor: ${evaluation.score}/100 - ${evaluation.passed ? "Lulus" : "Belum lulus"}` : "Passing score 70%. Kirimkan jawaban/solusi Anda sesuai instruksi studi kasus di bawah."}
                </p>
                <div className={clsx("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest w-fit", forgeExpired(selectedNode) ? "bg-error/10 text-error" : "bg-secondary/10 text-secondary")}>
                  <CalendarClock size={14} /> Deadline: {formatForgeDeadline(selectedNode.data.forgeExpiresAt)}
                </div>
              </div>
              <button onClick={closeTestReview} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant hover:bg-secondary hover:text-white transition-all"><X size={20} /></button>
            </div>

            {testLoading && !caseStudy && (
              <div className="flex flex-col items-center justify-center rounded-[24px] border border-secondary/20 bg-white/50 p-12 text-center shadow-sm">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-secondary/30 border-t-secondary mb-4" />
                <p className="text-sm font-black uppercase tracking-widest text-secondary">Generating Case Study...</p>
              </div>
            )}
            
            {!testLoading && !caseStudy && (
              <div className="rounded-[24px] border border-dashed border-outline-variant bg-white/30 p-8 text-center">
                <p className="text-sm font-bold text-on-surface-variant opacity-60 uppercase tracking-widest">Studi kasus belum tersedia. Tutup modal lalu mulai lagi.</p>
              </div>
            )}

            {caseStudy && (
              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-6">
                  {forgeExpired(selectedNode) && (
                    <div className="rounded-[20px] border border-error/20 bg-error/5 p-6 text-sm font-bold leading-relaxed text-error shadow-sm">
                      Case ini sudah expired karena melewati batas 24 jam. Tutup modal lalu mulai Forge lagi untuk membuat studi kasus baru.
                    </div>
                  )}
                  
                  <div className="rounded-[24px] border border-secondary/10 bg-secondary/5 p-6 shadow-sm">
                    <h4 className="text-lg font-black tracking-tight text-secondary">{caseStudy.title}</h4>
                    <p className="mt-3 text-sm font-medium leading-relaxed text-on-surface-variant">{caseStudy.scenario}</p>
                  </div>
                  
                  <div className="rounded-[24px] border border-outline-variant/50 bg-white/50 p-6 shadow-sm">
                    <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Requirements</p>
                    <ul className="space-y-3 text-sm font-medium leading-relaxed text-on-surface">
                      {caseStudy.requirements.map((item) => (
                        <li key={item} className="flex gap-3">
                          <CheckCircle2 className="shrink-0 text-emerald-500" size={18} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {caseStudy.expectedOutput && (
                    <div className="rounded-[24px] border border-outline-variant/50 bg-white/50 p-6 shadow-sm">
                      <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Expected Output</p>
                      <p className="text-sm font-medium leading-relaxed text-on-surface">{caseStudy.expectedOutput}</p>
                    </div>
                  )}
                  
                  <div className="rounded-[24px] border border-outline-variant/50 bg-white/50 p-6 shadow-sm">
                    <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Evaluation Criteria</p>
                    <ul className="space-y-3 text-sm font-medium leading-relaxed text-on-surface">
                      {caseStudy.evaluationCriteria.map((item) => (
                        <li key={item} className="flex gap-3">
                          <div className="mt-1 h-2 w-2 rounded-full bg-secondary shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-6 flex flex-col h-full">
                  <label className="block flex-1 flex flex-col">
                    <span className="mb-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Jawaban / Solusi Studi Kasus</span>
                    <textarea
                      value={submission}
                      onChange={(event) => setSubmission(event.target.value)}
                      spellCheck={false}
                      className="flex-1 w-full resize-none rounded-[24px] border border-outline-variant bg-white/80 p-6 text-sm font-medium leading-relaxed text-on-surface outline-none transition-all focus:border-secondary focus:ring-4 focus:ring-secondary/10 shadow-inner custom-scrollbar"
                      placeholder={`Tulis atau tempel jawaban Anda di sini...\n(Bisa berupa penjelasan konsep, analisis studi kasus, kode program, atau format lain sesuai instruksi tugas)`}
                    />
                  </label>

                  {evaluation && (
                    <div className={`rounded-[24px] border-2 p-6 shadow-sm ${evaluation.passed ? "border-emerald-400 bg-emerald-50/80" : "border-error/30 bg-error/5"}`}>
                      <div className="flex items-start gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${evaluation.passed ? "bg-emerald-100 text-emerald-600" : "bg-error/10 text-error"}`}>
                           {evaluation.passed ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                        </div>
                        <div>
                          <p className={`text-lg font-black tracking-tight ${evaluation.passed ? "text-emerald-700" : "text-error"}`}>
                            {evaluation.passed ? "Lulus, Bisa Lanjut" : "Belum Memenuhi Syarat"} — {evaluation.score}/100
                          </p>
                          <p className="mt-2 text-sm font-medium leading-relaxed text-on-surface-variant">{evaluation.feedback}</p>
                        </div>
                      </div>
                      
                      {evaluation.issues.length > 0 && (
                        <div className="mt-6 border-t border-black/5 pt-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60 mb-3">Area Perbaikan</p>
                          <ul className="space-y-2 text-sm font-medium leading-relaxed text-on-surface">
                            {evaluation.issues.map((issue) => <li key={issue} className="flex gap-2"><div className="mt-2 h-1.5 w-1.5 rounded-full bg-error shrink-0" /><span>{issue}</span></li>)}
                          </ul>
                        </div>
                      )}
                      
                      {evaluation.nextSteps.length > 0 && (
                        <div className="mt-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60 mb-3">Langkah Berikutnya</p>
                          <ul className="space-y-2 text-sm font-medium leading-relaxed text-on-surface">
                            {evaluation.nextSteps.map((step) => <li key={step} className="flex gap-2"><div className="mt-2 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" /><span>{step}</span></li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 mt-auto pt-2">
                    {evaluation ? (
                      evaluation.passed ? (
                        <button disabled className="h-14 flex-1 rounded-full bg-emerald-100 px-6 text-sm font-black uppercase tracking-widest text-emerald-700 opacity-80 cursor-not-allowed">
                          Sudah Lulus
                        </button>
                      ) : (
                        <button onClick={() => void retryForgeTest()} disabled={testLoading} className="h-14 flex-1 rounded-full bg-secondary px-6 text-sm font-black uppercase tracking-widest text-white shadow-secondary-glow transition-all hover:bg-secondary/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-dim disabled:text-on-surface-variant disabled:shadow-none">
                          {testLoading ? "Membuat Case Baru..." : "Test Ulang"}
                        </button>
                      )
                    ) : (
                      <button onClick={() => void submitTest()} disabled={testLoading || !submission.trim() || forgeExpired(selectedNode)} className="h-14 flex-1 rounded-full bg-secondary px-6 text-sm font-black uppercase tracking-widest text-white shadow-secondary-glow transition-all hover:bg-secondary/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-dim disabled:text-on-surface-variant disabled:shadow-none">
                        {testLoading ? "Menilai Submission..." : "Submit Evaluasi"}
                      </button>
                    )}
                    <button onClick={closeTestReview} className="h-14 rounded-full border border-outline-variant px-8 text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-all">
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
