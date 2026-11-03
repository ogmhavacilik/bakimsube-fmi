import * as XLSX from 'xlsx';
import { CalculatedSummary, OgmPersonnel } from '../types/ogm';

export function exportToExcel(summaries: CalculatedSummary[], personnel: OgmPersonnel[]) {
  const warningText = "2026 YILI KURAL BİLGİSİ: 18 Eylül 2026 öncesi standart 3-11 kuralı (Hafta içi 3 saat, Hafta sonu 11 saat) uygulanır; 18 Eylül - 21 Ekim 2026 arası Hafta içi 1 saat / Hafta sonu 10 saat ve 21 Ekim sonrası Hafta içi 0 saat / Hafta sonu 8 saat kuralları geçerlidir.";

  const headers = [
    'Sıra', 'Personel Adı', 'Unvanı', 'Birim', 
    '1. Dönem Gün Sayısı (18 Eyl - 21 Eki)', '1. Dönem Toplam Saat', 
    '2. Dönem Gün Sayısı (22 Eki Sonrası)', '2. Dönem Toplam Saat', 
    'Toplam Çalışılan Gün', 'Toplam Mesai Saati'
  ];

  const rows = summaries.map((s, index) => [
    index + 1,
    s.fullName,
    s.title,
    s.unit,
    s.phase1Days,
    s.phase1Hours,
    s.phase2Days,
    s.phase2Hours,
    s.totalDaysOnDuty,
    s.totalHours
  ]);

  const aoa = [
    [warningText],
    [],
    headers,
    ...rows
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'OGM 2026 Mesai Özeti');

  // Set column widths
  const colWidths = [
    { wch: 6 },
    { wch: 22 },
    { wch: 22 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, 'OGM_2026_1_Oturum_Mesai_Raporu.xlsx');
}

export function printReport() {
  window.print();
}
