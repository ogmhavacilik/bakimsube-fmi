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
      data: {
        attendance: getAttendance(),
        personnel: getPersonnel(),
        transactions: getTransactions()
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
  
  var msg = "Sistem Aktif - Personel, Yoklama ve Plansız İşlemler Entegrasyonu Çalışıyor.";
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + JSON.stringify({success: true, message: msg}) + ");")
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
        data: {
          attendance: getAttendance(),
          personnel: getPersonnel(),
          transactions: getTransactions()
        }
      };
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
