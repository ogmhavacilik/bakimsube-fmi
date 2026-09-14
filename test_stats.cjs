const fs = require('fs');

const rawTxs = JSON.parse(fs.readFileSync('ridvan_24.json', 'utf8'));
const rawAtt = JSON.parse(fs.readFileSync('ridvan_att.json', 'utf8'));

const cleanPersonnelId = (id) => {
    if (id === null || id === undefined) return '';
    const str = String(id).trim().toLowerCase();
    return str.replace(/^p[-_]?/i, '').replace(/^0+/, '');
};

const formatDateLocal = (date) => {
    if (!date) return '';
    if (typeof date === 'string') {
        const trimmed = date.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            return trimmed.split('T')[0].split(' ')[0];
        }
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const DAY_TYPES = {
    WEEKDAY: 'Hafta İçi',
    WEEKEND: 'Hafta Sonu',
    HOLIDAY: 'Resmi Tatil'
};

const TURKISH_HOLIDAYS = [
    '01-01', '04-23', '05-01', '05-19', '07-15', '08-30', '10-29'
];
const MOVABLE_HOLIDAYS = [
    '2024-04-10', '2024-04-11', '2024-04-12',
    '2024-06-16', '2024-06-17', '2024-06-18', '2024-06-19',
    '2025-03-30', '2025-03-31', '2025-04-01',
    '2025-06-06', '2025-06-07', '2025-06-08', '2025-06-09',
    '2026-03-20', '2026-03-21', '2026-03-22',
    '2026-05-23', '2026-05-24', '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30', '2026-05-31'
];

function getDayType(dateStr) {
    if (!dateStr) return DAY_TYPES.WEEKDAY;
    const normalized = formatDateLocal(dateStr);
    const [y, m, d] = normalized.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return DAY_TYPES.WEEKDAY;
    const date = new Date(y, m - 1, d);
    const monthDay = String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    if (TURKISH_HOLIDAYS.includes(monthDay) || MOVABLE_HOLIDAYS.includes(normalized)) {
        return DAY_TYPES.HOLIDAY;
    }
    const dayNum = date.getDay();
    if (dayNum === 0 || dayNum === 6) return DAY_TYPES.WEEKEND;
    return DAY_TYPES.WEEKDAY;
}

const checkIsDriver = (p) => {
    if (!p) return false;
    const r = String(p.role || p.ROLE || '').toLocaleUpperCase('tr-TR');
    const t = String(p.title || p.TITLE || '').toLocaleUpperCase('tr-TR');
    return r.includes('ŞOFÖR') || r.includes('SOFOR') || t.includes('ŞOFÖR') || t.includes('SOFOR');
};
const checkIsDriverOnly = checkIsDriver;
const checkIsTechnical = (p) => false;
const checkIsYerDestek = (p) => true;
const isOverseas = () => false;
const isStandbyDate = () => true;
const isPlannedDutySeason = (d) => {
    const s = formatDateLocal(d);
    return s >= '2026-05-01' && s <= '2026-10-31';
};
const checkIsWeekend = (d) => {
    const s = formatDateLocal(d);
    const [y, m, day] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, day);
    return dt.getDay() === 0 || dt.getDay() === 6;
};
const TRANSACTION_TYPES = {
    EARNED: 'EARNED',
    USED: 'USED'
};

const personnel = [{
    id: '67',
    fullName: 'RIDVAN ŞATIR',
    role: 'Şoför',
    title: 'DESTEK MEMUR(ŞÖFÖR)',
    unit: 'OGM'
}];

// Format transactions
const transactions = rawTxs.map(tx => ({
    ...tx,
    id: tx.ID || tx.id,
    personId: cleanPersonnelId(tx.PERSONID || tx.personId),
    personName: tx.PERSONNAME || tx.personName,
    date: tx.DATE || tx.date,
    hours: parseFloat(tx.HOURS || tx.hours || 0),
    days: parseInt(tx.DAYS || tx.days || 1),
    description: tx.DESCRIPTION || tx.description || '',
    note: tx.NOTE || tx.note || '',
    shift: tx.SHIFT || tx.shift || 'Gündüz',
    dayType: tx.DAYTYPE || tx.dayType || 'Hafta İçi',
    type: tx.TYPE || tx.type || 'EARNED',
    status: tx.STATUS || tx.status || 'APPROVED',
    isPlansiz: tx.IS_PLANSIZ === true || tx.isPlansiz === true
}));

// Format attendance
const attendanceRecords = rawAtt.map(a => ({
    personId: cleanPersonnelId(a.PERSON_ID || a.PERSONNEL_ID || a.PID || a.personId),
    status: a.STATUS || a.status || '',
    location: a.DUTY_LOC || a.location || '',
    date: a.DATE_L || a.DATE || a.date,
    note: a.NOTE || a.note || '',
    leaveType: a.LEAVE_TYPE || a.leaveType || ''
})).filter(a => a.personId === '67');

console.log('Transactions count:', transactions.length);
console.log('Attendance count:', attendanceRecords.length);

// Now execute filteredTransactions logic:
const personnelMap = new Map();
personnel.forEach(p => personnelMap.set(cleanPersonnelId(p.id), p));
const getPerson = (id) => personnelMap.get(cleanPersonnelId(id));

const seenStandby = new Set();
const seenDuty = new Set();
const attendanceVirtual = [];

attendanceRecords.forEach(record => {
    const pid = cleanPersonnelId(record.personId);
    const dateStr = formatDateLocal(record.date);
    if (!dateStr.startsWith('2026')) return;

    const p = getPerson(pid);
    const status = String(record.status || '').toLocaleUpperCase('tr-TR');
    const note = String(record.note || '').toLocaleUpperCase('tr-TR');
    const loc = String(record.location || record.DUTY_LOC || '').toLocaleUpperCase('tr-TR');
    const isExcluded = status.includes('İZİN') || status.includes('IZIN') || status.includes('RAPOR') || status.includes('İSTİRAHAT') || status.includes('HASTANE') || status.includes('KURS');
    const isWeeklyOrPublicHoliday = getDayType(dateStr) === DAY_TYPES.HOLIDAY;
    const normStatus = status.replace(/\./g, '');

    // 1. FMİ
    if (normStatus.includes('FMİ') || normStatus.includes('FMI')) {
        attendanceVirtual.push({
            id: `auto-fmi-${pid}-${dateStr}`,
            personId: pid,
            personName: p?.fullName || pid,
            date: dateStr,
            type: TRANSACTION_TYPES.USED,
            hours: 8.0,
            description: 'FMİ İZİNİ (YOKLAMA)',
            status: 'APPROVED',
            isAuto: true,
            isFmi: true
        });
    }

    // 2. Bekleme
    const isStandby = normStatus.includes('BEKLEME') || note.includes('BEKLEME') || loc.includes('BEKLEME');
    const isHolidayStandby = isStandby && (normStatus.includes('RESMİ') || normStatus.includes('RESMI') || normStatus.includes('TATİL') || normStatus.includes('TATIL') || isWeeklyOrPublicHoliday);
    if (isStandby && !isHolidayStandby && !isExcluded) {
        attendanceVirtual.push({
            id: `auto-standby-${pid}-${dateStr}`,
            personId: pid,
            personName: p?.fullName || pid,
            date: dateStr,
            type: TRANSACTION_TYPES.EARNED,
            hours: 24.0,
            description: 'BEKLEME-ANKARA (YOKLAMA)',
            status: 'APPROVED',
            isAuto: true
        });
    }
});

console.log('Virtual attendance created:', attendanceVirtual.length);

const allTxs = [...transactions, ...attendanceVirtual];
console.log('allTxs count:', allTxs.length);

// Filter
const filteredTransactions = allTxs.filter(tx => {
    const date = String(tx.date || '');
    if (!date.startsWith('2026')) return false;

    const pid = cleanPersonnelId(tx.personId);
    const dateLocal = formatDateLocal(tx.date);
    const id = String(tx.id || tx.ID || '').toLowerCase();
    const isAuto = id.startsWith('auto-') || id.includes('auto-') || id.includes('sync');
    
    const desc = String(tx.description || tx.DESCRIPTION || '').toLocaleUpperCase('tr-TR');
    const isPlansiz = tx.isPlansiz === true || tx.IS_PLANSIZ === true || id.startsWith('manual-tx') || desc.includes('PLANSIZ');
    if (isPlansiz) return true;

    // ... other checks
    return true;
});

console.log('filteredTransactions count:', filteredTransactions.length);

// Now execute stats
const map = {
    '67': {
        earned: 0,
        used: 0,
        balance: 0,
        standbyDays: 0,
        standby: 0,
        holidayStandbyDays: 0,
        holidayStandby: 0,
        breakdown: {
            [DAY_TYPES.WEEKDAY]: { day: 0, night: 0 },
            [DAY_TYPES.WEEKEND]: { day: 0, night: 0 },
            [DAY_TYPES.HOLIDAY]: { day: 0, night: 0 }
        },
        notesBreakdown: {}
    }
};

const txDedupMap = new Map();
filteredTransactions.forEach(tx => {
    let pid = cleanPersonnelId(tx.personId);
    if (!pid || !map[pid]) return;

    const txDateStr = String(tx.date || '');
    if (!txDateStr.startsWith('2026')) return;

    const txId = String(tx.id || tx.ID || '');
    const descUpper = String(tx.description || tx.DESCRIPTION || '').toLocaleUpperCase('tr-TR');
    const dateStr = formatDateLocal(tx.date);

    const isPlansiz = tx.isPlansiz === true || tx.IS_PLANSIZ === true || txId.toLowerCase().startsWith('manual-tx') || descUpper.includes('PLANSIZ');
    const hasBeklemeInText = !isPlansiz && (txId.toLowerCase().includes('standby') || descUpper.includes('BEKLEME'));
    const isStandby = !isPlansiz && hasBeklemeInText;

    let cat = 'OTHER';
    if (isStandby) cat = 'STANDBY';
    else if (isPlansiz) cat = 'DUTY';

    const isAuto = txId.toLowerCase().startsWith('auto-') || txId.toLowerCase().includes('sync');
    const key = (isAuto && !isPlansiz) ? `${pid}_${dateStr}_${cat}` : `${pid}_${txId || Math.random()}_${dateStr}_${cat}`;
    
    txDedupMap.set(key, tx);
});

console.log('txDedupMap size:', txDedupMap.size);

const sortedTxs = Array.from(txDedupMap.values());
sortedTxs.forEach(tx => {
    let pid = cleanPersonnelId(tx.personId);
    if (!map[pid]) return;

    const txId = String(tx.id || tx.ID || '');
    const descUpper = String(tx.description || tx.DESCRIPTION || '').toLocaleUpperCase('tr-TR');
    const dateStr = formatDateLocal(tx.date);
    const dayType = getDayType(dateStr) === DAY_TYPES.HOLIDAY ? DAY_TYPES.HOLIDAY : (tx.dayType || getDayType(dateStr));

    const isPlansiz = tx.isPlansiz === true || tx.IS_PLANSIZ === true || txId.toLowerCase().startsWith('manual-tx') || descUpper.includes('PLANSIZ');

    if (isPlansiz) {
        const rawH = parseFloat(tx.hours !== undefined ? tx.hours : (tx.HOURS || 0));
        const dayStats = map[pid].breakdown[dayType] || { day: 0, night: 0 };
        if (String(tx.shift).toUpperCase().includes('GECE')) dayStats.night += rawH;
        else dayStats.day += rawH;
        map[pid].breakdown[dayType] = dayStats;
    }
});

console.log('FINAL STATS BREAKDOWN:', JSON.stringify(map['67'].breakdown, null, 2));
const wkday = map['67'].breakdown[DAY_TYPES.WEEKDAY].day + map['67'].breakdown[DAY_TYPES.WEEKDAY].night;
const wkend = map['67'].breakdown[DAY_TYPES.WEEKEND].day + map['67'].breakdown[DAY_TYPES.WEEKEND].night;
console.log('Calculated Weekday:', wkday, 'Weekend:', wkend, 'Total:', wkday + wkend);
