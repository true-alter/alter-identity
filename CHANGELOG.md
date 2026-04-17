# Changelog

All notable changes to `@truealter/sdk` (formerly `@alter/identity`, renamed 2026-04-15) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `CONTRIBUTING.md` — workflow, scope, and back-port policy for the
  public source mirror.
- `SECURITY.md` — disclosure address (`security@truealter.com`), scope
  boundaries, and a short summary of prior hardening already shipped in
  the SDK.
- README: CI + Node version badges; Docker usage section; Contributing
  and Security sections linking to the new meta files.

## [0.2.1] — 2026-04-15

### Removed

- **Cosmology-surface tool listings.** `seat_status`, `respond_to_offering`,
  and `subscribe_announcements` were withdrawn from the live MCP server in
  hotfix #421 (11 Apr 2026) but the SDK still advertised them in
  `FREE_TOOL_NAMES`, `ToolInputs`/`ToolOutputs`, the registries
  (`TOOL_TIERS`, `TOOL_COSTS`, `TOOL_BLAST_RADIUS`), and as `seatStatus()`,
  `respondToOffering()`, `subscribeAnnouncements()` methods on
  `AlterClient`. Removed from the SDK surface so it matches what the
  server actually serves; calling these methods would have failed with a
  tool-not-found error against the live endpoint regardless.
- **Type exports** `SeatStatusInput`, `SeatStatusOutput`,
  `RespondToOfferingInput`, `RespondToOfferingOutput`,
  `SubscribeAnnouncementsInput`, `SubscribeAnnouncementsOutput`.

### Changed

- **Vocabulary alignment.** Replaced "candidate" with "person" throughout
  README prose and JSDoc comments. ALTER is identity infrastructure, not
  a hiring platform — descriptive copy now matches that framing. Wire
  field names (`candidate_id`, etc.) are unchanged because they are
  server-contract identifiers; only human-readable descriptions moved.
- **Trademark notice** now references "the Trill" — the canonical name
  for the `~` mark (locked 7 Apr 2026, brand-internal#100) — instead of
  the legacy "Alter Stroke (~) device mark" wording.
- Tool count summary: `40 total — 28 free (L0) + 12 premium` →
  `37 total — 25 free (L0) + 12 premium`.

## [0.2.0] — 2026-04-15

### Changed

- **Package renamed `@alter/identity` → `@truealter/sdk`.** The `@alter`
  npm namespace is not owned by ALTER. Published under the
  owned `@truealter` scope to match the canonical `truealter.com`
  anchor and the existing v0.0.1 placeholder on npm. Consumers of the
  legacy name (unpublished in-repo only) must update their
  `package.json` dependency entry and import paths — the export
  surface is otherwise unchanged.
- **CLI invocation examples updated.** Use `npx alter-identity <cmd>`
  (or `alter-identity <cmd>` post-install) — `npx @truealter/sdk` does
  not resolve because the package ships two bins and neither matches
  the unscoped package name.
- **`SDK_NAME` constant** now returns `@truealter/sdk`.
- **Default `clientInfo.name`** in `MCPClient` and `alter-mcp-bridge`
  updated to `@truealter/sdk` / `@truealter/sdk-mcp-bridge` respectively.

## [0.1.1] — 2026-04-14

### Security

- **CRITICAL (C-4): Harden `verify_at` resolution against hostile MCP
  servers.** `verifyProvenance()` previously trusted any `http://` or
  `https://` URL supplied in the server response envelope's `verify_at`
  field when fetching the JWKS for ES256 signature verification. A
  hostile MCP server could point `verify_at` at an attacker-controlled
  JWKS and pass verification with its own signing key.
  - JWKS fetches are now **https-only** — `http:` URLs are rejected
    unconditionally for both `verify_at` hints and caller-supplied
    `jwksUrl` options.
  - Envelope `verify_at` hostnames are gated through a hostname
    allowlist. Default allowlist is `api.truealter.com` and
    `mcp.truealter.com`.
  - Downstream integrators can extend the allowlist without a fork via
    the new `verifyAtAllowlist` option on both `verifyProvenance()` and
    the `AlterClient` constructor.
  - Callers that supply an explicit `jwksUrl` bypass the envelope
    entirely (the caller has already vouched for the origin); the
    `https:` scheme requirement still applies.
  - New exports: `DEFAULT_VERIFY_AT_ALLOWLIST`, `resolveVerifyAt`,
    `VerifyProvenanceOptions`.

### Added

- `DEFAULT_VERIFY_AT_ALLOWLIST` — the frozen default hostname allowlist.
- `resolveVerifyAt(verifyAt, allowlist?)` — exported for advanced
  callers and test harnesses.
- `AlterClientOptions.verifyAtAllowlist` — per-client allowlist override.

## [0.1.0] — 2026-04-13

- Initial public release.
