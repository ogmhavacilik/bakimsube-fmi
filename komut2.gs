const PERSONNEL_SHEET_ID = "1EbwS6gIo8DHIdpZKyrX4JwM0aDejCrhRBsK-PK0f_fk";
const MAIN_DB_SHEET_ID = "1QY6ETO3zQ_zQfxZIRm5gPj5YnA3y1h41bGEHVqSQEp4";
const SYSTEM_ID = "0005536572913";

/**
 * GOOGLE APPS SCRIPT - KOMUT2.GS
 * Bu dosyayı kopyalayıp Google Apps Script (GAS) editörüne yapıştırın.
 * Ardından projeyi "Yeni Dağıtım" (New Deployment) yaparak yayınlayın
 * ve yeni URL'yi index.html dosyasındaki OVERTIME_SCRIPT_URL kısmına yapıştırın.
 */

function doGet(e) {
  return showStatus("Sistem Aktif (V2)");
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    let result;

    switch (action) {
      case 'get_init_data':
        result = handleGetInitData();
        break;
      case 'save_overtime':
        result = handleSaveOvertime(payload);
        break;
      case 'approve_overtime':
        result = handleApproveOvertime(payload);
        break;
      case 'delete_overtime':
        result = handleDeleteOvertime(payload);
        break;
      case 'sync_auto_transactions':
        result = syncAutoTransactions();
        break;
      case 'save_attendance':
        result = handleSaveAttendance(payload);
        break;
      default:
        throw new Error('Geçersiz işlem: ' + action);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetSafely(db, possibleNames) {
  for (let name of possibleNames) {
    let sheet = db.getSheetByName(name);
    if (sheet) return sheet;
  }
  if (possibleNames && possibleNames.length > 0) {
    try {
      return db.insertSheet(possibleNames[0]);
    } catch (e) {
      console.error("Could not insert sheet: " + possibleNames[0] + ", error: " + e.message);
    }
  }
  return db.getSheets()[0];
}

function getValGS(obj, keys) {
  if (!obj) return '';
  const normalizeKey = function(k) {
    return String(k || '').trim().toUpperCase()
      .replace(/İ/g, 'I')
      .replace(/Ğ/g, 'G')
      .replace(/Ü/g, 'U')
      .replace(/Ş/g, 'S')
      .replace(/Ö/g, 'O')
      .replace(/Ç/g, 'C')
      .replace(/[^A-Z0-9]/g, '');
  };
  
  const objKeys = Object.keys(obj);
  const normalizedObjEntries = objKeys.map(function(ok) {
    return { original: ok, normalized: normalizeKey(ok) };
  });
  
  for (let i = 0; i < keys.length; i++) {
    const normalizedTarget = normalizeKey(keys[i]);
    const match = normalizedObjEntries.find(function(e) {
      return e.normalized === normalizedTarget;
    });
    if (match) {
      const val = String(obj[match.original] || '').trim();
      if (val && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') return val;
    }
  }
  return '';
}

function isStandbyDateGS(dateStr) {
  if (!dateStr) return false;
  if (!dateStr.startsWith('2026')) return false;
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3) return false;
  const mm = parts[1];
  return mm >= 5; // Active Season start May (5) to December (12)
}

function isOverseasGS(loc, note, status) {
  const checkStr = `${loc || ""} ${note || ""} ${status || ""}`.toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .trim();
  
  if (checkStr.includes('YURT DISI') || checkStr.includes('YURTDISI') || checkStr.includes('OVERSEAS')) return true;

  const overseasCountries = [
    // Europe
    'ALMANYA', 'GERMANY', 'FRANSA', 'FRANCE', 'INGILTERE', 'ENGLAND', 'ITALYA', 'ITALY', 
    'ISPANYA', 'SPAIN', 'UKRES', 'BELCIKA', 'BELGIUM', 'HOLLANDA', 'NETHERLANDS', 'AVUSTURYA', 
    'AUSTRIA', 'AVUSTURALYA', 'AUSTRALIA', 'KANADA', 'CANADA', 'BREZILYA', 'BRAZIL', 
    'CIN', 'CHINA', 'JAPONYA', 'JAPAN', 'KORE', 'KOREA', 'ARABISTAN', 'ARABIA', 
    'IRAK', 'IRAQ', 'SURIYE', 'SYRIA', 'IRAN', 'SUUDI ARABISTAN', 'KATAR', 'QATAR', 'YUNANISTAN', 'GREECE', 
    'BULGARISTAN', 'BULGARIA', 'ROMANYA', 'ROMANIA', 'POLONYA', 'POLAND', 'ISVICRE', 
    'SWITZERLAND', 'ISVEC', 'SWEDEN', 'DANIMARKA', 'DENMARK', 'NORVEC', 'NORWAY', 
    'FINLANDIYA', 'FINLAND', 'LETONYA', 'LATVIA', 'ESTONYA', 'ESTONIA', 'LITVANYA', 'LITHUANIA',
    'CEKYA', 'CZECH', 'MACARISTAN', 'HUNGARY', 'PORTEKIZ', 'PORTUGAL', 'IZLANDA', 'ICELAND',
    'IRLANDA', 'IRELAND', 'MALTA', 'SIRBISTAN', 'SERBIA', 'HIRVATISTAN', 'CROATIA',
    'UKRAYNA', 'UKRAINE', 'SLOVENYA', 'SLOVENIA', 'SLOVAKYA', 'SLOVAKIA', 'CEZAYIR', 'ALGERIA',
    'MONAKO', 'MONACO', 'ANDORRA', 'SAN MARINO', 'VATIKAN', 'VATICAN', 'ARNAVUTLUK', 'ALBANIA',
    'MAKEDONYA', 'MACEDONIA', 'BOSNA', 'BOSNIA', 'HERSEK', 'HERZEGOVINA', 'KARADAG', 'MONTENEGRO',
    'KOSOVA', 'KOSOVO', 'MOLDOVA', 'BELARUS', 'GURCISTAN', 'GEORGIA', 'ERMENISTAN', 'ARMENIA',
    'AZERBAYCAN', 'AZERBAIJAN', 'KIBRIS', 'CYPRUS', 'LATVIJA', 'LATVYA', 'LETONYADA', 'LETONYA\'DA',
    
    // Americas
    'ABD', 'USA', 'MEKSIKA', 'MEXICO', 'KOLOMBIYA', 'COLOMBIA', 'ARJANTIN', 'ARGENTINA',
    'SILI', 'CHILE', 'PERU', 'EKVADOR', 'ECUADOR', 'VENEZUELA', 'BOLIVYA', 'BOLIVIA',
    'PARAGUAY', 'URUGUAY', 'GUATEMALA', 'KOSTA RIKA', 'COSTA RICA', 'PANAMA', 'KUBA', 'CUBA',
    'JAMAIKA', 'JAMAICA', 'DOMINIK', 'DOMINICAN', 'BAHAMALAR', 'BAHAMAS',
    
    // Asia & Middle East
    'MALEZYA', 'MALAYSIA', 'ENDONEZYA', 'INDONESIA', 'FILIPINLER', 'PHILIPPINES',
    'SINGAPUR', 'SINGAPORE', 'TAYLAND', 'THAILAND', 'VIETNAM', 'KAMBOCYA', 'CAMBODIA',
    'LAOS', 'MYANMAR', 'BURMA', 'HINDISTAN', 'INDIA', 'PAKISTAN', 'AFGANISTAN', 'AFGHANISTAN',
    'BANGLADES', 'BANGLADESH', 'NEPAL', 'SRI LANKA', 'MALDIVLER', 'MALDIVES', 'KAZAKISTAN', 'KAZAKHSTAN',
    'OZBEKISTAN', 'UZBEKISTAN', 'TURKMENISTAN', 'KIRGIZISTAN', 'KYRGYZSTAN', 'TACIKISTAN', 'TAJIKISTAN',
    'MOGOLISTAN', 'MONGOLIA', 'TAYVAN', 'TAIWAN', 'HONG KONG', 'MAKAU', 'MACAO', 'YEMEN', 'UMMAN', 'OMAN',
    'BIRLESIK ARAP EMIRLIKLERI', 'BAE', 'UAE', 'DUBAI', 'ABU DABI', 'KUVEYT', 'KUWAIT', 'BAHREYN', 'BAHRAIN',
    'LUBNAN', 'LEBANON', 'URDUN', 'JORDAN', 'ISRAIL', 'ISRAEL', 'FILISTIN', 'PALESTINE',
    
    // Africa
    'MISIR', 'EGYPT', 'GUNEY AFRIKA', 'SOUTH AFRICA', 'TUNUS', 'TUNISIA', 'FAS', 'MOROCCO',
    'NIGER', 'NIGERIA', 'KENYA', 'ETIYOPYA', 'ETHIOPIA', 'TANZANYA', 'TANZANIA', 'UGANDA',
    'SENEGAL', 'GANA', 'GHANA', 'ANGOLA', 'SUDAN', 'LIBYA', 'MADAGASKAR', 'MADAGASCAR',
    'CEZAYIR', 'ALGERIA', 'KONG', 'CONGO', 'MOGADISU', 'SOMALI',
    
    // Oceania
    'YENI ZELANDA', 'NEW ZEALAND'
  ];

  return overseasCountries.some(function(country) { return checkStr.includes(country); });
}

let personnelDbCache = null;
let mainDbCache = null;

function getPersonnelDb() {
  if (personnelDbCache) return personnelDbCache;
  try {
    personnelDbCache = SpreadsheetApp.openById(PERSONNEL_SHEET_ID);
    return personnelDbCache;
  } catch (e) {
    throw new Error(`Personel veri tabanına erişilemedi (${PERSONNEL_SHEET_ID}): ` + e.message);
  }
}

function getMainDb() {
  if (mainDbCache) return mainDbCache;
  try {
    mainDbCache = SpreadsheetApp.openById(MAIN_DB_SHEET_ID);
    return mainDbCache;
  } catch (e) {
    throw new Error(`Ana veri tabanına erişilemedi (${MAIN_DB_SHEET_ID}): ` + e.message);
  }
}

function handleGetInitData() {
  let result = { personnel: [], transactions: [], attendance: [] };
  
  const extractData = (sheet, resultKey) => {
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    if (data.length > 0) {
      const headers = data[0].map(h => String(h).trim().toUpperCase());
      
      const list = data.slice(1).map(row => {
        let obj = {};
        headers.forEach((h, i) => {
          let val = row[i];
          if (val instanceof Date) {
            val = Utilities.formatDate(val, "GMT+3", "yyyy-MM-dd HH:mm");
          }
          obj[h] = val;
        });
        return obj;
      });
      if (resultKey === 'attendance') {
        result.attendance = result.attendance.concat(list);
      } else if (resultKey === 'personnel') {
        result.personnel = list;
      } else if (resultKey === 'transactions') {
        result.transactions = list;
      }
    }
  };

  try {
    const perDb = getPersonnelDb();
    extractData(getSheetSafely(perDb, ["Personel", "personel", "PERSONEL"]), 'personnel');
    extractData(getSheetSafely(perDb, ["Yoklama", "yoklama", "YOKLAMA", "Attendance", "ATTENDANCE"]), 'attendance');
  } catch(e) { console.error("Personnel error: " + e.message); }

  try {
    const mainDb = getMainDb();
    extractData(getSheetSafely(mainDb, ["İşlemler", "Islemler", "Mesailer", "Transactions"]), 'transactions');
    
    // Also load "plansız işlemler"
    try {
      let plansizSheet = null;
      const possibleNames = ["plansız işlemler", "plansız ıslemler", "plansiz_islemler", "plansiz islemler", "Plansız İşlemler", "Plansız Islemler"];
      for (let name of possibleNames) {
        plansizSheet = mainDb.getSheetByName(name);
        if (plansizSheet) break;
      }
      if (!plansizSheet) {
        plansizSheet = mainDb.insertSheet("plansız ıslemler");
        const displayHeaders = ["ID", "PersonId", "PersonName", "Date", "EndDate", "Days", "Hours", "Type", "Shift", "DayType", "Description", "Status", "Timestamp"];
        plansizSheet.appendRow(displayHeaders);
      }
      if (plansizSheet) {
        const rawData = plansizSheet.getDataRange().getValues();
        if (rawData.length > 0) {
          const headers = rawData[0].map(h => String(h).trim().toUpperCase());
          const plansizList = rawData.slice(1).map(row => {
            let obj = {};
            headers.forEach((h, i) => {
              let val = row[i];
              if (val instanceof Date) {
                val = Utilities.formatDate(val, "GMT+3", "yyyy-MM-dd HH:mm");
              }
              obj[h] = val;
            });
            return obj;
          });
          
          const existingIds = {};
          result.transactions.forEach((t, idx) => {
            if (t.ID) {
              existingIds[String(t.ID).trim()] = idx;
            }
          });
          
          plansizList.forEach(pTx => {
            const pId = String(pTx.ID || "").trim();
            if (pId) {
              if (pId in existingIds) {
                result.transactions[existingIds[pId]] = pTx;
              } else {
                result.transactions.push(pTx);
              }
            }
          });
        }
      }
    } catch(errPlansiz) {
      console.error("Plansız işlemler load error: " + errPlansiz.message);
    }

    extractData(getSheetSafely(mainDb, ["YOKLAMA AKTAR", "Yoklama", "YOKLAMA", "Attendance"]), 'attendance');
  } catch(e) { console.error("Main DB error: " + e.message); }

  return result;
}

function handleSaveOvertime(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const tx = payload.transaction;
    
    // ALWAYS write to plansiz sheet. Do NOT append to the main transactions sheet (İşlemler).
    saveOrUpdateManualToPlansizSheet(tx, "SAVE");
    
    const typeValue = String(tx.type || "").toUpperCase();
    const isUsedOrFmi = typeValue.includes("USED") || 
                        typeValue.includes("İZİN") || 
                        typeValue.includes("IZIN") || 
                        typeValue.includes("FMİ") || 
                        typeValue.includes("FMI");

    // Only write to attendance if APPROVED (typically it starts as PENDING)
    if (tx.status === 'APPROVED' && isUsedOrFmi) {
      writeToAttendance(tx);
    }
    logAction("MESAI_KAYDI", `Yeni kayıt (Plansız): ${tx.personName}`, payload.user);
  } finally {
    lock.releaseLock();
  }
  return { success: true };
}

function handleApproveOvertime(payload) {
  const mainDb = getMainDb();
  const txSheet = getSheetSafely(mainDb, ["İşlemler", "Islemler", "Mesailer"]);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const data = txSheet.getDataRange().getValues();
    let txIdx = -1;
    let txHeaders = [];

    if (data.length > 0) {
      txHeaders = data[0].map(h => String(h).trim().toUpperCase());
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == payload.id) {
          txIdx = i + 1;
          break;
        }
      }
    }

    let txObj = null;

    if (txIdx !== -1) {
      const tx = payload.transaction;
      if (tx) {
        const row = txHeaders.map((h, idx) => {
          switch(h) {
            case "ID": return tx.id;
            case "PERSONID": case "PID": return tx.personId;
            case "PERSONNAME": return tx.personName;
            case "DATE": case "TARİH": return tx.date;
            case "ENDDATE": return tx.endDate || tx.date;
            case "DAYS": return tx.days || 1;
            case "HOURS": return tx.hours;
            case "TYPE": return tx.type;
            case "SHIFT": return tx.shift || 'Gündüz';
            case "DAYTYPE": return tx.dayType;
            case "DESCRIPTION": return tx.description;
            case "NOTE": return tx.note || "";
            case "STATUS": return "APPROVED";
            case "TIMESTAMP": return data[txIdx-1][idx];
            default: return data[txIdx-1][idx];
          }
        });
        txSheet.getRange(txIdx, 1, 1, row.length).setValues([row]);
      } else {
        const statusColIdx = txHeaders.indexOf("STATUS") + 1 || 12;
        txSheet.getRange(txIdx, statusColIdx).setValue("APPROVED");
      }
      
      const updatedRow = txSheet.getRange(txIdx, 1, 1, txHeaders.length).getValues()[0];
      txObj = {};
      txHeaders.forEach((h, idx) => { txObj[h] = updatedRow[idx]; });
      
      if (txObj) {
        writeToAttendance(txObj);
      }
      logAction("ONAY", `Onaylandı: ${txObj.PERSONNAME || payload.id}`, payload.user);
    }

    // Now, also search and approve in "plansız işlemler"
    try {
      const possibleNames = ["plansız işlemler", "plansız ıslemler", "plansiz_islemler", "plansiz islemler", "Plansız İşlemler", "Plansız Islemler"];
      let plansizSheet = null;
      for (let name of possibleNames) {
        plansizSheet = mainDb.getSheetByName(name);
        if (plansizSheet) break;
      }
      
      if (plansizSheet) {
        const pData = plansizSheet.getDataRange().getValues();
        if (pData.length > 0) {
          const pHeaders = pData[0].map(h => String(h).trim().toUpperCase());
          const idColIdx = pHeaders.indexOf("ID");
          let pTxIdx = -1;
          
          if (idColIdx !== -1) {
            for (let i = 1; i < pData.length; i++) {
              if (String(pData[i][idColIdx]).trim() === String(payload.id).trim()) {
                pTxIdx = i + 1;
                break;
              }
            }
          }
          
          if (pTxIdx !== -1) {
            const pStatusColIdx = pHeaders.indexOf("STATUS") + 1;
            if (pStatusColIdx > 0) {
              plansizSheet.getRange(pTxIdx, pStatusColIdx).setValue("APPROVED");
            }
            
            const pRow = plansizSheet.getRange(pTxIdx, 1, 1, pHeaders.length).getValues()[0];
            const pTxObj = {};
            pHeaders.forEach((h, idx) => { pTxObj[h] = pRow[idx]; });
            
            writeToAttendance(pTxObj);
            
            if (!txObj) {
              txObj = pTxObj;
              logAction("ONAY", `Onaylandı (Plansız): ${pTxObj.PERSONNAME || payload.id}`, payload.user);
            } else {
              logAction("ONAY", `Onaylandı (İşlem & Plansız): ${pTxObj.PERSONNAME || payload.id}`, payload.user);
            }
          }
        }
      }
    } catch (plansizErr) {
      console.warn("Failed to approve in plansiz sheet: " + plansizErr.toString());
    }

  } finally {
    lock.releaseLock();
  }
  return { success: true };
}

function deleteFromAttendanceByDate(pid, dateVal, daysVal) {
  if (!pid || !dateVal) return;
  const mainDb = getMainDb();
  const perDb = getPersonnelDb();
  const s1 = getSheetSafely(mainDb, ["YOKLAMA AKTAR", "Yoklama", "YOKLAMA", "ATTENDANCE"]);
  const s2 = getSheetSafely(perDb, ["Yoklama", "YOKLAMA", "ATTENDANCE"]);

  let dateStr = "";
  if (dateVal instanceof Date) {
    dateStr = Utilities.formatDate(dateVal, "GMT+3", "yyyy-MM-dd");
  } else {
    dateStr = String(dateVal).split(' ')[0].split('T')[0];
  }
  
  const parts = dateStr.split('-');
  if (parts.length < 3) return;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const days = parseInt(daysVal, 10) || 1;
  const targetDates = [];
  for (let i = 0; i < days; i++) {
    const cur = new Date(year, month, day + i, 12, 0, 0);
    targetDates.push(Utilities.formatDate(cur, "GMT+3", "yyyy-MM-dd"));
  }

  const cleanPid = String(pid).trim();

  [s1, s2].forEach(sheet => {
    if (!sheet) return;
    try {
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return;
      const headers = data[0].map(h => String(h).trim().toUpperCase());
      const dateColIdx = headers.indexOf("DATE") === -1 ? headers.indexOf("TARIH") : headers.indexOf("DATE");
      const pidColIdx = headers.indexOf("PERSON_ID") === -1 ? (headers.indexOf("PERSONID") === -1 ? headers.indexOf("PID") : headers.indexOf("PERSONID")) : headers.indexOf("PERSON_ID");

      if (dateColIdx === -1 || pidColIdx === -1) return;

      for (let i = data.length - 1; i >= 1; i--) {
        const rowDateVal = data[i][dateColIdx];
        const rowDateStr = normalizeDateStrGS(rowDateVal);
        const rowPid = String(data[i][pidColIdx]).trim();

        if (rowPid === cleanPid && targetDates.indexOf(rowDateStr) !== -1) {
          sheet.deleteRow(i + 1);
        }
      }
    } catch(e) {
      console.warn("Failed to delete from attendance for sheet: " + e.message);
    }
  });
}

function writeToAttendance(tx) {
  const pid = String(getProp(tx, "personId") || getProp(tx, "pid") || "").trim();
  const dateVal = getProp(tx, "date") || getProp(tx, "Tarîh") || "";
  const daysVal = getProp(tx, "days") || 1;

  if (!pid || !dateVal) return;

  // Clean up any existing attendance rows for this person during this date range first
  deleteFromAttendanceByDate(pid, dateVal, daysVal);

  let dateStr = "";
  if (dateVal instanceof Date) {
    dateStr = Utilities.formatDate(dateVal, "GMT+3", "yyyy-MM-dd");
  } else {
    dateStr = String(dateVal).split(' ')[0].split('T')[0];
  }
  
  const parts = dateStr.split('-');
  if (parts.length < 3) return;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const days = parseInt(daysVal, 10) || 1;
  const mainDb = getMainDb();
  
  const s1 = getSheetSafely(mainDb, ["YOKLAMA AKTAR", "Yoklama", "YOKLAMA", "ATTENDANCE"]);

  const typeValue = String(getProp(tx, "type") || getProp(tx, "tip") || "").toUpperCase();
  const desc = String(getProp(tx, "description") || getProp(tx, "note") || "").toUpperCase();

  for (let i = 0; i < days; i++) {
    const cur = new Date(year, month, day + i, 12, 0, 0);
    const dStr = Utilities.formatDate(cur, "GMT+3", "yyyy-MM-dd");
    
    // Fixed ID format: always fixed SYSTEM_ID
    const rowId = SYSTEM_ID;
    
    let statusStr = "İzin";
    let dutyLocStr = "";
    let dutyTypStr = "Planlı";
    let leaveTypeStr = "F.M.İ";

    if (typeValue === "EARNED" || typeValue.includes("KAZANIM") || typeValue.includes("ÖDEME")) {
      dutyTypStr = "Plansız";
      leaveTypeStr = "";
      dutyLocStr = String(getProp(tx, "location") || getProp(tx, "DUTY_LOC") || "").trim();

      if (desc.includes("BEKLEME")) {
        statusStr = "Bekleme";
      } else if (desc.includes("GÖREV") || desc.includes("GOREV")) {
        statusStr = "Görev";
      } else {
        statusStr = "Görev"; // fallback default for plansız entries
      }
    }
    
    // Columns: ID, DATE, PERSON_ID, STATUS, DUTY_LOC, DUTY_TYP, LEAVE_TYI, NOTE, MONTH, YEAR
    const row = [
      rowId,
      dStr,
      pid,
      statusStr,
      dutyLocStr,
      dutyTypStr,
      leaveTypeStr,
      String(getProp(tx, "description") || getProp(tx, "note") || "").trim(), // NOTE
      cur.getMonth() + 1, // MONTH
      cur.getFullYear()   // YEAR
    ];
    
    if (s1) s1.appendRow(row);
  }
}

function handleDeleteOvertime(payload) {
  const mainDb = getMainDb();
  const sheet = getSheetSafely(mainDb, ["İşlemler", "Islemler", "Mesailer"]);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const data = sheet.getDataRange().getValues();
    const targetId = String(payload.id || "").trim().toLowerCase();
    
    // Check if the target is an automatic or virtual transaction ID
    if (targetId.startsWith("auto-") || targetId.startsWith("fmi-auto-") || targetId.startsWith("gorev-auto-sync-")) {
      let pid = "";
      let dateVal = "";
      let daysVal = 1;
      
      let parts = targetId.split('-');
      if (targetId.startsWith("auto-fmi-") || targetId.startsWith("auto-standby-") || targetId.startsWith("auto-duty-") || targetId.startsWith("auto-hstandby-")) {
        if (parts.length >= 4) {
          pid = parts[2];
          dateVal = parts.slice(3).join('-');
        }
      }
      
      if (pid && dateVal) {
        try {
          deleteFromAttendanceByDate(pid, dateVal, daysVal);
        } catch(e) {
          console.error("Failed auto delete from attendance: " + e.message);
        }
      }
      
      // Also delete it if there is a row with this ID in the "İşlemler" sheet
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim().toLowerCase() === targetId) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      
      // Also delete from plansız sheet if present
      try {
        saveOrUpdateManualToPlansizSheet({ id: payload.id }, "DELETE");
      } catch(e) {}
      
      logAction("SİLME", `Otomatik/Virtual Silindi ID: ${payload.id}`, payload.user);
      
      // Trigger sync auto transactions to make sure everything is completely cleaned and updated
      try {
        syncAutoTransactions(true);
      } catch(e) {
        console.error("Sync error in delete: " + e.message);
      }
      
      return { success: true };
    }

    // Normal manual delete
    let foundInMain = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == payload.id) {
        // Find row details before deleting
        const headers = data[0].map(h => String(h).trim().toUpperCase());
        const pidCol = headers.indexOf("PERSONID") === -1 ? headers.indexOf("PID") : headers.indexOf("PERSONID");
        const dateCol = headers.indexOf("DATE") === -1 ? headers.indexOf("TARIH") : headers.indexOf("DATE");
        const daysCol = headers.indexOf("DAYS") === -1 ? headers.indexOf("GUNLER") : headers.indexOf("DAYS");
        
        const pid = pidCol !== -1 ? String(data[i][pidCol] || "").trim() : "";
        const dateVal = dateCol !== -1 ? data[i][dateCol] : "";
        const daysVal = daysCol !== -1 ? data[i][daysCol] : 1;

        sheet.deleteRow(i + 1);
        logAction("SİLME", `Silindi ID: ${payload.id}`, payload.user);
        try {
          saveOrUpdateManualToPlansizSheet({ id: payload.id }, "DELETE");
        } catch (e) {}
        try {
          deleteFromAttendanceByDate(pid, dateVal, daysVal);
        } catch (e) {}
        foundInMain = true;
        break;
      }
    }
    
    if (!foundInMain) {
      try {
        saveOrUpdateManualToPlansizSheet({ id: payload.id }, "DELETE");
      } catch (e) {}
    }
  } finally {
    lock.releaseLock();
  }
  return { success: true };
}

function logAction(act, det, user) {
  try {
    const sheet = getMainDb().getSheetByName("Günlükler");
    if (sheet) sheet.appendRow([new Date(), user || "Sistem", act, det]);
  } catch(e) {}
}

function normalizeDateStrGS(d) {
  if (!d) return "";
  let date;
  if (d instanceof Date) {
    date = d;
  } else {
    const dStr = String(d);
    if (dStr.includes('.')) {
      const parts = dStr.split('.');
      if (parts.length === 3) date = new Date(parts[2], parts[1] - 1, parts[0]);
    }
    if (!date || isNaN(date.getTime())) date = new Date(d);
  }
  if (!date || isNaN(date.getTime())) return String(d);
  return Utilities.formatDate(date, "GMT+3", "yyyy-MM-dd");
}

function syncAutoTransactions(hasLock) {
  var lockObj = null;
  if (!hasLock) {
    lockObj = LockService.getScriptLock();
    try {
      lockObj.waitLock(15000);
    } catch (e) {
      console.warn("Could not acquire lock for syncAutoTransactions: " + e.message);
      throw new Error("Sistem şu anda meşgul (Kilit Aşımı). Lütfen az sonra tekrar deneyin.");
    }
  }
  try {
    const initData = handleGetInitData();
    const mainDb = getMainDb();
    const txSheet = getSheetSafely(mainDb, ["İşlemler", "Islemler", "Mesailer"]);
    const txData = txSheet.getDataRange().getValues();
    const headers = txData[0].map(h => String(h).trim().toUpperCase());
    
    // NEW: Ensure we have "DATE_L" in the 12th column (index 11 / Column L)
    while (headers.length < 12) {
      headers.push("");
    }
    const hadDateL = headers.indexOf("DATE_L");
    if (hadDateL === -1) {
      if (txSheet.getLastColumn() < 12) {
        txSheet.getRange(1, 12).setValue("DATE_L");
      }
      headers[11] = "DATE_L";
    }

    const idColIdx = headers.indexOf("ID");
    
    // 1. Separate manual (user entered) rows and keep them intact
    const manualRows = [];
    txData.forEach((row, i) => {
      if (i === 0) return; // Header
      const id = String(row[idColIdx] || "").trim();
      if (!id.toLowerCase().startsWith("auto-")) {
        // Ensure manual rows also span 12 columns
        const tempRow = [...row];
        while (tempRow.length < headers.length) {
          tempRow.push("");
        }
        manualRows.push(tempRow);
      }
    });

    const manualRecords = new Set();
    manualRows.forEach(row => {
      const pidCol = headers.indexOf("PERSONID") === -1 ? headers.indexOf("PID") : headers.indexOf("PERSONID");
      const dateCol = headers.indexOf("DATE") === -1 ? headers.indexOf("TARIH") : headers.indexOf("DATE");
      const pid = String(row[pidCol] || "").trim();
      const dateStr = normalizeDateStrGS(row[dateCol]);
      if (pid && dateStr) {
        manualRecords.add(`${pid}_${dateStr}`);
      }
    });

    // 2. Identify and group all 2026 season attendance records
    const groupedAttendance = {};
    initData.attendance.forEach(att => {
      const pid = String(getValGS(att, ['PERSON_ID', 'PERSONNEL_ID', 'PID', 'KİŞİ ID', 'KISI ID'])).trim();
      const dateStr = normalizeDateStrGS(getValGS(att, ['DATE', 'TARİH', 'TARIH']));
      if (!pid || !dateStr) return;
      
      // SEASON AND YEAR FILTER (Only 2026 and starting May 1st)
      if (!isStandbyDateGS(dateStr)) return;

      const key = `${pid}_${dateStr}`;
      if (!groupedAttendance[key]) groupedAttendance[key] = [];
      groupedAttendance[key].push(att);
    });

    const desiredAutoTxs = {};
    Object.keys(groupedAttendance).forEach(key => {
      const atts = groupedAttendance[key];
      const [pid, dateStr] = key.split('_');
      if (manualRecords.has(`${pid}_${dateStr}`)) return; // Skip if manually overridden

      let bestAutoType = null;
      let bestHours = 0;
      let bestDesc = "";
      
      const containsFmi = (str) => {
        if (!str) return false;
        const s = String(str).toUpperCase('tr-TR').replace(/\./g, '');
        return s.includes('FMI') || s.includes('FMİ');
      };

      atts.forEach(att => {
        const status = getValGS(att, ['STATUS', 'DURUM', 'DUTY_TYPE', 'GOREV_TIPI']).toUpperCase('tr-TR');
        const note = getValGS(att, ['NOTE', 'ACIKLAMA', 'DESCRIPTION', 'NOT', 'ACIKLAMASI', 'NOTLAR', 'NOT/AÇIKLAMA']).toUpperCase('tr-TR');
        const loc = getValGS(att, ['DUTY_LOC', 'DUTY_LOCAT', 'DUTY_LOCATION', 'GOREV_YERI', 'LOCATION', 'YER']).toUpperCase('tr-TR');
        const type = getValGS(att, ['DUTY_TYPE', 'GOREV_TIPI', 'DURUM_TIPI']).toUpperCase('tr-TR');
        const leave = getValGS(att, ['LEAVE_TYPE', 'LEAVE_TYI', 'IZIN_TIPI', 'G_SUTUNU', 'İZİN TÜRÜ', 'IZIN TURU', 'IZIN_TIPI']).toUpperCase('tr-TR');
        
        const isCancelled = note.includes('İPTAL') || note.includes('IPTAL');
        if (isCancelled) return;

        const isStatusIzin = status === 'İZİN' || status === 'IZIN';
        const isLeaveFmi = containsFmi(leave);
        const isFmi = isStatusIzin && isLeaveFmi;
        
        const isStandby = (status.includes('BEKLEME') || note.includes('BEKLEME') || loc.includes('BEKLEME')) && !isFmi;
        
        const isPlanned = type.includes('PLANLI') || type === '';
        const isInternational = isOverseasGS(loc, note, status);
        const isExcluded = status.includes('İZİN') || status.includes('IZIN') || status.includes('RAPOR') || status.includes('İSTİRAHAT');
        
        const isDuty = (status.includes('GÖREV') || status.includes('GOREV')) && !isStandby && !isFmi && !isInternational && !isExcluded && isPlanned;

        if (isFmi) {
          bestAutoType = "AUTO_FMI";
          bestHours = 8;
          bestDesc = "OTOMATİK FMİ İZNİ (YOKLAMA)";
        } else if (isStandby) {
          bestAutoType = "AUTO_STANDBY";
          const dayType = getDayTypeGS(dateStr);
          const isHoliday = status.includes('RESMİ') || status.includes('RESMI') || note.includes('RESMİ') || note.includes('RESMI') || dayType === "Resmi Tatil";
          bestHours = isHoliday ? 2 : 1;
          bestDesc = isHoliday ? "OTOMATİK RESMİ TATİL BEKLEME (YOKLAMA)" : "OTOMATİK BEKLEME MESAİSİ";
        } else if (isDuty) {
          bestAutoType = "AUTO_DUTY";
          const dayType = getDayTypeGS(dateStr);
          const isWkHoliday = dayType === "Resmi Tatil" || dayType === "Hafta Sonu";
          bestHours = isWkHoliday ? 11 : 3;
          bestDesc = `OTOMATİK GÖREV MESAİSİ (${isWkHoliday ? 'HAFTA SONU' : 'HAFTA İÇİ'})`;
        }
      });

      if (bestAutoType) {
        const autoId = `auto-${bestAutoType.toLowerCase()}-${pid}-${dateStr}`;
        const personnel = initData.personnel.find(p => {
          const personIdOfRow = String(getValGS(p, ['ID', 'PERSONID', 'PID', 'KİŞİ ID', 'KISI ID'])).trim();
          return personIdOfRow === pid;
        });
        let name = personnel ? (getValGS(personnel, ['FULLNAME', 'PERSONNAME', 'AD_SOYAD', 'AD SOYADI']) || pid) : pid;
        
        desiredAutoTxs[autoId] = { pid, name, date: dateStr, hours: bestHours, type: bestAutoType === "AUTO_FMI" ? "USED" : "EARNED", desc: bestDesc, dayType: getDayTypeGS(dateStr) };
      }
    });

    // 3. Clear existing overtimes (except header) and rewrite completely
    if (txSheet.getLastRow() > 1) {
      txSheet.getRange(2, 1, txSheet.getLastRow() - 1, txSheet.getLastColumn()).clearContent();
    }

    const allRowsToWrite = [];
    
    // Add manual entries first
    manualRows.forEach(row => {
      allRowsToWrite.push(row);
    });

    // Convert and append new automatic sync entries
    Object.keys(desiredAutoTxs).forEach(id => {
      const tx = desiredAutoTxs[id];
      const row = headers.map(h => {
        switch(h) {
          case "ID": return id;
          case "PERSONID": case "PID": return tx.pid;
          case "PERSONNAME": return tx.name;
          case "DATE": return ""; // Empty B column for auto rows (as requested, removing the date data)
          case "ENDDATE": return ""; // Empty ENDDATE column too
          case "DAYS": return 1;
          case "HOURS": return tx.hours;
          case "TYPE": return tx.type;
          case "SHIFT": return "Gündüz";
          case "DAYTYPE": return tx.dayType;
          case "DESCRIPTION": return tx.desc;
          case "STATUS": return "APPROVED";
          case "DATE_L": return tx.date; // Put in L column
          case "TIMESTAMP": return new Date();
          default: return "";
        }
      });
      allRowsToWrite.push(row);
    });

    const maxCols = Math.max(headers.length, 12);
    const finalizedRows = allRowsToWrite.map(row => {
      const tempRow = [...row];
      while (tempRow.length < maxCols) {
        tempRow.push("");
      }
      return tempRow;
    });

    if (finalizedRows.length > 0) {
      txSheet.getRange(2, 1, finalizedRows.length, maxCols).setValues(finalizedRows);
    }
    
    return { added: Object.keys(desiredAutoTxs).length, manualKept: manualRows.length };
  } finally {
    if (lockObj) {
      try { lockObj.releaseLock(); } catch(e) {}
    }
  }
}

function saveOrUpdateManualToPlansizSheet(tx, actionType) {
  try {
    const mainDb = getMainDb();
    const possibleNames = ["plansız işlemler", "plansız ıslemler", "plansiz_islemler", "plansiz islemler", "Plansız İşlemler", "Plansız Islemler"];
    let plansizSheet = null;
    for (let name of possibleNames) {
      plansizSheet = mainDb.getSheetByName(name);
      if (plansizSheet) break;
    }
    
    // If not found, create "plansız ıslemler"
    if (!plansizSheet) {
      plansizSheet = mainDb.insertSheet("plansız ıslemler");
    }
    
    let plansizData = [];
    if (plansizSheet.getLastRow() > 0) {
      plansizData = plansizSheet.getDataRange().getValues();
    }
    
    let plansizHeaders = [];
    if (plansizData.length > 0) {
      plansizHeaders = plansizData[0].map(h => String(h).trim().toUpperCase());
    } else {
      // Create headers
      plansizHeaders = ["ID", "PERSONID", "PERSONNAME", "DATE", "ENDDATE", "DAYS", "HOURS", "TYPE", "SHIFT", "DAYTYPE", "DESCRIPTION", "STATUS", "TIMESTAMP"];
      const displayHeaders = ["ID", "PersonId", "PersonName", "Date", "EndDate", "Days", "Hours", "Type", "Shift", "DayType", "Description", "Status", "Timestamp"];
      plansizSheet.appendRow(displayHeaders);
    }

    const idColIdx = plansizHeaders.indexOf("ID");
    const statusColIdx = plansizHeaders.indexOf("STATUS");

    const targetId = String(getProp(tx, "id")).trim();
    if (!targetId) return;

    if (actionType === "DELETE") {
      if (idColIdx !== -1 && plansizData.length > 1) {
        for (let i = 1; i < plansizData.length; i++) {
          if (String(plansizData[i][idColIdx]).trim() === targetId) {
            plansizSheet.deleteRow(i + 1);
            break;
          }
        }
      }
      return;
    }

    // Find if already exists
    let existingRowIndex = -1;
    if (idColIdx !== -1 && plansizData.length > 1) {
      for (let i = 1; i < plansizData.length; i++) {
        if (String(plansizData[i][idColIdx]).trim() === targetId) {
          existingRowIndex = i + 1;
          break;
        }
      }
    }

    // Construct correct row matched to plansizHeaders
    const row = plansizHeaders.map(h => {
      switch(h) {
        case "ID": return targetId;
        case "PERSONID": case "PID": return String(getProp(tx, "personId") || getProp(tx, "pid") || "");
        case "PERSONNAME": return String(getProp(tx, "personName") || getProp(tx, "name") || "");
        case "DATE": case "TARİH": {
          let dt = getProp(tx, "date");
          if (dt instanceof Date) dt = Utilities.formatDate(dt, "GMT+3", "yyyy-MM-dd");
          return String(dt);
        }
        case "ENDDATE": {
          let edt = getProp(tx, "endDate");
          if (!edt) edt = getProp(tx, "date");
          if (edt instanceof Date) edt = Utilities.formatDate(edt, "GMT+3", "yyyy-MM-dd");
          return String(edt);
        }
        case "DAYS": {
          const dy = getProp(tx, "days");
          return dy ? Number(dy) : 1;
        }
        case "HOURS": {
          const hr = getProp(tx, "hours");
          return hr ? Number(hr) : 0;
        }
        case "TYPE": return String(getProp(tx, "type"));
        case "SHIFT": {
          const sh = getProp(tx, "shift");
          return sh ? String(sh) : "Gündüz";
        }
        case "DAYTYPE": return String(getProp(tx, "dayType"));
        case "DESCRIPTION": return String(getProp(tx, "description") || getProp(tx, "desc") || "");
        case "STATUS": {
          if (actionType === "APPROVE") return "APPROVED";
          const st = String(getProp(tx, "status"));
          return st ? st : "PENDING";
        }
        case "TIMESTAMP": return new Date();
        default: return "";
      }
    });

    if (existingRowIndex !== -1) {
      // If found, update entire row or just status if needed (we update entire row for consistency)
      plansizSheet.getRange(existingRowIndex, 1, 1, row.length).setValues([row]);
    } else {
      // If not found (even on APPROVE, as a fallback), insert it
      plansizSheet.appendRow(row);
    }
  } catch (err) {
    console.warn("Error in saveOrUpdateManualToPlansizSheet: " + err.toString());
  }
}

function getProp(obj, propName) {
  if (!obj) return "";
  const upper = propName.toUpperCase();
  const lower = propName.toLowerCase();
  
  if (obj[propName] !== undefined && obj[propName] !== null) return obj[propName];
  if (obj[upper] !== undefined && obj[upper] !== null) return obj[upper];
  if (obj[lower] !== undefined && obj[lower] !== null) return obj[lower];
  
  // Custom case-insensitive mappings for common fields
  if (upper === "PERSONID") {
    if (obj.pid !== undefined && obj.pid !== null) return obj.pid;
    if (obj.PID !== undefined && obj.PID !== null) return obj.PID;
  }
  if (upper === "PERSONNAME") {
    if (obj.name !== undefined && obj.name !== null) return obj.name;
    if (obj.NAME !== undefined && obj.NAME !== null) return obj.NAME;
  }
  if (upper === "DESCRIPTION") {
    if (obj.desc !== undefined && obj.desc !== null) return obj.desc;
    if (obj.DESC !== undefined && obj.DESC !== null) return obj.DESC;
  }
  return "";
}

function getDayTypeGS(dateStr) {
  const TURKISH_HOLIDAYS = ['01-01', '04-23', '05-01', '05-19', '07-15', '08-30', '10-29'];
  const MOVABLE_HOLIDAYS = ['2024-04-10', '2024-04-11', '2024-04-12', '2024-06-16', '2024-06-17', '2024-06-18', '2024-06-19', '2025-03-30', '2025-03-31', '2025-04-01', '2025-06-06', '2025-06-07', '2025-06-08', '2025-06-09', '2026-03-20', '2026-03-21', '2026-03-22', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30'];
  if (!dateStr) return "Hafta İçi";
  const parts = dateStr.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const mmDd = Utilities.formatDate(date, "GMT+3", "MM-dd");
  const yyyyMmDd = Utilities.formatDate(date, "GMT+3", "yyyy-MM-dd");
  if (TURKISH_HOLIDAYS.indexOf(mmDd) !== -1 || MOVABLE_HOLIDAYS.indexOf(yyyyMmDd) !== -1) return "Resmi Tatil";
  const dayOfWeek = parseInt(Utilities.formatDate(date, "GMT+3", "u"));
  return dayOfWeek >= 6 ? "Hafta Sonu" : "Hafta İçi";
}

function handleSaveAttendance(payload) {
  const perDb = getPersonnelDb();
  const sheet = getSheetSafely(perDb, ["Yoklama", "YOKLAMA", "ATTENDANCE"]);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const record = payload.record || {};
    const dateStr = record.date || "";
    const personId = record.personId || "";
    const status = record.status || "";
    const location = record.location || "";
    const isPlannedStr = record.isPlanned ? "PLANLI" : "PLANSIZ";
    const leaveType = record.leaveType || "";
    const note = record.note || "";
    
    let monthVal = "";
    let yearVal = "";
    if (dateStr) {
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        monthVal = parseInt(parts[1], 10) || "";
      }
      if (parts.length >= 1) {
        yearVal = parseInt(parts[0], 10) || "";
      }
    }
    
    const row = [
      SYSTEM_ID,
      dateStr,
      personId,
      status,
      location,
      isPlannedStr,
      leaveType,
      note,
      monthVal,
      yearVal
    ];
    
    // Ensure absolutely no "undefined" or "null" elements are passed to appendRow
    const sanitizedRow = row.map(function(val) {
      return (val === undefined || val === null) ? "" : val;
    });
    
    sheet.appendRow(sanitizedRow);
  } finally { lock.releaseLock(); }
  return { success: true };
}

function showStatus(msg) { return ContentService.createTextOutput(msg); }
