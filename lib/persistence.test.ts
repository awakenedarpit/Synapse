import assert from "node:assert/strict";
import { test } from "node:test";
import {
  correctMemory,
  forgetMemory,
  getFalkorConfig,
  linkMemoryToEntity,
  normalizeUserId,
  readGraphEvidence,
  readRecentMemories,
  scopeEntityKey,
  writeEntity,
  writeMemory,
  writeRelationship,
} from "./persistence.ts";
import type { GraphQueryOptions } from "./persistence.ts";

type QueryCall = { cypher: string; params?: GraphQueryOptions["params"] };

function createMockGraph(rows: unknown[] = []) {
  const calls: QueryCall[] = [];
  return {
    calls,
    async query(cypher: string, options?: GraphQueryOptions) {
      calls.push({ cypher, params: options?.params });
      return { data: rows };
    },
  };
}

test("loads one consistent FalkorDB configuration, graph name, and TLS mode", () => {
  assert.deepEqual(getFalkorConfig({ FALKORDB_HOST: "db", FALKORDB_PORT: "6380", FALKORDB_USERNAME: "user", FALKORDB_PASSWORD: "secret", FALKORDB_GRAPH_NAME: "project_memory", FALKORDB_TLS: "TRUE" }), {
    host: "db", port: 6380, username: "user", password: "secret", graphName: "project_memory", tls: true,
  });
  assert.equal(getFalkorConfig({ FALKORDB_HOST: "db", FALKORDB_PORT: "6380", FALKORDB_USERNAME: "user", FALKORDB_PASSWORD: "secret" })?.tls, false);
  assert.equal(getFalkorConfig({ FALKORDB_HOST: "db", FALKORDB_PORT: "not-a-port", FALKORDB_USERNAME: "user", FALKORDB_PASSWORD: "secret" }), null);
});

test("normalizes user scope and rejects unsafe or empty values", () => {
  assert.equal(normalizeUserId(" team.alpha-1 "), "team.alpha-1");
  assert.equal(normalizeUserId("user with spaces"), "default");
  assert.equal(normalizeUserId(""), "default");
  assert.equal(scopeEntityKey("user-1", "person_arpit_raj"), "user-1::person_arpit_raj");
});

test("writes a traceable memory with owner, source, timestamp, and user edge", async () => {
  const graph = createMockGraph([{ memoryId: "memory-1" }]);
  assert.equal(await writeMemory(graph, { memoryId: "memory-1", userId: "user-1", content: "A fact", createdAt: 123, source: "chat" }), true);
  assert.match(graph.calls[0].cypher, /MERGE \(u:User/);
  assert.match(graph.calls[0].cypher, /CREATE \(m:Memory/);
  assert.match(graph.calls[0].cypher, /HAS_MEMORY/);
  assert.deepEqual(graph.calls[0].params, { memoryId: "memory-1", userId: "user-1", content: "A fact", createdAt: 123, source: "chat" });
});

test("writes entity ownership and idempotent provenance links", async () => {
  const graph = createMockGraph([{ key: "person_arpit_raj" }, { memoryId: "memory-1" }]);
  assert.equal(await writeEntity(graph, { key: "person_arpit_raj", name: "Arpit Raj", type: "Person", aliases: ["Arpit"], userId: "user-1", updatedAt: 123 }), true);
  assert.equal(await linkMemoryToEntity(graph, "memory-1", "person_arpit_raj", "user-1", 123), true);
  assert.match(graph.calls[0].cypher, /ownerUserId/);
  assert.match(graph.calls[1].cypher, /MENTIONS/);
  assert.match(graph.calls[1].cypher, /sourceMemoryId/);
});

test("writes a typed relationship with provenance and user scope", async () => {
  const graph = createMockGraph([{ fromKey: "person_arpit_raj", toKey: "project_graph_memory" }]);
  assert.equal(await writeRelationship(graph, { fromKey: "person_arpit_raj", toKey: "project_graph_memory", relation: "BUILDS", memoryId: "memory-1", userId: "user-1", observedAt: 123 }), true);
  assert.match(graph.calls[0].cypher, /MATCH \(a:Entity/);
  assert.match(graph.calls[0].cypher, /MERGE \(a\)-\[r:BUILDS\]->\(b\)/);
  assert.match(graph.calls[0].cypher, /sourceUserId/);
});

test("reads only the requested user's recent memories through parameters", async () => {
  const graph = createMockGraph([{ content: "older" }, { content: "newer" }]);
  const result = await readRecentMemories(graph, "user-1", 10);
  assert.deepEqual(result, ["newer", "older"]);
  assert.deepEqual(graph.calls[0].params, { userId: "user-1", limit: 10 });
});

test("retrieves bounded graph evidence for one user and groups duplicate memory rows", async () => {
  const graph = createMockGraph([
    { memoryId: "memory-2", content: "I build Graph Memory", createdAt: 200, entities: ["Arpit", "Graph Memory"], relationships: ["Arpit BUILDS Graph Memory"] },
    { memoryId: "memory-1", content: "My name is Arpit", createdAt: 100, entities: ["Arpit"], relationships: [null] },
    { memoryId: "memory-2", content: "I build Graph Memory", createdAt: 200, entities: ["Graph Memory"], relationships: ["Arpit BUILDS Graph Memory"] },
  ]);
  const result = await readGraphEvidence(graph, "user-1", 2);
  assert.deepEqual(result, [
    { memoryId: "memory-1", content: "My name is Arpit", createdAt: 100, entities: ["Arpit"], relationships: [] },
    { memoryId: "memory-2", content: "I build Graph Memory", createdAt: 200, entities: ["Arpit", "Graph Memory"], relationships: ["Arpit BUILDS Graph Memory"] },
  ]);
  assert.match(graph.calls[0].cypher, /MATCH \(m:Memory \{userId: \$userId\}\)/);
  assert.match(graph.calls[0].cypher, /e\.ownerUserId = \$userId/);
  assert.match(graph.calls[0].cypher, /e\.ownerUserId IS NULL AND \$userId = 'default'/);
  assert.match(graph.calls[0].cypher, /OPTIONAL MATCH \(e\)-\[r\]-\(related:Entity\)/);
  assert.deepEqual(graph.calls[0].params, { userId: "user-1", limit: 2 });
});

test("corrects one active memory while preserving a revision node", async () => {
  const graph = createMockGraph([{ memoryId: "memory-1" }]);
  const changed = await correctMemory(graph, { memoryId: "memory-1", userId: "user-1", content: "The corrected fact", correctedAt: 456 });
  assert.equal(changed, true);
  assert.match(graph.calls[0].cypher, /CREATE \(revision:MemoryRevision/);
  assert.match(graph.calls[0].cypher, /previousContent: m.content/);
  assert.match(graph.calls[0].cypher, /HAS_REVISION/);
  assert.deepEqual(graph.calls[0].params, { memoryId: "memory-1", userId: "user-1", content: "The corrected fact", correctedAt: 456 });
});

test("soft-forgets an exact active memory without deleting graph data", async () => {
  const graph = createMockGraph([{ memoryId: "memory-1" }]);
  const forgotten = await forgetMemory(graph, "memory-1", "user-1", 789);
  assert.equal(forgotten, true);
  assert.match(graph.calls[0].cypher, /SET m.deleted = true/);
  assert.doesNotMatch(graph.calls[0].cypher, /DELETE|DETACH DELETE/);
  assert.match(graph.calls[0].cypher, /userId: \$userId/);
  assert.deepEqual(graph.calls[0].params, { memoryId: "memory-1", userId: "user-1", forgottenAt: 789 });
});
