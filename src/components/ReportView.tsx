import React from 'react';
import { CalculatedSummary, OgmPersonnel } from '../types/ogm';
import { Shield, Printer, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

interface ReportViewProps {
  summaries: CalculatedSummary[];
  personnelList: OgmPersonnel[];
  onExportExcel: () => void;
  onPrint: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  summaries,
  onExportExcel,
  onPrint,
}) => {
  const currentDateStr = new Date().toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const grandTotalHours = summaries.reduce((acc, curr) => acc + curr.totalHours, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-end space-x-3 print:hidden">
        <button
          onClick={onExportExcel}
          className="flex items-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Excel İndir</span>
        </button>
        <button
          onClick={onPrint}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm"
        >
          <Printer className="w-4 h-4" />
          <span>Resmi Raporu Yazdır</span>
        </button>
      </div>

      {/* Printable Official Document Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12 print:shadow-none print:border-none print:p-0">
        {/* Header */}
        <div className="text-center border-b-2 border-slate-800 pb-6 mb-8">
          <div className="flex items-center justify-center space-x-3 mb-2">
            <Shield className="w-10 h-10 text-emerald-800" />
            <div>
              <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">T.C. TARIM VE ORMAN BAKANLIĞI</h2>
              <h3 className="text-lg font-bold text-emerald-900">Orman Genel Müdürlüğü</h3>
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-700 mt-2">
            2026 YILI 1. OTURUM PERSONELİ MESAİ VE GÖREV TAHAKKUK CETVELİ
          </p>
          <p className="text-xs text-slate-500 mt-1">Rapor Düzenleme Tarihi: {currentDateStr}</p>
        </div>

        {/* Info */}
        <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-700 flex justify-between items-center">
          <div>
            <span className="font-semibold text-slate-900">Kapsam:</span> OGM 1. Oturum Personeli (18 Eylül - 21 Ekim ve 22 Ekim Sonrası Kuralları)
          </div>
          <div>
            <span className="font-semibold text-slate-900">Toplam Personel:</span> {summaries.length} Kişi
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-left border-collapse border border-slate-300 text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
              <th className="py-3 px-3 border-r border-slate-300 text-center w-12">S.No</th>
              <th className="py-3 px-3 border-r border-slate-300">Personel Adı Soyadı</th>
              <th className="py-3 px-3 border-r border-slate-300">Unvanı</th>
              <th className="py-3 px-3 border-r border-slate-300">Birim / Şube</th>
              <th className="py-3 px-3 border-r border-slate-300 text-center">1. Dönem Saat<br/><span className="text-[10px] font-normal">(18 Eyl - 21 Eki)</span></th>
              <th className="py-3 px-3 border-r border-slate-300 text-center">2. Dönem Saat<br/><span className="text-[10px] font-normal">(22 Eki Sonrası)</span></th>
              <th className="py-3 px-3 text-center">Toplam Mesai Saati</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {summaries.map((s, idx) => (
              <tr key={s.personId} className="hover:bg-slate-50">
                <td className="py-2.5 px-3 border-r border-slate-300 text-center font-medium">{idx + 1}</td>
                <td className="py-2.5 px-3 border-r border-slate-300 font-bold text-slate-900">{s.fullName}</td>
                <td className="py-2.5 px-3 border-r border-slate-300 text-slate-800">{s.title}</td>
                <td className="py-2.5 px-3 border-r border-slate-300 text-slate-600">{s.unit}</td>
                <td className="py-2.5 px-3 border-r border-slate-300 text-center font-medium">{s.phase1Hours} saat</td>
                <td className="py-2.5 px-3 border-r border-slate-300 text-center font-medium">{s.phase2Hours} saat</td>
                <td className="py-2.5 px-3 text-center font-bold text-emerald-800 bg-emerald-50/50">{s.totalHours} Saat</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-800">
              <td colSpan={6} className="py-3 px-4 text-right border-r border-slate-300">GENEL TOPLAM MESAİ SAATİ:</td>
              <td className="py-3 px-4 text-center text-emerald-900 text-base">{grandTotalHours} Saat</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures */}
        <div className="mt-16 grid grid-cols-3 gap-8 text-center text-xs sm:text-sm pt-8">
          <div>
            <p className="font-bold text-slate-900">Düzenleyen</p>
            <p className="text-slate-600 mt-1">İdari İşler / Şube Personeli</p>
            <div className="mt-12 border-b border-slate-400 w-3/4 mx-auto"></div>
            <p className="mt-1 text-slate-500">İmza</p>
          </div>
          <div>
            <p className="font-bold text-slate-900">Kontrol Eden</p>
            <p className="text-slate-600 mt-1">Bakım / Operasyon Şefi</p>
            <div className="mt-12 border-b border-slate-400 w-3/4 mx-auto"></div>
            <p className="mt-1 text-slate-500">İmza</p>
          </div>
          <div>
            <p className="font-bold text-slate-900">Tasdik Olunur</p>
            <p className="text-slate-600 mt-1">Şube Müdürü / Yetkili Makam</p>
            <div className="mt-12 border-b border-slate-400 w-3/4 mx-auto"></div>
            <p className="mt-1 text-slate-500">İmza / Mühür</p>
          </div>
        </div>
      </div>
    </div>
  );
};
