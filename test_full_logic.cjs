const fs = require('fs');

const liveData = JSON.parse(fs.readFileSync('live_init_data.json', 'utf8'));

// Also load ridvan_live_sheet if needed to ensure 24 txs
const ridvanTxs = JSON.parse(fs.readFileSync('ridvan_live_sheet.json', 'utf8'));

console.log('Testing full logic update...');

function formatDateLocal(d) {
    if (!d) return '';
    if (typeof d === 'string') {
        const p = d.split(' ')[0].split('T')[0];
        if (p.includes('.')) {
            const parts = p.split('.');
            if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return p;
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

const checkIsDriverOnly = (p) => {
    if (!p) return false;
    const pTitle = String(p.title || p.TITLE || p.duty || p.DUTY || '').toLocaleUpperCase('tr-TR');
    const pUnit = String(p.unit || p.UNIT || '').toLocaleUpperCase('tr-TR');
    const pName = String(p.fullName || p.PERSONNAME || p.personName || p.name || '').toLocaleUpperCase('tr-TR');
    const pid = cleanPersonnelId(p.id || p.PID || p.PERSON_ID || p.PERSONID);
    const isNamedOrId = pid === '67' || pName.includes('RIDVAN') || pName.includes('ŞATIR') || pName.includes('SATIR');
    return isNamedOrId || ['ŞÖFÖR', 'ŞOFÖR', 'SOFOR', 'SÜRÜCÜ', 'SURUCU', 'DESTEK'].some(k => pTitle.includes(k) || pUnit.includes(k));
};

const checkIsYerDestek = (p) => {
    return checkIsDriverOnly(p);
};

const checkIsDriver = (p) => {
    return checkIsDriverOnly(p) || checkIsYerDestek(p);
};

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

function checkIsWeekend(dateStr) {
    if (!dateStr) return false;
    const normalized = formatDateLocal(dateStr);
    const [y, m, d] = normalized.split('-');
    const dt = new Date(y, m - 1, d);
    return dt.getDay() === 0 || dt.getDay() === 6;
}

// Ensure Rıdvan Şatır is in personnel
let pList = liveData.personnel || [];
let rPerson = pList.find(p => cleanPersonnelId(p.id || p.PID) === '67');
if (!rPerson) {
    rPerson = { id: '67', fullName: 'RIDVAN ŞATIR', title: 'DESTEK ŞÖFÖR', unit: 'DESTEK' };
    pList.push(rPerson);
}

// Check attendance for Rıdvan in 2026
const att2026 = (liveData.attendance || []).filter(a => {
    const pid = cleanPersonnelId(a.PERSON_ID || a.personId);
    const date = formatDateLocal(a.DATE || a.date);
    return pid === '67' && date.startsWith('2026');
});

console.log('Att 2026 for Ridvan:', att2026.length);

// 1. FMİ
const fmiDays = att2026.filter(a => {
    const st = String(a.STATUS || a.status || '').toLocaleUpperCase('tr-TR');
    const lt = String(a.LEAVE_TYPE || a.leaveType || '').toLocaleUpperCase('tr-TR').replace(/\./g, '');
    const nt = String(a.NOTE || a.note || '').toLocaleUpperCase('tr-TR');
    return (st.includes('İZİN') && lt.includes('FMI')) || st.includes('FMI') || st.includes('FMİ') || lt.includes('FMİ') || nt.includes('FMİ') || nt.includes('FMI');
});
console.log('FMİ days count:', fmiDays.length, 'Total FMİ hours:', fmiDays.length * 8);

// 2. Bekleme
const beklemeDays = att2026.filter(a => {
    const st = String(a.STATUS || a.status || '').toLocaleUpperCase('tr-TR');
    const nt = String(a.NOTE || a.note || '').toLocaleUpperCase('tr-TR');
    const lc = String(a.DUTY_LOCATION || a.location || '').toLocaleUpperCase('tr-TR');
    const isEx = st.includes('İZİN') || st.includes('IZIN') || st.includes('RAPOR') || st.includes('İSTİRAHAT') || st.includes('HASTANE');
    return (st.includes('BEKLEME') || nt.includes('BEKLEME') || lc.includes('BEKLEME')) && !isEx;
});

let beklemeHours = 0;
let beklemeWk = 0;
let beklemeWd = 0;
beklemeDays.forEach(a => {
    const d = formatDateLocal(a.DATE || a.date);
    const isWk = checkIsWeekend(d);
    const isHolid = getDayType(d) === DAY_TYPES.HOLIDAY;
    const isDriver = checkIsDriverOnly(rPerson);
    if (isWk || isHolid) {
        beklemeWk++;
        beklemeHours += (isDriver ? 10 : 2);
    } else {
        beklemeWd++;
        beklemeHours += 1;
    }
});
console.log('Bekleme days count:', beklemeDays.length, 'Wk days:', beklemeWk, 'Wd days:', beklemeWd, 'Total Bekleme hours:', beklemeHours);

// 3. Plansız Mesai from ridvanTxs
let plansizHours = 0;
let plansizWk = 0;
let plansizWd = 0;
ridvanTxs.forEach(t => {
    const d = formatDateLocal(t.DATE || t.date);
    const isWk = checkIsWeekend(d);
    const h = parseFloat(t.HOURS || t.hours || 0);
    plansizHours += h;
    if (isWk) plansizWk += h;
    else plansizWd += h;
});
console.log('Plansiz tx count:', ridvanTxs.length, 'Wk:', plansizWk.toFixed(1), 'Wd:', plansizWd.toFixed(1), 'Total Plansiz:', plansizHours.toFixed(1));

console.log('TOTAL EARNED (Plansiz + Bekleme):', (plansizHours + beklemeHours).toFixed(1));
console.log('TOTAL USED (FMİ):', fmiDays.length * 8);
console.log('NET BALANCE:', (plansizHours + beklemeHours - fmiDays.length * 8).toFixed(1));
