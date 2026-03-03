import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  manifest: () => ({
    name: "Scroller for ChatGPT",
    description:
      "A browser extension that adds a timeline-style scroll rail to ChatGPT, making long conversations easier to navigate.",
    version: "0.2.0",
    browser_specific_settings: {
      gecko: {
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  }),
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
