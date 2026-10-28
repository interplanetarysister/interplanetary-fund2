// Node 20-compatible loader for repository TypeScript verification imports.
// This avoids Node 22-only --experimental-strip-types while preserving the
// same TypeScript source under test.
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts')) {
    const source = await readFile(new URL(url), 'utf8');
    return {
      format: 'module',
      source: ts.transpileModule(source, {
        fileName: new URL(url).pathname,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
