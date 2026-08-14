import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

function normalizeBasePath(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = env.VITE_API_BASE_URL?.trim();

  if (env.CI && !apiBaseUrl) {
    throw new Error(
      "VITE_API_BASE_URL e obrigatoria no build do GitHub Pages. Configure PRECOCERTO_API_BASE_URL nas variaveis do repositorio.",
    );
  }

  if (apiBaseUrl && !/^https?:\/\//i.test(apiBaseUrl)) {
    throw new Error("VITE_API_BASE_URL deve ser uma URL absoluta HTTP(S).");
  }

  return {
    base: normalizeBasePath(env.VITE_BASE_PATH),
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(process.cwd()),
      },
    },
    build: {
      outDir: "dist-pages",
      emptyOutDir: true,
    },
  };
});
