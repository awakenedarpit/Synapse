import { NextResponse } from "next/server";
import { FalkorDB } from "falkordb";
import { correctMemory, forgetMemory, getFalkorConfig, normalizeUserId } from "@/lib/persistence";

function validMemoryId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 200;
}

export async function POST(request: Request) {
  const config = getFalkorConfig(process.env);
  if (!config) return NextResponse.json({ error: "FalkorDB configuration is missing from .env.local." }, { status: 500 });

  let db: Awaited<ReturnType<typeof FalkorDB.connect>> | undefined;
  try {
    const body = await request.json();
    const action = body?.action;
    const memoryId = body?.memoryId;
    const userId = normalizeUserId(body?.userId);
    if (action !== "correct" && action !== "forget") return NextResponse.json({ error: "Action must be 'correct' or 'forget'." }, { status: 400 });
    if (!validMemoryId(memoryId)) return NextResponse.json({ error: "A specific memoryId is required." }, { status: 400 });
    if (action === "forget" && body?.confirmed !== true) return NextResponse.json({ error: "Forgetting requires confirmed: true for the specific memoryId." }, { status: 400 });

    db = await FalkorDB.connect({ username: config.username, password: config.password, socket: { host: config.host, port: config.port, tls: false, connectTimeout: 10000 } });
    const graph = db.selectGraph(config.graphName);
    const now = Date.now();
    if (action === "correct") {
      const content = typeof body?.content === "string" ? body.content.trim() : "";
      if (!content || content.length > 10000) return NextResponse.json({ error: "Corrected content must be between 1 and 10000 characters." }, { status: 400 });
      const updated = await correctMemory(graph, { memoryId: memoryId.trim(), userId, content, correctedAt: now });
      if (!updated) return NextResponse.json({ error: "Active memory not found for this user." }, { status: 404 });
      return NextResponse.json({ action, memoryId: memoryId.trim(), userId, corrected: true });
    }

    const forgotten = await forgetMemory(graph, memoryId.trim(), userId, now);
    if (!forgotten) return NextResponse.json({ error: "Active memory not found for this user." }, { status: 404 });
    return NextResponse.json({ action, memoryId: memoryId.trim(), userId, forgotten: true, reversible: true });
  } catch (error) {
    console.error("Memory correction/forgetting failed:", error);
    return NextResponse.json({ error: "The memory change failed. Check the server configuration and logs." }, { status: 500 });
  } finally {
    if (db) { try { await db.close(); } catch (closeError) { console.error("FalkorDB close failed:", closeError); } }
  }
}
