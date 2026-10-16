import { NextRequest, NextResponse } from "next/server";
import { FalkorDB } from "falkordb";
import { getFalkorConfig, normalizeUserId } from "@/lib/persistence";

type GraphRow = { sourceId?: string | number; sourceType?: string; targetId?: string | number; targetType?: string; content?: string; relType?: string };
type GraphNode = { id: string; label: string; type: string };
type GraphLink = { source: string; target: string; label: string };

export async function GET(req: NextRequest) {
  let client: Awaited<ReturnType<typeof FalkorDB.connect>> | undefined;
  try {
    const config = getFalkorConfig(process.env);
    if (!config) return NextResponse.json({ error: "FalkorDB configuration is missing or invalid." }, { status: 500 });
    const userId = normalizeUserId(new URL(req.url).searchParams.get("userId"));
    client = await FalkorDB.connect({ username: config.username, password: config.password, socket: { host: config.host, port: config.port, tls: false, connectTimeout: 10000 } });
    const graph = client.selectGraph(config.graphName);
    const result = await graph.query(`
      MATCH (m:Memory)
      WHERE m.userId = $userId AND coalesce(m.deleted, false) = false
      RETURN $userId AS sourceId, 'User' AS sourceType,
             toString(id(m)) AS targetId, labels(m)[0] AS targetType,
             m.content AS content, 'HAS_MEMORY' AS relType
      ORDER BY m.createdAt ASC`, { params: { userId } });
    const nodesMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    if (result && Array.isArray(result.data)) {
      for (const row of result.data as GraphRow[]) {
        const { sourceId, sourceType, targetId, targetType, content, relType } = row;
        if (sourceId !== undefined && sourceId !== null && !nodesMap.has(String(sourceId))) nodesMap.set(String(sourceId), { id: String(sourceId), label: `User (${sourceId})`, type: sourceType || "User" });
        if (targetId !== undefined && targetId !== null && !nodesMap.has(String(targetId))) nodesMap.set(String(targetId), { id: String(targetId), label: content ? content.length > 35 ? `${content.substring(0, 32)}...` : content : `Memory (${targetId})`, type: targetType || "Memory" });
        if (sourceId !== undefined && sourceId !== null && targetId !== undefined && targetId !== null) links.push({ source: String(sourceId), target: String(targetId), label: relType || "HAS_MEMORY" });
      }
    }
    const entityScope = "(e.ownerUserId = $userId OR (e.ownerUserId IS NULL AND $userId = 'default'))";
    const entityResult = await graph.query(`MATCH (e:Entity) WHERE ${entityScope} RETURN e.key AS key, e.name AS name, e.type AS type` , { params: { userId } });
    const entityIds = new Set<string>();
    if (entityResult && Array.isArray(entityResult.data)) {
      for (const raw of entityResult.data as Array<{ key?: string; name?: string; type?: string }>) {
        if (!raw.key) continue;
        entityIds.add(raw.key);
        nodesMap.set(`entity:${raw.key}`, { id: `entity:${raw.key}`, label: raw.name || raw.key, type: raw.type || "Other" });
      }
    }
    const relationResult = await graph.query(`MATCH (a:Entity)-[r]->(b:Entity) WHERE coalesce(r.deleted, false) = false AND (${entityScope.replaceAll("e.", "a.")}) AND (b.ownerUserId = $userId OR (b.ownerUserId IS NULL AND $userId = 'default')) RETURN a.key AS fromKey, b.key AS toKey, type(r) AS relation`, { params: { userId } });
    if (relationResult && Array.isArray(relationResult.data)) {
      for (const relation of relationResult.data as Array<{ fromKey?: string; toKey?: string; relation?: string }>) {
        if (!relation.fromKey || !relation.toKey || !entityIds.has(relation.fromKey) || !entityIds.has(relation.toKey)) continue;
        links.push({ source: `entity:${relation.fromKey}`, target: `entity:${relation.toKey}`, label: relation.relation || "RELATED_TO" });
      }
    }
    return NextResponse.json({ nodes: Array.from(nodesMap.values()), links });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[API/GRAPH] FalkorDB query failed:", errorMessage);
    return NextResponse.json({ error: "Failed to retrieve graph data" }, { status: 500 });
  } finally {
    if (client) { try { await client.close(); } catch (closeError) { console.error("[API/GRAPH] FalkorDB close failed:", closeError); } }
  }
}
