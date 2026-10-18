import { NextResponse } from "next/server";
import { FalkorDB } from "falkordb";
import { getFalkorConfig } from "@/lib/persistence";
import { getAuthenticatedIdentity } from "@/lib/auth";

export async function GET() {
  const authResult = await getAuthenticatedIdentity();
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  let db: Awaited<ReturnType<typeof FalkorDB.connect>> | undefined;
  try {
    const config = getFalkorConfig(process.env);
    if (!config) return NextResponse.json({ error: "FalkorDB environment variables are missing." }, { status: 500 });
    db = await FalkorDB.connect({ username: config.username, password: config.password, socket: { host: config.host, port: config.port, tls: config.tls, connectTimeout: 10000 } });
    const graph = db.selectGraph(config.graphName);
    await graph.query(
      "MERGE (m:MemoryTest {id: $id, userId: $userId}) SET m.message = 'Graph write and read works', m.source = 'diagnostic', m.updatedAt = timestamp()",
      { params: { id: `connection-test::${authResult.identity.userId}`, userId: authResult.identity.userId } },
    );
    const result = await graph.query("MATCH (m:MemoryTest {id: $id, userId: $userId}) RETURN m.message AS message, m.source AS source", { params: { id: `connection-test::${authResult.identity.userId}`, userId: authResult.identity.userId } });
    return NextResponse.json({ success: true, message: "FalkorDB graph write and read succeeded.", graphName: config.graphName, result: result.data });
  } catch (error) {
    console.error("FalkorDB graph test failed:", error);
    return NextResponse.json({ error: "Graph test failed. Check the server terminal." }, { status: 500 });
  } finally {
    if (db) await db.close();
  }
}
