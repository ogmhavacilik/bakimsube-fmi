const PERSONNEL_SHEET_ID = "1EbwS6gIo8DHIdpZKyrX4JwM0aDejCrhRBsK-PK0f_fk";
const MAIN_DB_SHEET_ID = "1QY6ETO3zQ_zQfxZIRm5gPj5YnA3y1h41bGEHVqSQEp4";
const SYSTEM_ID = "0005536572913";

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "get_init_data";
  
  if (action === "get_init_data") {
    var output = {
      success: true,
      data: {
        attendance: getAttendance(),
        personnel: getPersonnel(),
        transactions: getTransactions()
      }
    };
    return ContentService.createTextOutput(JSON.stringify(output))
                         .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput("Sistem Aktif (Read-Only) - V4: Personel, Yoklama ve Plansız İşlemler Aktif");
}

function doPost(e) {
  var output = { success: false, error: "Bilinmeyen istek" };
  
  try {
    var contents = e.postData ? e.postData.contents : "{}";
    var body = JSON.parse(contents);
    var action = body.action || "get_init_data";

    if (action === "get_init_data") {
      output = {
        success: true,
        data: {
          attendance: getAttendance(),
          personnel: getPersonnel(),
          transactions: getTransactions()
        }
      };
    } else {
      output = { success: false, error: "Sistem sadece veri okuma (Read-Only) modundadır." };
    }
  } catch (error) {
    output = { success: false, error: error.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(output))
                       .setMimeType(ContentService.MimeType.JSON);
}

function getPersonnelDb() {
  try {
    return SpreadsheetApp.openById(PERSONNEL_SHEET_ID);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function getMainDb() {
  try {
    return SpreadsheetApp.openById(MAIN_DB_SHEET_ID);
  } catch (e) {
    try {
      return SpreadsheetApp.openById(PERSONNEL_SHEET_ID);
    } catch (e2) {
      return SpreadsheetApp.getActiveSpreadsheet();
    }
  }
}

function getSheetSafely(db, possibleNames) {
  if (!db) return null;
  // 1. Direct name match
  for (var i = 0; i < possibleNames.length; i++) {
    var s = db.getSheetByName(possibleNames[i]);
    if (s) return s;
  }
  // 2. Normalized name match across all sheets in db
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
  var perDb = getPersonnelDb();
  var sheet = getSheetSafely(perDb, ["Yoklama", "YOKLAMA", "ATTENDANCE"]);
  if (!sheet) {
    var mainDb = getMainDb();
    sheet = getSheetSafely(mainDb, ["Yoklama", "YOKLAMA", "ATTENDANCE"]);
  }
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
  var perDb = getPersonnelDb();
  var sheet = getSheetSafely(perDb, ["Personel", "PERSONEL", "PERSONNEL"]);
  if (!sheet) {
    var mainDb = getMainDb();
    sheet = getSheetSafely(mainDb, ["Personel", "PERSONEL", "PERSONNEL"]);
  }
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
  var targetSheets = [
    "plansız işlemler", "Plansız İşlemler", "PLANSIZ İŞLEMLER",
    "plansız ıslemler", "Plansız Isılemler", "PLANSIZ ISLEMLER",
    "plansız islemler", "Plansız Islemler",
    "plansiz islemler", "Plansiz Islemler",
    "plansız mesai", "Plansız Mesai", "PLANSIZ MESAİ",
    "plansiz mesai", "Plansiz Mesai", "PLANSIZ MESAI",
    "plansiz", "plansız", "plansizislem", "plansizislemler"
  ];
  
  var mainDb = getMainDb();
  var sheet = getSheetSafely(mainDb, targetSheets);
  if (!sheet) {
    var perDb = getPersonnelDb();
    sheet = getSheetSafely(perDb, targetSheets);
  }
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
    // Benzersiz ID garantisi: Tabloda ID yoksa veya boşsa satır indeksi ile oluştur
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
