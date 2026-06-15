import { NextResponse } from "next/server";
import { getGroqClient, groqModel } from "@/lib/groq";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    roadmapTitle?: string;
    nodeTitle?: string;
    nodeDescription?: string;
    messages?: { role: "user" | "assistant"; content: string }[];
  };

  const groq = getGroqClient();
  const lastMessage = body.messages?.at(-1)?.content ?? "";

  if (!groq) {
    return NextResponse.json({
      content: `Untuk topik ${body.nodeTitle ?? "ini"}, mulai dari konsep inti, buat contoh kecil, lalu uji pemahamanmu dengan latihan. Pertanyaanmu: "${lastMessage}"`
    });
  }

  const completion = await groq.chat.completions.create({
    model: groqModel,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: `Kamu adalah AI learning companion untuk topik: ${body.nodeTitle}.
Deskripsi topik: ${body.nodeDescription}.
Roadmap ini adalah: ${body.roadmapTitle}.
Bantu user memahami topik ini. Jawab dalam bahasa Indonesia, praktis, dan fokus pada pemahaman yang mudah dicerna serta aplikatif.`
        + " Gunakan format ringkas dengan heading pendek dan bullet seperlunya. Hindari markdown tebal berlebihan."
      },
      ...(body.messages ?? []).map((message) => ({
        role: message.role,
        content: message.content
      }))
    ]
  });

  return NextResponse.json({
    content: completion.choices[0]?.message?.content ?? "Aku belum bisa membuat jawaban untuk pesan ini."
  });
}
