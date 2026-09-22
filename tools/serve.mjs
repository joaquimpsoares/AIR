import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import process from "node:process";

const root = new URL("..", import.meta.url).pathname;
const port = Number(process.env.AIR_PORT ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".air": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const host = process.env.AIR_HOST ?? "0.0.0.0";

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    let route = (url.pathname === "/" || url.pathname === "/web" || url.pathname === "/web/") ? "/web/index.html" : url.pathname;
    let path = normalize(join(root, route));
    if (!path.startsWith(root)) throw new Error("path outside workspace");
    let info = await stat(path);
    if (info.isDirectory()) {
      path = join(path, "index.html");
      info = await stat(path);
    }
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream", "cache-control": "no-store" });
    response.end(await readFile(path));
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, host, () => {
  console.log(`AIR prototype: http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`);
  console.log(`Landing demo:  http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}/?demo=landing`);
  console.log(`Task demo:     http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}/?demo=tasks`);
});
