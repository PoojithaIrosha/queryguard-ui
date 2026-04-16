import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function normalizeViteBase(value: string | undefined) {
  if (!value || value === "/") return "/";

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: normalizeViteBase(env.VITE_QUERYGUARD_UI_BASE_PATH),
    plugins: [react()],
  };
})
