# Product Requirements Document

## Vision

Graph Memory Agent helps a user store meaningful facts in a knowledge graph and recall them later with grounded AI responses. The experience should make memory persistence visible without exposing private data or inventing facts.

## Primary user journeys

1. **Remember:** The user tells the agent a fact, project, person, preference, or relationship. The agent saves the raw memory and structured graph facts.
2. **Recall:** The user asks a follow-up question. The agent retrieves relevant evidence and answers only from stored facts plus the current conversation.
3. **Explore:** The user opens the graph explorer, searches or inspects nodes, and understands how memories connect.
4. **Correct:** The user clarifies or corrects a fact. The agent updates the existing fact rather than creating a duplicate.
5. **Forget:** The user requests removal of a fact. Ambiguous requests require clarification and confirmed scope.

## Requirements

### Chat and memory

- Provide responsive, accessible chat with clear loading, empty, success, and error states.
- Persist meaningful user memories without silently losing the raw message.
- Use retrieved evidence when answering memory questions and admit missing information.

### Identity and graph quality

- Reuse an entity only when identity is sufficiently certain.
- Support aliases and unambiguous short-name resolution.
- Never merge people solely on a shared first name.
- Store typed relationships and avoid duplicate edges.
- Preserve provenance and timestamps for important facts.

### Privacy and reliability

- Scope memory reads and writes to an explicit authenticated user identity.
- Validate dynamic graph labels and relationship types.
- Preserve existing data during migrations.
- Provide safe errors when integrations are unavailable.

### Graph explorer

- Show graph loading, empty, and failure states.
- Support node selection and useful details.
- Add search/filter/path highlighting in a later milestone.
- Remain usable on desktop and mobile.

## Milestone acceptance criteria

- M0: documented architecture, baseline checks, risks, and setup.
- M1: clean production build; polished responsive chat/graph UI; no fake controls.
- M2: implemented with canonical/type-scoped identity keys, explicit aliases, ambiguity-safe short-name matching, duplicate-resistant entity and relationship writes, and six repeatable regression tests.
- M3: implemented with shared graph configuration, normalized request-level user scope, traceable memory/entity/relationship provenance, additive legacy compatibility, and controlled persistence integration tests.
- M4: bounded graph retrieval and multi-hop evidence.
- M5: safe correction and forgetting.
- M6: explicit conversational/pronoun context.
- M7: graph search, filters, details, and path highlighting.
- M8: regression suite and hackathon demo readiness.
