import React, { useState } from 'react';
import { CalculatedSummary, OgmPersonnel } from '../types/ogm';
import { Users, Clock, CalendarCheck, Award, Search, FileSpreadsheet, Printer, ArrowUpRight } from 'lucide-react';

interface DashboardSummaryProps {
  summaries: CalculatedSummary[];
  personnelList: OgmPersonnel[];
  onExportExcel: () => void;
  onPrint: () => void;
  onNavigateCalendar: (personId?: string) => void;
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({
  summaries,
  personnelList,
  onExportExcel,
  onPrint,
  onNavigateCalendar,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const totalPersonnelCount = personnelList.length;
  const grandTotalHours = summaries.reduce((acc, curr) => acc + curr.totalHours, 0);
  const totalPhase1Hours = summaries.reduce((acc, curr) => acc + curr.phase1Hours, 0);
  const totalPhase2Hours = summaries.reduce((acc, curr) => acc + curr.phase2Hours, 0);
  const totalDutyDays = summaries.reduce((acc, curr) => acc + curr.totalDaysOnDuty, 0);

  const filteredSummaries = summaries.filter(s =>
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.unit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">1. Oturum Personel</p>
            <h4 className="text-2xl font-bold text-slate-900 mt-0.5">{totalPersonnelCount} <span className="text-sm font-normal text-slate-500">Kişi</span></h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-teal-100 text-teal-800 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Toplam Mesai Saati</p>
            <h4 className="text-2xl font-bold text-emerald-700 mt-0.5">{grandTotalHours} <span className="text-sm font-normal text-slate-500">Saat</span></h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Toplam Görev Günü</p>
            <h4 className="text-2xl font-bold text-slate-900 mt-0.5">{totalDutyDays} <span className="text-sm font-normal text-slate-500">Gün</span></h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-800 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Dönem Dağılımı</p>
            <div className="text-xs font-semibold text-slate-700 mt-1 flex space-x-2">
              <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">1.Dönem: {totalPhase1H_format(totalPhase1Hours)}s</span>
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">2.Dönem: {totalPhase2Hours}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Personel Bazlı 2026 Mesai Özeti</h3>
            <p className="text-sm text-slate-500">OGM 1. oturum personeli için kurallara göre otomatik hesaplanan toplam mesai süreleri</p>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Personel veya unvan ara..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onExportExcel}
                className="p-2 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-300 transition-colors"
                title="Excel İndir"
              >
                <FileSpreadsheet className="w-5 h-5" />
              </button>
              <button
                onClick={onPrint}
                className="p-2 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-300 transition-colors"
                title="Yazdır"
              >
                <Printer className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Personel Adı</th>
                <th className="py-3.5 px-4">Unvan / Birim</th>
                <th className="py-3.5 px-4 text-center">1. Dönem (18 Eyl - 21 Eki)<br/><span className="text-[10px] font-normal text-slate-500">(İçi: 1s, Sonu: 10s)</span></th>
                <th className="py-3.5 px-4 text-center">2. Dönem (22 Eki Sonrası)<br/><span className="text-[10px] font-normal text-slate-500">(İçi: 0s, Sonu: 8s)</span></th>
                <th className="py-3.5 px-4 text-center">Toplam Görev Günü</th>
                <th className="py-3.5 px-4 text-center">Toplam Mesai Saati</th>
                <th className="py-3.5 px-4 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    Kayıt bulunamadı. Lütfen arama kriterini değiştirin veya personel ekleyin.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((s, idx) => (
                  <tr key={s.personId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-500">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{s.fullName}</td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 font-medium">{s.title}</div>
                      <div className="text-xs text-slate-500">{s.unit}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="bg-emerald-50 text-emerald-800 font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                        {s.phase1Hours} saat
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5">{s.phase1Days} gün</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="bg-slate-100 text-slate-800 font-semibold px-2.5 py-1 rounded-full border border-slate-200">
                        {s.phase2Hours} saat
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5">{s.phase2Days} gün</div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium text-slate-800">
                      {s.totalDaysOnDuty} gün
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm">
                        {s.totalHours} Saat
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => onNavigateCalendar(s.personId)}
                        className="inline-flex items-center space-x-1 text-emerald-700 hover:text-emerald-900 font-medium text-xs bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
                      >
                        <span>Görevleri Gör</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function totalPhase1H_format(val: number) {
  return val;
}
