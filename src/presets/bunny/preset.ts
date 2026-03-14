import { defineNitroPreset } from "nitropack/kit";
import type { Nitro } from "nitropack/types";
import { builtinModules } from "node:module";
import { rm } from "node:fs/promises";

const edgeScripting = defineNitroPreset(
  {
    entry: "./runtime/edge-scripting",

    exportConditions: ["deno"],
    noExternals: true,
    commands: {
      preview: "deno -A --no-config ./bunny-edge-scripting.mjs",
    },

    output: {
      dir: "{{ rootDir }}/.output",
      serverDir: "{{ output.dir }}",
      publicDir: "{{ output.dir }}/public",
    },

    rollupConfig: {
      output: {
        format: "esm",
        entryFileNames: "bunny-edge-scripting.mjs",
        inlineDynamicImports: true,
        hoistTransitiveImports: false,
      },
      external: (id: string) =>
        id.startsWith("https://") || id.startsWith("node:") ||
        id === "typescript" || id === "vue-component-meta",
      plugins: [
        {
          // Rewrite bare Node builtins (e.g. "fs") to "node:fs" for Deno/Bunny compat
          name: "rollup-plugin-node-prefix",
          resolveId(id: string) {
            id = id.replace("node:", "");
            if (builtinModules.includes(id)) {
              return {
                id: `node:${id}`,
                moduleSideEffects: false,
                external: true,
              };
            }
          },
        },
        {
          // Inject CJS global polyfills for Deno/Bunny ESM runtime
          name: "inject-cjs-globals",
          renderChunk: {
            order: "post" as const,
            handler(code: string, chunk: { isEntry: boolean }) {
              if (!chunk.isEntry) {
                return;
              }
              const preamble = [
                "import __process__ from 'node:process';",
                "import { fileURLToPath as __fileURLToPath__ } from 'node:url';",
                "import { dirname as __dirname__ } from 'node:path';",
                "globalThis.process = globalThis.process || __process__;",
                "if (typeof globalThis.__filename === 'undefined') { globalThis.__filename = __fileURLToPath__(import.meta.url); }",
                "if (typeof globalThis.__dirname === 'undefined') { globalThis.__dirname = __dirname__(globalThis.__filename); }",
              ].join("");
              return { code: preamble + code, map: null };
            },
          },
        },
      ],
    },

    serveStatic: "inline",
    minify: true,

    hooks: {
      "build:before": (nitro: Nitro) => {
        if (nitro.options.serveStatic !== "inline" && nitro.options.serveStatic !== false) {
          nitro.options.serveStatic = "inline";
          nitro.logger.warn(
            "Bunny Edge Scripting preset requires `serveStatic` to be `inline` or `false`. Overriding to `inline`."
          );
        }
      },
      async compiled(nitro: Nitro) {
        if (nitro.options.serveStatic === "inline") {
          const publicDir = nitro.options.output.publicDir;
          await rm(publicDir, { recursive: true, force: true });
        }
      },
    },
  },
  {
    aliases: ["bunny"],
    name: "bunny-edge-scripting" as const,
    compatibilityDate: "2026-03-14",
    url: import.meta.url,
  }
);

export default [edgeScripting] as const;
