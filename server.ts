import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsers for JSON and URL-encoded data
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CORS support
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

  const FAST_CSV_TRANSACTIONS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT3MCU4qhFXt1MJtK_ypsaEj2ZtqgJ_HZKAJU3AIA25dd-qhcotXNc-1Ks3YBalsJt_AAC3OwAanYbR/pub?output=csv&gid=1412906013";
  const FAST_CSV_PERSONNEL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQDs49-l2K-dYi11wKj11T0E5KkXMFdMfDN-SP23onLZLvZoV6dUGrxpOuPpRwvTxmc2P__UA6IcqVc/pub?output=csv&gid=0";
  const FAST_CSV_ATTENDANCE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQDs49-l2K-dYi11wKj11T0E5KkXMFdMfDN-SP23onLZLvZoV6dUGrxpOuPpRwvTxmc2P__UA6IcqVc/pub?output=csv&gid=1568664684";
  const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzIcoXEFiU_BKRq5DuIMvsio5HYNvp_kMoQA0ynqht8BmKHq-FO6V28RnRQ9bwUFNay/exec";

  function parseCSV(text: string): string[][] {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines: string[][] = [];
    let row: string[] = [''];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== '') lines.push(row);
    return lines;
  }

  function rowsToObjects(lines: string[][]): Record<string, any>[] {
    if (lines.length < 2) return [];
    const headers = lines[0].map(h => h.replace(/^\uFEFF/, '').trim());
    const objs: Record<string, any>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.length === 1 && !row[0]) continue;
      const obj: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        if (!header) continue;
        let val = row[j] !== undefined ? row[j].trim() : '';
        const hLower = header.toLowerCase();
        if (hLower === 'hours' || hLower === 'days' || hLower === 'sure' || hLower === 'puan' || hLower === 'saat') {
          val = val.replace(',', '.');
        }
        obj[header] = val;
        const camel = header.charAt(0).toLowerCase() + header.slice(1);
        if (!(camel in obj)) obj[camel] = val;
        if (!(hLower in obj)) obj[hLower] = val;
        const upper = header.toUpperCase();
        if (!(upper in obj)) obj[upper] = val;
      }
      objs.push(obj);
    }
    return objs;
  }

  // Fast CSV data endpoint - Pure live Google Sheets CSV, NO local JSON caching
  app.get("/api/fast-data", async (req, res) => {
    try {
      const fetchUtf8 = async (url: string, timeoutMs: number) => {
        const r = await fetch(url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(), { 
          signal: AbortSignal.timeout(timeoutMs), 
          headers: { 
            "User-Agent": "Mozilla/5.0", 
            "Cache-Control": "no-cache, no-store, must-revalidate", 
            "Pragma": "no-cache" 
          } 
        });
        const buf = await r.arrayBuffer();
        return new TextDecoder('utf-8').decode(buf);
      };

      const [resTx, resPer, resAtt] = await Promise.all([
        fetchUtf8(FAST_CSV_TRANSACTIONS, 15000).catch(() => ""),
        fetchUtf8(FAST_CSV_PERSONNEL, 15000).catch(() => ""),
        fetchUtf8(FAST_CSV_ATTENDANCE, 20000).catch(() => "")
      ]);

      const csvTxObjs = resTx ? rowsToObjects(parseCSV(resTx)) : [];
      const perObjs = resPer ? rowsToObjects(parseCSV(resPer)) : [];
      const attObjs = resAtt ? rowsToObjects(parseCSV(resAtt)) : [];

      const payload = {
        transactions: csvTxObjs,
        personnel: perObjs,
        attendance: attObjs
      };

      return res.json({
        success: true,
        fromCache: false,
        fetchedAt: new Date().toISOString(),
        ...payload
      });
    } catch (err: any) {
      console.error("Fast data fetch error:", err?.message || err);
      return res.json({
        success: false,
        error: err?.message || String(err),
        transactions: [],
        personnel: [],
        attendance: []
      });
    }
  });

  // Dedicated robust server proxy for saving overtime & sending data to Google Apps Script
  app.post("/api/save-overtime", async (req, res) => {
    try {
      const txData = req.body.transaction || req.body;
      const targetUrl = req.body.targetUrl || DEFAULT_APPS_SCRIPT_URL;

      const requestBody = JSON.stringify({
        action: "save_overtime",
        transaction: txData,
        sheet: "Plansız İşlemler"
      });

      console.log("Forwarding save-overtime to Apps Script:", targetUrl);

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: requestBody,
        redirect: "follow",
        signal: AbortSignal.timeout(25000)
      });

      const text = await response.text();
      let resJson: any = null;
      try { resJson = JSON.parse(text); } catch (e) {}

      if (resJson && resJson.success) {
        return res.json(resJson);
      }
      
      // If Apps Script returned error or non-success
      return res.status(500).json({
        success: false,
        error: resJson?.error || text || "Google Apps Script kayıt başarısız döndü."
      });
    } catch (e: any) {
      console.error("Server save-overtime forward error:", e?.message || e);
      return res.status(500).json({
        success: false,
        error: `Sunucu Apps Script yönlendirme hatası: ${e?.message || e}`
      });
    }
  });

  // Backend proxy for Google Apps Script requests
  app.all("/api/proxy", async (req, res) => {
    const body = req.method === "GET" ? req.query : req.body;
    const { targetUrl, action, ...payload } = body as any;

    const finalTargetUrl = targetUrl || DEFAULT_APPS_SCRIPT_URL;
    if (!finalTargetUrl) {
      return res.status(400).json({ success: false, error: "Hedef URL belirtilmedi." });
    }

    try {
      let response: any;
      const isGet = (action === "get_init_data" || !action);

      if (isGet) {
        const getUrl = finalTargetUrl + (finalTargetUrl.includes("?") ? "&" : "?") + `action=${encodeURIComponent(action || "get_init_data")}&_t=${Date.now()}`;
        response = await fetch(getUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate"
          },
          redirect: "follow",
          signal: AbortSignal.timeout(30000)
        });
      } else {
        const postUrl = finalTargetUrl + (finalTargetUrl.includes("?") ? "&" : "?") + `action=${encodeURIComponent(action || "")}&_t=${Date.now()}`;
        const requestBody = JSON.stringify({ action, ...payload });
        response = await fetch(postUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate"
          },
          body: requestBody,
          redirect: "follow",
          signal: AbortSignal.timeout(20000)
        });
      }

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
        const textUpper = text.toUpperCase();
        if (text.includes("Google Accounts") || text.includes("signin") || textUpper.includes("SERVICE LOGIN")) {
          return res.status(403).json({
            success: false,
            error: "Giriş Gerekli: Google Apps Script 'Herkes' (Anyone) erişimine yetkilendirilmemiş olabilir."
          });
        }
        return res.json({ success: true, data: text });
      }
    } catch (error: any) {
      const isTimeout = error.name === "AbortError" || error.name === "TimeoutError" || String(error).includes("timeout") || String(error).includes("aborted");
      return res.status(504).json({
        success: false,
        error: isTimeout 
          ? "Sunucu yanıt süresi aşıldı (Zaman aşımı)." 
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
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        return res.sendFile(path.join(distPath, "index.html"));
      }
      next();
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
