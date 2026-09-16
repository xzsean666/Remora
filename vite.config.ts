import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const openRouterKey =
    env.OPEN_ROUTER_API_KEY ||
    env.VITE_AI_API_KEY ||
    env.AI_API_KEY ||
    process.env.OPEN_ROUTER_API_KEY ||
    process.env.VITE_AI_API_KEY ||
    process.env.AI_API_KEY ||
    "";
  const aiBaseUrl =
    env.AI_BASE_URL ||
    env.VITE_AI_BASE_URL ||
    env.OPENROUTER_BASE_URL ||
    process.env.AI_BASE_URL ||
    process.env.OPENROUTER_BASE_URL ||
    "https://openrouter.ai/api/v1";
  const aiModel =
    env.AI_MODEL ||
    env.VITE_AI_MODEL ||
    process.env.AI_MODEL ||
    "nvidia/nemotron-3.5-lightning:free";

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_AI_API_KEY": JSON.stringify(openRouterKey),
      "import.meta.env.VITE_AI_BASE_URL": JSON.stringify(aiBaseUrl),
      "import.meta.env.VITE_AI_MODEL": JSON.stringify(aiModel),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      watch: {
        // 3. tell vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
