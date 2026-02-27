import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: 'src',
  modules: ["@wxt-dev/module-react"],
  manifest: () => ({
    name: "Scroller for ChatGPT",
    description:
      "A browser extension that adds an easy scroll bar to the ChatGPT interface, allowing users to easily navigate through long conversations.",
    version: "0.1.0",
  }),
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
