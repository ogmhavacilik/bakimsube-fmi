export interface OgmPersonnel {
  id: string;
  fullName: string;
  title: string; // Pilot, Teknisyen, Koordinatör, vb.
  tcNo?: string;
  session: '1. Oturum' | '2. Oturum' | 'Genel';
  unit: string;
}

export interface DutyRecord {
  id: string;
  personId: string;
  date: string; // YYYY-MM-DD
  isOnDuty: boolean;
  note?: string;
}

export interface CalculatedSummary {
  personId: string;
  fullName: string;
  title: string;
  unit: string;
  phase1Hours: number; // 18 Eylül - 21 Ekim
  phase2Hours: number; // 22 Ekim sonrası
  totalHours: number;
  totalDaysOnDuty: number;
  phase1Days: number;
  phase2Days: number;
}
