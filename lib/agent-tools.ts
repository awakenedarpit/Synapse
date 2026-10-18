import type { FunctionDeclaration } from "@google/genai";
import type { GraphQueryRunner } from "@/lib/persistence";

export const MAX_TOOL_EXECUTIONS = 4;
const MAX_RESULTS = 10;
const TOOL_NAMES = ["search_memories", "find_entity_relationships"] as const;
export type GraphToolName = (typeof TOOL_NAMES)[number];

type ToolArgs = Record<string, unknown>;

type MemoryRow = { memoryId?: unknown; content?: unknown; createdAt?: unknown; entities?: unknown };
type RelationshipRow = { key?: unknown; name?: unknown; type?: unknown; relatedName?: unknown; relatedType?: unknown; relation?: unknown; sourceMemoryId?: unknown };

export const graphToolDeclarations: FunctionDeclaration[] = [
  {
    name: "search_memories",
    description: "Search the current user's non-deleted graph memories by a phrase or entity name. Use this before answering questions about what the user stored.",
    parametersJsonSchema: {
      type: "object",
      properties: { query: { type: "string", description: "A concise phrase, project name, person name, or fact to search for." }, limit: { type: "integer", description: "Maximum results, from 1 to 10." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "find_entity_relationships",
    description: "Find exact-name or exact-alias matches for a current user's entity and return its stored graph relationships. If several entities match, report ambiguity instead of guessing.",
    parametersJsonSchema: {
      type: "object",
      properties: { name: { type: "string", description: "The exact entity name or alias to resolve." }, limit: { type: "integer", description: "Maximum relationship rows, from 1 to 10." } },
      required: ["name"],
      additionalProperties: false,
    },
  },
];

export function getCurrentDateTime() {
  const now = new Date();
  const timeZone = process.env.AGENT_TIME_ZONE || "Asia/Kolkata";
  let localDateTime: string;
  try {
    localDateTime = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone,
    }).format(now);
  } catch {
    localDateTime = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: "UTC",
    }).format(now);
  }
  return {
    ok: true,
    iso: now.toISOString(),
    unixMilliseconds: now.getTime(),
    timeZone,
    localDateTime,
    source: "server clock",
  };
}

function textArg(args: ToolArgs, name: string): string | null {
  const value = args[name];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= 200 ? trimmed : null;
}

function resultLimit(args: ToolArgs): number {
  const value = args.limit;
  if (typeof value !== "number" || !Number.isInteger(value)) return MAX_RESULTS;
  return Math.max(1, Math.min(MAX_RESULTS, value));
}

function isToolName(value: unknown): value is GraphToolName {
  return typeof value === "string" && (TOOL_NAMES as readonly string[]).includes(value);
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function searchMemories(graph: GraphQueryRunner, userId: string, args: ToolArgs) {
  const query = textArg(args, "query");
  if (!query) return { ok: false, error: "query must be a non-empty string of at most 200 characters" };
  const limit = resultLimit(args);
  const result = await graph.query(
    `MATCH (m:Memory {userId: $userId})
     WHERE coalesce(m.deleted, false) = false
       AND (toLower(m.content) CONTAINS toLower($query)
         OR EXISTS { MATCH (m)-[:MENTIONS]->(e:Entity)
           WHERE toLower(e.name) CONTAINS toLower($query)
             AND (e.ownerUserId = $userId) })
     OPTIONAL MATCH (m)-[:MENTIONS]->(mentioned:Entity)
     WHERE mentioned.ownerUserId = $userId
     RETURN m.id AS memoryId, m.content AS content, m.createdAt AS createdAt,
       collect(DISTINCT mentioned.name) AS entities
     ORDER BY m.createdAt DESC LIMIT $limit`,
    { params: { userId, query, limit } },
  );
  const memories = (Array.isArray(result.data) ? result.data : []).map((row: unknown) => {
    const item = row as MemoryRow;
    return { memoryId: asText(item.memoryId) || "", content: asText(item.content) || "", createdAt: asNumber(item.createdAt), entities: Array.isArray(item.entities) ? item.entities.map(asText).filter((value): value is string => Boolean(value)) : [] };
  }).filter((item) => item.memoryId && item.content);
  return { ok: true, query, memories };
}

export async function findEntityRelationships(graph: GraphQueryRunner, userId: string, args: ToolArgs) {
  const name = textArg(args, "name");
  if (!name) return { ok: false, error: "name must be a non-empty string of at most 200 characters" };
  const limit = resultLimit(args);
  const result = await graph.query(
    `MATCH (e:Entity)
     WHERE (e.ownerUserId = $userId)
       AND (toLower(e.name) = toLower($name)
         OR any(alias IN coalesce(e.aliases, []) WHERE toLower(alias) = toLower($name)))
     OPTIONAL MATCH (e)-[r]-(other:Entity)
     WHERE coalesce(r.deleted, false) = false
       AND (other.ownerUserId = $userId)
     RETURN e.key AS key, e.name AS name, e.type AS type,
       other.name AS relatedName, other.type AS relatedType, type(r) AS relation,
       r.sourceMemoryId AS sourceMemoryId
     LIMIT $limit`,
    { params: { userId, name, limit } },
  );
  const rows = (Array.isArray(result.data) ? result.data : []).map((row: unknown) => row as RelationshipRow);
  const entities = Array.from(new Map(rows.map((row) => {
    const key = asText(row.key);
    return key ? [key, { key, name: asText(row.name) || key, type: asText(row.type) || "Other" }] as const : null;
  }).filter((item): item is readonly [string, { key: string; name: string; type: string }] => item !== null)) .values());
  if (!entities.length) return { ok: true, status: "not_found", name, entities: [], relationships: [] };
  if (entities.length > 1) return { ok: true, status: "ambiguous", name, entities, relationships: [] };
  const relationships = rows.map((row) => {
    const relatedName = asText(row.relatedName);
    const relation = asText(row.relation);
    if (!relatedName || !relation) return null;
    return { from: entities[0].name, relation, to: relatedName, relatedType: asText(row.relatedType) || "Other", sourceMemoryId: asText(row.sourceMemoryId) || null };
  }).filter((item): item is { from: string; relation: string; to: string; relatedType: string; sourceMemoryId: string | null } => item !== null);
  return { ok: true, status: "resolved", name, entities, relationships };
}

export async function executeGraphTool(graph: GraphQueryRunner | undefined, userId: string, name: unknown, args: unknown) {
  if (!isToolName(name)) return { ok: false, error: "Unknown or disallowed graph tool." };
  if (!graph) return { ok: false, error: "Graph memory is unavailable." };
  const safeArgs = args && typeof args === "object" && !Array.isArray(args) ? args as ToolArgs : {};
  if (name === "search_memories") return searchMemories(graph, userId, safeArgs);
  return findEntityRelationships(graph, userId, safeArgs);
}
