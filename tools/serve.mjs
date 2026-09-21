import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import process from "node:process";

const root = new URL("..", import.meta.url).pathname;
const port = Number(process.env.AIR_PORT ?? 4173);
const types = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".air": "text/plain; charset=utf-8" };

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const route = url.pathname === "/" ? "/web/index.html" : url.pathname;
    const path = normalize(join(root, route));
    if (!path.startsWith(root)) throw new Error("path outside workspace");
    const info = await stat(path);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream", "cache-control": "no-store" });
    response.end(await readFile(path));
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`AIR prototype: http://127.0.0.1:${port}`);
  console.log(`Task demo:     http://127.0.0.1:${port}/?demo=tasks`);
});
