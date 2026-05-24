import express from "express";
import path from "path";
import https from "https";
import http from "http";
import { URL } from "url";
import { createServer as createViteServer } from "vite";

// Custom helper: Follows redirects and allows arbitrary timeout for slow Apps Script environments
function requestWithRedirects(
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  redirectCount = 0
): Promise<{ statusCode?: number; headers: any; body: string }> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) {
      return reject(new Error("Çok fazla yönlendirme (Too many redirects)"));
    }

    const parsedUrl = new URL(targetUrl);
    const lib = parsedUrl.protocol === "https:" ? https : http;

    const reqHeaders = { ...headers };
    if (body) {
      reqHeaders["Content-Length"] = Buffer.byteLength(body).toString();
    } else {
      delete reqHeaders["Content-Length"];
      delete reqHeaders["Content-Type"];
    }

    const reqOptions: https.RequestOptions = {
      method: method,
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: reqHeaders,
    };

    const req = lib.request(reqOptions, (res) => {
      const statusCode = res.statusCode || 200;

      // Handle redirect
      if ([301, 302, 303, 307, 308].includes(statusCode) && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, targetUrl).toString();
        let nextMethod = method;
        let nextBody = body;
        let nextHeaders = { ...headers };

        if ([301, 302, 303].includes(statusCode)) {
          nextMethod = "GET";
          nextBody = undefined;
          delete nextHeaders["Content-Type"];
          delete nextHeaders["Content-Length"];
        }

        return resolve(
          requestWithRedirects(redirectUrl, nextMethod, nextHeaders, nextBody, redirectCount + 1)
        );
      }

      // Read response
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on("end", () => {
        const responseBody = Buffer.concat(chunks).toString("utf8");
        resolve({
          statusCode: statusCode,
          headers: res.headers,
          body: responseBody,
        });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    // Set connection and response timeouts (120 seconds for safety against cold start latency)
    req.setTimeout(120000, () => {
      req.destroy(new Error("Google Apps Script yanıt zaman aşımı (120 saniye aşıldı)"));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsers for JSON and URL-encoded data
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Secure backend proxy to bypass CORS/iframe restrictions for Google Apps Script
  app.post("/api/proxy", async (req, res) => {
    const { targetUrl, action, ...payload } = req.body;
    
    if (!targetUrl) {
      return res.status(400).json({ success: false, error: "Hedef URL (targetUrl) belirtilmedi." });
    }

    try {
      const reqHeaders = {
        "Content-Type": "application/json"
      };
      
      const requestBody = JSON.stringify({ action, ...payload });

      const result = await requestWithRedirects(
        targetUrl,
        "POST",
        reqHeaders,
        requestBody
      );

      // Probe if the response body is JSON first
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(result.body);
      } catch (e) {
        responseJson = null;
      }

      if (responseJson && typeof responseJson === "object") {
        return res.json(responseJson);
      } else {
        const text = result.body;
        if (text.includes("Google Accounts") || text.includes("signin")) {
          return res.status(403).json({
            success: false,
            error: "Giriş Gerekli: Google Apps Script 'Herkes' (Anyone) erişimine yetkilendirilmemiş olabilir."
          });
        }
        return res.json({ success: true, data: text });
      }
    } catch (error: any) {
      console.error("Proxy Hatası:", error);
      return res.status(500).json({
        success: false,
        error: `Sunucu proxy hatası: ${error.message || "Bilinmeyen hata"}`
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
