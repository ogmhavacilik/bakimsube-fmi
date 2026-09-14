const fs = require('fs');

const liveData = JSON.parse(fs.readFileSync('live_init_data.json', 'utf8'));
const transactions = liveData.transactions;
const attendanceRecords = liveData.attendance;
const personnel = liveData.personnel;

const TURKISH_HOLIDAYS = [
    '01-01', '04-23', '05-01', '05-19', '07-15', '08-30', '10-29'
];
const MOVABLE_HOLIDAYS = [
    '2026-03-19', '2026-03-20', '2026-03-21', '2026-03-22',
    '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30'
];
const DAY_TYPES = {
    WEEKDAY: 'Hafta İçi',
    WEEKEND: 'Hafta Sonu',
    HOLIDAY: 'Resmi Tatil'
};
const TRANSACTION_TYPES = {
    EARNED: 'EARNED',
    USED: 'USED'
};

function formatDateLocal(d) {
    if (!d) return '';
    if (typeof d === 'string') return d.split(' ')[0].split('T')[0];
    if (d instanceof Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    return String(d);
}

function cleanPersonnelId(raw) {
    if (!raw && raw !== 0) return '';
    let s = String(raw).trim().toLowerCase();
    s = s.replace(/^p0*/, '');
    s = s.replace(/^0+/, '');
    return s;
}

function isStandbyDate(d) {
    if (!d) return false;
    const dateStr = formatDateLocal(d);
    return dateStr >= '2026-05-01' && dateStr <= '2026-11-30';
}

function isPlannedDutySeason(d) {
    if (!d) return false;
    const dateStr = formatDateLocal(d);
    return dateStr >= '2026-05-01' && dateStr <= '2026-11-30';
}

function isOverseas(loc) {
    if (!loc) return false;
    const l = String(loc).toLocaleUpperCase('tr-TR');
    return ['KKTC', 'KIBRIS', 'GİRNE', 'LEFKOŞA', 'ERCAN', 'GEÇİTKALE', 'YURTDIŞI', 'YURT DIŞI'].some(k => l.includes(k));
}

function getDayType(dateStr) {
    if (!dateStr) return DAY_TYPES.WEEKDAY;
    const normalized = formatDateLocal(dateStr);
    const parts = normalized.split('-');
    if (parts.length < 3) return DAY_TYPES.WEEKDAY;
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    const monthDay = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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
    const [y, m, d] = normalized.split('-');
    const dt = new Date(y, m - 1, d);
    return dt.getDay() === 0 || dt.getDay() === 6;
}

function checkIsTechnical(p) {
    if (!p) return false;
    const pName = String(p.fullName || p.FULL_NAME || '').toLocaleUpperCase('tr-TR');
    const pTitle = String(p.title || p.TITLE || '').toLocaleUpperCase('tr-TR');
    const isSerkan = pName.includes('SERKAN KOTAN') || pName.includes('SERKAN KÖTEN');
    return ['UÇAK TEKNİKERİ', 'UÇAK TEKNİSYENİ'].some(t => pTitle.includes(t)) && !isSerkan;
}

function checkIsDriver(p) {
    if (!p) return true; // Default true for test or check
    const pTitle = String(p.title || p.TITLE || '').toLocaleUpperCase('tr-TR');
    const pUnit = String(p.unit || p.UNIT || '').toLocaleUpperCase('tr-TR');
    return ['ŞÖFÖR', 'ŞOFÖR', 'SOFOR', 'SÜRÜCÜ', 'SURUCU'].some(k => pTitle.includes(k) || pUnit.includes(k));
}

function checkIsDriverOnly(p) {
    return checkIsDriver(p);
}

function checkIsYerDestek(p) {
    return false;
}

// Add Rıdvan to personnel if not present
let pObj = personnel.find(p => cleanPersonnelId(p.id) === '67' || String(p.fullName || '').includes('RIDVAN'));
if (!pObj) {
    pObj = { id: '67', fullName: 'RIDVAN ŞATIR', title: 'DESTEK ŞÖFÖR', unit: 'DESTEK' };
    personnel.push(pObj);
}

const personnelMap = new Map();
personnel.forEach(p => {
    const cleanId = cleanPersonnelId(p.id);
    if (cleanId) personnelMap.set(cleanId, p);
});

const getPerson = (rawId) => {
    const cleanId = cleanPersonnelId(rawId);
    return personnelMap.get(cleanId);
};

// Now simulate lines 1666 to 1950:
const attendanceVirtual = [];
attendanceRecords.forEach(record => {
    const status = String(record.status || '').toLocaleUpperCase('tr-TR');
    const normStatus = status.replace(/\./g, '');
    const dateStr = String(record.date || '');
    const note = String(record.note || '').toLocaleUpperCase('tr-TR');
    const leave = String(record.leaveType || '').toLocaleUpperCase('tr-TR');
    const loc = String(record.location || record.DUTY_LOC || '').toLocaleUpperCase('tr-TR');
    
    if (!dateStr.startsWith('2026')) return;
    
    const pidRaw = String(record.personId || '').trim().toLowerCase();
    const p = getPerson(pidRaw);
    const pid = p ? String(p.id).trim().toLowerCase() : pidRaw;
    
    const dayType = getDayType(dateStr);
    const isHolidayDate = dayType === DAY_TYPES.HOLIDAY;
    const isWk = checkIsWeekend(dateStr);
    const isStatusIzin = normStatus.trim() === 'İZİN' || normStatus.trim() === 'IZIN';
    const cleanLeave = leave.replace(/\./g, '').trim();
    const isLeaveFmi = cleanLeave === 'FMİ' || cleanLeave === 'FMI' || cleanLeave.includes('FMİ') || cleanLeave.includes('FMI');
    const isStatusFmi = normStatus.includes('FMİ') || normStatus.includes('FMI');
    const isFmi = (isStatusIzin && isLeaveFmi) || isStatusFmi || note.includes('FMİ') || note.includes('FMI');
    if (isFmi) {
        if (!isWk && !isHolidayDate) {
            attendanceVirtual.push({
                id: `auto-fmi-${pid}-${dateStr}`,
                personId: pid,
                personName: p?.fullName || pid,
                date: dateStr,
                type: TRANSACTION_TYPES.USED,
                hours: 8.0,
                description: 'YOKLAMADAN AKTARILAN FMİ İZNİ',
                status: 'APPROVED',
                isAuto: true
            });
        }
        return;
    }
    
    const descJoint = `${normStatus} ${note} ${loc}`.toLocaleUpperCase('tr-TR');
    const isExcludedFromStandby = normStatus.includes('İZİN') || normStatus.includes('IZIN') || normStatus.includes('RAPOR') || normStatus.includes('HASTANE') || normStatus.includes('İSTİRAHAT') || normStatus.includes('ISTIRAHAT') || normStatus.includes('KURS');
    const hasBeklemeInText = normStatus.includes('BEKLEME') || note.includes('BEKLEME') || loc.includes('BEKLEME');
    const isExplicitHolidayStandby = descJoint.includes('RESMİ BEKLEME') || descJoint.includes('RESMI BEKLEME') || descJoint.includes('TATİL-BEKLEME') || descJoint.includes('TATIL-BEKLEME') || descJoint.includes('RESMİ TATİL BEKLEME') || descJoint.includes('RESMI TATIL BEKLEME') || descJoint.includes('RESMİ TATİL') || descJoint.includes('RESMI TATIL');
    
    const inSeason = isStandbyDate(dateStr);
    const isHolidayStandby = inSeason && !isExcludedFromStandby && hasBeklemeInText && (isHolidayDate || isExplicitHolidayStandby);
    const isStandby = inSeason && !isExcludedFromStandby && hasBeklemeInText && !isHolidayStandby;
    
    if (isHolidayStandby) {
         attendanceVirtual.push({
            id: `auto-hstandby-${pid}-${dateStr}`,
            personId: pid,
            personName: p?.fullName || pid,
            date: dateStr,
            type: TRANSACTION_TYPES.EARNED,
            hours: checkIsDriverOnly(p) ? 10.0 : 2.0,
            description: 'RESMİ TATİL BEKLEME-ANKARA (YOKLAMA)',
            status: 'APPROVED',
            isAuto: true
        });
    } else if (isStandby) {
         let h = 1.0;
         if (isWk) {
             if (checkIsDriverOnly(p)) h = 10.0;
             else h = 2.0;
         }

         attendanceVirtual.push({
            id: `auto-standby-${pid}-${dateStr}`,
            personId: pid,
            personName: p?.fullName || pid,
            date: dateStr,
            type: TRANSACTION_TYPES.EARNED,
            hours: h,
            description: 'BEKLEME-ANKARA (YOKLAMA)',
            status: 'APPROVED',
            isAuto: true
        });
    }
});

const allTxs = [...transactions, ...attendanceVirtual];

const autoFmiSet = new Set();
attendanceVirtual.forEach(v => {
    if (String(v.id || '').toLowerCase().includes('fmi')) {
        autoFmiSet.add(`${cleanPersonnelId(v.personId)}_${formatDateLocal(v.date)}`);
    }
});

const dutyOnDaySet = new Set();
allTxs.forEach(oTx => {
    const oId = String(oTx.id || oTx.ID || '').toLowerCase();
    const oDesc = String(oTx.description || oTx.DESCRIPTION || '').toLocaleUpperCase('tr-TR');
    const oIsStandby = oId.includes('standby') || oDesc.includes('BEKLEME');
    const oIsFmi = oDesc.includes('FMİ') || oDesc.includes('FMI') || oDesc.includes('F.M.İ');
    if (!oIsStandby && !oIsFmi) {
        dutyOnDaySet.add(`${cleanPersonnelId(oTx.personId || oTx.PERSONID)}_${formatDateLocal(oTx.date || oTx.DATE)}`);
    }
});

const sorted = allTxs.sort((a,b) => {
    const aId = String(a.id || a.ID || '').toLowerCase();
    const bId = String(b.id || b.ID || '').toLowerCase();
    const getPriority = (id) => {
        if (id.startsWith('manual-override')) return 0;
        if (id.startsWith('auto-') || id.includes('sync')) return 2;
        return 1;
    };
    return getPriority(aId) - getPriority(bId);
});

// Look at line 1823:
const filteredTransactions = sorted.filter(tx => {
    const date = String(tx.date || tx.DATE || '');
    if (!date.startsWith('2026')) return false;

    const pid = cleanPersonnelId(tx.personId || tx.PERSONID);
    const dateLocal = formatDateLocal(tx.date || tx.DATE);
    const id = String(tx.id || tx.ID || '').toLowerCase();
    const isAuto = id.startsWith('auto-') || id.includes('auto-') || id.includes('sync');
    
    const desc = String(tx.description || tx.DESCRIPTION || '').toLocaleUpperCase('tr-TR');
    const isPlansiz = tx.isPlansiz === true || tx.IS_PLANSIZ === true || id.startsWith('manual-tx') || desc.includes('PLANSIZ');
    if (isPlansiz) return true; // Plansız mesailer her zaman korunur

    return true;
});

console.log('FilteredTransactions for Ridvan:', filteredTransactions.filter(t => cleanPersonnelId(t.personId || t.PERSONID) === '67').length);

// Now simulate modal lines 4965 - 5251 for selectedPerson = pObj
const selectedPerson = pObj;
const normalizeId = (id) => String(id || '').trim().toLowerCase();
const normalizeDateSimple = (d) => formatDateLocal(d);
const targetPid = normalizeId(selectedPerson?.id);
const targetName = String(selectedPerson?.fullName || '').toLocaleUpperCase('tr-TR');

const combined = filteredTransactions
    .filter(tx => {
        const pid = normalizeId(tx.personId || tx.PERSONID);
        const dateStr = normalizeDateSimple(tx.date || tx.DATE);
        const descUpper = String(tx.description || tx.DESCRIPTION || '').toLocaleUpperCase('tr-TR');
        const txId = String(tx.id || tx.ID || '').toLowerCase();
        const isAuto = txId.startsWith('auto-') || txId.includes('sync');
        const isPlansiz = txId.startsWith('manual-tx') || tx.isPlansiz === true || tx.IS_PLANSIZ === true || descUpper.includes('PLANSIZ') || (!isAuto && (tx.type === TRANSACTION_TYPES.EARNED || tx.TYPE === 'EARNED'));
        
        if (isPlansiz) {
            const isPersonMatch = pid === targetPid || 
                                 (tx.personName && String(tx.personName).toLocaleUpperCase('tr-TR') === targetName) ||
                                 (tx.PERSONNAME && String(tx.PERSONNAME).toLocaleUpperCase('tr-TR') === targetName);
            return isPersonMatch && dateStr.startsWith('2026');
        }

        return true;
    });

console.log('Combined for modal:', combined.length);

const rawItems = [...combined];
const seen = new Map();
rawItems.forEach(item => {
    const d = normalizeDateSimple(item.date || item.DATE);
    const descUpper = String(item.description || item.DESCRIPTION || '').toLocaleUpperCase('tr-TR');
    const txId = String(item.id || item.ID || '').toLowerCase();
    const itemHours = item.hours !== undefined ? item.hours : (item.HOURS !== undefined ? item.HOURS : (item.displayHours !== undefined ? item.displayHours : 0));
    
    const isPlansiz = item.isPlansiz === true || item.IS_PLANSIZ === true || txId.startsWith('manual-tx') || descUpper.includes('PLANSIZ');
    
    item.isPlansiz = isPlansiz;
    item.hours = itemHours;
    item.date = d;

    // Line 5207:
    const key = isPlansiz 
        ? `plansiz_${d}_${txId}_${itemHours}_${descUpper}_${item.timestamp || item.TIMESTAMP || Math.random()}` 
        : (d + '_category');
    seen.set(key, item);
});

const allItems = Array.from(seen.values());
const plansizItems = allItems.filter(tx => tx.isPlansiz);
const pWkday_modal = plansizItems.filter(tx => getDayType(tx.date) === DAY_TYPES.WEEKDAY).reduce((s, tx) => s + (parseFloat(tx.hours) || 0), 0);
const pWkend_modal = plansizItems.filter(tx => getDayType(tx.date) === DAY_TYPES.WEEKEND).reduce((s, tx) => s + (parseFloat(tx.hours) || 0), 0);
const pHolid_modal = plansizItems.filter(tx => getDayType(tx.date) === DAY_TYPES.HOLIDAY).reduce((s, tx) => s + (parseFloat(tx.hours) || 0), 0);
const totalPlansizPuan_modal = pWkday_modal + pWkend_modal + pHolid_modal;

console.log('Plansiz count:', plansizItems.length);
console.log('pWkday_modal:', pWkday_modal);
console.log('pWkend_modal:', pWkend_modal);
console.log('totalPlansizPuan_modal:', totalPlansizPuan_modal);
