import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

// Baca data dari file JSON
const schedulesData = JSON.parse(
  await Deno.readTextFile("./data/schedules.json"),
);

const router = new Router();
router
  .get("/", (context) => {
    context.response.body = "JTK25 Jadwal API";
  })
  .get("/download/:version", async (context) => {
    const version = context.params.version;
    // Sanitize version parameter to ensure it's a float only
    if (!/^\d+(\.\d+)?$/.test(version)) {
      context.response.status = 400;
      context.response.body = "Invalid version format. Must be a float value.";
      return;
    }
    return context.response.body = await Deno.readFile(
      `./builds/${version}.apk`,
    );
  })
  .get("/api/version", (context) => context.response.body = 1.1)
  .get("/api/schedules", (context) => {
    context.response.body = schedulesData;
  });

const app = new Application();
app.use(oakCors()); // Enable CORS for all routes
app.use(router.routes());
app.use(router.allowedMethods());

console.log("Server running on http://localhost:8000");
await app.listen({ port: 8000 });
