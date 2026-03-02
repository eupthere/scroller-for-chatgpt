import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  manifest: () => ({
    name: "Scroller for ChatGPT",
    description:
      "A browser extension that adds a timeline-style scroll rail to ChatGPT, making long conversations easier to navigate.",
    version: "0.1.0",
  }),
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
