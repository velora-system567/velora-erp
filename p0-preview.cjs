const http = require("http");
const fs = require("fs");
const path = require("path");

const DIST = "D:\\Jishan\\Velora\\ERPs\\frontend\\dist";
const BACKEND = "http://localhost:4000";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api")) {
    const proxyReq = http.request(BACKEND + req.url, { method: req.method, headers: { ...req.headers, host: "localhost:4000" } }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", () => { res.writeHead(502); res.end("Bad Gateway"); });
    req.pipe(proxyReq);
    return;
  }
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  let filePath = path.join(DIST, urlPath);
  if (!filePath.startsWith(DIST)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(DIST, "index.html"), (err2, html) => {
        if (err2) { res.writeHead(404); res.end("Not found"); return; }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});
server.listen(5173, "127.0.0.1", () => console.log("prod-preview on 5173"));
