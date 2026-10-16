export const DEFAULT_GRAPH_NAME = "memory_agent";
export const DEFAULT_USER_ID = "default";

export type GraphQueryParam = null | string | number | boolean | { [key: string]: GraphQueryParam } | GraphQueryParam[];
export type GraphQueryOptions = { params?: Record<string, GraphQueryParam> };
export type GraphQueryRunner = {
  query: (cypher: string, options?: GraphQueryOptions) => Promise<{ data?: unknown[] }>;
};

export type FalkorConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  graphName: string;
};

export type MemoryWrite = {
  memoryId: string;
  userId: string;
  content: string;
  createdAt: number;
  source: "chat" | "document" | "diagnostic";
};

export type EntityWrite = {
  key: string;
  name: string;
  type: string;
  aliases: string[];
  userId: string;
  updatedAt: number;
};

export type RelationshipWrite = {
  fromKey: string;
  toKey: string;
  relation: string;
  memoryId: string;
  userId: string;
  observedAt: number;
};

export type GraphEvidence = {
  memoryId: string;
  content: string;
  createdAt: number;
  entities: string[];
  relationships: string[];
};

export type MemoryCorrection = {
  memoryId: string;
  userId: string;
  content: string;
  correctedAt: number;
};

export function getFalkorConfig(
  env: Record<string, string | undefined>,
): FalkorConfig | null {
  const host = env.FALKORDB_HOST;
  const port = Number(env.FALKORDB_PORT);
  const username = env.FALKORDB_USERNAME;
  const password = env.FALKORDB_PASSWORD;
  if (!host || !Number.isFinite(port) || port <= 0 || !username || !password) return null;
  return {
    host,
    port,
    username,
    password,
    graphName: env.FALKORDB_GRAPH_NAME || DEFAULT_GRAPH_NAME,
  };
}

export function normalizeUserId(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_USER_ID;
  const normalized = value.trim();
  if (!normalized || normalized.length > 120 || !/^[\p{L}\p{N}._:-]+$/u.test(normalized)) return DEFAULT_USER_ID;
  return normalized;
}

export function scopeEntityKey(userId: string, key: string): string {
  return `${userId}::${key}`;
}

export async function readRecentMemories(graph: GraphQueryRunner, userId: string, limit = 10): Promise<string[]> {
  const result = await graph.query(
    "MATCH (m:Memory) WHERE m.userId = $userId AND coalesce(m.deleted, false) = false RETURN m.content AS content ORDER BY m.createdAt DESC LIMIT $limit",
    { params: { userId, limit } },
  );
  return (Array.isArray(result.data) ? result.data : [])
    .map((row: unknown) => row && typeof row === "object" && typeof (row as { content?: unknown }).content === "string" ? (row as { content: string }).content : "")
    .filter(Boolean)
    .reverse();
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function readGraphEvidence(graph: GraphQueryRunner, userId: string, limit = 12): Promise<GraphEvidence[]> {
  const result = await graph.query(
    `MATCH (m:Memory {userId: $userId})
     WHERE coalesce(m.deleted, false) = false
     OPTIONAL MATCH (m)-[:MENTIONS]->(e:Entity)
     WHERE e.ownerUserId = $userId OR (e.ownerUserId IS NULL AND $userId = 'default')
     OPTIONAL MATCH (e)-[r]-(related:Entity)
     WHERE coalesce(r.deleted, false) = false
       AND (related IS NULL OR related.ownerUserId = $userId OR (related.ownerUserId IS NULL AND $userId = 'default'))
     RETURN m.id AS memoryId, m.content AS content, m.createdAt AS createdAt,
       collect(DISTINCT e.name) AS entities,
       collect(DISTINCT CASE WHEN related IS NULL THEN NULL ELSE e.name + ' ' + type(r) + ' ' + related.name END) AS relationships
     ORDER BY m.createdAt DESC LIMIT $limit`,
    { params: { userId, limit } },
  );
  const grouped = new Map<string, GraphEvidence>();
  for (const row of Array.isArray(result.data) ? result.data : []) {
    if (!row || typeof row !== "object") continue;
    const item = row as { memoryId?: unknown; content?: unknown; createdAt?: unknown; entities?: unknown; relationships?: unknown };
    const memoryId = stringValue(item.memoryId);
    const content = stringValue(item.content);
    if (!memoryId || !content) continue;
    const entities = Array.isArray(item.entities) ? item.entities.map(stringValue).filter((value): value is string => Boolean(value)) : [];
    const relationships = Array.isArray(item.relationships) ? item.relationships.map(stringValue).filter((value): value is string => Boolean(value)) : [];
    const existing = grouped.get(memoryId);
    if (existing) {
      existing.entities = Array.from(new Set([...existing.entities, ...entities]));
      existing.relationships = Array.from(new Set([...existing.relationships, ...relationships]));
      continue;
    }
    grouped.set(memoryId, {
      memoryId,
      content,
      createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
      entities: Array.from(new Set(entities)),
      relationships: Array.from(new Set(relationships)),
    });
  }
  return Array.from(grouped.values()).sort((a, b) => a.createdAt - b.createdAt).slice(-limit);
}

export async function correctMemory(graph: GraphQueryRunner, correction: MemoryCorrection): Promise<boolean> {
  const result = await graph.query(
    `MATCH (m:Memory {id: $memoryId, userId: $userId})
     WHERE coalesce(m.deleted, false) = false
     CREATE (revision:MemoryRevision {id: $memoryId, userId: $userId, previousContent: m.content, createdAt: $correctedAt})
     CREATE (m)-[:HAS_REVISION]->(revision)
     SET m.content = $content, m.updatedAt = $correctedAt, m.correctedAt = $correctedAt
     RETURN m.id AS memoryId`,
    { params: correction },
  );
  return Array.isArray(result.data) && result.data.length > 0;
}

export async function forgetMemory(graph: GraphQueryRunner, memoryId: string, userId: string, forgottenAt: number): Promise<boolean> {
  const result = await graph.query(
    `MATCH (m:Memory {id: $memoryId, userId: $userId})
     WHERE coalesce(m.deleted, false) = false
     SET m.deleted = true, m.deletedAt = $forgottenAt, m.updatedAt = $forgottenAt
     WITH m
     OPTIONAL MATCH (a:Entity)-[r]->(b:Entity)
     WHERE r.sourceMemoryId = $memoryId AND r.sourceUserId = $userId
     SET r.deleted = true, r.deletedAt = $forgottenAt
     RETURN m.id AS memoryId`,
    { params: { memoryId, userId, forgottenAt } },
  );
  return Array.isArray(result.data) && result.data.length > 0;
}

export async function writeMemory(graph: GraphQueryRunner, memory: MemoryWrite): Promise<boolean> {
  const result = await graph.query(
    `MERGE (u:User {id: $userId})
     CREATE (m:Memory {id: $memoryId, userId: $userId, content: $content, source: $source, createdAt: $createdAt, updatedAt: $createdAt})
     MERGE (u)-[:HAS_MEMORY]->(m)
     RETURN m.id AS memoryId`,
    { params: memory },
  );
  return Array.isArray(result.data) && result.data.length > 0;
}

export async function writeEntity(graph: GraphQueryRunner, entity: EntityWrite): Promise<boolean> {
  const result = await graph.query(
    `MERGE (e:Entity {key: $key})
     SET e.name = $name, e.type = $type, e.aliases = $aliases, e.ownerUserId = $userId, e.updatedAt = $updatedAt
     RETURN e.key AS key`,
    { params: entity },
  );
  return Array.isArray(result.data) && result.data.length > 0;
}

export async function linkMemoryToEntity(graph: GraphQueryRunner, memoryId: string, entityKey: string, userId: string, observedAt: number): Promise<boolean> {
  const result = await graph.query(
    `MATCH (m:Memory {id: $memoryId, userId: $userId}), (e:Entity {key: $entityKey, ownerUserId: $userId})
     MERGE (m)-[r:MENTIONS]->(e)
     SET r.observedAt = $observedAt, r.sourceMemoryId = $memoryId, r.sourceUserId = $userId
     RETURN m.id AS memoryId`,
    { params: { memoryId, entityKey, userId, observedAt } },
  );
  return Array.isArray(result.data) && result.data.length > 0;
}

export async function writeRelationship(graph: GraphQueryRunner, relationship: RelationshipWrite): Promise<boolean> {
  const result = await graph.query(
    `MATCH (a:Entity {key: $fromKey, ownerUserId: $userId}), (b:Entity {key: $toKey, ownerUserId: $userId})
     MERGE (a)-[r:${relationship.relation}]->(b)
     SET r.updatedAt = $observedAt, r.sourceMemoryId = $memoryId, r.sourceUserId = $userId
     RETURN a.key AS fromKey, b.key AS toKey`,
    { params: relationship },
  );
  return Array.isArray(result.data) && result.data.length > 0;
}
