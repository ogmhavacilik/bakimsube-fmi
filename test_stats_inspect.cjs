const fs = require('fs');

const liveData = JSON.parse(fs.readFileSync('live_init_data.json', 'utf8'));
const transactions = liveData.transactions;
const attendanceRecords = liveData.attendance;
const personnel = liveData.personnel;

// Let's ensure Rıdvan is in personnel
let pObj = personnel.find(p => String(p.id).includes('67') || String(p.fullName || '').includes('RIDVAN'));
if (!pObj) {
    pObj = { id: '67', fullName: 'RIDVAN ŞATIR', title: 'DESTEK ŞÖFÖR', unit: 'DESTEK' };
    personnel.push(pObj);
}

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

function checkIsDriver(p) {
    const pTitle = String(p?.title || p?.TITLE || '').toLocaleUpperCase('tr-TR');
    const pUnit = String(p?.unit || p?.UNIT || '').toLocaleUpperCase('tr-TR');
    return ['ŞÖFÖR', 'ŞOFÖR', 'SOFOR', 'SÜRÜCÜ', 'SURUCU'].some(k => pTitle.includes(k) || pUnit.includes(k));
}
function checkIsDriverOnly(p) { return checkIsDriver(p); }
function checkIsYerDestek(p) { return false; }
function checkIsTechnical(p) { return false; }

const personnelMap = new Map();
personnel.forEach(p => {
    const cleanId = cleanPersonnelId(p.id);
    if (cleanId) personnelMap.set(cleanId, p);
});
const getPerson = (rawId) => personnelMap.get(cleanPersonnelId(rawId));

// STEP 1: attendanceVirtual
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
        // Look at how index.html currently does it:
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
console.log('Total virtual transactions generated:', attendanceVirtual.length);
console.log('Virtual for Ridvan:', attendanceVirtual.filter(t => cleanPersonnelId(t.personId) === '67').length);
console.log('Virtual FMI for Ridvan:', attendanceVirtual.filter(t => cleanPersonnelId(t.personId) === '67' && t.type === TRANSACTION_TYPES.USED).length);
console.log('Virtual Standby for Ridvan:', attendanceVirtual.filter(t => cleanPersonnelId(t.personId) === '67' && t.type === TRANSACTION_TYPES.EARNED).length);
