import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dedupeExtractedEntities,
  dedupeRelationships,
  identityKey,
  normalizeIdentityText,
  resolveEntityIdentity,
} from "./identity.ts";
import type { KnownEntity } from "./identity.ts";

const people: KnownEntity[] = [
  { key: "person_arpit_raj", name: "Arpit Raj", type: "Person", aliases: ["AJ"] },
  { key: "person_arpit_sharma", name: "Arpit Sharma", type: "Person" },
  { key: "project_graph_memory", name: "Graph Memory", type: "Project" },
];

test("normalizes equivalent names without losing Unicode letters", () => {
  assert.equal(normalizeIdentityText("  Graph—Memory  "), "graph memory");
  assert.equal(identityKey("Project", "Graph Memory"), "project_graph_memory");
});

test("resolves an exact person and a declared alias to the same entity", () => {
  const exact = resolveEntityIdentity("Arpit Raj", "Person", people);
  const alias = resolveEntityIdentity("AJ", "Person", people);
  assert.equal(exact.status, "exact");
  assert.equal(alias.status, "alias");
  if (exact.status !== "exact" || alias.status !== "alias") return;
  assert.equal(exact.entity.key, alias.entity.key);
});

test("resolves a short name only when the first-name match is unique", () => {
  const ambiguous = resolveEntityIdentity("Arpit", "Person", people);
  assert.equal(ambiguous.status, "ambiguous");
  if (ambiguous.status === "ambiguous") assert.equal(ambiguous.candidates.length, 2);

  const unique = resolveEntityIdentity("Graph", "Project", people);
  assert.equal(unique.status, "new");
});

test("does not merge a same-named entity across domain types", () => {
  const match = resolveEntityIdentity("Graph Memory", "Person", people);
  assert.equal(match.status, "new");
  if (match.status === "new") assert.equal(match.key, "person_graph_memory");
});

test("deduplicates extracted entities and merges their aliases", () => {
  const result = dedupeExtractedEntities([
    { name: "Arpit Raj", type: "Person", aliases: ["Arpit"] },
    { name: " Arpit Raj ", type: "Person", aliases: ["AJ"] },
    { name: "Graph Memory", type: "Project" },
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].aliases, ["Arpit", "AJ"]);
});

test("deduplicates identical typed relationships within one extraction", () => {
  const result = dedupeRelationships([
    { from: "Arpit Raj", relation: "BUILDS", to: "Graph Memory" },
    { from: "arpit raj", relation: "BUILDS", to: "graph-memory" },
    { from: "Arpit Raj", relation: "USES", to: "FalkorDB" },
  ]);
  assert.equal(result.length, 2);
});
