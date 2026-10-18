import { NextResponse } from "next/server";
import { FalkorDB } from "falkordb";
import { getFalkorConfig } from "@/lib/persistence";

/**
 * Minimal deployment diagnostic. Never returns credentials or host details.
 * This endpoint reports only whether the required environment is configured
 * and whether FalkorDB accepts a simple query.
 */
export async function GET() {
  const config = getFalkorConfig(process.env);
  if (!config) {
    return NextResponse.json({
      ok: false,
      stage: "configuration",
      error: "FalkorDB environment variables are missing or invalid.",
      required: ["FALKORDB_HOST", "FALKORDB_PORT", "FALKORDB_USERNAME", "FALKORDB_PASSWORD"],
    }, { status: 503 });
  }

  let client: Awaited<ReturnType<typeof FalkorDB.connect>> | undefined;
  try {
    client = await FalkorDB.connect({
      username: config.username,
      password: config.password,
      socket: {
        host: config.host,
        port: config.port,
        tls: config.tls,
        connectTimeout: 8000,
      },
    });
    const graph = client.selectGraph(config.graphName);
    await graph.query("RETURN 1 AS ok");
    return NextResponse.json({ ok: true, stage: "connected", graphConfigured: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    const category = /auth|password|credential|noperm/.test(lower) ? "authentication"
      : /timeout|timed out|econnrefused|enotfound|socket|connect/.test(lower) ? "network"
      : "query";
    console.error("[MEMORY HEALTH] FalkorDB diagnostic failed:", { category, message });
    return NextResponse.json({
      ok: false,
      stage: category,
      error: category === "authentication"
        ? "FalkorDB rejected the configured credentials."
        : category === "network"
          ? "The app could not establish a connection to FalkorDB. Check host, port, TLS, and network access."
          : "FalkorDB connected, but the diagnostic query failed. Check graph/database compatibility and server logs.",
    }, { status: 503 });
  } finally {
    if (client) {
      try { await client.close(); } catch (error) {
        console.error("[MEMORY HEALTH] FalkorDB close failed:", error);
      }
    }
  }
}
