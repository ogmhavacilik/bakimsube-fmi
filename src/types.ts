export interface Personnel {
  id: string;
  fullName: string;
  title?: string;
  unit?: string;
  photoUrl?: string;
}

export interface AttendanceRecord {
  id?: string;
  personId: string;
  date: string;
  status: string;
  location?: string;
  note?: string;
}

export interface OvertimeTransaction {
  id: string;
  personId: string;
  type: 'EARNED' | 'USED';
  date: string;
  hours?: number;
  days?: number;
  status?: string;
  description?: string;
}
