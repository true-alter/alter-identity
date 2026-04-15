#!/usr/bin/env node
/**
 * alter-identity CLI.
 *
 *   alter-identity init                 generate keypair, discover endpoint, write config
 *   alter-identity verify <handle>      verify an ALTER identity
 *   alter-identity status               show connection state and cached identity
 *   alter-identity config [--claude|--cursor|--generic]   print MCP config snippet
 *
 * Pure Node — uses `node:fs`, `node:path`, `node:os`. The CLI is the
 * one place we are allowed to depend on Node-only APIs.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { argv, exit, stderr, stdout, env } from 'node:process';

import { AlterClient } from '../src/client.js';
import type { MCPCallToolResult } from '../src/mcp.js';
import { discover } from '../src/discovery.js';
import { generateKeypair, keypairFromPrivateKey, type Ed25519Keypair } from '../src/auth.js';
import { generateClaudeConfig } from '../src/adapters/claude-code.js';
import { generateCursorConfig } from '../src/adapters/cursor.js';
import { generateGenericMcpConfig } from '../src/adapters/generic-mcp.js';
import { SDK_NAME, SDK_VERSION } from '../src/index.js';

interface ConfigFile {
  endpoint?: string;
  apiKey?: string;
  keypair?: Ed25519Keypair;
  initialisedAt?: string;
}

const CONFIG_DIR = join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'alter');
const CONFIG_PATH = join(CONFIG_DIR, 'identity.json');

async function main(): Promise<void> {
  const [, , command, ...rest] = argv;
  switch (command) {
    case 'init':
      await runInit(rest);
      break;
    case 'verify':
      await runVerify(rest);
      break;
    case 'status':
      await runStatus();
      break;
    case 'config':
      await runConfig(rest);
      break;
    case 'message':
      await runMessage(rest);
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      break;
    case 'version':
    case '--version':
    case '-v':
      stdout.write(`${SDK_NAME} ${SDK_VERSION}\n`);
      break;
    default:
      stderr.write(`unknown command: ${command}\n\n`);
      printHelp();
      exit(2);
  }
}

function printHelp(): void {
  stdout.write(`${SDK_NAME} ${SDK_VERSION}

Usage:
  alter-identity init                       Generate Ed25519 keypair, discover MCP, write config
  alter-identity verify <~handle|email>     Verify an identity
  alter-identity status                     Show connection state
  alter-identity config [--claude|--cursor|--generic]
                                            Print MCP config snippet

Alter-to-Alter Messaging:
  alter-identity message send <~handle> <body>     Send a direct message (body '-' = stdin)
  alter-identity message inbox [--unread]          List your inbound messages
  alter-identity message thread <~handle>          Bidirectional thread view with a peer
  alter-identity message grant <~handle>           Allow a peer to message you
  alter-identity message revoke <~handle>          Revoke a peer's grant

Config: ${CONFIG_PATH}
`);
}

async function runInit(args: string[]): Promise<void> {
  const force = args.includes('--force') || args.includes('-f');
  const existing = readConfig();
  if (existing && !force) {
    stdout.write(`already initialised at ${CONFIG_PATH} (re-run with --force to overwrite)\n`);
    return;
  }

  stdout.write('• Generating Ed25519 keypair...\n');
  const keypair = generateKeypair();

  stdout.write('• Discovering MCP endpoint for truealter.com...\n');
  let endpoint: string;
  try {
    const result = await discover('truealter.com');
    endpoint = result.url;
    stdout.write(`  → ${endpoint} (via ${result.source})\n`);
  } catch (err) {
    endpoint = 'https://mcp.truealter.com/api/v1/mcp';
    stdout.write(`  → ${endpoint} (discovery failed: ${(err as Error).message})\n`);
  }

  const cfg: ConfigFile = { endpoint, keypair, initialisedAt: new Date().toISOString() };
  writeConfig(cfg);
  stdout.write(`• Wrote config to ${CONFIG_PATH}\n`);
  stdout.write(`  did: ${keypair.did}\n`);
  stdout.write(`\nNext: alter-identity verify ~truealter\n`);
}

async function runVerify(args: string[]): Promise<void> {
  const handle = args[0];
  if (!handle) {
    stderr.write('usage: alter-identity verify <~handle|email|uuid>\n');
    exit(2);
  }
  const cfg = readConfig() ?? {};
  const client = new AlterClient({ endpoint: cfg.endpoint, apiKey: cfg.apiKey });
  try {
    const result = await client.verify(handle);
    const text = result.content?.[0]?.text ?? JSON.stringify(result.data ?? result, null, 2);
    stdout.write(text + '\n');
  } catch (err) {
    stderr.write(`verify failed: ${(err as Error).message}\n`);
    exit(1);
  }
}

async function runStatus(): Promise<void> {
  const cfg = readConfig();
  if (!cfg) {
    stdout.write(`not initialised — run \`alter-identity init\`\n`);
    return;
  }
  stdout.write(`config:        ${CONFIG_PATH}\n`);
  stdout.write(`endpoint:      ${cfg.endpoint ?? '(default)'}\n`);
  stdout.write(`api key:       ${cfg.apiKey ? '(set)' : '(none)'}\n`);
  if (cfg.keypair) {
    const recovered = keypairFromPrivateKey(cfg.keypair.privateKey);
    stdout.write(`did:           ${recovered.did}\n`);
  }
  stdout.write(`initialised:   ${cfg.initialisedAt ?? '(unknown)'}\n`);

  // Probe the endpoint
  const client = new AlterClient({ endpoint: cfg.endpoint, apiKey: cfg.apiKey });
  try {
    const stats = await client.getNetworkStats();
    const text = stats.content?.[0]?.text ?? JSON.stringify(stats.data ?? '');
    stdout.write(`network probe: ok — ${text.slice(0, 120)}\n`);
  } catch (err) {
    stdout.write(`network probe: failed — ${(err as Error).message}\n`);
  }
}

async function runConfig(args: string[]): Promise<void> {
  const cfg = readConfig() ?? {};
  const opts = { endpoint: cfg.endpoint, apiKey: cfg.apiKey };
  let out: unknown;
  if (args.includes('--cursor')) out = generateCursorConfig(opts);
  else if (args.includes('--generic')) out = generateGenericMcpConfig(opts);
  else out = generateClaudeConfig(opts); // default
  stdout.write(JSON.stringify(out, null, 2) + '\n');
}

// ── Alter-to-Alter Messaging ────────────────────────────────────────────

async function runMessage(args: string[]): Promise<void> {
  const [sub, ...rest] = args;
  if (!sub) {
    stderr.write('usage: alter-identity message <send|inbox|thread|grant|revoke> ...\n');
    exit(2);
  }

  const cfg = readConfig() ?? {};
  const client = new AlterClient({ endpoint: cfg.endpoint, apiKey: cfg.apiKey });

  const printResult = (result: MCPCallToolResult): void => {
    const text = result.content?.[0]?.text;
    if (text) {
      stdout.write(text + '\n');
      return;
    }
    if (result.data !== undefined) {
      stdout.write(JSON.stringify(result.data, null, 2) + '\n');
      return;
    }
    stdout.write(JSON.stringify(result, null, 2) + '\n');
  };

  try {
    switch (sub) {
      case 'send': {
        const to = rest[0];
        let body = rest[1];
        if (!to || !body) {
          stderr.write('usage: alter-identity message send <~handle> <body|->\n');
          exit(2);
        }
        if (body === '-') {
          // Read body from stdin
          const chunks: Buffer[] = [];
          for await (const chunk of (await import('node:process')).stdin) {
            chunks.push(chunk as Buffer);
          }
          body = Buffer.concat(chunks).toString('utf8').trim();
          if (!body) {
            stderr.write('error: empty body on stdin\n');
            exit(2);
          }
        }
        const result = await client.messageSend({ to, body });
        printResult(result);
        break;
      }
      case 'inbox': {
        const unreadOnly = rest.includes('--unread');
        const sinceArg = rest.find((a) => a.startsWith('--since='));
        const since = sinceArg ? sinceArg.slice('--since='.length) : undefined;
        const result = await client.messageInbox({
          unread_only: unreadOnly || undefined,
          since,
        });
        printResult(result);
        break;
      }
      case 'thread': {
        const peer = rest[0];
        if (!peer) {
          stderr.write('usage: alter-identity message thread <~handle>\n');
          exit(2);
        }
        const result = await client.messageThread({ with: peer });
        printResult(result);
        break;
      }
      case 'grant': {
        const peer = rest[0];
        if (!peer) {
          stderr.write('usage: alter-identity message grant <~handle>\n');
          exit(2);
        }
        const result = await client.messageGrant({ peer });
        printResult(result);
        break;
      }
      case 'revoke': {
        const peer = rest[0];
        if (!peer) {
          stderr.write('usage: alter-identity message revoke <~handle>\n');
          exit(2);
        }
        const result = await client.messageRevoke({ peer });
        printResult(result);
        break;
      }
      case 'mark-read': {
        const ids = rest.filter((a) => !a.startsWith('--'));
        if (ids.length === 0) {
          stderr.write('usage: alter-identity message mark-read <id> [<id> ...]\n');
          exit(2);
        }
        const result = await client.messageMarkRead({ message_ids: ids });
        printResult(result);
        break;
      }
      case 'redact': {
        const id = rest[0];
        if (!id) {
          stderr.write('usage: alter-identity message redact <id>\n');
          exit(2);
        }
        const result = await client.messageRedact({ message_id: id });
        printResult(result);
        break;
      }
      default:
        stderr.write(`unknown message subcommand: ${sub}\n`);
        exit(2);
    }
  } catch (err) {
    stderr.write(`message ${sub} failed: ${(err as Error).message}\n`);
    exit(1);
  }
}

function readConfig(): ConfigFile | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as ConfigFile;
  } catch {
    return null;
  }
}

function writeConfig(cfg: ConfigFile): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

main().catch((err: unknown) => {
  stderr.write(`error: ${(err as Error).message}\n`);
  exit(1);
});
