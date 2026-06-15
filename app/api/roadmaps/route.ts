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

type DbTask = {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string | null;
};

type DbNode = {
  id: string;
  position_x: number;
  position_y: number;
  title: string;
  description?: string | null;
  status: string;
  notes?: string | null;
  order_index: number;
  forge_passed?: boolean | null;
  forge_feedback?: string | null;
  cooldown_until?: string | null;
  messages_json?: Array<{ id: string; role: string; content: string }> | null;
  tasks?: DbTask[] | null;
};

type DbDependency = {
  id: string;
  from_node_id: string;
  to_node_id: string;
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
    nodes: ((roadmap.nodes ?? []) as DbNode[]).map((node) => ({
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
        tasks: (node.tasks ?? []).map((task) => ({
          id: task.id,
          title: task.title,
          completed: task.completed,
          dueDate: task.due_date ?? undefined
        }))
      }
    })),
    edges: ((roadmap.node_dependencies ?? []) as DbDependency[]).map((edge) => ({
      id: edge.id,
      source: edge.from_node_id,
      target: edge.to_node_id,
      type: "bezier",
      animated: false,
      markerEnd: { type: "arrowclosed", color: "#7C3AED" },
      style: { stroke: "#7C3AED", strokeWidth: 2.25 }
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

    const nodeRows = roadmap.nodes.map((node) => ({
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
    }));

    const nodeIds = nodeRows.map((node) => node.id);
    const nodeIdSet = new Set(nodeIds);
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
    const taskIds = taskRows.map((task) => task.id);
    const edgeRows = roadmap.edges
      .filter((edge) => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        roadmap_id: roadmap.id,
        from_node_id: edge.source,
        to_node_id: edge.target
      }));
    const edgeIds = edgeRows.map((edge) => edge.id);

    if (nodeRows.length) {
      const { error: nodesError } = await supabase.from("nodes").upsert(nodeRows);

      if (nodesError) {
        return NextResponse.json({ ok: false, error: nodesError.message }, { status: 503 });
      }

      if (taskRows.length) {
        const { error: tasksError } = await supabase.from("tasks").upsert(taskRows);

        if (tasksError) {
          return NextResponse.json({ ok: false, error: tasksError.message }, { status: 503 });
        }
      }

      if (edgeRows.length) {
        const { error: edgesError } = await supabase.from("node_dependencies").upsert(edgeRows);

        if (edgesError) {
          return NextResponse.json({ ok: false, error: edgesError.message }, { status: 503 });
        }
      }

      const staleEdgeQuery = supabase.from("node_dependencies").delete().eq("roadmap_id", roadmap.id);
      const { error: staleEdgeError } = edgeIds.length ? await staleEdgeQuery.not("id", "in", `(${edgeIds.join(",")})`) : await staleEdgeQuery;

      if (staleEdgeError) {
        return NextResponse.json({ ok: false, error: staleEdgeError.message }, { status: 503 });
      }

      const staleTaskQuery = supabase.from("tasks").delete().eq("roadmap_id", roadmap.id);
      const { error: staleTaskError } = taskIds.length ? await staleTaskQuery.not("id", "in", `(${taskIds.join(",")})`) : await staleTaskQuery;

      if (staleTaskError) {
        return NextResponse.json({ ok: false, error: staleTaskError.message }, { status: 503 });
      }

      const staleNodeQuery = supabase.from("nodes").delete().eq("roadmap_id", roadmap.id);
      const { error: staleNodeError } = await staleNodeQuery.not("id", "in", `(${nodeIds.join(",")})`);

      if (staleNodeError) {
        return NextResponse.json({ ok: false, error: staleNodeError.message }, { status: 503 });
      }
    } else {
      const tables = ["tasks", "node_dependencies", "nodes"] as const;

      for (const table of tables) {
        const { error: childError } = await supabase.from(table).delete().eq("roadmap_id", roadmap.id);

        if (childError) {
          return NextResponse.json({ ok: false, error: childError.message }, { status: 503 });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const { supabase, user, error: authError } = await getAuthenticatedUser(request);

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase env belum terisi" }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ ok: false, error: authError }, { status: 401 });
  }

  const { id, title, description } = (await request.json()) as { id?: string; title?: string; description?: string };

  if (!id || !title?.trim()) {
    return NextResponse.json({ ok: false, error: "Roadmap id dan title wajib diisi" }, { status: 400 });
  }

  const patch: { title: string; updated_at: string; description?: string } = {
    title: title.trim(),
    updated_at: new Date().toISOString()
  };

  if (typeof description === "string") {
    patch.description = description;
  }

  const { data, error } = await supabase
    .from("roadmaps")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: "Roadmap tidak ditemukan" }, { status: 404 });
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

  const { data: ownedRoadmap, error: lookupError } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ ok: false, error: lookupError.message }, { status: 503 });
  }

  if (!ownedRoadmap) {
    return NextResponse.json({ ok: false, error: "Roadmap tidak ditemukan" }, { status: 404 });
  }

  const tables = ["tasks", "node_dependencies", "nodes"] as const;

  for (const table of tables) {
    const { error: childError } = await supabase.from(table).delete().eq("roadmap_id", id);

    if (childError) {
      return NextResponse.json({ ok: false, error: childError.message }, { status: 503 });
    }
  }

  const { error } = await supabase.from("roadmaps").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
