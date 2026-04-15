import { defineConfig } from 'tsup';

// Two builds: the library (ESM + CJS, no shebang) and the CLI (ESM, with
// shebang). Splitting them keeps the library tree-shakeable and avoids
// double-banner issues — the CLI source already declares its own shebang.
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'node18',
    platform: 'neutral',
    shims: false,
    treeshake: true,
    outDir: 'dist',
  },
  {
    entry: {
      'bin/alter-identity': 'bin/alter-identity.ts',
      'bin/mcp-bridge': 'bin/mcp-bridge.ts',
    },
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'node18',
    platform: 'node',
    shims: false,
    treeshake: true,
    outDir: 'dist',
  },
]);
