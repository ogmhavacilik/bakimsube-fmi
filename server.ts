import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

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
      const requestBody = JSON.stringify({ action, ...payload });

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: requestBody,
        signal: AbortSignal.timeout(60000)
      });

      const text = await response.text();
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(text);
      } catch (e) {
        responseJson = null;
      }

      if (responseJson && typeof responseJson === "object") {
        return res.json(responseJson);
      } else {
        if (text.includes("Google Accounts") || text.includes("signin")) {
          return res.status(403).json({
            success: false,
            error: "Giriş Gerekli: Google Apps Script 'Herkes' (Anyone) erişimine yetkilendirilmemiş olabilir."
          });
        }
        if (text.includes("Page not found") || text.includes("file you have requested does not exist") || text.trim().startsWith("<")) {
          return res.status(404).json({
            success: false,
            error: "Google Apps Script adresi bulunamadı veya 404 hatası verdi."
          });
        }
        return res.json({ success: true, data: text });
      }
    } catch (error: any) {
      const isTimeout = error.name === "AbortError" || error.name === "TimeoutError" || String(error).includes("timeout") || String(error).includes("aborted");
      if (!isTimeout) {
        console.error("Proxy Hatası:", error?.message || error);
      }
      return res.status(504).json({
        success: false,
        error: isTimeout 
          ? "Google Apps Script yanıt süresi aşıldı (Zaman aşımı)." 
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
