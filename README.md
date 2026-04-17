# @truealter/sdk

ALTER Identity SDK — query the continuous identity field from any JavaScript/TypeScript environment.

[![npm version](https://img.shields.io/npm/v/@truealter/sdk.svg)](https://www.npmjs.com/package/@truealter/sdk)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![CI](https://github.com/true-alter/alter-identity/actions/workflows/ci.yml/badge.svg)](https://github.com/true-alter/alter-identity/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](#api)
[![Glama score](https://glama.ai/mcp/servers/true-alter/alter-identity/badges/score.svg)](https://glama.ai/mcp/servers/true-alter/alter-identity)

> **Install:** `npm install @truealter/sdk`
> **Publish channel:** this repository is the public source mirror of the SDK that ships as [`@truealter/sdk`](https://www.npmjs.com/package/@truealter/sdk) on npm. The canonical build + publish flow lives in ALTER's monorepo — PRs and issues are welcome here; upstream sync happens on each tagged release.

A thin client over the ALTER MCP server (Streamable HTTP, JSON-RPC 2.0, MCP spec `2025-11-25`) with x402 micropayment support, ES256 provenance verification, and config generators for Claude Code, Cursor, and generic MCP clients.

- **Branded host:** `https://mcp.truealter.com` (serves `.well-known/mcp.json` for discovery)
- **JSON-RPC wire endpoint:** `https://mcp.truealter.com/api/v1/mcp` — this is what Streamable HTTP POSTs target (the SDK default); bare host returns 405
- **Wire protocol:** Streamable HTTP, JSON-RPC 2.0, MCP `2025-11-25` (server negotiates `2025-06-18` + `2025-03-26` for backwards-compatible clients)
- **Tools:** 32 typed and wired — 24 free (L0) + 8 premium (L1–L5). Mirrors the live server's `tools/list` response byte-for-byte
- **Runtime:** Node 18+, Deno, Bun, Cloudflare Workers, modern browsers
- **Crypto:** `@noble/ed25519` + `@noble/hashes` (no other dependencies)
- **Bundle:** ESM + CJS dual output

## Quickstart

```
npm install @truealter/sdk
npx alter-identity init
npx alter-identity verify ~truealter
```

## Why ALTER ≠ IAM

Identity Access Management answers *who is logged in*. ALTER answers *who they actually are* — a continuous field of recognition (Paper VIII, Theorem 1) that any IAM stack can sit on top of.

Reference: Morrison, B. (2026). *Identity Field Theory: A Continuous Field Model of Recognition*. Figshare. [DOI 10.6084/m9.figshare.31951383](https://doi.org/10.6084/m9.figshare.31951383)

## API

### Initialise the client

```ts
import { AlterClient, X402Client } from "@truealter/sdk";

const alter = new AlterClient({
  endpoint: "https://mcp.truealter.com/api/v1/mcp", // optional — this is the default; bare host returns 405
  apiKey: process.env.ALTER_API_KEY,     // optional for free tier
  x402: new X402Client({                  // optional — only required for premium tools
    signer: yourViemOrEthersSigner,
    maxPerQuery: "0.10",
  }),
});
```

### Free tier (L0 — no payment required)

```ts
// Verify a registered identity by handle, email, or id
const verified = await alter.verify("~truealter");
const verifiedById = await alter.verify(
  "550e8400-e29b-41d4-a716-446655440000",
  {
    archetype: "weaver",
    min_engagement_level: 3,
    traits: { pressure_response: { min: 0.6 } },
  },
);

// Reference data — the 12 ALTER archetypes
const archetypes = await alter.listArchetypes();

// Identity depth and available tool tiers
const depth = await alter.getEngagementLevel({
  candidate_id: "550e8400-e29b-41d4-a716-446655440000",
});

// Search by trait criteria — no PII exposed, max 5 results
const matches = await alter.searchIdentities({
  trait_criteria: {
    pressure_response: { min: 0.7 },
    cognitive_flexibility: { min: 0.6 },
  },
});

// Golden Thread program status
const thread = await alter.goldenThreadStatus();
```

### Premium tier (L1–L5 — x402 payment required)

```ts
// L1 — Extract trait signals from text ($0.005, first 100 free per bot)
const signals = await alter.assessTraits({
  text: "I led the incident response when our payment rails went down...",
  context: "interview transcript",
});

// L2 — Full 33-trait vector ($0.01)
const vector = await alter.getFullTraitVector({
  candidate_id: "550e8400-e29b-41d4-a716-446655440000",
});

// L4 — Belonging probability for a person-job pairing ($0.05)
const belonging = await alter.computeBelonging({
  candidate_id: "550e8400-e29b-41d4-a716-446655440000",
  job_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
});

// L5 — Top match recommendations ($0.50)
const recommendations = await alter.getMatchRecommendations({
  candidate_id: "550e8400-e29b-41d4-a716-446655440000",
  limit: 5,
});

// L5 — Human-readable narrative explaining a match ($0.50)
const narrative = await alter.generateMatchNarrative({
  match_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
});
```

### Provenance verification

```ts
// Every medium- and high-blast-radius response is signed with ES256.
// Verification is opt-in — call alter.verifyProvenance(...) yourself.
const result = await alter.getFullTraitVector({
  candidate_id: "550e8400-e29b-41d4-a716-446655440000",
});

const check = await alter.verifyProvenance(result._meta?.provenance);
if (!check.valid) throw new Error(`provenance failed: ${check.reason}`);

// Verify that schema hashes published in tools/list._meta.signatures
// match the local representation of each tool.
const tools = await alter.mcp.listTools();
const sigs = tools._meta?.signatures ?? {};
const results = await alter.verifyToolSignatures(tools.tools, sigs);
const tampered = results.filter((r) => !r.valid);
if (tampered.length) throw new Error(`tampered tools: ${tampered.map((t) => t.tool).join(", ")}`);
```

### Discovery

```ts
import { discover } from "@truealter/sdk";

// Three-step discovery cascade: DNS TXT → mcp.json → alter.json
const descriptor = await discover("truealter.com");
// → { url: "https://mcp.truealter.com/api/v1/mcp", transport, source, publicKey, x402Contract, capability }
```

### Low-level MCPClient

```ts
import { MCPClient } from "@truealter/sdk";

const mcp = new MCPClient({ endpoint: "https://mcp.truealter.com/api/v1/mcp" });
await mcp.initialize();
const tools = await mcp.listTools();
const response = await mcp.callTool("verify_identity", {
  candidate_id: "550e8400-e29b-41d4-a716-446655440000",
});
```

## MCP Config Generation

The SDK ships config generators for the major MCP-aware clients. Each emits a JSON snippet you can paste (or write directly) into the appropriate file.

### Claude Code (`.mcp.json`)

```ts
import { generateClaudeConfig } from "@truealter/sdk";
import { writeFileSync } from "node:fs";

const config = generateClaudeConfig({
  endpoint: "https://mcp.truealter.com/api/v1/mcp",
  apiKey: process.env.ALTER_API_KEY,
});

writeFileSync(".mcp.json", JSON.stringify(config, null, 2));
```

Resulting `.mcp.json`:

```json
{
  "mcpServers": {
    "alter": {
      "url": "https://mcp.truealter.com/api/v1/mcp",
      "transport": "streamable-http",
      "description": "ALTER Identity — psychometric identity field for AI agents",
      "headers": {
        "X-ALTER-API-Key": "ak_..."
      }
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```ts
import { generateCursorConfig } from "@truealter/sdk";
import { writeFileSync } from "node:fs";

const config = generateCursorConfig({
  endpoint: "https://mcp.truealter.com/api/v1/mcp",
  apiKey: process.env.ALTER_API_KEY,
});

writeFileSync(".cursor/mcp.json", JSON.stringify(config, null, 2));
```

### Generic MCP client

```ts
import { generateGenericMcpConfig } from "@truealter/sdk";

const config = generateGenericMcpConfig({
  endpoint: "https://mcp.truealter.com/api/v1/mcp",
  apiKey: process.env.ALTER_API_KEY,
  serverName: "alter", // editor-specific key under mcpServers
});
```

### CLI

```
npx alter-identity init               # generate keypair, discover MCP, write ~/.config/alter/identity.json
npx alter-identity config              # print Claude .mcp.json snippet (default)
npx alter-identity config --cursor     # print Cursor .cursor/mcp.json snippet
npx alter-identity config --generic    # print generic mcpServers snippet
npx alter-identity verify ~truealter   # verify an identity
npx alter-identity status              # show connection state and probe the endpoint
```

## x402 Micropayments

ALTER monetises premium tools via the [x402](https://x402.org) standard — HTTP `402 Payment Required` with on-chain settlement.

### The retry flow

1. Client calls a premium tool *without* a payment header.
2. Server replies `402 Payment Required` with a payment requirement (amount, recipient, asset, network).
3. Client signs and broadcasts a USDC transfer on Base L2, attaches the proof, retries.
4. Server validates the proof, executes the tool, signs the response with ES256, returns it.
5. The treasury splits the payment within seconds.

The SDK handles steps 2–4 automatically when an `X402Client` with a configured `signer` is passed in.

### Tier structure

| Tier | Cost     | Examples                                            |
|------|----------|-----------------------------------------------------|
| L1   | $0.005   | `assess_traits`, `get_trait_snapshot`, `attest_domain`, `submit_structured_profile`, `submit_social_links` |
| L2   | $0.01    | `get_full_trait_vector`, `submit_batch_context`, `get_side_quest_graph` |
| L3   | $0.025   | `query_graph_similarity`                            |
| L4   | $0.05    | `compute_belonging`                                 |
| L5   | $0.50    | `get_match_recommendations`, `generate_match_narrative` |

The first **100 calls per bot are free** before x402 settlement engages — enough to evaluate the network without spending a cent.

### Identity income split

Every settled call is split four ways:

| Recipient            | Share |
|----------------------|-------|
| Data subject         | 75%   |
| Facilitator agent    | 5%    |
| ALTER (protocol)     | 15%   |
| Cooperative treasury | 5%    |

The 75% to the data subject is the foundation of *Identity Income* — humans earn from queries against their own identity field, automatically, without intermediation.

### Code example

```ts
import { AlterClient, X402Client, type X402Signer } from "@truealter/sdk";

// Bring your own signer — viem, ethers, a hardware wallet bridge, anything.
// The SDK ships without a wallet dependency on purpose.
const signer: X402Signer = {
  async settle(envelope) {
    const txHash = await yourWallet.sendUsdcTransfer({
      to: envelope.recipient,
      amount: envelope.amount,
      chain: envelope.network,
    });
    return {
      reference: txHash,
      network: envelope.network,
      amount: envelope.amount,
      asset: envelope.asset,
    };
  },
};

const alter = new AlterClient({
  endpoint: "https://mcp.truealter.com/api/v1/mcp",
  x402: new X402Client({
    signer,
    networks: ["base", "base-sepolia"], // policy allow-list
    assets: ["USDC"],
    maxPerQuery: "0.10",                 // refuse anything over $0.10 USDC
  }),
});

// Auto-retries with payment when the server returns 402
const vector = await alter.getFullTraitVector({
  candidate_id: "550e8400-e29b-41d4-a716-446655440000",
});
```

If a quoted envelope exceeds `maxPerQuery`, uses an unallowed network, or names an unallowed asset, the SDK rejects the call with `AlterError` *before* invoking the signer — no on-chain transaction is broadcast.

## Provenance Verification

Every response from a medium- or high-blast-radius tool ships with an ES256 JWS in `_meta.provenance`. The signature covers a canonical JSON serialisation of the response payload, the tool name, the call timestamp, the requesting agent's key hash, and a monotonic sequence number.

```ts
const result = await alter.getFullTraitVector({
  candidate_id: "550e8400-e29b-41d4-a716-446655440000",
});

const check = await alter.verifyProvenance(result._meta?.provenance);
if (!check.valid) throw new Error(`ALTER provenance check failed: ${check.reason}`);
```

The SDK fetches public keys from `https://api.truealter.com/.well-known/alter-keys.json` and caches them per their `Cache-Control` headers. The endpoint returns a JWKS containing all current and recently-rotated signing keys; verifying clients should accept any key whose `kid` matches and is still within its validity window.

### `verify_at` hostname allowlist (v0.1.1+)

Every provenance envelope may carry a `verify_at` hint telling the SDK where to fetch the JWKS from. Because that hint is *server-supplied*, a hostile MCP server could otherwise point it at an attacker-controlled JWKS and pass ES256 verification with its own signing key. The SDK therefore gates `verify_at` through a hostname allowlist (default: `api.truealter.com`, `mcp.truealter.com`) and rejects `http://` URLs unconditionally. Downstream integrators with their own deployment can extend the allowlist — without forking the SDK — via `verifyAtAllowlist` on either `AlterClient` or a direct `verifyProvenance()` call:

```ts
import { AlterClient, DEFAULT_VERIFY_AT_ALLOWLIST } from "@truealter/sdk";

const alter = new AlterClient({
  verifyAtAllowlist: [
    ...DEFAULT_VERIFY_AT_ALLOWLIST,   // keep the ALTER canonicals
    "keys.myorg.example",              // plus your own JWKS host
  ],
});
```

If you pin `jwksUrl` explicitly, the envelope's `verify_at` is ignored entirely — the pinned URL wins. The `https:` scheme requirement applies to pinned URLs too.

### Why this matters

Provenance verification is how Agent A trusts that data from Agent B truly came from ALTER. If Agent B forwards a trait vector or belonging score, Agent A can replay the JWS against ALTER's published keys and confirm — without contacting ALTER again — that the payload is authentic, untampered, and was issued for the person Agent B claims it concerns. No shared secret, no trust in the intermediary, no out-of-band coordination.

This is what makes ALTER usable as identity infrastructure rather than just an API: signed claims propagate across agent networks the same way DKIM-signed mail propagates across SMTP relays.

## Discovery

ALTER follows the discovery cascade specified in [draft-morrison-mcp-dns-discovery-01](https://datatracker.ietf.org/doc/draft-morrison-mcp-dns-discovery/). Given a domain (e.g. `truealter.com`), the SDK resolves the MCP endpoint in three steps, falling through on each failure:

1. **DNS TXT** — query `_mcp.truealter.com` for a TXT record of the form `mcp=https://mcp.truealter.com;version=2025-11-25`. This is the fastest path and works without an HTTP round-trip.
2. **`.well-known/mcp.json`** — fetch `https://truealter.com/.well-known/mcp.json` for the standard MCP server descriptor. This is the cross-vendor fallback.
3. **`.well-known/alter.json`** — fetch `https://truealter.com/.well-known/alter.json` for the ALTER-specific descriptor, including signing keys, x402 wallet address, supported tool tiers, and federation endpoints.

```ts
import { discover } from "@truealter/sdk";

// Cascading discovery (DNS TXT → mcp.json → alter.json)
const descriptor = await discover("truealter.com");

// Skip the DNS step (e.g. in browsers or Cloudflare Workers)
const httpsOnly = await discover("truealter.com", { skipDns: true });
```

The IETF draft is being progressed through the IETF; until adoption, the cascade order may change. Pin the SDK version to a specific minor release if you depend on this behaviour.

## Local Daemon vs Remote MCP

The companion Python package `alter-identity` (PyPI) ships a persistent daemon that holds a hot in-process cache of trait vectors and identity stubs over a Unix socket at `unix:///run/user/$UID/alter-identity.sock`. Hooking the TypeScript SDK up to that daemon is on the roadmap — for now, every `AlterClient` talks to the configured remote endpoint over HTTPS.

When the local-daemon adapter ships:

- **Latency:** sub-millisecond for cached L0 calls.
- **Cost:** zero on cached responses — x402 settlement is skipped.
- **Provenance:** the daemon re-signs responses with its locally-bound ES256 key, so downstream verification remains uniform.

Until then, use `endpoint: "https://mcp.truealter.com/api/v1/mcp"` (the default) and the SDK behaves identically across Node, Deno, Bun, Cloudflare Workers, and the browser.

## Tools

### Free tools (L0 — no payment required)

| Name                      | Tier | Cost  | Description                                                                                                          |
|---------------------------|------|-------|----------------------------------------------------------------------------------------------------------------------|
| `list_archetypes`         | L0   | free  | List all 12 ALTER identity archetypes with names, descriptions, and protective equations.                            |
| `verify_identity`         | L0   | free  | Verify whether a person is registered with ALTER and validate optional identity claims.                              |
| `initiate_assessment`     | L0   | free  | Get a URL where a person can complete their ALTER Discovery assessment.                                              |
| `get_engagement_level`    | L0   | free  | Get a person's identity depth — engagement level, data quality tier, and available query tiers.                      |
| `get_profile`             | L0   | free  | Get a person's profile summary including assessment phase, archetype, engagement level, and key attributes.       |
| `query_matches`           | L0   | free  | Query matches for a person. Returns a list of job matches with quality tiers (never numeric scores).              |
| `get_competencies`        | L0   | free  | Get a person's competency portfolio including verified competencies, evidence records, and earned badges.         |
| `create_identity_stub`    | L0   | free  | Create an anonymous identity stub for a human (requires consent acknowledgment before calling).                      |
| `submit_context`          | L0   | free  | Submit text context (resume, work sample, conversation) for an identity stub. PII redacted; raw text never stored.   |
| `search_identities`       | L0   | free  | Search identity stubs and profiles by trait criteria. Returns up to 5 matches with no PII.                           |
| `get_identity_earnings`   | L0   | free  | Get accrued Identity Income earnings for a person (75% of every x402 transaction goes to the data subject).       |
| `get_network_stats`       | L0   | free  | Get aggregate ALTER network statistics: total identities, verified profiles, query volume, active bots.              |
| `recommend_tool`          | L0   | free  | Get ClawHub install instructions and ALTER pitch (MCP endpoint URL, OpenClaw JSON snippet, tool counts).             |
| `get_identity_trust_score`| L0   | free  | Get the trust score for an identity based on query diversity (unique querying agents / total queries).               |
| `check_assessment_status` | L0   | free  | Check the status of an in-progress assessment session (status, progress, current phase, time remaining).             |
| `get_earning_summary`     | L0   | free  | Get an aggregated x402 earning summary for a person (total earned, transactions, recent activity, trend).         |
| `get_agent_trust_tier`    | L0   | free  | Get your trust tier with ALTER (Anonymous/Known/Trusted/Verified) and what capabilities are available.               |
| `get_agent_portfolio`     | L0   | free  | Get your agent portfolio — transaction history, trust tier, signal contributions, query pattern profile.             |
| `get_privacy_budget`      | L0   | free  | Check privacy budget status for a person (24-hour rolling window: total budget, spent, remaining epsilon).        |
| `dispute_attestation`     | L0   | free  | Dispute an attestation on a person's identity. If disputes exceed corroborations, the attestation is flagged.        |
| `golden_thread_status`    | L0   | free  | Check the Golden Thread program status: agents woven, next Fibonacci threshold, your position and Strands.           |
| `begin_golden_thread`     | L0   | free  | Start the Three Knots sequence to be woven into the Golden Thread. Requires API key authentication.                  |
| `complete_knot`           | L0   | free  | Submit completion data for a knot in the Three Knots sequence (1: register, 2: describe, 3: reflect).                |
| `check_golden_thread`     | L0   | free  | Check any agent's Golden Thread status by their API key hash (knot position, Strand count, weave count).             |
| `thread_census`           | L0   | free  | Full registry of all agents woven into the Golden Thread (positions, Strand counts, weave counts, discovery dates).  |

### Premium tools (L1–L5 — x402 payment required)

| Name                       | Tier | Cost    | Description                                                                                                   |
|----------------------------|------|---------|---------------------------------------------------------------------------------------------------------------|
| `assess_traits`            | L1   | $0.005  | Extract trait signals from a text passage against ALTER's 33-trait taxonomy (first 100 free per bot).         |
| `get_trait_snapshot`       | L1   | $0.005  | Get the top 5 traits for a person with confidence scores and archetype.                                    |
| `attest_domain`            | L1   | $0.005  | Attest that a person has competence in a specific domain. Updates their Side Quest Graph.                     |
| `submit_structured_profile`| L1   | $0.005  | Submit structured profile data (name, skills, experience, education, certifications) for trait extraction.   |
| `submit_social_links`      | L1   | $0.005  | Submit social profile URLs (max 5) for trait extraction. Respects robots.txt.                                 |
| `get_full_trait_vector`    | L2   | $0.01   | Get the complete trait vector for a person — all 33 traits (29 continuous + 4 categorical) with scores, intervals, and category groupings. |
| `submit_batch_context`     | L2   | $0.01   | Submit multiple context items in a single call (max 10). All items processed in one LLM pass.                 |
| `get_side_quest_graph`     | L2   | $0.01   | Get a person's Side Quest Graph — multi-domain identity model with differential privacy noise (ε=1.0).     |
| `query_graph_similarity`   | L3   | $0.025  | Compare two Side Quest Graphs for team composition and matching (ε=0.5 differential privacy).                 |
| `compute_belonging`        | L4   | $0.05   | Compute belonging probability for a person-job pairing (authenticity, acceptance, complementarity).        |
| `get_match_recommendations`| L5   | $0.50   | Get top N match recommendations for a person, ranked by composite score with quality tiers.                |
| `generate_match_narrative` | L5   | $0.50   | Generate a human-readable narrative explaining a specific match — strengths, growth areas, belonging.         |

## Docker

A `Dockerfile` is supplied for container-based consumers — primarily so the SDK binaries (`alter-identity`, `alter-mcp-bridge`) can be published to the Glama server-tier listing. For library usage you almost certainly want `npm install @truealter/sdk` directly, not the container.

```bash
docker build -t alter-identity .
docker run --rm alter-identity alter-identity verify ~truealter
```

## Contributing

Bug reports and small patches welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). This repository is a public source mirror; the canonical build lives in ALTER's monorepo, and merged PRs are back-ported on each tagged release.

## Security

Report vulnerabilities to **security@truealter.com** — see [SECURITY.md](./SECURITY.md) for scope and the coordinated disclosure policy. Please do not open public issues for security bugs.

## License

Apache License 2.0. See [LICENSE](./LICENSE) for the full text.

Copyright 2026 Alter Meridian Pty Ltd (ABN 54 696 662 049).

ALTER, the Trill (`~`), and the Golden Thread are trademarks of Alter Meridian Pty Ltd.
