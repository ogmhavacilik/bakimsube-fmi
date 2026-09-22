import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsers for JSON and URL-encoded data
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CORS support so external static deployments (like Netlify) can use this proxy safely
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Per-URL in-memory cache for fast instant response and fallback
  const urlCache = new Map<string, { data: any; timestamp: number }>();

  // Secure backend proxy to bypass CORS/iframe restrictions for Google Apps Script
  app.all("/api/proxy", async (req, res) => {
    // Support both GET query and POST body
    const body = req.method === "GET" ? req.query : req.body;
    const { targetUrl, action, ...payload } = body as any;
    
    if (!targetUrl) {
      return res.status(400).json({ success: false, error: "Hedef URL (targetUrl) belirtilmedi." });
    }

    const cacheKey = `${targetUrl}_${action || 'get_init_data'}`;

    try {
      const requestBody = JSON.stringify({ action, ...payload });

      let response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: requestBody,
        redirect: "manual",
        signal: AbortSignal.timeout(60000)
      });

      // Follow Google Apps Script 302 redirect via GET to get final response
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location) {
          response = await fetch(location, {
            method: "GET",
            signal: AbortSignal.timeout(60000)
          });
        }
      }

      const text = await response.text();
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(text);
      } catch (e) {
        responseJson = null;
      }

      if (responseJson && typeof responseJson === "object") {
        if (action === "get_init_data" && responseJson.success && responseJson.data) {
          urlCache.set(cacheKey, { data: responseJson, timestamp: Date.now() });
        }
        return res.json(responseJson);
      } else {
        const textUpper = text.toUpperCase();
        if (text.includes("Google Accounts") || text.includes("signin") || textUpper.includes("SERVICE LOGIN")) {
          return res.status(403).json({
            success: false,
            error: "Giriş Gerekli: Google Apps Script 'Herkes' (Anyone) erişimine yetkilendirilmemiş olabilir."
          });
        }
        if (text.includes("Page not found") || text.includes("file you have requested does not exist") || text.includes("unable to open the file") || text.trim().startsWith("<")) {
          return res.status(404).json({
            success: false,
            error: "Google Apps Script servisine erişilemiyor veya adres geçersiz."
          });
        }
        return res.json({ success: true, data: text });
      }
    } catch (error: any) {
      const isTimeout = error.name === "AbortError" || error.name === "TimeoutError" || String(error).includes("timeout") || String(error).includes("aborted");
      if (!isTimeout) {
        console.error("Proxy Hatası:", error?.message || error);
      }

      // If we have cached data for this targetUrl and action, serve it during transient network timeout
      const cached = urlCache.get(cacheKey);
      if (action === "get_init_data" && cached && cached.data) {
        console.log(`Serving cached data for ${cacheKey} after proxy timeout`);
        return res.json(cached.data);
      }

      return res.status(504).json({
        success: false,
        error: isTimeout 
          ? "Sunucu yanıt süresi aşıldı (Zaman aşımı). Lütfen ağ bağlantınızı kontrol edip tekrar deneyiniz." 
          : `Sunucu proxy hatası: ${error.message || "Bilinmeyen hata"}`
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
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
