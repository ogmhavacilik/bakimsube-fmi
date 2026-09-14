const fs = require('fs');

const liveData = JSON.parse(fs.readFileSync('live_init_data.json', 'utf8'));

// Run exactly index.html normalization
function normalizeDate(d) {
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

const getVal = (obj, keys) => {
    const normalizeKey = (k) => String(k || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const objKeys = Object.keys(obj);
    const normalizedObjEntries = objKeys.map(ok => ({ original: ok, normalized: normalizeKey(ok) }));
    
    for (const k of keys) {
        const normalizedTarget = normalizeKey(k);
        const match = normalizedObjEntries.find(e => e.normalized === normalizedTarget);
        if (match) {
            const val = String(obj[match.original] || '').trim();
            if (val && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') return val;
        }
    }
    return '';
};

// 1. Format personnel
let formattedPL = (liveData.personnel || []).map(p => ({
    id: cleanPersonnelId(getVal(p, ['ID', 'PID', 'PERSON_ID'])),
    fullName: getVal(p, ['FULL_NAME', 'FULLNAME', 'NAME', 'KISI_ADI']),
    title: getVal(p, ['TITLE', 'UNVAN', 'GOREV', 'POZISYON']),
    unit: getVal(p, ['UNIT', 'BIRIM', 'SUBE']),
}));

let rObj = formattedPL.find(p => p.id === '67' || p.fullName.includes('RIDVAN'));
if (!rObj) {
    rObj = { id: '67', fullName: 'RIDVAN ŞATIR', title: 'DESTEK ŞÖFÖR', unit: 'DESTEK' };
    formattedPL.push(rObj);
}

// 2. Format transactions
const formattedTX = liveData.transactions.map(tx => {
    return {
        ...tx,
        id: getVal(tx, ['ID']),
        personId: cleanPersonnelId(getVal(tx, ['PID', 'PERSON_ID', 'PERSONID']) || ''),
        personName: getVal(tx, ['PERSON_NAME', 'PERSONNAME', 'KISI_ADI', 'NAME']),
        date: normalizeDate(getVal(tx, ['DATE_L', 'DATE_REF', 'DATE', 'TARIH'])),
        hours: parseFloat(String(getVal(tx, ['HOURS', 'SURE']) || 0).replace(',', '.')),
        days: parseInt(String(getVal(tx, ['DAYS', 'GUN']) || 1)),
        description: getVal(tx, ['DESCRIPTION', 'ACIKLAMA']),
        shift: getVal(tx, ['SHIFT', 'VARDIYA']),
        dayType: getVal(tx, ['DAY_TYPE', 'DAYTYPE']),
        type: (() => {
            const t = String(getVal(tx, ['TYPE', 'TIP']) || '').toUpperCase();
            if (t.includes('EARN') || t.includes('KAZAN') || t.includes('FMİ') || t.includes('MESAİ')) return 'EARNED';
            if (t.includes('USE') || t.includes('KULLAN') || t.includes('İZİN')) return 'USED';
            return t;
        })(),
        status: 'APPROVED'
    };
}).filter(tx => tx.personId && tx.date);

// 3. Format attendance
const formattedAttendance = liveData.attendance.map(a => {
    return {
        personId: cleanPersonnelId(getVal(a, ['PERSON_ID', 'PID']) || ''),
        date: normalizeDate(getVal(a, ['DATE_L', 'DATE_REF', 'DATE', 'TARIH'])),
        status: getVal(a, ['STATUS', 'DURUM']) || 'Mevcut',
        location: getVal(a, ['DUTY_LOCATION', 'LOCATION']),
        note: getVal(a, ['NOTE', 'ACIKLAMA']),
        leaveType: getVal(a, ['LEAVE_TYPE', 'IZIN_TIPI']),
        isPlanned: String(getVal(a, ['DUTY_TYPE']) || '').toLocaleUpperCase('tr-TR').includes('PLANLI')
    };
}).filter(a => a.personId && a.date);

console.log('Formatted transactions for Ridvan:', formattedTX.filter(t => t.personId === '67').length);
console.log('Formatted attendance for Ridvan:', formattedAttendance.filter(a => a.personId === '67').length);

// Let's inspect attendance for Ridvan:
const ridvanAtt = formattedAttendance.filter(a => a.personId === '67' && a.date.startsWith('2026'));
console.log('2026 Ridvan attendance count:', ridvanAtt.length);

const fmiAtt = ridvanAtt.filter(a => {
    const st = a.status.toLocaleUpperCase('tr-TR');
    const lt = a.leaveType.toLocaleUpperCase('tr-TR');
    const nt = a.note.toLocaleUpperCase('tr-TR');
    return st.includes('FMİ') || st.includes('FMI') || lt.includes('FMİ') || lt.includes('FMI') || nt.includes('FMİ') || nt.includes('FMI');
});
console.log('FMI attendance records count:', fmiAtt.length);
fmiAtt.forEach(a => console.log('  FMI date:', a.date, a.status, a.leaveType));

const beklemeAtt = ridvanAtt.filter(a => {
    const st = a.status.toLocaleUpperCase('tr-TR');
    const lt = a.leaveType.toLocaleUpperCase('tr-TR');
    const nt = a.note.toLocaleUpperCase('tr-TR');
    const lc = a.location.toLocaleUpperCase('tr-TR');
    return st.includes('BEKLEME') || nt.includes('BEKLEME') || lc.includes('BEKLEME');
});
console.log('BEKLEME attendance records count:', beklemeAtt.length);
