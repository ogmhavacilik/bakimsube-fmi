
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("live_init_data.json", "utf8"));

const TURKISH_HOLIDAYS = [
    "01-01", "04-23", "05-01", "05-19", "07-15", "08-30", "10-29"
];
const MOVABLE_HOLIDAYS = [
    "2026-03-19", "2026-03-20", "2026-03-21", "2026-03-22",
    "2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30"
];
const DAY_TYPES = {
    WEEKDAY: "Hafta İçi",
    WEEKEND: "Hafta Sonu",
    HOLIDAY: "Resmi Tatil"
};
const TRANSACTION_TYPES = {
    EARNED: "EARNED",
    USED: "USED"
};

function formatDateLocal(d) {
    if (!d) return "";
    if (typeof d === "string") return d.split(" ")[0].split("T")[0];
    if (d instanceof Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }
    return String(d);
}

function cleanPersonnelId(raw) {
    if (!raw && raw !== 0) return "";
    let s = String(raw).trim().toLowerCase();
    s = s.replace(/^p0*/, "");
    s = s.replace(/^0+/, "");
    return s;
}

function isStandbyDate(d) {
    if (!d) return false;
    const dateStr = formatDateLocal(d);
    return dateStr >= "2026-05-01" && dateStr <= "2026-11-30";
}

function isPlannedDutySeason(d) {
    if (!d) return false;
    const dateStr = formatDateLocal(d);
    return dateStr >= "2026-05-01" && dateStr <= "2026-11-30";
}

function getDayType(dateStr) {
    if (!dateStr) return DAY_TYPES.WEEKDAY;
    const normalized = formatDateLocal(dateStr);
    const parts = normalized.split("-");
    if (parts.length < 3) return DAY_TYPES.WEEKDAY;
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    const monthDay = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (TURKISH_HOLIDAYS.includes(monthDay) || MOVABLE_HOLIDAYS.includes(normalized)) {
        return DAY_TYPES.HOLIDAY;
    }
    const dayNum = date.getDay();
    if (dayNum === 0 || dayNum === 6) return DAY_TYPES.WEEKEND;
    return DAY_TYPES.WEEKDAY;
}

function getMultiplier(dayType, isTechnical) {
    return 1.0;
}

function checkIsWeekend(dateStr) {
    if (!dateStr) return false;
    const normalized = formatDateLocal(dateStr);
    const [y, m, d] = normalized.split("-").map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
    const dt = new Date(y, m - 1, d);
    return dt.getDay() === 0 || dt.getDay() === 6;
}

function checkIsTechnical(p) {
    if (!p) return false;
    const pName = String(p.fullName || p.FULL_NAME || "").toLocaleUpperCase("tr-TR");
    const pTitle = String(p.title || p.TITLE || "").toLocaleUpperCase("tr-TR");
    const isSerkan = pName.includes("SERKAN KOTAN") || pName.includes("SERKAN KÖTEN");
    return ["UÇAK TEKNİKERİ", "UÇAK TEKNİSYENİ"].some(t => pTitle.includes(t)) && !isSerkan;
}

function checkIsDriverOnly(p) {
    if (!p) return false;
    const pTitle = String(p.title || p.TITLE || "").toLocaleUpperCase("tr-TR");
    const pUnit = String(p.unit || p.UNIT || "").toLocaleUpperCase("tr-TR");
    return ["ŞÖFÖR", "ŞOFÖR", "SOFOR", "SÜRÜCÜ", "SURUCU"].some(k => pTitle.includes(k) || pUnit.includes(k));
}

function checkIsYerDestek(p) {
    if (!p) return false;
    const pTitle = String(p.title || p.TITLE || "").toLocaleUpperCase("tr-TR");
    const pUnit = String(p.unit || p.UNIT || "").toLocaleUpperCase("tr-TR");
    const pName = String(p.fullName || p.FULL_NAME || "").toLocaleUpperCase("tr-TR");
    const isSerkan = pName.includes("SERKAN KOTAN") || pName.includes("SERKAN KÖTEN");
    const isKeywords = ["ŞÖFÖR", "ŞOFÖR", "SOFOR", "DESTEK MEMUR", "DESTEK MEMURU", "SÜRÜCÜ", "SURUCU", "İŞÇİ", "ISCI", "MEMUR"].some(k => pTitle.includes(k) || pUnit.includes(k));
    const isYerDestekUnit = pUnit.includes("DESTEK") || pUnit.includes("YER") || pTitle.includes("DESTEK") || isSerkan;
    return isKeywords || isYerDestekUnit;
}

function checkIsDriver(p) {
    return checkIsYerDestek(p);
}

function isOverseas(text) {
    if (!text) return false;
    const upper = String(text).toLocaleUpperCase("tr-TR");
    return upper.includes("YURT DIŞI") || upper.includes("YURTDISI") || upper.includes("OVERSEAS");
}

const personnel = data.personnel.map(p => ({
    ...p,
    id: p.ID,
    fullName: p.FULL_NAME,
    title: p.TITLE,
    role: p.ROLE
}));

const personnelMap = new Map();
personnel.forEach(p => {
    const cleanId = cleanPersonnelId(p.id);
    if (cleanId) personnelMap.set(cleanId, p);
});

const transactions = (data.transactions || []).map(t => ({
    ...t,
    id: t.ID || t.id,
    personId: t.PERSONID || t.personId,
    personName: t.PERSONNAME || t.personName,
    date: t.DATE || t.date,
    hours: t.HOURS || t.hours,
    type: t.TYPE || t.type,
    shift: t.SHIFT || t.shift,
    dayType: t.DAYTYPE || t.dayType,
    description: t.DESCRIPTION || t.description,
    status: t.STATUS || t.status,
    isPlansiz: t.IS_PLANSIZ || t.isPlansiz,
    timestamp: t.TIMESTAMP || t.timestamp
}));

const attendanceRecords = (data.attendance || []).map(a => ({
    ...a,
    id: a.ID || a.id,
    personId: a.PERSON_ID || a.personId,
    date: a.DATE || a.date,
    status: a.STATUS || a.status,
    note: a.NOTE || a.note,
    location: a.DUTY_LOCATION || a.location,
    leaveType: a.LEAVE_TYPE || a.leaveType,
    isPlanned: a.DUTY_TYPE === "Planlı" || a.isPlanned
}));

// RUN filteredTransactions
const seenDuty = new Set();
const seenStandby = new Set();

const getPerson = (id) => {
    if (!id) return null;
    const cleanId = cleanPersonnelId(id);
    return personnelMap.get(cleanId);
};

const attendanceVirtual = [];
attendanceRecords.forEach(record => {
    const status = String(record.status || "").toLocaleUpperCase("tr-TR");
    const normStatus = status.replace(/\./g, "");
    const dateStr = String(record.date || "");
    const note = String(record.note || "").toLocaleUpperCase("tr-TR");
    const leave = String(record.leaveType || "").toLocaleUpperCase("tr-TR");
    const loc = String(record.location || record.DUTY_LOC || "").toLocaleUpperCase("tr-TR");
    
    if (!dateStr.startsWith("2026")) return;
    
    const pidRaw = String(record.personId || "").trim().toLowerCase();
    const p = getPerson(pidRaw);
    const pid = p ? String(p.id).trim().toLowerCase() : pidRaw;
    
    // 1. FMİ Usage
    const isStatusIzin = normStatus.trim() === "İZİN" || normStatus.trim() === "IZIN";
    const cleanLeave = leave.replace(/\./g, "").trim();
    const isLeaveFmi = cleanLeave === "FMİ" || cleanLeave === "FMI" || cleanLeave.includes("FMİ") || cleanLeave.includes("FMI");
    const isStatusFmi = normStatus.includes("FMİ") || normStatus.includes("FMI");
    const isFmi = (isStatusIzin && isLeaveFmi) || isStatusFmi || note.includes("FMİ") || note.includes("FMI");
    if (isFmi) {
        attendanceVirtual.push({
            id: `auto-fmi-${pid}-${dateStr}`,
            personId: pid,
            personName: p?.fullName || pid,
            date: dateStr,
            type: TRANSACTION_TYPES.USED,
            hours: 8.0,
            description: "YOKLAMADAN AKTARILAN FMİ İZNİ",
            status: "APPROVED",
            isAuto: true
        });
        return;
    }
    
    // 2. Standby detection
    const dayType = getDayType(dateStr);
    const isHolidayDate = dayType === DAY_TYPES.HOLIDAY;
    const descJoint = `${normStatus} ${note} ${loc}`.toLocaleUpperCase("tr-TR");
    
    const isExcludedFromStandby = normStatus.includes("İZİN") || normStatus.includes("IZIN") || normStatus.includes("RAPOR") || normStatus.includes("HASTANE") || normStatus.includes("İSTİRAHAT") || normStatus.includes("ISTIRAHAT") || normStatus.includes("KURS");
    
    const hasBeklemeInText = normStatus.includes("BEKLEME") || note.includes("BEKLEME") || loc.includes("BEKLEME");
    const isExplicitHolidayStandby = descJoint.includes("RESMİ BEKLEME") || descJoint.includes("RESMI BEKLEME") || descJoint.includes("TATİL-BEKLEME") || descJoint.includes("TATIL-BEKLEME") || descJoint.includes("RESMİ TATİL BEKLEME") || descJoint.includes("RESMI TATIL BEKLEME") || descJoint.includes("RESMİ TATİL") || descJoint.includes("RESMI TATIL");
    
    const isHolidayStandby = !isExcludedFromStandby && hasBeklemeInText && (isHolidayDate || isExplicitHolidayStandby);
    const isStandby = !isExcludedFromStandby && hasBeklemeInText && !isHolidayStandby;
    
    if (isHolidayStandby) {
         attendanceVirtual.push({
            id: `auto-hstandby-${pid}-${dateStr}`,
            personId: pid,
            personName: p?.fullName || pid,
            date: dateStr,
            type: TRANSACTION_TYPES.EARNED,
            hours: 48.0,
            description: "RESMİ TATİL BEKLEME-ANKARA (YOKLAMA)",
            status: "APPROVED",
            isAuto: true
        });
    } else if (isStandby) {
         attendanceVirtual.push({
            id: `auto-standby-${pid}-${dateStr}`,
            personId: pid,
            personName: p?.fullName || pid,
            date: dateStr,
            type: TRANSACTION_TYPES.EARNED,
            hours: 24.0,
            description: "BEKLEME-ANKARA (YOKLAMA)",
            status: "APPROVED",
            isAuto: true
        });
    }
});

const allTxs = [...transactions, ...attendanceVirtual];
console.log("Total allTxs for all personnel:", allTxs.length);

const dutyOnDaySet = new Set();
allTxs.forEach(oTx => {
    const oId = String(oTx.id || oTx.ID || "").toLowerCase();
    const oDesc = String(oTx.description || oTx.DESCRIPTION || "").toLocaleUpperCase("tr-TR");
    const oIsStandby = oId.includes("standby") || oDesc.includes("BEKLEME");
    const oIsFmi = oDesc.includes("FMİ") || oDesc.includes("FMI") || oDesc.includes("F.M.İ");
    if (!oIsStandby && !oIsFmi) {
        dutyOnDaySet.add(`${cleanPersonnelId(oTx.personId)}_${formatDateLocal(oTx.date)}`);
    }
});

const attendanceStandbySet = new Set();
attendanceRecords.forEach(r => {
    const st = String(r.status || "").toLocaleUpperCase("tr-TR");
    const nt = String(r.note || "").toLocaleUpperCase("tr-TR");
    const lc = String(r.location || r.DUTY_LOC || "").toLocaleUpperCase("tr-TR");
    const isEx = st.includes("İZİN") || st.includes("IZIN") || st.includes("RAPOR") || st.includes("İSTİRAHAT") || st.includes("HASTANE") || st.includes("KURS");
    if ((st.includes("BEKLEME") || nt.includes("BEKLEME") || lc.includes("BEKLEME")) && !isEx) {
        attendanceStandbySet.add(`${cleanPersonnelId(r.personId)}_${formatDateLocal(r.date)}`);
    }
});

const filteredTransactions = allTxs.filter(tx => {
    const date = String(tx.date || "");
    if (!date.startsWith("2026")) return false;

    const pid = cleanPersonnelId(tx.personId);
    const dateLocal = formatDateLocal(tx.date);
    const id = String(tx.id || tx.ID || "").toLowerCase();
    const isAuto = id.startsWith("auto-") || id.includes("sync");
    
    const desc = String(tx.description || tx.DESCRIPTION || "").toLocaleUpperCase("tr-TR");
    const isPlansiz = tx.isPlansiz === true || tx.IS_PLANSIZ === true || id.startsWith("manual-tx") || desc.includes("PLANSIZ");
    if (isPlansiz) return true;

    const dayType = getDayType(dateLocal) === DAY_TYPES.HOLIDAY ? DAY_TYPES.HOLIDAY : (tx.dayType || getDayType(dateLocal));
    const isHolidayDate = dayType === DAY_TYPES.HOLIDAY;
    
    const hasBeklemeInText = !isPlansiz && (tx.isStandbySync === true || tx.isStandby === true || tx.isHolidayStandby === true || id.includes("standby") || id.includes("hstandby") || id.includes("bekleme") || desc.includes("BEKLEME")) && !desc.includes("UÇUŞ") && !desc.includes("UCUS") && !desc.includes("BAKIM");
    const isExplicitHolidayStandby = !isPlansiz && (desc.includes("RESMİ BEKLEME") || desc.includes("RESMI BEKLEME") || desc.includes("TATİL-BEKLEME") || desc.includes("TATIL-BEKLEME") || desc.includes("RESMİ TATİL BEKLEME") || desc.includes("RESMI TATIL BEKLEME") || desc.includes("RESMİ TATİL") || desc.includes("RESMI TATIL") || id.includes("hstandby") || id.includes("holidaystandby"));
    
    const isHolidayStandby = !isPlansiz && (tx.isHolidayStandby !== undefined ? tx.isHolidayStandby : (hasBeklemeInText && (isHolidayDate || isExplicitHolidayStandby)));
    const isStandby = !isPlansiz && (tx.isStandby !== undefined ? tx.isStandby : (hasBeklemeInText && !isHolidayStandby));

    const personObj = getPerson(pid);
    const isDriverPerson = checkIsDriver(personObj);
    if ((isStandby || isHolidayStandby) && !isDriverPerson && !isStandbyDate(dateLocal) && !isAuto) return false;

    const hasDutyOnThisDay = dutyOnDaySet.has(`${pid}_${dateLocal}`);
    const isDriverOnly = checkIsDriverOnly(personObj);
    const isYerDestekPerson = checkIsYerDestek(personObj);
    const isTechPerson = checkIsTechnical(personObj);
    const isWk = checkIsWeekend(dateLocal);

    let skipStandby = false;
    if (isHolidayStandby) {
        if (hasDutyOnThisDay && !isDriverOnly) skipStandby = true;
    } else if (isStandby) {
        if (isTechPerson && isWk && hasDutyOnThisDay) skipStandby = true;
    }
    if (isAuto && (isStandby || isHolidayStandby) && skipStandby) return false;

    if (isAuto && (isStandby || isHolidayStandby)) {
        const key = `${pid}_${dateLocal}`;
        if (seenStandby.has(key)) return false;
        seenStandby.add(key);
    }

    return true;
});

console.log("Filtered txs count for Ridvan:", filteredTransactions.filter(t => cleanPersonnelId(t.personId) === "67").length);

// NOW CALCULATE STATS
const map = {};
personnel.forEach(p => {
    const normId = cleanPersonnelId(p.id);
    map[normId] = { 
        earned: 0, 
        used: 0, 
        balance: 0, 
        score: 0,
        standbyDays: 0,
        standby: 0,
        holidayStandbyDays: 0,
        holidayStandby: 0,
        notesBreakdown: {},
        breakdown: {
            [DAY_TYPES.WEEKDAY]: { day: 0, night: 0 },
            [DAY_TYPES.WEEKEND]: { day: 0, night: 0 },
            [DAY_TYPES.HOLIDAY]: { day: 0, night: 0 }
        }
    };
});

const standardIdMap = new Map();
personnel.forEach(p => {
    const pId = String(p.id || "").trim().toLowerCase();
    if (!pId) return;
    standardIdMap.set(pId, pId);
    if (pId.startsWith("p")) standardIdMap.set(pId.replace(/^p/, ""), pId);
    else standardIdMap.set("p" + pId, pId);
});

const getStandardId = (rawId) => {
    const clean = String(rawId || "").trim().toLowerCase();
    if (!clean) return "";
    return standardIdMap.get(clean) || clean;
};

const txDedupMap = new Map();
filteredTransactions.forEach(tx => {
    let pid = getStandardId(tx.personId);
    if (!pid || !map[pid]) return;

    const txDateStr = String(tx.date || "");
    if (!txDateStr.startsWith("2026")) return;

    const txId = String(tx.id || tx.ID || "");
    const descUpper = String(tx.description || tx.DESCRIPTION || "").toLocaleUpperCase("tr-TR");
    const dateStr = formatDateLocal(tx.date);

    const isPlansiz = tx.isPlansiz === true || tx.IS_PLANSIZ === true || txId.toLowerCase().startsWith("manual-tx") || descUpper.includes("PLANSIZ");
    const hasBeklemeInText = !isPlansiz && (tx.isStandbySync === true || tx.isStandby === true || tx.isHolidayStandby === true || txId.toLowerCase().includes("standby") || txId.toLowerCase().includes("hstandby") || txId.toLowerCase().includes("bekleme") || descUpper.includes("BEKLEME")) && !descUpper.includes("UÇUŞ") && !descUpper.includes("UCUS") && !descUpper.includes("BAKIM");
    const dayType = getDayType(dateStr) === DAY_TYPES.HOLIDAY ? DAY_TYPES.HOLIDAY : (tx.dayType || getDayType(dateStr));
    const isHolidayDate = dayType === DAY_TYPES.HOLIDAY;
    const isExplicitHolidayStandby = !isPlansiz && (descUpper.includes("RESMİ BEKLEME") || descUpper.includes("RESMI BEKLEME") || descUpper.includes("TATİL-BEKLEME") || descUpper.includes("TATIL-BEKLEME") || descUpper.includes("RESMİ TATİL BEKLEME") || descUpper.includes("RESMI TATIL BEKLEME") || descUpper.includes("RESMİ TATİL") || descUpper.includes("RESMI TATIL") || txId.toLowerCase().includes("hstandby") || txId.toLowerCase().includes("holidaystandby"));
    
    const isHolidayStandby = !isPlansiz && (tx.isHolidayStandby !== undefined ? tx.isHolidayStandby : (hasBeklemeInText && (isHolidayDate || isExplicitHolidayStandby)));
    const isStandby = !isPlansiz && (tx.isStandby !== undefined ? tx.isStandby : (hasBeklemeInText && !isHolidayStandby));

    let cat = "OTHER";
    if (isHolidayStandby) cat = "HOLIDAY_STANDBY";
    else if (isStandby) cat = "STANDBY";
    else if (isPlansiz) cat = "DUTY";

    const isAuto = txId.toLowerCase().startsWith("auto-") || txId.toLowerCase().includes("sync");
    const key = isPlansiz 
        ? `${pid}_plansiz_${dateStr}_${txId}_${tx.hours || tx.HOURS || 0}_${descUpper}_${tx.timestamp || tx.TIMESTAMP || Math.random()}`
        : ((isAuto ? `${pid}_${dateStr}_${cat}` : `${pid}_${txId || Math.random()}_${dateStr}_${cat}`));
    txDedupMap.set(key, tx);
});

const sortedTxs = Array.from(txDedupMap.values());
console.log("sortedTxs count for Ridvan:", sortedTxs.filter(t => cleanPersonnelId(t.personId) === "67").length);

const processedDays = {
    DUTY: new Set(),
    STANDBY: new Set(),
    PLANNED_DUTY: new Set(),
    USED: new Set()
};

sortedTxs.forEach(tx => {
    let pid = getStandardId(tx.personId);
    if (!map[pid]) return;

    const txId = String(tx.id || tx.ID || "");
    const descUpper = String(tx.description || tx.DESCRIPTION || "").toLocaleUpperCase("tr-TR");
    const dateStr = formatDateLocal(tx.date);
    const dayType = getDayType(dateStr) === DAY_TYPES.HOLIDAY ? DAY_TYPES.HOLIDAY : (tx.dayType || getDayType(dateStr));
    const isHolidayDate = dayType === DAY_TYPES.HOLIDAY;

    const isPlansiz = tx.isPlansiz === true || tx.IS_PLANSIZ === true || txId.toLowerCase().startsWith("manual-tx") || descUpper.includes("PLANSIZ");
    const hasBeklemeInText = !isPlansiz && (tx.isStandbySync === true || tx.isStandby === true || tx.isHolidayStandby === true || txId.toLowerCase().includes("standby") || txId.toLowerCase().includes("hstandby") || txId.toLowerCase().includes("bekleme") || descUpper.includes("BEKLEME")) && !descUpper.includes("UÇUŞ") && !descUpper.includes("UCUS") && !descUpper.includes("BAKIM");
    const isExplicitHolidayStandby = !isPlansiz && (descUpper.includes("RESMİ BEKLEME") || descUpper.includes("RESMI BEKLEME") || descUpper.includes("TATİL-BEKLEME") || descUpper.includes("TATIL-BEKLEME") || descUpper.includes("RESMİ TATİL BEKLEME") || descUpper.includes("RESMI TATIL BEKLEME") || descUpper.includes("RESMİ TATİL") || descUpper.includes("RESMI TATIL") || txId.toLowerCase().includes("hstandby") || txId.toLowerCase().includes("holidaystandby"));
    
    const isHolidayStandby = !isPlansiz && (tx.isHolidayStandby !== undefined ? tx.isHolidayStandby : (hasBeklemeInText && (isHolidayDate || isExplicitHolidayStandby)));
    const isStandby = !isPlansiz && (tx.isStandby !== undefined ? tx.isStandby : (hasBeklemeInText && !isHolidayStandby));

    if (isPlansiz) {
        const rawH = parseFloat(tx.hours !== undefined ? tx.hours : (tx.HOURS || 0));
        const dayStats = map[pid].breakdown[dayType] || { day: 0, night: 0 };
        if (String(tx.shift).toUpperCase().includes("GECE")) dayStats.night += rawH; 
        else dayStats.day += rawH;
        map[pid].breakdown[dayType] = dayStats;

        const pObj = personnelMap.get(cleanPersonnelId(pid));
        const pTitle = (pObj?.title || "").toLocaleUpperCase("tr-TR");
        const pFullName = (pObj?.fullName || "").toLocaleUpperCase("tr-TR");
        const isSerkanP = pFullName.includes("SERKAN KOTAN") || pFullName.includes("SERKAN KÖTEN");
        const isTechP = ["UÇAK TEKNİKERİ", "UÇAK TEKNİSYENİ"].some(t => pTitle.includes(t)) && !isSerkanP;
        const isDriverP = checkIsDriver(pObj);
        const multP = isDriverP ? 1 : getMultiplier(dayType, isTechP);
        const points = rawH * multP;
        map[pid].score += points;
        return;
    }

    const personObj = personnelMap.get(cleanPersonnelId(pid));
    const isDriverPerson = checkIsDriver(personObj);
    const inSeason = isStandbyDate(dateStr);
    const isAuto = txId.startsWith("auto-") || txId.includes("sync");
    if ((isStandby || isHolidayStandby) && !inSeason && !isDriverPerson && !isAuto) return;

    const [y, mm, dd] = dateStr.split("-").map(Number);
    const cur = new Date(y, mm - 1, dd);
    const curStr = formatDateLocal(cur);
    const dayKey = `${pid}_${curStr}`;
    
    const isWk = cur.getDay() === 0 || cur.getDay() === 6;
    const hasDutyOnThisDay = dutyDaysSet.has(`${pid}_${curStr}`);
    const isDriverOnly = checkIsDriverOnly(personObj);
    const isYerDestekPerson = checkIsYerDestek(personObj);

    let points = 0;
    let skip = false;

    if (isHolidayStandby) {
        if (processedDays.STANDBY.has(dayKey)) skip = true;
        else {
            processedDays.STANDBY.add(dayKey);
            if (hasDutyOnThisDay) {
                points = 0;
                skip = true;
            } else if (isDriverOnly) {
                points = 10.0;
            } else {
                points = 2.0;
            }
        }
    } else if (isStandby) {
        if (processedDays.STANDBY.has(dayKey)) skip = true;
        else {
            processedDays.STANDBY.add(dayKey);
            if (!isStandbyDate(curStr) && !isYerDestekPerson && !isDriverPerson && !isAuto) skip = true;
            else if (hasDutyOnThisDay) {
                points = 0;
                skip = true;
            } else if (isDriverOnly) {
                points = isWk ? 10.0 : 1.0;
            } else if (isYerDestekPerson && isWk) {
                points = 2.0;
            } else {
                points = 1.0;
            }
        }
    }

    if (skip) return;

    map[pid].score += points;

    if (isHolidayStandby) {
        map[pid].holidayStandbyDays = (map[pid].holidayStandbyDays || 0) + 1;
        map[pid].holidayStandby += points;
    } else if (isStandby) {
        map[pid].standbyDays = (map[pid].standbyDays || 0) + 1;
        map[pid].standby += points;
    }
});

Object.keys(map).forEach(id => {
    map[id].earned = parseFloat((map[id].score + map[id].used).toFixed(1));
    map[id].balance = parseFloat((map[id].score || 0).toFixed(1));
});

console.log("MAP 67 / p67:", map["67"]);
