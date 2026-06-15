import { NextResponse } from "next/server";
import { getGroqClient, groqModel } from "@/lib/groq";

type ForgeNode = {
  title: string;
  description: string;
  tasks?: string[];
};

type CaseStudy = {
  title: string;
  scenario: string;
  requirements: string[];
  expectedOutput?: string;
  evaluationCriteria: string[];
};

type Evaluation = {
  passed: boolean;
  score: number;
  feedback: string;
  issues: string[];
  nextSteps: string[];
};

type RequirementCheck = {
  label: string;
  met: boolean;
  issue: string;
};

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const cleaned = (fenced ?? text).trim();
  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");
  const startsAt = objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart) ? objectStart : arrayStart;
  const endsAt = objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart) ? cleaned.lastIndexOf("}") : cleaned.lastIndexOf("]");
  return startsAt >= 0 && endsAt >= startsAt ? cleaned.slice(startsAt, endsAt + 1) : cleaned;
}

function fallbackCase(nodes: ForgeNode[] = [], targetNode?: ForgeNode): CaseStudy {
  const target = targetNode ?? nodes.at(-1);
  const title = target?.title ?? "Materi ini";
  const tasks = target?.tasks ?? [];

  return {
    title: `Studi Kasus: ${title}`,
    scenario: `Buat project mini yang membuktikan kamu memahami node "${title}" berdasarkan task yang ada di node ini.`,
    requirements: tasks.length ? tasks.slice(0, 8).map((task) => `Terapkan task: ${task}`) : [`Terapkan konsep inti dari ${title}.`, "Buat contoh nyata yang bisa dijelaskan ulang."],
    expectedOutput: "Kirim kode, pseudocode, atau penjelasan implementasi yang bisa dinilai.",
    evaluationCriteria: [
      "Solusi menjawab semua requirement utama.",
      "Konsep dari node digunakan dengan benar.",
      "Tidak ada error logika yang fatal.",
      "Penjelasan cukup jelas untuk divalidasi."
    ]
  };
}

function hasCustomHook(text: string, topic?: string) {
  const hasHookName = /\bfunction\s+use[A-Z][A-Za-z0-9_]*\b/.test(text) || /\bconst\s+use[A-Z][A-Za-z0-9_]*\s*=/.test(text);
  return topic ? hasHookName && text.includes(topic) : hasHookName;
}

function checkRequirement(requirement: string, submission: string): RequirementCheck {
  const req = requirement.toLowerCase();
  const text = submission.toLowerCase();

  if (submission.trim().length < 15) {
    return {
      label: requirement,
      met: false,
      issue: `Requirement belum terpenuhi karena jawaban terlalu pendek: ${requirement}`
    };
  }

  const isCodingReq = req.includes("route") || req.includes("routing") || req.includes("state") || req.includes("hook") || req.includes("useeffect") || req.includes("array") || req.includes("object") || req.includes("loop") || req.includes("function") || req.includes("fungsi");
  const isCodingSubmission = text.includes("const ") || text.includes("let ") || text.includes("function") || text.includes("=>") || text.includes("{") || text.includes(";");

  let met = false;
  if (isCodingReq && isCodingSubmission) {
    if (req.includes("react router") || req.includes("perpindahan antar halaman") || req.includes("routing")) {
      met = /browserrouter|createbrowserrouter|routes|route|link|usenavigate|navigate\(/i.test(submission);
    } else if (req.includes("state management") || req.includes("data pengguna") || req.includes("user")) {
      const hasStateTool = /usestate|usereducer|createcontext|usecontext|redux|zustand|provider|dispatch|set[A-Z]/.test(text);
      const hasUserData = /user|username|email|password|auth|login/.test(text);
      met = hasStateTool && hasUserData;
    } else if (req.includes("custom hook") || req.includes("custom hooks")) {
      met = hasCustomHook(submission, req.includes("tema") || req.includes("theme") ? "theme" : undefined);
    } else if (req.includes("tema") || req.includes("theme")) {
      met = /theme|dark|light|toggletheme|settheme|usetheme/i.test(submission);
    } else if (req.includes("login")) {
      met = /username|email|password|login/i.test(submission);
    } else if (req.includes("tambah") && req.includes("todo")) {
      met = /addtodo|settodos|push|concat|\[\s*\.\.\.todos/i.test(submission);
    } else if (req.includes("useeffect")) {
      met = /useeffect\s*\(/i.test(submission);
    } else if (req.includes("array")) {
      met = /\[[\s\S]*\]/.test(submission) || /\.map\(|\.filter\(|\.reduce\(/i.test(submission);
    } else if (req.includes("object")) {
      met = /\{[\s\S]*:[\s\S]*\}/.test(submission);
    } else if (req.includes("function") || req.includes("fungsi")) {
      met = /function\s+\w+|\([^)]*\)\s*=>|const\s+\w+\s*=\s*\([^)]*\)\s*=>/i.test(submission);
    } else if (req.includes("conditional") || req.includes("if") || req.includes("kondisi")) {
      met = /\bif\s*\(|\?|switch\s*\(/i.test(submission);
    } else if (req.includes("loop")) {
      met = /\bfor\s*\(|\bwhile\s*\(|\.map\(|\.forEach\(|\.reduce\(/i.test(submission);
    } else {
      const words = req
        .split(/[^a-z0-9]+/i)
        .filter((word) => word.length > 4 && !["menggunakan", "dengan", "untuk", "aplikasi", "secara", "benar"].includes(word));
      met = words.length === 0 || words.some((word) => text.includes(word));
    }
  } else {
    const words = req
      .split(/[^a-z0-9]+/i)
      .filter((word) => word.length > 4 && !["menggunakan", "dengan", "untuk", "tugas", "studi", "kasus", "materi", "secara", "benar"].includes(word));
    met = words.length === 0 || words.some((word) => text.includes(word)) || text.length > 40;
  }

  return {
    label: requirement,
    met,
    issue: `Requirement belum terpenuhi: ${requirement}`
  };
}

function auditSubmission(submission: string, caseStudy?: CaseStudy) {
  const checks = (caseStudy?.requirements ?? []).map((requirement) => checkRequirement(requirement, submission));
  const missingRequirements = checks.filter((item) => !item.met);
  const text = submission.toLowerCase();
  const selfDeclaredIncomplete =
    /belum ada|belum dibuat|tidak ada|cuma fokus|hanya fokus|belum selesai/i.test(text);
  const missingCount = missingRequirements.length + (selfDeclaredIncomplete ? 1 : 0);
  const scoreCap = selfDeclaredIncomplete ? 65 : 100;

  return {
    checks,
    missingRequirements,
    selfDeclaredIncomplete,
    scoreCap,
    canPass: submission.trim().length >= 15 && !selfDeclaredIncomplete
  };
}

function enforceAudit(evaluation: Evaluation, submission: string, caseStudy?: CaseStudy): Evaluation {
  const audit = auditSubmission(submission, caseStudy);
  const auditIssues = audit.missingRequirements.map((item) => item.issue);
  if (audit.selfDeclaredIncomplete) auditIssues.push("Submission menyatakan sendiri bahwa sebagian requirement belum dikerjakan.");
  const auditNextSteps = audit.missingRequirements.map((item) => `Lengkapi: ${item.label}`);

  const score = Math.min(evaluation.score, audit.scoreCap);
  const passed = audit.canPass && score >= 70 && evaluation.passed;

  return {
    ...evaluation,
    score,
    passed,
    feedback: passed
      ? evaluation.feedback
      : auditIssues.length
        ? `Belum lulus karena masih ada requirement wajib yang belum terpenuhi. ${evaluation.feedback}`
        : evaluation.feedback,
    issues: auditIssues.length ? auditIssues : Array.from(new Set(evaluation.issues)),
    nextSteps: passed
      ? evaluation.nextSteps
      : Array.from(new Set(["Lengkapi semua requirement wajib dari studi kasus.", "Berikan jawaban atau penjelasan yang detail untuk membuktikan pemahaman Anda.", ...(auditNextSteps.length ? auditNextSteps : evaluation.nextSteps)]))
  };
}

function fallbackEvaluation(submission: string, nodes: ForgeNode[] = [], caseStudy?: CaseStudy): Evaluation {
  const text = submission.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const tooShort = wordCount < 10;
  const passed = !tooShort && text.length > 40;
  const score = passed ? 80 : 45;

  const evaluation: Evaluation = {
    passed,
    score,
    feedback: passed
      ? "Solusi sudah memenuhi kriteria dasar studi kasus."
      : "Solusi belum cukup memenuhi kriteria. Lengkapi jawaban Anda agar lebih detail.",
    issues: tooShort ? ["Jawaban terlalu pendek (minimal 10 kata)"] : [],
    nextSteps: passed ? ["Lanjutkan ke node berikutnya."] : ["Tulis jawaban yang lebih detail sesuai studi kasus."]
  };
  return enforceAudit(evaluation, submission, caseStudy);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    mode?: "generate" | "evaluate";
    nodes?: ForgeNode[];
    targetNode?: ForgeNode;
    caseStudy?: CaseStudy;
    submission?: string;
    variantSeed?: number;
  };
  const nodes = body.nodes ?? [];
  const groq = getGroqClient();
  if (body.mode === "evaluate") {
    if (!body.submission?.trim()) {
      return NextResponse.json({ evaluation: fallbackEvaluation("", body.targetNode ? [...nodes, body.targetNode] : nodes, body.caseStudy) });
    }

    if (!groq) {
      return NextResponse.json({ evaluation: fallbackEvaluation(body.submission, body.targetNode ? [...nodes, body.targetNode] : nodes, body.caseStudy) });
    }

    const completion = await groq.chat.completions.create({
      model: groqModel,
      temperature: 0.15,
      messages: [
        {
          role: "system",
          content:
            "Kamu adalah evaluator ahli untuk Forge Test. Nilai submission/jawaban user terhadap studi kasus/tugas yang diberikan. Tugas bisa berupa coding, penjelasan konsep, studi kasus bisnis, desain, bahasa, atau topik lainnya sesuai materi node. Balas hanya JSON valid dengan shape {\"passed\":boolean,\"score\":number,\"feedback\":string,\"issues\":string[],\"nextSteps\":string[]}. Passing score minimal 70, tetapi user hanya boleh lulus jika SEMUA requirement wajib terbukti telah dikerjakan atau dijawab dengan benar di dalam submission. Jangan memberi nilai tinggi jika solusi tidak lengkap atau tidak menjawab esensi tugas. Jika ada requirement tidak dikerjakan, salah, atau tidak sesuai skenario, score maksimal 65 dan passed harus false. Tulis feedback yang konstruktif dan cantumkan detail issue/requirement yang belum terpenuhi di issues."
        },
        {
          role: "user",
          content: JSON.stringify({
            nodes,
            targetNode: body.targetNode,
            caseStudy: body.caseStudy,
            submission: body.submission
          })
        }
      ]
    });

    const text = completion.choices[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(extractJson(text)) as Evaluation;
      const evaluation = enforceAudit({
        passed: Boolean(parsed.passed),
        score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
        feedback: String(parsed.feedback ?? ""),
        issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
        nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.map(String) : []
      }, body.submission, body.caseStudy);
      return NextResponse.json({
        evaluation
      });
    } catch {
      return NextResponse.json({ evaluation: fallbackEvaluation(body.submission, body.targetNode ? [...nodes, body.targetNode] : nodes, body.caseStudy), raw: text });
    }
  }

  if (!groq) {
    return NextResponse.json({ caseStudy: fallbackCase(nodes, body.targetNode) });
  }

  const completion = await groq.chat.completions.create({
    model: groqModel,
    temperature: 0.75,
    messages: [
      {
        role: "system",
        content:
          "Buat Forge Test berbentuk studi kasus/praktik/tugas, bukan pilihan ganda. Balas hanya JSON valid dengan shape {\"title\":string,\"scenario\":string,\"requirements\":string[],\"expectedOutput\":string,\"evaluationCriteria\":string[]}. Studi kasus/tugas WAJIB berdasarkan targetNode.title, targetNode.description, dan targetNode.tasks saja. nodes hanya konteks prasyarat, jangan mengambil topik baru dari node lain. Jangan menyebut teknologi/topik/konsep yang tidak ada di targetNode. Setiap request harus membuat skenario/tugas yang berbeda/variatif sesuai randomSeed, jangan mengulang skenario lama. Skenario harus spesifik: apa yang harus diselesaikan, data/input yang digunakan (jika ada), proses/analisis/langkah yang harus dilakukan, dan format jawaban yang diharapkan. Requirement harus menguji semua task utama dari targetNode."
      },
      {
        role: "user",
        content: JSON.stringify({
          targetNode: body.targetNode,
          prerequisiteContext: nodes,
          randomSeed: body.variantSeed ?? Date.now(),
          instruction: "Buat kasus random baru yang tetap sesuai targetNode dan task-nya. Jangan gunakan bank soal hardcoded."
        })
      }
    ]
  });

  const text = completion.choices[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(extractJson(text)) as CaseStudy;
    const caseStudy: CaseStudy = {
      title: String(parsed.title ?? "Forge Case Study"),
      scenario: String(parsed.scenario ?? ""),
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements.map(String) : [],
      expectedOutput: parsed.expectedOutput ? String(parsed.expectedOutput) : undefined,
      evaluationCriteria: Array.isArray(parsed.evaluationCriteria) ? parsed.evaluationCriteria.map(String) : []
    };
    return NextResponse.json({ caseStudy: caseStudy.requirements.length ? caseStudy : fallbackCase(nodes, body.targetNode) });
  } catch {
    return NextResponse.json({ caseStudy: fallbackCase(nodes, body.targetNode), raw: text });
  }
}
