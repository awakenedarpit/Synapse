export type EntityType =
  | "Person"
  | "Project"
  | "Team"
  | "Skill"
  | "Organization"
  | "Preference"
  | "Place"
  | "Other";

export type KnownEntity = {
  key: string;
  name: string;
  type: EntityType;
  aliases?: string[];
};

export type ExtractedEntity = {
  name: string;
  type: EntityType;
  aliases?: string[];
};

export type ExtractedRelationship = {
  from: string;
  relation: string;
  to: string;
};

export type IdentityMatch =
  | { status: "exact" | "alias" | "short"; entity: KnownEntity; input: string }
  | { status: "ambiguous"; candidates: KnownEntity[]; input: string }
  | { status: "new"; key: string; input: string };

export function normalizeIdentityText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function identityKey(type: EntityType, name: string): string {
  const slug = normalizeIdentityText(name)
    .replace(/\s+/g, "_")
    .slice(0, 100);
  return `${type.toLocaleLowerCase()}_${slug || "unnamed"}`;
}

function uniqueEntities(entities: KnownEntity[]): KnownEntity[] {
  return Array.from(new Map(entities.map((entity) => [entity.key, entity])).values());
}

function firstToken(value: string): string {
  return normalizeIdentityText(value).split(" ")[0] || "";
}

export function resolveEntityIdentity(
  inputName: string,
  type: EntityType,
  knownEntities: KnownEntity[],
): IdentityMatch {
  const input = inputName.trim();
  const normalized = normalizeIdentityText(input);
  const typed = uniqueEntities(knownEntities.filter((entity) => entity.type === type));
  const exact = typed.filter((entity) => normalizeIdentityText(entity.name) === normalized);
  if (exact.length === 1) return { status: "exact", entity: exact[0], input };
  if (exact.length > 1) return { status: "ambiguous", candidates: exact, input };

  const aliases = typed.filter((entity) =>
    (entity.aliases || []).some((alias) => normalizeIdentityText(alias) === normalized),
  );
  if (aliases.length === 1) return { status: "alias", entity: aliases[0], input };
  if (aliases.length > 1) return { status: "ambiguous", candidates: aliases, input };

  // A short Person name may resolve only when exactly one known person has that first token.
  if (type === "Person" && !normalized.includes(" ")) {
    const matches = typed.filter((entity) =>
      [entity.name, ...(entity.aliases || [])].some((value) => firstToken(value) === normalized),
    );
    if (matches.length === 1) return { status: "short", entity: matches[0], input };
    if (matches.length > 1) return { status: "ambiguous", candidates: matches, input };
  }

  return { status: "new", key: identityKey(type, input), input };
}

export function dedupeExtractedEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const byIdentity = new Map<string, ExtractedEntity>();
  for (const entity of entities) {
    const name = entity.name.trim();
    if (!name) continue;
    const key = `${entity.type}:${normalizeIdentityText(name)}`;
    const previous = byIdentity.get(key);
    const aliases = Array.from(new Set([...(previous?.aliases || []), ...(entity.aliases || [])].map((alias) => alias.trim()).filter(Boolean)));
    byIdentity.set(key, { name, type: entity.type, ...(aliases.length ? { aliases } : {}) });
  }
  return Array.from(byIdentity.values());
}

export function dedupeRelationships(relationships: ExtractedRelationship[]): ExtractedRelationship[] {
  const seen = new Set<string>();
  return relationships.filter((relationship) => {
    const key = `${normalizeIdentityText(relationship.from)}|${relationship.relation}|${normalizeIdentityText(relationship.to)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
