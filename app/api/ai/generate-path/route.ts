import { NextResponse } from "next/server";
import { getGroqClient, groqModel } from "@/lib/groq";

type GeneratedNode = {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  tasks?: string[];
};

function fallbackPath(goal = ""): GeneratedNode[] {
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

function parseGeneratedNodes(text: string, goal = ""): GeneratedNode[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const cleaned = (fenced ?? text).trim();
  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");
  const startsAt = objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart) ? objectStart : arrayStart;
  const endsAt = objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart) ? cleaned.lastIndexOf("}") : cleaned.lastIndexOf("]");
  const jsonSlice = startsAt >= 0 && endsAt >= startsAt ? cleaned.slice(startsAt, endsAt + 1) : cleaned;
  const parsed = JSON.parse(jsonSlice) as { nodes?: unknown } | unknown[];
  const nodes = Array.isArray(parsed) ? parsed : parsed.nodes;

  if (!Array.isArray(nodes)) {
    return [];
  }

  const normalizedGoal = goal.toLowerCase();
  const skipHtmlCss = normalizedGoal.includes("html") && normalizedGoal.includes("css") && (normalizedGoal.includes("sudah") || normalizedGoal.includes("udah"));

  return nodes
    .map((node, index) => {
      const item = node as Partial<GeneratedNode>;
      const tasks = Array.isArray(item.tasks)
        ? item.tasks
            .map((task) => {
              if (typeof task === "string") return task;
              if (task && typeof task === "object") {
                const record = task as { title?: unknown; description?: unknown; task?: unknown; name?: unknown };
                return String(record.title ?? record.task ?? record.name ?? record.description ?? "").trim();
              }
              return "";
            })
            .filter(Boolean)
            .slice(0, 10)
        : undefined;
      return {
        id: String(item.id ?? index + 1),
        title: String(item.title ?? "").trim(),
        description: String(item.description ?? "").trim(),
        dependencies: Array.isArray(item.dependencies) ? item.dependencies.map(String) : [],
        tasks
      };
    })
    .filter((node) => node.title && node.description)
    .filter((node) => {
      if (!skipHtmlCss) return true;
      const title = node.title.toLowerCase();
      return !title.includes("html") && !title.includes("css");
    });
}

export async function POST(request: Request) {
  const { goal } = (await request.json()) as { goal?: string };
  const groq = getGroqClient();

  if (!groq || !goal) {
    return NextResponse.json({ nodes: fallbackPath(goal) });
  }

  const completion = await groq.chat.completions.create({
    model: groqModel,
    temperature: 0.25,
    messages: [
      {
        role: "system",
        content:
          "Kamu membuat learning path untuk topik APA SAJA yang diminta user (programming, bahasa, musik, desain, sains, dll). Balas hanya JSON valid dengan shape {\"nodes\":[...]}. Setiap node punya id string, title, description, dependencies array berisi id prasyarat. Buat 6-9 node, urut dari fundamental ke advanced. Ikuti goal user secara spesifik — sesuaikan isi node dengan topik yang diminta, JANGAN default ke JavaScript/programming kalau topiknya bukan itu."
          + " Setiap node wajib punya tasks array berisi string task konkret yang harus dikerjakan user untuk menyelesaikan node itu. Jumlah task FLEKSIBEL tergantung kebutuhan materi — bisa 3 sampai 10 task. Node dengan materi banyak boleh punya lebih banyak task, node sederhana cukup sedikit. Maksimal 10 task per node. Jika materinya butuh lebih dari 10 task, pilih 10 yang paling urgent dan paling perlu dipelajari duluan. Jangan pakai object untuk tasks."
      },
      { role: "user", content: goal }
    ]
  });

  const text = completion.choices[0]?.message?.content ?? "";

  try {
    const parsed = parseGeneratedNodes(text, goal);
    return NextResponse.json({ nodes: parsed.length ? parsed : fallbackPath(goal) });
  } catch {
    return NextResponse.json({ nodes: fallbackPath(goal), raw: text });
  }
}
