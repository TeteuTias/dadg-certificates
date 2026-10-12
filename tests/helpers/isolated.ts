import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
export function loadIsolated(
  path: string,
  mocks: Record<string, unknown>,
): Record<string, (...args: unknown[]) => Promise<Response>> {
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const isolatedModule = { exports: {} };
  const requireNative = createRequire(import.meta.url);
  const requireMock = (name: string) => {
    if (name in mocks) return mocks[name];
    if (name === "next/server" || name === "bson") return requireNative(name);
    throw new Error(`Unexpected dependency: ${name}`);
  };
  new Function("require", "module", "exports", code)(
    requireMock,
    isolatedModule,
    isolatedModule.exports,
  );
  return isolatedModule.exports;
}
