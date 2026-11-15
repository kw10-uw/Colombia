import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
          backup: ["fflate"],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["avatars/*.webp", "icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "TurboColombia · El Parche",
        short_name: "TurboColombia",
        description:
          "One adventure. Four friends. Your Colombia trip, together.",
        theme_color: "#442a58",
        background_color: "#fff7ed",
        display: "standalone",
        scope: "./",
        start_url: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}"],
        globIgnores: ["avatars/*.png"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
