// Railway-compatible TLS Config Refiner (Node.js)
// Original project: Surfboardv2ray/v2ray-refiner
// Important: Railway uses its own public hostname. A Cloudflare Clean IP
// cannot be used as the destination address for a Railway deployment.

const http = require("node:http");
const { URL } = require("node:url");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DOMAIN = (process.env.RAILWAY_PUBLIC_DOMAIN || process.env.PUBLIC_DOMAIN || "")
  .replace(/^https?:\/\//, "").replace(/\/$/, "");
const ALLOWED_WS_HOSTS = (process.env.ALLOWED_WS_HOSTS || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const server = http.createServer(async (req, res) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }

  if (req.method === "GET") {
    res.writeHead(200, { ...cors, "Content-Type": "text/html; charset=UTF-8" });
    return res.end(renderHTML());
  }

  if (req.method === "POST") {
    try {
      const body = await readBody(req);
      const form = new URLSearchParams(body);
      const config = (form.get("config") || "").trim();
      const workerHost = PUBLIC_DOMAIN || (req.headers.host || "").split(":")[0];
      const refinedConfig = refineConfig(config, workerHost);

      res.writeHead(200, { ...cors, "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ refinedConfig }));
    } catch (error) {
      res.writeHead(400, { ...cors, "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: error.message || "Bad request" }));
    }
  }

  res.writeHead(405, {
    ...cors,
    "Content-Type": "text/plain; charset=utf-8",
    Allow: "GET, POST, OPTIONS",
  });
  res.end("Method not allowed");
});

server.on("upgrade", (req, socket, head) => {
  proxyWebSocket(req, socket, head).catch((err) => {
    console.error("WebSocket proxy error:", err.message);
    if (!socket.destroyed) {
      socket.write("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
      socket.destroy();
    }
  });
});

async function proxyWebSocket(req, socket, head) {
  const incoming = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const parts = incoming.pathname.replace(/^\/+/, "").split("/");
  const targetHost = decodeURIComponent(parts.shift() || "").toLowerCase();
  const targetPath = "/" + parts.join("/");

  if (!targetHost || !/^[a-z0-9.-]+$/i.test(targetHost)) {
    throw new Error("Invalid WebSocket target host");
  }
  if (ALLOWED_WS_HOSTS.length && !ALLOWED_WS_HOSTS.includes(targetHost)) {
    throw new Error("WebSocket target host is not in ALLOWED_WS_HOSTS");
  }

  const targetUrl = new URL(`wss://${targetHost}${targetPath}${incoming.search}`);
  const headers = { ...req.headers };
  for (const key of [
    "host", "connection", "upgrade", "sec-websocket-key",
    "sec-websocket-version", "sec-websocket-extensions",
    "sec-websocket-protocol", "content-length"
  ]) delete headers[key];

  const protocols = req.headers["sec-websocket-protocol"]
    ? req.headers["sec-websocket-protocol"].split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const upstream = new WebSocket(targetUrl, protocols.length ? protocols : undefined, {
    headers,
    handshakeTimeout: 15000,
    perMessageDeflate: false,
    rejectUnauthorized: true,
  });

  await new Promise((resolve, reject) => {
    upstream.once("open", resolve);
    upstream.once("error", reject);
  });

  const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });
  wss.handleUpgrade(req, socket, head, (client) => {
    client.on("message", (data, isBinary) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary });
    });
    upstream.on("message", (data, isBinary) => {
      if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
    });
    client.on("close", (code, reason) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.close(code, reason);
      else upstream.terminate();
    });
    upstream.on("close", (code, reason) => {
      if (client.readyState === WebSocket.OPEN) client.close(code, reason);
    });
    client.on("error", () => upstream.terminate());
    upstream.on("error", () => client.terminate());
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function renderHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TLS Config Refiner</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;margin:0;padding:0;background:#f5f5f5;color:#333}
    .container{max-width:800px;margin:40px auto;padding:20px;background:white;border-radius:10px;box-shadow:0 4px 8px rgba(0,0,0,.1)}
    h2{text-align:center;color:#ff5722;font-weight:bold}
    label{font-size:16px;margin-top:10px;display:block;font-weight:600;color:#555}
    textarea{box-sizing:border-box;width:100%;padding:8px;border:1px solid #ccc;border-radius:8px;font-size:16px;background:#f9f9f9;resize:vertical;min-height:120px}
    textarea:focus{border-color:#ff5722;outline:none;background:#fff;box-shadow:0 0 5px rgba(255,87,34,.5)}
    button{padding:12px 20px;margin:10px 0;font-size:16px;color:white;background:linear-gradient(145deg,#ff6b3d,#ff5722);border:0;border-radius:8px;cursor:pointer;box-shadow:0 4px 6px rgba(0,0,0,.2)}
    button:hover{transform:translateY(-2px)}
    .output-box{position:relative}.copy-btn{position:absolute;top:10px;right:10px;padding:8px 12px;font-size:14px}
    .note{font-size:13px;color:#666;line-height:1.5}
    @media(max-width:768px){.container{margin:20px;padding:15px}button{width:100%}.copy-btn{position:static}}
  </style>
</head>
<body>
  <div class="container">
    <h2>TLS Config Refiner</h2>
    <label for="config">Enter your proxy config (VMess, VLESS, Trojan):</label>
    <textarea id="config" placeholder="vmess://..."></textarea>
    <p class="note">The output address and TLS host are set to this Railway app's public domain.</p>
    <button id="refine-btn">Refine</button>
    <h3>Refined Config:</h3>
    <div class="output-box">
      <textarea id="refined-config" readonly></textarea>
      <button class="copy-btn" id="copy-btn">Copy</button>
    </div>
  </div>
  <script>
    document.getElementById('refine-btn').addEventListener('click', async () => {
      const config = document.getElementById('config').value.trim();
      try {
        const response = await fetch(window.location.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: new URLSearchParams({ config })
        });
        const result = await response.json();
        document.getElementById('refined-config').value = response.ok ? result.refinedConfig : result.error;
      } catch (error) {
        document.getElementById('refined-config').value = 'Error: ' + error.message;
      }
    });
    document.getElementById('copy-btn').addEventListener('click', async () => {
      const field = document.getElementById('refined-config');
      field.select();
      try { await navigator.clipboard.writeText(field.value); }
      catch (_) { document.execCommand('copy'); }
      alert('Config copied to clipboard');
    });
  </script>
</body>
</html>`;
}

function refineConfig(config, publicHost) {
  const allowedPorts = ["443", "8443", "2053", "2083", "2087", "2096"];
  if (!config) throw new Error("Please enter a config");
  if (!publicHost) throw new Error("Railway public domain was not detected");

  if (config.startsWith("vmess://")) return refineVmess(config, publicHost, allowedPorts);
  if (config.startsWith("vless://")) return refineVless(config, publicHost, allowedPorts);
  if (config.startsWith("trojan://")) return refineTrojan(config, publicHost, allowedPorts);
  throw new Error("Invalid config format. Please enter a valid VMess, VLESS or Trojan config with WS+TLS.");
}

function refineVmess(config, publicHost, allowedPorts) {
  const base64Data = config.slice(8).replace(/-/g, "+").replace(/_/g, "/");
  const decoded = JSON.parse(Buffer.from(base64Data, "base64").toString("utf8"));
  if (decoded.net !== "ws") throw new Error("Network must be WS");
  if (decoded.tls !== "tls") throw new Error("Security must be TLS");
  if (!allowedPorts.includes(String(decoded.port))) {
    throw new Error("Config must use port 443, 8443, 2053, 2083, 2087 or 2096");
  }
  const originalSni = decoded.sni || decoded.host || "";
  decoded.port = 443;
  decoded.add = publicHost;
  decoded.host = publicHost;
  decoded.sni = publicHost;
  decoded.path = `/${originalSni}${decoded.path || ""}`;
  return "vmess://" + Buffer.from(JSON.stringify(decoded), "utf8").toString("base64");
}

function refineVless(config, publicHost, allowedPorts) {
  const url = new URL(config);
  if (url.searchParams.get("type") !== "ws") throw new Error("Network must be WS");
  if (url.searchParams.get("security") !== "tls") throw new Error("Security must be TLS");
  if (!allowedPorts.includes(url.port)) {
    throw new Error("Config must use port 443, 8443, 2053, 2083, 2087 or 2096");
  }
  url.port = "443";
  url.hostname = publicHost;
  const originalHost = url.searchParams.get("host") || "";
  const originalPath = url.searchParams.get("path") || "";
  url.searchParams.set("host", publicHost);
  url.searchParams.set("sni", publicHost);
  url.searchParams.set("path", `/${originalHost}${originalPath}`);
  return url.toString();
}

function refineTrojan(config, publicHost, allowedPorts) {
  const url = new URL(config);
  if (url.searchParams.get("type") !== "ws") throw new Error("Network must be WS");
  if (url.searchParams.get("security") !== "tls") throw new Error("Security must be TLS");
  if (!allowedPorts.includes(url.port)) {
    throw new Error("Config must use port 443, 8443, 2053, 2083, 2087 or 2096");
  }
  url.port = "443";
  url.hostname = publicHost;
  const originalHost = url.searchParams.get("host") || "";
  const originalPath = url.searchParams.get("path") || "";
  url.searchParams.set("host", publicHost);
  url.searchParams.set("sni", publicHost);
  url.searchParams.set("path", `/${originalHost}${originalPath}`);
  return url.toString();
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`TLS Config Refiner listening on ${PORT}`);
});
