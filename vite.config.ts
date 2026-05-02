import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import dts from "vite-plugin-dts";
import path from "node:path";
import { readFileSync, copyFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

// All peer and top-level deps that should NOT be bundled into the library
const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-konva",
  "konva",
  "framer-motion",
  "lucide-react",
  "react-router-dom",
  "@tanstack/react-query",
  ...Object.keys(pkg.dependencies || {}),
];

const externalRegex = new RegExp(
  `^(${external.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(/.+)?$`
);

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ["src"],
      outDir: "dist",
      insertTypesEntry: true,
    }),
    {
      name: "copy-style-dts",
      closeBundle() {
        copyFileSync(
          path.resolve(__dirname, "src/style.d.ts"),
          path.resolve(__dirname, "dist/style.d.ts")
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@sabi-canvas": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "SabiCanvas",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    rollupOptions: {
      external: (id) => externalRegex.test(id),
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react-konva": "ReactKonva",
          konva: "Konva",
          "framer-motion": "FramerMotion",
          "lucide-react": "LucideReact",
          "react-router-dom": "ReactRouterDom",
          "@tanstack/react-query": "ReactQuery",
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") return "style.css";
          return assetInfo.name ?? "asset";
        },
      },
    },
    sourcemap: true,
    copyPublicDir: false,
  },
});
