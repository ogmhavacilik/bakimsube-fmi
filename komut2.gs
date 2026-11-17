// =========================================================================
// OGM PERSONEL, YOKLAMA VE PLANSIZ İŞLEMLER GOOGLE APPS SCRIPT
// E-Tablo ID: 1EbwS6gIo8DHIdpZKyrX4JwM0aDejCrhRBsK-PK0f_fk
// =========================================================================

const SPREADSHEET_ID = "1QY6ETO3zQ_zQfxZIRm5gPj5YnA3y1h41bGEHVqSQEp4";
const SYSTEM_ID = "0005536572913";

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "get_init_data";
  var callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : null;
  
  if (action === "get_init_data") {
    var output = {
      success: true,
      milatlarSupported: true,
      data: {
        attendance: getAttendance(),
        personnel: getPersonnel(),
        transactions: getTransactions(),
        milatlar: getMilatlar()
      }
    };
    var jsonStr = JSON.stringify(output);
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + jsonStr + ");")
                           .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(jsonStr)
                         .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "get_milatlar" || action === "init_milatlar") {
    var initInfo = ensureMilatlarSheetOnce();
    var mOutput = {
      success: true,
      milatlarSupported: true,
      sheetName: "milatlar",
      created: initInfo.created,
      alreadyExists: initInfo.alreadyExists,
      milatlar: getMilatlar()
    };
    var mJson = JSON.stringify(mOutput);
    if (callback) {
      return ContentService.createTextOutput(callback + "(" + mJson + ");")
                           .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(mJson)
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  var msg = "Sistem Aktif - Personel, Yoklama, Plansız İşlemler ve Milatlar Entegrasyonu Çalışıyor.";
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + JSON.stringify({success: true, milatlarSupported: true, message: msg}) + ");")
                         .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(msg);
}

function doPost(e) {
  var output = { success: false, error: "Bilinmeyen istek" };
  
  try {
    var body = null;
    var contents = (e && e.postData && e.postData.contents) ? e.postData.contents : "";
    
    if (contents) {
      try {
        body = JSON.parse(contents);
      } catch (parseErr) {
        body = null;
      }
    }
    
    if (!body && e && e.parameter) {
      if (e.parameter.postData) {
        try { body = JSON.parse(e.parameter.postData); } catch (pErr) {}
      }
      if (!body && e.parameter.action) {
        body = e.parameter;
      }
    }
    
    if (!body) body = {};
    var action = body.action || (e && e.parameter && e.parameter.action) || "save_overtime";

    if (action === "get_init_data") {
      output = {
        success: true,
        milatlarSupported: true,
        data: {
          attendance: getAttendance(),
          personnel: getPersonnel(),
          transactions: getTransactions(),
          milatlar: getMilatlar()
        }
      };
    } else if (action === "init_milatlar" || action === "get_milatlar") {
      var initRes = ensureMilatlarSheetOnce(body.milatlar || body.defaultRows);
      output = {
        success: true,
        milatlarSupported: true,
        sheetName: "milatlar",
        created: initRes.created,
        alreadyExists: initRes.alreadyExists,
        milatlar: getMilatlar()
      };
    } else if (action === "save_milat" || action === "save_milatlar") {
      output = saveMilatlar(body);
    } else if (action === "delete_milat") {
      output = deleteMilat(body);
    } else if (action === "save_overtime" || action === "save_fmi" || action === "add_overtime" || action === "use_permit") {
      output = saveOvertime(body);
    } else if (action === "approve_overtime") {
      output = approveOvertime(body);
    } else if (action === "delete_overtime") {
      output = deleteOvertime(body);
    } else {
      output = saveOvertime(body);
    }
  } catch (error) {
    output = { success: false, error: error.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(output))
                       .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreatePlansizSheet(db) {
  var targetSheets = [
    "plansız işlemler", "Plansız İşlemler", "PLANSIZ İŞLEMLER",
    "plansız ıslemler", "Plansız Isılemler", "PLANSIZ ISLEMLER",
    "plansız islemler", "Plansız Islemler",
    "plansiz islemler", "Plansiz Islemler",
    "plansız mesai", "Plansız Mesai", "PLANSIZ MESAİ",
    "plansiz mesai", "Plansiz Mesai", "PLANSIZ MESAI"
  ];
  
  var sheet = getSheetSafely(db, targetSheets);
  if (!sheet) {
    // Sayfa yoksa otomatik oluştur
    try {
      sheet = db.insertSheet("Plansız İşlemler");
      var defaultHeaders = ["ID", "PersonId", "PersonName", "Date", "EndDate", "Days", "Hours", "Type", "Shift", "DayType", "Description", "Status", "Timestamp", "CreatedAt", "Note"];
      sheet.appendRow(defaultHeaders);
      sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight("bold").setBackground("#e2e8f0");
    } catch (createErr) {
      sheet = db.getSheets()[0];
    }
  }
  return sheet;
}

function saveOvertime(body) {
  var tx = body.transaction || body;
  var db = getSpreadsheet();
  if (!db) {
    return { success: false, error: "Google E-Tablo açılamadı." };
  }
  
  var sheet = getOrCreatePlansizSheet(db);
  var data = sheet.getDataRange().getValues();
  var headers = data.length > 0 ? data[0] : [];
  
  var id = tx.rawTxId || tx.id || ("manual-tx-" + new Date().getTime());
  var personId = tx.personId || tx.PersonId || tx.PID || "";
  var personName = tx.personName || tx.PersonName || tx.NAME || "";
  var date = tx.date || tx.Date || "";
  var endDate = tx.endDate || tx.EndDate || date;
  var days = tx.days !== undefined ? tx.days : 1;
  var hours = tx.hours !== undefined ? tx.hours : 0;
  var isUsed = String(tx.type || "").toUpperCase().includes("USE") || String(tx.type || "").toUpperCase().includes("IZIN");
  var type = isUsed ? "USED" : "EARNED";
  var shift = tx.shift || tx.Shift || "Gündüz";
  var dayType = tx.dayType || tx.DayType || "Hafta İçi";
  var description = tx.description || tx.Description || tx.note || (isUsed ? "FMİ İZNİ" : "PLANSIZ MESAİ");
  var status = tx.status || tx.Status || "APPROVED";
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+3", "dd.MM.yyyy HH:mm:ss");
  var createdAt = tx.createdAt || tx.CreatedAt || timestamp;
  var note = tx.note || tx.Note || description;
  
  if (headers.length > 0) {
    var newRow = [];
    for (var j = 0; j < headers.length; j++) {
      var h = String(headers[j]).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (h === "ID" || h === "TRANSACTIONID") newRow.push(id);
      else if (h === "PERSONID" || h === "PID" || h === "TCNO") newRow.push(personId);
      else if (h === "PERSONNAME" || h === "ADSOYAD" || h === "NAME") newRow.push(personName);
      else if (h === "DATE" || h === "TARIH") newRow.push(date);
      else if (h === "ENDDATE" || h === "BITISTARIHI") newRow.push(endDate);
      else if (h === "DAYS" || h === "GUN") newRow.push(days);
      else if (h === "HOURS" || h === "SAAT" || h === "SURE") newRow.push(hours);
      else if (h === "TYPE" || h === "TIP") newRow.push(type);
      else if (h === "SHIFT" || h === "VARDIYA") newRow.push(shift);
      else if (h === "DAYTYPE" || h === "GUNTIPI") newRow.push(dayType);
      else if (h === "DESCRIPTION" || h === "ACIKLAMA" || h === "GOREV") newRow.push(description);
      else if (h === "STATUS" || h === "DURUM") newRow.push(status);
      else if (h === "TIMESTAMP" || h === "ZAMANDAMGASI") newRow.push(timestamp);
      else if (h === "CREATEDAT" || h === "OLUSTURMATARIHI") newRow.push(createdAt);
      else if (h === "NOTE" || h === "NOT") newRow.push(note);
      else newRow.push("");
    }
    sheet.appendRow(newRow);
  } else {
    sheet.appendRow([id, personId, personName, date, endDate, days, hours, type, shift, dayType, description, status, timestamp, createdAt, note]);
  }
  
  return {
    success: true,
    message: "Plansız işlem kaydı e-tabloya başarıyla eklendi.",
    id: id,
    sheet: sheet.getName()
  };
}

function approveOvertime(body) {
  var id = body.id || (body.transaction && body.transaction.id);
  if (!id) return { success: false, error: "ID bulunamadı" };
  
  var db = getSpreadsheet();
  var sheet = getOrCreatePlansizSheet(db);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, message: "Tablo boş" };
  
  var headers = data[0];
  var idCol = -1;
  var statusCol = -1;
  for (var j = 0; j < headers.length; j++) {
    var h = String(headers[j]).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (h === "ID" || h === "TRANSACTIONID") idCol = j;
    if (h === "STATUS" || h === "DURUM") statusCol = j;
  }
  
  if (idCol !== -1 && statusCol !== -1) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idCol]).trim() === String(id).trim()) {
        sheet.getRange(i + 1, statusCol + 1).setValue("APPROVED");
        return { success: true, message: "Kayıt onaylandı." };
      }
    }
  }
  return { success: true, message: "Kayıt durumu güncellendi." };
}

function deleteOvertime(body) {
  var id = body.id;
  if (!id) return { success: false, error: "ID bulunamadı" };
  
  var db = getSpreadsheet();
  var sheet = getOrCreatePlansizSheet(db);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, message: "Tablo boş" };
  
  var headers = data[0];
  var idCol = -1;
  for (var j = 0; j < headers.length; j++) {
    var h = String(headers[j]).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (h === "ID" || h === "TRANSACTIONID") idCol = j;
  }
  
  if (idCol !== -1) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idCol]).trim() === String(id).trim()) {
        sheet.deleteRow(i + 1);
        return { success: true, message: "Kayıt silindi." };
      }
    }
  }
  return { success: true, message: "Silme tamamlandı." };
}

function getSheetSafely(db, possibleNames) {
  if (!db) return null;
  for (var i = 0; i < possibleNames.length; i++) {
    var s = db.getSheetByName(possibleNames[i]);
    if (s) return s;
  }
  try {
    var allSheets = db.getSheets();
    var cleanStr = function(str) {
      return String(str || '').trim().toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ı/g, 'i').replace(/i̇/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, '');
    };
    for (var i = 0; i < allSheets.length; i++) {
      var s = allSheets[i];
      var sNorm = cleanStr(s.getName());
      for (var j = 0; j < possibleNames.length; j++) {
        var pNorm = cleanStr(possibleNames[j]);
        if (sNorm === pNorm || (pNorm.length > 5 && sNorm.indexOf(pNorm) !== -1) || (sNorm.length > 5 && pNorm.indexOf(sNorm) !== -1)) {
          return s;
        }
      }
    }
  } catch (err) {}
  return null;
}

function getAttendance() {
  var db = getSpreadsheet();
  var sheet = getSheetSafely(db, ["Yoklama", "YOKLAMA", "ATTENDANCE"]);
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  var headers = data[0];
  var result = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var hasContent = false;
    for (var k = 0; k < row.length; k++) {
      if (row[k] !== "" && row[k] !== null && row[k] !== undefined) {
        hasContent = true;
        break;
      }
    }
    if (!hasContent) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var header = String(headers[j]).trim();
      if (header) {
        var val = row[j];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone() || "GMT+3", "yyyy-MM-dd HH:mm");
        }
        obj[header] = val;
      }
    }
    result.push(obj);
  }
  return result;
}

function getPersonnel() {
  var db = getSpreadsheet();
  var sheet = getSheetSafely(db, ["Personel", "PERSONEL", "PERSONNEL"]);
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  var headers = data[0];
  var result = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var hasContent = false;
    for (var k = 0; k < row.length; k++) {
      if (row[k] !== "" && row[k] !== null && row[k] !== undefined) {
        hasContent = true;
        break;
      }
    }
    if (!hasContent) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var header = String(headers[j]).trim();
      if (header) {
        var val = row[j];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone() || "GMT+3", "yyyy-MM-dd");
        }
        obj[header] = val;
      }
    }
    result.push(obj);
  }
  return result;
}

function getTransactions() {
  var db = getSpreadsheet();
  var sheet = getOrCreatePlansizSheet(db);
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  var headers = data[0];
  var result = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var hasContent = false;
    for (var k = 0; k < row.length; k++) {
      if (row[k] !== "" && row[k] !== null && row[k] !== undefined) {
        hasContent = true;
        break;
      }
    }
    if (!hasContent) continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var header = String(headers[j]).trim();
      if (header) {
        var val = row[j];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone() || "GMT+3", "yyyy-MM-dd");
        }
        obj[header] = val;
      }
    }
    if (!obj["ID"] && !obj["id"] && !obj["TRANSACTION_ID"] && !obj["ISLEM_ID"]) {
      obj["ID"] = "sheet_tx_" + i;
    }
    obj["ROW_INDEX"] = i;
    obj["IS_PLANSIZ"] = true;
    obj["isPlansiz"] = true;
    result.push(obj);
  }
  return result;
}

// =========================================================================
// MİLATLAR VE KATSAYI KOŞULLARI YÖNETİMİ ("milatlar" Sayfası)
// =========================================================================

var MILATLAR_HEADERS = [
  "ID",
  "Oturum",
  "Unvan",
  "Milat_Baslangic",
  "Milat_Bitis",
  "Bekleme_HaftaIci",
  "Bekleme_HaftaSonu",
  "Bekleme_ResmiTatil",
  "Gorev_HaftaIci",
  "Gorev_HaftaSonu",
  "Gorev_ResmiTatil",
  "Durum",
  "Aciklama",
  "Guncelleme_Tarihi"
];

function normalizeTrUpper(str) {
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

function normalizeYmd(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || "GMT+3", "yyyy-MM-dd");
  }
  var s = String(val).trim();
  if (!s) return "";
  var dmy = s.split(" ")[0].match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (dmy) {
    return dmy[3] + "-" + ("0" + dmy[2]).slice(-2) + "-" + ("0" + dmy[1]).slice(-2);
  }
  var ymd = s.split(" ")[0].match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (ymd) {
    return ymd[1] + "-" + ("0" + ymd[2]).slice(-2) + "-" + ("0" + ymd[3]).slice(-2);
  }
  return s.split("T")[0];
}

function prevDayYmd(dateStr) {
  var norm = normalizeYmd(dateStr);
  var parts = norm.split("-");
  if (parts.length !== 3) return "";
  var dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) - 1));
  var y = dt.getUTCFullYear();
  var m = ("0" + (dt.getUTCMonth() + 1)).slice(-2);
  var d = ("0" + dt.getUTCDate()).slice(-2);
  return y + "-" + m + "-" + d;
}

function getDefaultMilatlarSeedRows() {
  var nowTs = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+3", "yyyy-MM-dd HH:mm:ss");
  var personnel = [];
  try { personnel = getPersonnel(); } catch (e) { personnel = []; }

  var titleMap = {};
  var registerTitle = function(rawTitle, rawUnit) {
    var t = String(rawTitle || "").trim();
    if (!t) return;
    var norm = normalizeTrUpper(t);
    var uNorm = normalizeTrUpper(rawUnit || "");
    var isExcludedAircraft = ["BELL-429", "BELL 429", "B-360", "B360", "T-70", "T70", "C-650", "C650", "AT-802", "AT802"].some(function(pat) { return norm.indexOf(pat) !== -1; });
    if (isExcludedAircraft) return;
    var isDriver = ["SOFOR", "SURUCU"].some(function(k) { return norm.indexOf(k) !== -1 || uNorm.indexOf(k) !== -1; });
    var isYerDestek = isDriver || ["DESTEK", "ISCI", "HIZMETLI"].some(function(k) { return norm.indexOf(k) !== -1 || uNorm.indexOf(k) !== -1; });
    var oturum = isYerDestek ? "ogm2" : "ogm1";
    if (!titleMap[norm]) {
      titleMap[norm] = { unvan: t, oturum: oturum, isDriver: isDriver };
    }
  };

  registerTitle("UÇAK TEKNİKERİ", "TEKNİK");
  registerTitle("UÇAK TEKNİSYENİ", "TEKNİK");
  registerTitle("DESTEK MEMUR(ŞÖFÖR)", "YER DESTEK");
  registerTitle("DESTEK MEMURU", "YER DESTEK");

  for (var i = 0; i < personnel.length; i++) {
    var p = personnel[i];
    var pTitle = p.TITLE || p.title || p.UNVAN || p["ÜNVAN"] || p.unvan || "";
    var pUnit = p.BIRIM || p["BİRİM"] || p.unit || p.UNIT || "";
    registerTitle(pTitle, pUnit);
  }

  var rows = [];
  var keys = Object.keys(titleMap);
  for (var k = 0; k < keys.length; k++) {
    var info = titleMap[keys[k]];
    var bWkend = info.isDriver ? 10 : 2;
    var bHol = info.isDriver ? 10 : 2;
    var slug = keys[k].replace(/[^A-Z0-9]/g, "").slice(0, 18);

    rows.push(["milat-" + slug + "-1", info.oturum, info.unvan, "2026-05-01", "2026-09-17", 1, bWkend, bHol, 3, 11, "", "KAPALI", "18 Eylül 2026 öncesi standart 3-11 dönemi", nowTs]);
    rows.push(["milat-" + slug + "-2", info.oturum, info.unvan, "2026-09-18", "2026-10-21", 1, bWkend, bHol, 1, 10, "", "KAPALI", "18 Eylül - 21 Ekim 2026 OGM dönemi", nowTs]);
    rows.push(["milat-" + slug + "-3", info.oturum, info.unvan, "2026-10-22", "", 1, bWkend, bHol, 0, 8, "", "AKTİF", "22 Ekim 2026 sonrası güncel dönem", nowTs]);
  }
  return rows;
}

function findExistingMilatlarSheet(db) {
  if (!db) return null;
  var exact = db.getSheetByName("milatlar");
  if (exact) return exact;
  var allSheets = db.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var sName = String(allSheets[i].getName() || "").trim().toLowerCase();
    if (sName === "milatlar" || sName === "mİlatlar") {
      return allSheets[i];
    }
  }
  return null;
}

function ensureMilatlarSheetOnce(customRows) {
  var db = getSpreadsheet();
  if (!db) return { sheet: null, created: false, alreadyExists: false };

  // Sayfa zaten varsa kesinlikle üzerine yazılmaz!
  var existingSheet = findExistingMilatlarSheet(db);
  if (existingSheet) {
    return { sheet: existingSheet, created: false, alreadyExists: true };
  }

  var sheet = db.insertSheet("milatlar");
  sheet.appendRow(MILATLAR_HEADERS);
  var headerRange = sheet.getRange(1, 1, 1, MILATLAR_HEADERS.length);
  headerRange.setFontWeight("bold").setBackground("#194b2e").setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  var seedRows = [];
  if (customRows && customRows.length > 0) {
    var nowTs = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+3", "yyyy-MM-dd HH:mm:ss");
    for (var i = 0; i < customRows.length; i++) {
      var m = customRows[i];
      seedRows.push([
        m.id || ("milat-" + new Date().getTime() + "-" + i),
        m.oturum || "ogm1",
        m.unvan || "",
        normalizeYmd(m.milatBaslangic),
        normalizeYmd(m.milatBitis),
        Number(m.beklemeHaftaIci !== undefined ? m.beklemeHaftaIci : 1),
        Number(m.beklemeHaftaSonu !== undefined ? m.beklemeHaftaSonu : 2),
        Number(m.beklemeResmiTatil !== undefined ? m.beklemeResmiTatil : 2),
        Number(m.gorevHaftaIci !== undefined ? m.gorevHaftaIci : 0),
        Number(m.gorevHaftaSonu !== undefined ? m.gorevHaftaSonu : 8),
        (m.gorevResmiTatil !== undefined && m.gorevResmiTatil !== null && m.gorevResmiTatil !== "") ? Number(m.gorevResmiTatil) : "",
        m.durum || (normalizeYmd(m.milatBitis) ? "KAPALI" : "AKTİF"),
        m.aciklama || "",
        m.guncellemeTarihi || nowTs
      ]);
    }
  } else {
    seedRows = getDefaultMilatlarSeedRows();
  }

  if (seedRows.length > 0) {
    sheet.getRange(2, 1, seedRows.length, MILATLAR_HEADERS.length).setValues(seedRows);
    sheet.getRange(2, 4, seedRows.length, 2).setNumberFormat("@");
  }

  return { sheet: sheet, created: true, alreadyExists: false };
}

function getMilatlar() {
  var db = getSpreadsheet();
  if (!db) return [];
  var info = ensureMilatlarSheetOnce();
  var sheet = info.sheet;
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var hasAny = false;
    for (var c = 0; c < row.length; c++) {
      if (row[c] !== "" && row[c] !== null && row[c] !== undefined) { hasAny = true; break; }
    }
    if (!hasAny) continue;

    var raw = {};
    for (var j = 0; j < headers.length; j++) {
      var h = String(headers[j]).trim();
      if (h) raw[h] = row[j];
    }

    var baslangic = normalizeYmd(raw.Milat_Baslangic || raw["Milat Başlangıç"] || raw.milatBaslangic || "");
    var bitis = normalizeYmd(raw.Milat_Bitis || raw["Milat Bitiş"] || raw.milatBitis || "");
    var durum = String(raw.Durum || raw.durum || (bitis ? "KAPALI" : "AKTİF")).trim();

    result.push({
      id: String(raw.ID || raw.id || ("milat-row-" + i)),
      oturum: String(raw.Oturum || raw.oturum || "ogm1").trim(),
      unvan: String(raw.Unvan || raw.unvan || "").trim(),
      milatBaslangic: baslangic,
      milatBitis: bitis,
      beklemeHaftaIci: Number(raw.Bekleme_HaftaIci !== undefined && raw.Bekleme_HaftaIci !== "" ? raw.Bekleme_HaftaIci : 1),
      beklemeHaftaSonu: Number(raw.Bekleme_HaftaSonu !== undefined && raw.Bekleme_HaftaSonu !== "" ? raw.Bekleme_HaftaSonu : 2),
      beklemeResmiTatil: Number(raw.Bekleme_ResmiTatil !== undefined && raw.Bekleme_ResmiTatil !== "" ? raw.Bekleme_ResmiTatil : 2),
      gorevHaftaIci: Number(raw.Gorev_HaftaIci !== undefined && raw.Gorev_HaftaIci !== "" ? raw.Gorev_HaftaIci : 0),
      gorevHaftaSonu: Number(raw.Gorev_HaftaSonu !== undefined && raw.Gorev_HaftaSonu !== "" ? raw.Gorev_HaftaSonu : 8),
      gorevResmiTatil: (raw.Gorev_ResmiTatil !== undefined && raw.Gorev_ResmiTatil !== null && raw.Gorev_ResmiTatil !== "") ? Number(raw.Gorev_ResmiTatil) : "",
      durum: durum,
      aciklama: String(raw.Aciklama || raw["Açıklama"] || raw.aciklama || ""),
      guncellemeTarihi: String(raw.Guncelleme_Tarihi || raw.guncellemeTarihi || "")
    });
  }
  return result;
}

function milatToRowArray(m, nowTs) {
  var bitis = normalizeYmd(m.milatBitis || "");
  return [
    String(m.id || ("milat-" + new Date().getTime())),
    String(m.oturum || "ogm1"),
    String(m.unvan || ""),
    normalizeYmd(m.milatBaslangic || ""),
    bitis,
    Number(m.beklemeHaftaIci !== undefined ? m.beklemeHaftaIci : 1),
    Number(m.beklemeHaftaSonu !== undefined ? m.beklemeHaftaSonu : 2),
    Number(m.beklemeResmiTatil !== undefined ? m.beklemeResmiTatil : 2),
    Number(m.gorevHaftaIci !== undefined ? m.gorevHaftaIci : 0),
    Number(m.gorevHaftaSonu !== undefined ? m.gorevHaftaSonu : 8),
    (m.gorevResmiTatil !== undefined && m.gorevResmiTatil !== null && m.gorevResmiTatil !== "") ? Number(m.gorevResmiTatil) : "",
    m.durum || (bitis ? "KAPALI" : "AKTİF"),
    String(m.aciklama || ""),
    String(m.guncellemeTarihi || nowTs)
  ];
}

function saveMilatlar(body) {
  var info = ensureMilatlarSheetOnce();
  var sheet = info.sheet;
  if (!sheet) return { success: false, error: "milatlar sayfası açılamadı." };

  var nowTs = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+3", "yyyy-MM-dd HH:mm:ss");
  var currentList = getMilatlar();

  if (body.milat) {
    var incoming = body.milat;
    var incomingId = String(incoming.id || ("milat-" + new Date().getTime()));
    var incomingUnvanNorm = normalizeTrUpper(incoming.unvan);
    var incomingStart = normalizeYmd(incoming.milatBaslangic);
    var incomingEnd = normalizeYmd(incoming.milatBitis);
    var autoClosePrevious = body.autoClosePrevious !== false;

    if (autoClosePrevious && incomingStart) {
      var closeDate = prevDayYmd(incomingStart);
      for (var i = 0; i < currentList.length; i++) {
        var existing = currentList[i];
        if (String(existing.id) !== incomingId && normalizeTrUpper(existing.unvan) === incomingUnvanNorm) {
          if (existing.milatBaslangic && existing.milatBaslangic < incomingStart && (!existing.milatBitis || existing.milatBitis >= incomingStart)) {
            existing.milatBitis = closeDate;
            existing.durum = "KAPALI";
            existing.guncellemeTarihi = nowTs;
          }
        }
      }
    }

    var record = {
      id: incomingId,
      oturum: incoming.oturum || "ogm1",
      unvan: incoming.unvan || "",
      milatBaslangic: incomingStart,
      milatBitis: incomingEnd,
      beklemeHaftaIci: Number(incoming.beklemeHaftaIci !== undefined ? incoming.beklemeHaftaIci : 1),
      beklemeHaftaSonu: Number(incoming.beklemeHaftaSonu !== undefined ? incoming.beklemeHaftaSonu : 2),
      beklemeResmiTatil: Number(incoming.beklemeResmiTatil !== undefined ? incoming.beklemeResmiTatil : 2),
      gorevHaftaIci: Number(incoming.gorevHaftaIci !== undefined ? incoming.gorevHaftaIci : 0),
      gorevHaftaSonu: Number(incoming.gorevHaftaSonu !== undefined ? incoming.gorevHaftaSonu : 8),
      gorevResmiTatil: (incoming.gorevResmiTatil !== undefined && incoming.gorevResmiTatil !== null && incoming.gorevResmiTatil !== "") ? Number(incoming.gorevResmiTatil) : "",
      durum: incomingEnd ? "KAPALI" : (incoming.durum || "AKTİF"),
      aciklama: incoming.aciklama || "",
      guncellemeTarihi: nowTs
    };

    var replaced = false;
    for (var idx = 0; idx < currentList.length; idx++) {
      if (String(currentList[idx].id) === incomingId) {
        currentList[idx] = record;
        replaced = true;
        break;
      }
    }
    if (!replaced) currentList.push(record);
  } else if (Array.isArray(body.milatlar)) {
    if (body.replaceAll) {
      currentList = body.milatlar;
    } else {
      for (var k = 0; k < body.milatlar.length; k++) {
        var item = body.milatlar[k];
        var itemId = String(item.id || ("milat-" + new Date().getTime() + "-" + k));
        var found = false;
        for (var c = 0; c < currentList.length; c++) {
          if (String(currentList[c].id) === itemId) {
            currentList[c] = item;
            found = true;
            break;
          }
        }
        if (!found) currentList.push(item);
      }
    }
  }

  currentList.sort(function(a, b) {
    var ua = normalizeTrUpper(a.unvan);
    var ub = normalizeTrUpper(b.unvan);
    if (ua !== ub) return ua < ub ? -1 : 1;
    return String(a.milatBaslangic || "") < String(b.milatBaslangic || "") ? -1 : (String(a.milatBaslangic || "") > String(b.milatBaslangic || "") ? 1 : 0);
  });

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, MILATLAR_HEADERS.length).clearContent();
  }
  if (currentList.length > 0) {
    var matrix = [];
    for (var r = 0; r < currentList.length; r++) {
      matrix.push(milatToRowArray(currentList[r], nowTs));
    }
    sheet.getRange(2, 1, matrix.length, MILATLAR_HEADERS.length).setValues(matrix);
    sheet.getRange(2, 4, matrix.length, 2).setNumberFormat("@");
  }

  return {
    success: true,
    milatlarSupported: true,
    sheetName: "milatlar",
    milatlar: getMilatlar()
  };
}

function deleteMilat(body) {
  var id = body.id;
  if (!id) return { success: false, error: "ID bulunamadı" };
  var db = getSpreadsheet();
  var sheet = findExistingMilatlarSheet(db);
  if (!sheet) return { success: true, milatlar: [] };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return {
    success: true,
    milatlarSupported: true,
    sheetName: "milatlar",
    milatlar: getMilatlar()
  };
}
