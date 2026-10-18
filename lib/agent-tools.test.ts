import assert from "node:assert/strict";
import { test } from "node:test";
import { executeGraphTool, findEntityRelationships, graphToolDeclarations, searchMemories } from "./agent-tools.ts";
import type { GraphQueryOptions } from "./persistence.ts";

function createMockGraph(rows: unknown[]) {
  const calls: Array<{ cypher: string; params?: GraphQueryOptions["params"] }> = [];
  return {
    calls,
    async query(cypher: string, options?: GraphQueryOptions) {
      calls.push({ cypher, params: options?.params });
      return { data: rows };
    },
  };
}

test("declares only the two approved read-only graph tools", () => {
  assert.deepEqual(graphToolDeclarations.map((tool) => tool.name), ["search_memories", "find_entity_relationships"]);
  assert.ok(graphToolDeclarations.every((tool) => tool.parametersJsonSchema));
});

test("searches memories with the validated user scope and returns no invented result", async () => {
  const graph = createMockGraph([]);
  const result = await searchMemories(graph, "user-a", { query: "FalkorDB", limit: 50 });
  assert.deepEqual(result, { ok: true, query: "FalkorDB", memories: [] });
  assert.deepEqual(graph.calls[0].params, { userId: "user-a", query: "FalkorDB", limit: 10 });
  assert.match(graph.calls[0].cypher, /m\.userId|Memory \{userId: \$userId\}/);
  assert.match(graph.calls[0].cypher, /e\.ownerUserId = \$userId/);
  assert.match(graph.calls[0].cypher, /mentioned\.ownerUserId = \$userId/);
  assert.doesNotMatch(graph.calls[0].cypher, /ownerUserId IS NULL|\$userId = 'default'/);
  assert.doesNotMatch(graph.calls[0].cypher, /DELETE|DETACH DELETE/);
});

test("returns stored relationships and preserves their source memory evidence", async () => {
  const graph = createMockGraph([
    { key: "user-a::person_arpit", name: "Arpit", type: "Person", relatedName: "Graph Memory", relatedType: "Project", relation: "BUILDS", sourceMemoryId: "memory-1" },
  ]);
  const result = await findEntityRelationships(graph, "user-a", { name: "Arpit" });
  assert.deepEqual(result, {
    ok: true,
    status: "resolved",
    name: "Arpit",
    entities: [{ key: "user-a::person_arpit", name: "Arpit", type: "Person" }],
    relationships: [{ from: "Arpit", relation: "BUILDS", to: "Graph Memory", relatedType: "Project", sourceMemoryId: "memory-1" }],
  });
  assert.deepEqual(graph.calls[0].params, { userId: "user-a", name: "Arpit", limit: 10 });
});

test("reports ambiguous entity names instead of selecting a relationship", async () => {
  const graph = createMockGraph([
    { key: "user-a::person_arpit_raj", name: "Arpit Raj", type: "Person", relatedName: "Project A", relation: "BUILDS" },
    { key: "user-a::person_arpit_shah", name: "Arpit Shah", type: "Person", relatedName: "Project B", relation: "BUILDS" },
  ]);
  const result = await findEntityRelationships(graph, "user-a", { name: "Arpit" });
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(result.relationships, []);
});

test("unknown tools and malformed arguments fail closed", async () => {
  const graph = createMockGraph([]);
  assert.deepEqual(await executeGraphTool(graph, "user-a", "run_cypher", { query: "MATCH (n) RETURN n" }), { ok: false, error: "Unknown or disallowed graph tool." });
  assert.equal((await executeGraphTool(graph, "user-a", "search_memories", { query: ["not", "text"] })).ok, false);
  assert.equal(graph.calls.length, 0);
});
