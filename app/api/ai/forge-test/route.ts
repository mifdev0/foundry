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
  let met = false;

  if (req.includes("react router") || req.includes("perpindahan antar halaman") || req.includes("routing")) {
    met = /browserrouter|createbrowserrouter|routes|route|link|usenavigate|navigate\(/i.test(submission);
  } else if (req.includes("state management") || req.includes("data pengguna") || req.includes("user")) {
    const hasStateTool = /usestate|usereducer|createcontext|usecontext|redux|zustand|provider|dispatch|set[A-Z]/.test(text);
    const hasUserData = /user|username|email|password|auth|login/.test(text);
    const onlyLinkLogin = /<link[^>]+to=["']\/?dashboard["']/i.test(submission) && !/onsubmit|handlelogin|setuser|setauth|navigate\(/i.test(submission);
    met = hasStateTool && hasUserData && !onlyLinkLogin;
  } else if (req.includes("custom hook") || req.includes("custom hooks")) {
    met = hasCustomHook(submission, req.includes("tema") || req.includes("theme") ? "theme" : undefined);
  } else if (req.includes("tema") || req.includes("theme")) {
    met = /theme|dark|light|toggletheme|settheme|usetheme/i.test(submission) && /usestate|usereducer|createcontext|className|data-theme|style=/i.test(submission);
  } else if (req.includes("login")) {
    met = /onsubmit|handlelogin|setuser|setauth|navigate\(/i.test(submission) && /username|email|password/i.test(submission);
  } else if (req.includes("tambah") && req.includes("todo")) {
    met = /addtodo|settodos|push|concat|\[\s*\.\.\.todos/i.test(submission);
  } else if (req.includes("hapus") && req.includes("todo")) {
    met = /deletetodo|removetodo|filter\(/i.test(submission);
  } else if ((req.includes("update") || req.includes("edit")) && req.includes("todo")) {
    met = /updatetodo|edittodo|map\(/i.test(submission) && /settodos/i.test(submission);
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
    /belum ada|belum dibuat|tidak ada|cuma fokus|hanya fokus|baru memenuhi|minimal.*requirement|belum.*state management|belum.*custom hook|belum.*tema/.test(text);
  const missingCount = missingRequirements.length + (selfDeclaredIncomplete ? 1 : 0);
  const scoreCap = missingCount === 0 ? 100 : missingCount === 1 ? 65 : missingCount === 2 ? 50 : 40;

  return {
    checks,
    missingRequirements,
    selfDeclaredIncomplete,
    scoreCap,
    canPass: missingRequirements.length === 0 && !selfDeclaredIncomplete
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
        ? `Belum lulus karena masih ada requirement wajib yang belum terbukti di submission. ${evaluation.feedback}`
        : evaluation.feedback,
    issues: auditIssues.length ? auditIssues : Array.from(new Set(evaluation.issues)),
    nextSteps: passed
      ? evaluation.nextSteps
      : Array.from(new Set(["Lengkapi semua requirement wajib, bukan hanya konsep utama.", "Submit kode lengkap yang menunjukkan fitur bekerja.", ...(auditNextSteps.length ? auditNextSteps : evaluation.nextSteps)]))
  };
}

function fallbackEvaluation(submission: string, nodes: ForgeNode[] = [], caseStudy?: CaseStudy): Evaluation {
  const text = submission.toLowerCase();
  const target = nodes.at(-1);
  const tasks = target?.tasks ?? [];
  const concepts = tasks.join(" ").toLowerCase();
  const checks = [
    text.includes("function") || text.includes("=>"),
    text.includes("if") || text.includes("?"),
    text.includes("for") || text.includes("map") || text.includes("foreach"),
    text.includes("[") && text.includes("]"),
    text.includes("{") && text.includes("}")
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const passed = score >= 70;

  const evaluation: Evaluation = {
    passed,
    score,
    feedback: passed
      ? "Solusi sudah memenuhi mayoritas requirement studi kasus dan cukup untuk lanjut."
      : "Solusi belum cukup memenuhi requirement utama. Lengkapi bagian konsep yang masih kosong.",
    issues: checks
      .map((ok, index) => ({ ok, label: ["Function belum terlihat", "Conditional belum terlihat", "Loop belum terlihat", "Array belum terlihat", "Object belum terlihat"][index] }))
      .filter((item) => !item.ok)
      .map((item) => item.label)
      .concat(concepts && submission.length < 80 ? ["Jawaban terlalu pendek untuk divalidasi mendalam"] : []),
    nextSteps: passed ? ["Lanjutkan ke node berikutnya."] : ["Perbaiki submission sesuai issue.", "Pastikan kode bisa dijalankan tanpa syntax error.", "Tambahkan contoh output."]
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
            "Kamu adalah evaluator coding yang ketat untuk Forge Test. Nilai submission user terhadap studi kasus. Balas hanya JSON valid dengan shape {\"passed\":boolean,\"score\":number,\"feedback\":string,\"issues\":string[],\"nextSteps\":string[]}. Passing score minimal 70, tetapi user hanya boleh lulus jika SEMUA requirement wajib terbukti ada di kode/pseudocode. Jangan memberi nilai tinggi hanya karena ada sebagian konsep. Jika ada requirement tidak diimplementasikan, missing, hanya diklaim, atau user mengakui belum dibuat, score maksimal 65 dan passed harus false. Login dengan Link langsung ke dashboard bukan state management/auth yang valid. Custom hook harus berupa function/const bernama useX. Tema harus punya state/toggle/theme handling yang terlihat. Cantumkan requirement yang hilang di issues."
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
          "Buat Forge Test berbentuk studi kasus/praktik, bukan pilihan ganda. Balas hanya JSON valid dengan shape {\"title\":string,\"scenario\":string,\"requirements\":string[],\"expectedOutput\":string,\"evaluationCriteria\":string[]}. Studi kasus WAJIB berdasarkan targetNode.title, targetNode.description, dan targetNode.tasks saja. nodes hanya konteks prasyarat, jangan mengambil topik baru dari node lain. Jangan menyebut teknologi/topik yang tidak ada di targetNode. Setiap request harus membuat project mini yang berbeda/variatif sesuai randomSeed, jangan mengulang scenario lama. Scenario harus spesifik: apa yang dibuat, data/input yang dipakai, proses yang harus dilakukan, dan output yang diharapkan. Requirement harus menguji semua task utama dari targetNode."
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
