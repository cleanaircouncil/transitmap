import { defineConfig } from 'astro/config';

export default defineConfig({
  build: {
    inlineStylesheets: "never",
  },
  vite: {
    logLevel: "info",
    server: {
      proxy: {
        "/api/indego": {
          target: "https://www.rideindego.com",
          changeOrigin: true,
          rewrite: (path) => "/stations/json/",
        },
      },
    },
  },
});