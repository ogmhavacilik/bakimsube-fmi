import { OgmPersonnel, DutyRecord, CalculatedSummary } from '../types/ogm';

export interface OvertimeCalculationResult {
  hours: number;
  phase: 'phase1' | 'phase2' | 'none';
  isWeekend: boolean;
}

export function calculateDailyOvertime(dateStr: string, isOnDuty: boolean): OvertimeCalculationResult {
  if (!isOnDuty) {
    return { hours: 0, phase: 'none', isWeekend: false };
  }

  const date = new Date(dateStr);
  const year = date.getFullYear();
  const dayOfWeek = date.getDay(); // 0 = Pazar, 6 = Cumartesi
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // 2026 yılı dışı veya 18 Eylül öncesi 2026 için standart 3-11 kuralı (Hafta içi 3, Hafta sonu 11)
  if (year !== 2026) {
    const hours = isWeekend ? 11 : 3;
    return { hours, phase: 'none', isWeekend };
  }

  const timeVal = date.getTime();
  const startPhase1 = new Date('2026-09-18T00:00:00').getTime();
  const endPhase1 = new Date('2026-10-21T23:59:59').getTime();
  const startPhase2 = new Date('2026-10-22T00:00:00').getTime();
  const endYear = new Date('2026-12-31T23:59:59').getTime();

  if (timeVal >= startPhase1 && timeVal <= endPhase1) {
    // 18 Eylül - 21 Ekim arası: Hafta içi 1s, Hafta sonu 10s
    const hours = isWeekend ? 10 : 1;
    return { hours, phase: 'phase1', isWeekend };
  } else if (timeVal >= startPhase2 && timeVal <= endYear) {
    // 21 Ekim sonrası (22 Ekim ve sonrası): Hafta içi 0s, Hafta sonu 8s
    const hours = isWeekend ? 8 : 0;
    return { hours, phase: 'phase2', isWeekend };
  } else {
    // 18 Eylül öncesi 2026: Standart 3-11 kuralı (Hafta içi 3, Hafta sonu 11)
    const hours = isWeekend ? 11 : 3;
    return { hours, phase: 'none', isWeekend };
  }
}

export function calculatePersonnelSummaries(
  personnelList: OgmPersonnel[],
  dutyRecords: DutyRecord[]
): CalculatedSummary[] {
  // Map records by personId and date
  const recordMap = new Map<string, boolean>();
  dutyRecords.forEach(r => {
    if (r.isOnDuty) {
      recordMap.set(`${r.personId}_${r.date}`, true);
    }
  });

  return personnelList.map(person => {
    let phase1Hours = 0;
    let phase2Hours = 0;
    let phase1Days = 0;
    let phase2Days = 0;

    // Tüm 2026 yılı için günleri tarayalım
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-12-31');

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const key = `${person.id}_${dateStr}`;
      const isOnDuty = recordMap.has(key);

      if (isOnDuty) {
        const calc = calculateDailyOvertime(dateStr, true);
        if (calc.phase === 'phase1') {
          phase1Hours += calc.hours;
          phase1Days += 1;
        } else if (calc.phase === 'phase2') {
          phase2Hours += calc.hours;
          phase2Days += 1;
        } else {
          // Önceki dönem (3-11 kuralı)
          phase1Hours += calc.hours; // veya genel toplama dahil edilebilir
          phase1Days += 1;
        }
      }
    }

    return {
      personId: person.id,
      fullName: person.fullName,
      title: person.title,
      unit: person.unit,
      phase1Hours,
      phase2Hours,
      totalHours: phase1Hours + phase2Hours,
      totalDaysOnDuty: phase1Days + phase2Days,
      phase1Days,
      phase2Days,
    };
  });
}

export const INITIAL_PERSONNEL: OgmPersonnel[] = [
  { id: '1', fullName: 'Ahmet Yılmaz', title: 'Kaptan Pilot', session: '1. Oturum', unit: 'Havacılık Şubesi' },
  { id: '2', fullName: 'Mehmet Demir', title: 'İkinci Pilot', session: '1. Oturum', unit: 'Havacılık Şubesi' },
  { id: '3', fullName: 'Mustafa Kaya', title: 'Uçak Bakım Teknisyeni', session: '1. Oturum', unit: 'Bakım Şubesi' },
  { id: '4', fullName: 'Ali Çelik', title: 'Uçuş Koordinatörü', session: '1. Oturum', unit: 'Operasyon' },
  { id: '5', fullName: 'Hüseyin Şahin', title: 'Yangın Gözetleme Sorumlusu', session: '1. Oturum', unit: 'Orman Yangınları Mücadele' },
  { id: '6', fullName: 'Fatma Yıldız', title: 'Teknisyen', session: '1. Oturum', unit: 'Bakım Şubesi' },
];

export function generateDefaultDutyRecords(personnelIds: string[]): DutyRecord[] {
  const records: DutyRecord[] = [];
  const startDate = new Date('2026-09-18');
  const endDate = new Date('2026-11-03');

  let idCounter = 1;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    personnelIds.forEach(pId => {
      records.push({
        id: `rec_${idCounter++}`,
        personId: pId,
        date: dateStr,
        isOnDuty: true,
        note: isWeekend ? 'Hafta Sonu Nöbeti' : 'Normal Mesai'
      });
    });
  }

  return records;
}
