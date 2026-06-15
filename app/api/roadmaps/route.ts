import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-admin";

type RoadmapPayload = {
  id: string;
  title: string;
  description: string;
  updatedAt: string;
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: {
      title: string;
      description: string;
      status: string;
      notes: string;
      orderIndex: number;
      forgePassed: boolean;
      feedback?: string;
      cooldownUntil?: number;
      messages: Array<{ id: string; role: string; content: string }>;
      tasks: Array<{ id: string; title: string; completed: boolean; dueDate?: string }>;
    };
  }>;
  edges: Array<{ id: string; source: string; target: string }>;
};

export async function GET(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser(request);

  if (!supabase) {
    return NextResponse.json({ roadmaps: null, error: "Supabase env belum terisi" }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ roadmaps: null, error: authError }, { status: 401 });
  }

  const { data: roadmaps, error } = await supabase
    .from("roadmaps")
    .select("*, nodes(*, tasks(*)), node_dependencies(*)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ roadmaps: null, error: error.message }, { status: 503 });
  }

  const payload = (roadmaps ?? []).map((roadmap) => ({
    id: roadmap.id,
    title: roadmap.title,
    description: roadmap.description ?? "",
    updatedAt: roadmap.updated_at,
    nodes: (roadmap.nodes ?? []).map((node: any) => ({
      id: node.id,
      type: "skill",
      position: { x: node.position_x, y: node.position_y },
      data: {
        title: node.title,
        description: node.description ?? "",
        status: node.status,
        notes: node.notes ?? "",
        orderIndex: node.order_index,
        locked: false,
        forgePassed: node.forge_passed ?? false,
        feedback: node.forge_feedback ?? undefined,
        cooldownUntil: node.cooldown_until ? new Date(node.cooldown_until).getTime() : undefined,
        messages: node.messages_json ?? [],
        tasks: (node.tasks ?? []).map((task: any) => ({
          id: task.id,
          title: task.title,
          completed: task.completed,
          dueDate: task.due_date ?? undefined
        }))
      }
    })),
    edges: (roadmap.node_dependencies ?? []).map((edge: any) => ({
      id: edge.id,
      source: edge.from_node_id,
      target: edge.to_node_id,
      type: "smoothstep",
      animated: true,
      markerEnd: { type: "arrowclosed", color: "#7C3AED" },
      style: { stroke: "#7C3AED", strokeWidth: 2, strokeDasharray: "8 8" }
    }))
  }));

  return NextResponse.json({ roadmaps: payload });
}

export async function PUT(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser(request);

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase env belum terisi" }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ ok: false, error: authError }, { status: 401 });
  }

  const { roadmaps } = (await request.json()) as { roadmaps: RoadmapPayload[] };

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: String(user.user_metadata?.full_name ?? "User"),
    username: String(user.user_metadata?.username ?? user.email?.split("@")[0] ?? "user"),
    email: user.email ?? "user@local.test"
  });

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 503 });
  }

  for (const roadmap of roadmaps) {
    const { error: roadmapError } = await supabase.from("roadmaps").upsert({
      id: roadmap.id,
      user_id: user.id,
      title: roadmap.title,
      description: roadmap.description,
      updated_at: roadmap.updatedAt
    });

    if (roadmapError) {
      return NextResponse.json({ ok: false, error: roadmapError.message }, { status: 503 });
    }

    await supabase.from("node_dependencies").delete().eq("roadmap_id", roadmap.id);
    await supabase.from("nodes").delete().eq("roadmap_id", roadmap.id);

    if (roadmap.nodes.length) {
      const { error: nodesError } = await supabase.from("nodes").insert(
        roadmap.nodes.map((node) => ({
          id: node.id,
          roadmap_id: roadmap.id,
          title: node.data.title,
          description: node.data.description,
          status: node.data.status,
          position_x: node.position.x,
          position_y: node.position.y,
          notes: node.data.notes,
          order_index: node.data.orderIndex,
          forge_passed: node.data.forgePassed,
          forge_feedback: node.data.feedback ?? null,
          cooldown_until: node.data.cooldownUntil ? new Date(node.data.cooldownUntil).toISOString() : null,
          messages_json: node.data.messages
        }))
      );

      if (nodesError) {
        return NextResponse.json({ ok: false, error: nodesError.message }, { status: 503 });
      }

      const taskRows = roadmap.nodes.flatMap((node) =>
        (node.data.tasks ?? []).map((task) => ({
          id: task.id,
          node_id: node.id,
          roadmap_id: roadmap.id,
          title: task.title,
          completed: task.completed,
          due_date: task.dueDate ?? null
        }))
      );

      if (taskRows.length) {
        const { error: tasksError } = await supabase.from("tasks").insert(taskRows);

        if (tasksError) {
          return NextResponse.json({ ok: false, error: tasksError.message }, { status: 503 });
        }
      }
    }

    if (roadmap.edges.length) {
      const { error: edgesError } = await supabase.from("node_dependencies").insert(
        roadmap.edges.map((edge) => ({
          id: edge.id,
          roadmap_id: roadmap.id,
          from_node_id: edge.source,
          to_node_id: edge.target
        }))
      );

      if (edgesError) {
        return NextResponse.json({ ok: false, error: edgesError.message }, { status: 503 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser(request);

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase env belum terisi" }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ ok: false, error: authError }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ ok: false, error: "Roadmap id wajib diisi" }, { status: 400 });
  }

  const { error } = await supabase.from("roadmaps").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
