import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";

interface MilatRecord {
  id: string;
  oturum: string;
  unvan: string;
  milatBaslangic: string;
  milatBitis: string;
  beklemeHaftaIci: number;
  beklemeHaftaSonu: number;
  beklemeResmiTatil: number;
  gorevHaftaIci: number;
  gorevHaftaSonu: number;
  gorevResmiTatil: number;
  durum: "AKTİF" | "KAPALI";
  aciklama: string;
  guncellemeTarihi: string;
}

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
  const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXhg3TIWsb7FkySgsMMOEYk_4Yhsifk1Tc4vWDx2u8cap4RardTm_blQfrvtRCaeiV/exec";
  const DATA_DIR = path.join(process.cwd(), "data");
  const MILATLAR_FILE = path.join(DATA_DIR, "milatlar.json");

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
        attendance: attObjs,
        milatlar: readLocalMilatlar()
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
        attendance: [],
        milatlar: readLocalMilatlar()
      });
    }
  });

  // =========================================================================
  // MİLATLAR (KOŞULLAR) YÖNETİMİ - "milatlar" Sayfası (Açılışta varsa tekrar yazılmaz)
  // =========================================================================
  function normalizeTrUpper(str: string): string {
    return String(str || "")
      .replace(/İ/g, "I").replace(/ı/g, "I").replace(/i/g, "I")
      .replace(/ğ/g, "G").replace(/Ğ/g, "G")
      .replace(/ü/g, "U").replace(/Ü/g, "U")
      .replace(/ş/g, "S").replace(/Ş/g, "S")
      .replace(/ö/g, "O").replace(/Ö/g, "O")
      .replace(/ç/g, "C").replace(/Ç/g, "C")
      .toUpperCase()
      .trim();
  }

  function normalizeYmd(val: any): string {
    if (!val) return "";
    const s = String(val).trim();
    if (!s) return "";
    const dmy = s.split(" ")[0].match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    const ymd = s.split(" ")[0].match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
    if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
    return s.split("T")[0];
  }

  function prevDayYmd(dateStr: string): string {
    const norm = normalizeYmd(dateStr);
    const parts = norm.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return "";
    const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] - 1));
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function buildDefaultMilatlar(personnelRows: Record<string, any>[] = []): MilatRecord[] {
    const nowTs = new Date().toISOString();
    const titleMap = new Map<string, { unvan: string; oturum: string; isDriver: boolean }>();

    const registerTitle = (rawTitle: string, rawUnit = "") => {
      const t = String(rawTitle || "").trim();
      if (!t) return;
      const norm = normalizeTrUpper(t);
      const uNorm = normalizeTrUpper(rawUnit);
      const isExcludedAircraft = ["BELL-429", "BELL 429", "B-360", "B360", "T-70", "T70", "C-650", "C650", "AT-802", "AT802"].some(p => norm.includes(p));
      if (isExcludedAircraft) return;
      const isDriver = ["SOFOR", "SURUCU"].some(k => norm.includes(k) || uNorm.includes(k));
      const isYerDestek = isDriver || ["DESTEK", "ISCI", "HIZMETLI"].some(k => norm.includes(k) || uNorm.includes(k));
      const oturum = isYerDestek ? "ogm2" : "ogm1";
      if (!titleMap.has(norm)) {
        titleMap.set(norm, { unvan: t, oturum, isDriver });
      }
    };

    registerTitle("UÇAK TEKNİKERİ", "TEKNİK");
    registerTitle("UÇAK TEKNİSYENİ", "TEKNİK");
    registerTitle("DESTEK MEMUR(ŞÖFÖR)", "YER DESTEK");
    registerTitle("DESTEK MEMURU", "YER DESTEK");

    for (const p of personnelRows) {
      const t = p.TITLE || p.title || p.UNVAN || p["ÜNVAN"] || p.unvan || "";
      const u = p.BIRIM || p["BİRİM"] || p.unit || p.UNIT || "";
      registerTitle(t, u);
    }

    const rows: MilatRecord[] = [];
    for (const [normKey, info] of titleMap.entries()) {
      const bWkend = info.isDriver ? 10 : 2;
      const bHol = info.isDriver ? 10 : 2;
      const slug = normKey.replace(/[^A-Z0-9]/g, "").slice(0, 18);

      rows.push({
        id: `milat-${slug}-1`,
        oturum: info.oturum,
        unvan: info.unvan,
        milatBaslangic: "2026-05-01",
        milatBitis: "2026-09-17",
        beklemeHaftaIci: 1,
        beklemeHaftaSonu: bWkend,
        beklemeResmiTatil: bHol,
        gorevHaftaIci: 3,
        gorevHaftaSonu: 11,
        gorevResmiTatil: 11,
        durum: "KAPALI",
        aciklama: "18 Eylül 2026 öncesi standart 3-11 dönemi",
        guncellemeTarihi: nowTs
      });
      rows.push({
        id: `milat-${slug}-2`,
        oturum: info.oturum,
        unvan: info.unvan,
        milatBaslangic: "2026-09-18",
        milatBitis: "2026-10-21",
        beklemeHaftaIci: 1,
        beklemeHaftaSonu: bWkend,
        beklemeResmiTatil: bHol,
        gorevHaftaIci: 1,
        gorevHaftaSonu: 10,
        gorevResmiTatil: 10,
        durum: "KAPALI",
        aciklama: "18 Eylül - 21 Ekim 2026 OGM dönemi",
        guncellemeTarihi: nowTs
      });
      rows.push({
        id: `milat-${slug}-3`,
        oturum: info.oturum,
        unvan: info.unvan,
        milatBaslangic: "2026-10-22",
        milatBitis: "",
        beklemeHaftaIci: 1,
        beklemeHaftaSonu: bWkend,
        beklemeResmiTatil: bHol,
        gorevHaftaIci: 0,
        gorevHaftaSonu: 8,
        gorevResmiTatil: 8,
        durum: "AKTİF",
        aciklama: "22 Ekim 2026 sonrası güncel dönem",
        guncellemeTarihi: nowTs
      });
    }
    return rows;
  }

  function readLocalMilatlar(): MilatRecord[] {
    try {
      if (!fs.existsSync(MILATLAR_FILE)) return [];
      const raw = fs.readFileSync(MILATLAR_FILE, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeLocalMilatlar(list: MilatRecord[]) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(MILATLAR_FILE, JSON.stringify(list, null, 2), "utf8");
  }

  function sortMilatlar(list: MilatRecord[]): MilatRecord[] {
    return [...list].sort((a, b) => {
      const ua = normalizeTrUpper(a.unvan);
      const ub = normalizeTrUpper(b.unvan);
      if (ua !== ub) return ua.localeCompare(ub, "tr-TR");
      return String(a.milatBaslangic || "").localeCompare(String(b.milatBaslangic || ""));
    });
  }

  async function checkGasMilatlarSupport(targetUrl = DEFAULT_APPS_SCRIPT_URL): Promise<{ supported: boolean; milatlar?: MilatRecord[] }> {
    try {
      const url = `${targetUrl}${targetUrl.includes("?") ? "&" : "?"}action=get_milatlar&_t=${Date.now()}`;
      const r = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json", "Cache-Control": "no-cache" },
        redirect: "follow",
        signal: AbortSignal.timeout(10000)
      });
      const text = await r.text();
      const json = JSON.parse(text);
      if (json && json.milatlarSupported === true && Array.isArray(json.milatlar)) {
        return { supported: true, milatlar: json.milatlar };
      }
      return { supported: false };
    } catch {
      return { supported: false };
    }
  }

  async function ensureMilatlarOnStartup() {
    try {
      const alreadyExists = fs.existsSync(MILATLAR_FILE) && readLocalMilatlar().length > 0;
      const gasCheck = await checkGasMilatlarSupport(DEFAULT_APPS_SCRIPT_URL);

      if (alreadyExists) {
        console.log("[milatlar] Yerel milatlar sayfası zaten mevcut — üzerine yazılmadı.");
        return;
      }

      if (gasCheck.supported && gasCheck.milatlar && gasCheck.milatlar.length > 0) {
        writeLocalMilatlar(sortMilatlar(gasCheck.milatlar));
        console.log(`[milatlar] Google E-Tablo 'milatlar' sayfasından ${gasCheck.milatlar.length} kayıt senkronize edildi.`);
        return;
      }

      let perObjs: Record<string, any>[] = [];
      try {
        const resPer = await fetch(`${FAST_CSV_PERSONNEL}${FAST_CSV_PERSONNEL.includes("?") ? "&" : "?"}_t=${Date.now()}`, {
          signal: AbortSignal.timeout(10000),
          headers: { "User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache" }
        });
        if (resPer.ok) {
          const buf = await resPer.arrayBuffer();
          const text = new TextDecoder("utf-8").decode(buf);
          perObjs = rowsToObjects(parseCSV(text));
        }
      } catch {}

      const seeded = sortMilatlar(buildDefaultMilatlar(perObjs));
      writeLocalMilatlar(seeded);
      console.log(`[milatlar] Açılışta 'milatlar' sayfası ilk kez oluşturuldu (${seeded.length} kayıt).`);
    } catch (err: any) {
      console.warn("[milatlar] Başlangıç kontrol uyarısı:", err?.message || err);
    }
  }

  app.get("/api/milatlar", async (req, res) => {
    const targetUrl = String(req.query.targetUrl || DEFAULT_APPS_SCRIPT_URL);
    const localList = readLocalMilatlar();
    const gasCheck = await checkGasMilatlarSupport(targetUrl);
    if (gasCheck.supported && gasCheck.milatlar && gasCheck.milatlar.length > 0) {
      const sorted = sortMilatlar(gasCheck.milatlar);
      writeLocalMilatlar(sorted);
      return res.json({ success: true, sheetName: "milatlar", gasSynced: true, milatlar: sorted });
    }
    return res.json({ success: true, sheetName: "milatlar", gasSynced: false, milatlar: localList });
  });

  app.post("/api/milatlar/init", async (req, res) => {
    try {
      const targetUrl = req.body?.targetUrl || DEFAULT_APPS_SCRIPT_URL;
      const personnelFromClient: Record<string, any>[] = Array.isArray(req.body?.personnel) ? req.body.personnel : [];
      const current = readLocalMilatlar();
      let updated = [...current];
      let addedCount = 0;

      if (current.length === 0) {
        updated = buildDefaultMilatlar(personnelFromClient);
        addedCount = updated.length;
      } else if (personnelFromClient.length > 0) {
        // Sadece henüz "milatlar" sayfasında hiç kaydı olmayan yeni unvanları ekle; mevcutlara dokunma!
        const existingTitles = new Set(current.map(m => normalizeTrUpper(m.unvan)));
        const candidateRows = buildDefaultMilatlar(personnelFromClient);
        for (const row of candidateRows) {
          if (!existingTitles.has(normalizeTrUpper(row.unvan))) {
            updated.push(row);
            addedCount++;
          }
        }
      }

      const sorted = sortMilatlar(updated);
      if (addedCount > 0 || !fs.existsSync(MILATLAR_FILE)) {
        writeLocalMilatlar(sorted);
      }

      let gasSynced = false;
      const gasCheck = await checkGasMilatlarSupport(targetUrl);
      if (gasCheck.supported) {
        try {
          await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: addedCount > 0 ? "save_milatlar" : "init_milatlar", milatlar: sorted, replaceAll: false }),
            redirect: "follow",
            signal: AbortSignal.timeout(15000)
          });
          gasSynced = true;
        } catch {}
      }

      return res.json({ success: true, sheetName: "milatlar", alreadyExists: current.length > 0, addedCount, gasSynced, milatlar: sorted });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.post("/api/milatlar/save", async (req, res) => {
    try {
      const targetUrl = req.body?.targetUrl || DEFAULT_APPS_SCRIPT_URL;
      const incoming = req.body?.milat;
      const autoClosePrevious = req.body?.autoClosePrevious !== false;

      if (!incoming || !incoming.unvan || !incoming.milatBaslangic) {
        return res.status(400).json({ success: false, error: "Unvan ve Milat Başlangıç tarihi zorunludur." });
      }

      const nowTs = new Date().toISOString();
      let list = readLocalMilatlar();
      const incomingId = String(incoming.id || `milat-${Date.now()}`);
      const incomingUnvanNorm = normalizeTrUpper(incoming.unvan);
      const incomingStart = normalizeYmd(incoming.milatBaslangic);
      const incomingEnd = normalizeYmd(incoming.milatBitis);

      if (autoClosePrevious && incomingStart) {
        const closeDate = prevDayYmd(incomingStart);
        list = list.map(m => {
          if (String(m.id) !== incomingId && normalizeTrUpper(m.unvan) === incomingUnvanNorm) {
            if (m.milatBaslangic && m.milatBaslangic < incomingStart && (!m.milatBitis || m.milatBitis >= incomingStart)) {
              return { ...m, milatBitis: closeDate, durum: "KAPALI", guncellemeTarihi: nowTs };
            }
          }
          return m;
        });
      }

      const record: MilatRecord = {
        id: incomingId,
        oturum: String(incoming.oturum || "ogm1"),
        unvan: String(incoming.unvan).trim(),
        milatBaslangic: incomingStart,
        milatBitis: incomingEnd,
        beklemeHaftaIci: Number(incoming.beklemeHaftaIci ?? 1),
        beklemeHaftaSonu: Number(incoming.beklemeHaftaSonu ?? 2),
        beklemeResmiTatil: Number(incoming.beklemeResmiTatil ?? 2),
        gorevHaftaIci: Number(incoming.gorevHaftaIci ?? 0),
        gorevHaftaSonu: Number(incoming.gorevHaftaSonu ?? 8),
        gorevResmiTatil: Number(incoming.gorevResmiTatil ?? 8),
        durum: incomingEnd ? "KAPALI" : (incoming.durum === "KAPALI" ? "KAPALI" : "AKTİF"),
        aciklama: String(incoming.aciklama || ""),
        guncellemeTarihi: nowTs
      };

      const idx = list.findIndex(m => String(m.id) === incomingId);
      if (idx >= 0) list[idx] = record;
      else list.push(record);

      const sorted = sortMilatlar(list);
      writeLocalMilatlar(sorted);

      let gasSynced = false;
      const gasCheck = await checkGasMilatlarSupport(targetUrl);
      if (gasCheck.supported) {
        try {
          const gasRes = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "save_milat", milat: record, autoClosePrevious }),
            redirect: "follow",
            signal: AbortSignal.timeout(15000)
          });
          const gasJson = await gasRes.json().catch(() => null);
          if (gasJson?.success) gasSynced = true;
        } catch {}
      }

      return res.json({ success: true, sheetName: "milatlar", gasSynced, milat: record, milatlar: sorted });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.post("/api/milatlar/close", async (req, res) => {
    try {
      const targetUrl = req.body?.targetUrl || DEFAULT_APPS_SCRIPT_URL;
      const id = String(req.body?.id || "");
      const closeDate = normalizeYmd(req.body?.milatBitis || new Date().toISOString().slice(0, 10));
      if (!id || !closeDate) {
        return res.status(400).json({ success: false, error: "Kapatılacak milat ID ve kapanış tarihi gereklidir." });
      }

      const nowTs = new Date().toISOString();
      const list = readLocalMilatlar();
      const idx = list.findIndex(m => String(m.id) === id);
      if (idx < 0) {
        return res.status(404).json({ success: false, error: "Milat kaydı bulunamadı." });
      }

      const updatedRecord: MilatRecord = {
        ...list[idx],
        milatBitis: closeDate,
        durum: "KAPALI",
        guncellemeTarihi: nowTs
      };
      list[idx] = updatedRecord;
      const sorted = sortMilatlar(list);
      writeLocalMilatlar(sorted);

      let gasSynced = false;
      const gasCheck = await checkGasMilatlarSupport(targetUrl);
      if (gasCheck.supported) {
        try {
          const gasRes = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "save_milat", milat: updatedRecord, autoClosePrevious: false }),
            redirect: "follow",
            signal: AbortSignal.timeout(15000)
          });
          const gasJson = await gasRes.json().catch(() => null);
          if (gasJson?.success) gasSynced = true;
        } catch {}
      }

      return res.json({ success: true, sheetName: "milatlar", gasSynced, milat: updatedRecord, milatlar: sorted });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.post("/api/milatlar/delete", async (req, res) => {
    try {
      const targetUrl = req.body?.targetUrl || DEFAULT_APPS_SCRIPT_URL;
      const id = String(req.body?.id || "");
      if (!id) {
        return res.status(400).json({ success: false, error: "Silinecek milat ID gereklidir." });
      }

      const filtered = readLocalMilatlar().filter(m => String(m.id) !== id);
      const sorted = sortMilatlar(filtered);
      writeLocalMilatlar(sorted);

      let gasSynced = false;
      const gasCheck = await checkGasMilatlarSupport(targetUrl);
      if (gasCheck.supported) {
        try {
          const gasRes = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "delete_milat", id }),
            redirect: "follow",
            signal: AbortSignal.timeout(15000)
          });
          const gasJson = await gasRes.json().catch(() => null);
          if (gasJson?.success) gasSynced = true;
        } catch {}
      }

      return res.json({ success: true, sheetName: "milatlar", gasSynced, milatlar: sorted });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
    }
  });

  app.get("/api/komut2", (_req, res) => {
    try {
      const gsPath = path.join(process.cwd(), "komut2.gs");
      if (!fs.existsSync(gsPath)) {
        return res.status(404).json({ success: false, error: "komut2.gs bulunamadı." });
      }
      const code = fs.readFileSync(gsPath, "utf8");
      return res.json({ success: true, code });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || String(e) });
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

  await ensureMilatlarOnStartup();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
