/**
 * @truealter/sdk — ALTER Identity SDK
 *
 * Query the continuous identity field from any JavaScript/TypeScript
 * environment. Wraps the ALTER MCP server (29 invokable read tools at
 * this stage). Write tools (submit_*, attest_domain, dispute_attestation,
 * create_identity_stub) and alter-to-alter messaging tools are not
 * advertised to public callers — they re-enable as the consent
 * architecture and per-peer grant model land. First-class TypeScript
 * types, x402 micropayment support, and ES256 provenance verification.
 *
 * The ALTER endpoint discovery anchor is `truealter.com` — see
 * `discover()` for the cascade. The default MCP endpoint is
 * `https://mcp.truealter.com`.
 */

// High-level client (most consumers start here)
export { AlterClient, DEFAULT_DOMAIN, DEFAULT_ENDPOINT } from './client.js';
export type { AlterClientOptions } from './client.js';

// Low-level transport
export {
  MCPClient,
  MCP_PROTOCOL_VERSION,
  type MCPCallOptions,
  type MCPCallToolResult,
  type MCPClientInfo,
  type MCPClientOptions,
  type MCPContentBlock,
  type MCPListToolsResult,
  type MCPToolDefinition,
} from './mcp.js';

// Discovery
export { clearDiscoveryCache, discover, type DiscoveryOptions, type DiscoveryResult } from './discovery.js';

// Auth & Ed25519
export {
  base64urlDecode,
  base64urlEncode,
  decodeDid,
  encodeDid,
  generateKeypair,
  keypairFromPrivateKey,
  sign,
  verify,
  type ApiKeyConfig,
  type Ed25519Keypair,
} from './auth.js';

// Provenance
export {
  DEFAULT_VERIFY_AT_ALLOWLIST,
  fetchPublicKeys,
  resolveVerifyAt,
  verifyProvenance,
  verifyToolSignatures,
  type JsonWebKey,
  type JwksDocument,
  type ProvenanceEnvelope,
  type ProvenancePayload,
  type ProvenanceVerification,
  type SignedToolDefinition,
  type ToolSignatureMap,
  type VerifyProvenanceOptions,
} from './provenance.js';

// x402
export { parsePaymentHeader, X402Client, type X402ClientOptions, type X402Settlement, type X402Signer } from './x402.js';

// Errors
export {
  AlterAuthError,
  AlterDiscoveryError,
  AlterError,
  AlterInvalidResponse,
  AlterNetworkError,
  AlterPaymentRequired,
  AlterProvenanceError,
  AlterRateLimited,
  AlterTimeoutError,
  AlterToolError,
  type AlterErrorCode,
  type PaymentEnvelope,
} from './errors.js';

// Adapters (optional helpers for editor integrations)
export { generateClaudeConfig } from './adapters/claude-code.js';
export { generateCursorConfig } from './adapters/cursor.js';
export { generateGenericMcpConfig } from './adapters/generic-mcp.js';
export type { McpServerConfig } from './adapters/generic-mcp.js';

// Types — re-export everything from the generated types module
export * from './types.js';

// Package metadata
export const SDK_NAME = '@truealter/sdk';
export const SDK_VERSION = '0.1.1';
