import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fetchLiveTrends } from "./src/lib/trends.js";

export default defineConfig({
  plugins: [react(), {
    name: "local-trends-api",
    configureServer(server) {
      server.middlewares.use("/api/trends", async (request, response) => {
        if (request.method !== "GET") {
          response.statusCode = 405;
          response.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        const result = await fetchLiveTrends();
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(result));
      });
    },
  }],
});
