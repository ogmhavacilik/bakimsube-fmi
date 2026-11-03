import React, { useState } from 'react';
import { OgmPersonnel, DutyRecord } from '../types/ogm';
import { calculateDailyOvertime } from '../utils/calculator';
import { Calendar, Filter, Sparkles, ChevronLeft, ChevronRight, Wand2, X, Check } from 'lucide-react';

interface DutyCalendarMatrixProps {
  personnelList: OgmPersonnel[];
  dutyRecords: DutyRecord[];
  onToggleDuty: (personId: string, dateStr: string, isOnDuty: boolean) => void;
  onBulkDutySet: (dateStr: string, isOnDuty: boolean) => void;
  onAutoPlanDuties: (startDate: string, endDate: string, mode: 'all' | 'weekdays' | 'weekends') => void;
  selectedPersonIdFilter?: string;
}

export const DutyCalendarMatrix: React.FC<DutyCalendarMatrixProps> = ({
  personnelList,
  dutyRecords,
  onToggleDuty,
  onBulkDutySet,
  onAutoPlanDuties,
  selectedPersonIdFilter,
}) => {
  // Default to September 2026 or October 2026 or November 2026
  const [selectedMonth, setSelectedMonth] = useState('2026-09'); // YYYY-MM
  const [personFilter, setPersonFilter] = useState(selectedPersonIdFilter || 'all');
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);

  // Auto plan modal state
  const [autoStartDate, setAutoStartDate] = useState('2026-09-18');
  const [autoEndDate, setAutoEndDate] = useState('2026-11-03');
  const [autoMode, setAutoMode] = useState<'all' | 'weekdays' | 'weekends'>('all');

  // Generate days of the selected month
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr);
  const monthIndex = parseInt(monthStr) - 1;

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const monthDays: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    monthDays.push(`${yearStr}-${monthStr}-${dayStr}`);
  }

  // Quick record lookup set
  const dutySet = new Set<string>();
  dutyRecords.forEach(r => {
    if (r.isOnDuty) {
      dutySet.add(`${r.personId}_${r.date}`);
    }
  });

  const filteredPersonnel = personFilter === 'all'
    ? personnelList
    : personnelList.filter(p => p.id === personFilter);

  const handlePrevMonth = () => {
    const d = new Date(year, monthIndex - 1, 1);
    if (d.getFullYear() === 2026) {
      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  };

  const handleNextMonth = () => {
    const d = new Date(year, monthIndex + 1, 1);
    if (d.getFullYear() === 2026 && d.getMonth() <= 11) {
      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  };

  const handleRunAutoPlan = (e: React.FormEvent) => {
    e.preventDefault();
    onAutoPlanDuties(autoStartDate, autoEndDate, autoMode);
    setIsAutoModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Günlük Görev & Mesai Matrisi (Yoklama)</h3>
              <p className="text-sm text-slate-500">Personelin günlük görev durumunu yönetin veya otomatik planlı görev uygulayın</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Auto Plan Button */}
            <button
              onClick={() => setIsAutoModalOpen(true)}
              className="flex items-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium px-4 py-2 rounded-xl text-sm shadow-sm transition-all"
            >
              <Wand2 className="w-4 h-4 text-emerald-200" />
              <span>Otomatik Planlı Görev (Yoklama) Uygula</span>
            </button>

            {/* Month Selector */}
            <div className="flex items-center space-x-1 bg-slate-50 border border-slate-300 rounded-lg p-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
                title="Önceki Ay"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-800 px-2 focus:outline-none"
              >
                <option value="2026-08">Ağustos 2026</option>
                <option value="2026-09">Eylül 2026 (18 Eyl Başlangıç)</option>
                <option value="2026-10">Ekim 2026 (21 Eki Geçişi)</option>
                <option value="2026-11">Kasım 2026</option>
                <option value="2026-12">Aralık 2026</option>
              </select>
              <button
                onClick={handleNextMonth}
                className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
                title="Sonraki Ay"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Personnel Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={personFilter}
                onChange={e => setPersonFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="all">Tüm Personeller</option>
                {personnelList.map(p => (
                  <option key={p.id} value={p.id}>{p.fullName} ({p.title})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Info banner about rule state */}
        <div className="bg-emerald-50/60 border-b border-emerald-100 px-5 py-3 flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Kural Özeti:</strong> 18 Eylül - 21 Ekim arası Hafta İçi: 1s, Hafta Sonu: 10s | 22 Ekim sonrası Hafta İçi: 0s, Hafta Sonu: 8s. (2026)
            </span>
          </div>
          <span className="hidden sm:inline font-medium bg-white px-2 py-1 rounded border border-emerald-200">
            {monthDays.length} Günlük Matris Görünümü
          </span>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left border-collapse sticky-table">
            <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-3 px-4 min-w-[200px] bg-slate-50 sticky left-0 z-20 border-r border-slate-200">
                  Personel
                </th>
                {monthDays.map(dateStr => {
                  const d = new Date(dateStr);
                  const dayNum = d.getDate();
                  const dayOfWeek = d.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const dayName = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][dayOfWeek];

                  return (
                    <th key={dateStr} className={`py-3 px-2 text-center min-w-[50px] border-r border-slate-200 ${isWeekend ? 'bg-amber-50/80 text-amber-900' : ''}`}>
                      <div className="text-[10px] text-slate-500">{dayName}</div>
                      <div className="font-bold text-sm">{dayNum}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredPersonnel.length === 0 ? (
                <tr>
                  <td colSpan={monthDays.length + 1} className="text-center py-8 text-slate-500">
                    Personel bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredPersonnel.map(person => (
                  <tr key={person.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 bg-white sticky left-0 z-10 border-r border-slate-200 shadow-sm">
                      <div className="text-sm">{person.fullName}</div>
                      <div className="text-[11px] text-slate-500 font-normal">{person.title}</div>
                    </td>

                    {monthDays.map(dateStr => {
                      const key = `${person.id}_${dateStr}`;
                      const isOnDuty = dutySet.has(key);
                      const calc = calculateDailyOvertime(dateStr, isOnDuty);
                      const d = new Date(dateStr);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                      return (
                        <td
                          key={dateStr}
                          className={`py-2 px-1 text-center border-r border-slate-100 cursor-pointer select-none transition-all ${
                            isOnDuty
                              ? 'bg-emerald-50 hover:bg-emerald-100'
                              : isWeekend
                              ? 'bg-amber-50/30 hover:bg-amber-50'
                              : 'hover:bg-slate-100'
                          }`}
                          onClick={() => onToggleDuty(person.id, dateStr, !isOnDuty)}
                          title={`${dateStr} - ${person.fullName}: ${isOnDuty ? 'Görevde (' + calc.hours + ' saat)' : 'Görevde Değil'}`}
                        >
                          {isOnDuty ? (
                            <div className="flex flex-col items-center justify-center">
                              <span className="w-6 h-6 rounded bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                {calc.hours}
                              </span>
                              <span className="text-[9px] text-emerald-800 font-semibold mt-0.5">G</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-300 hover:text-slate-500">
                              <span className="w-5 h-5 rounded border border-dashed border-slate-300 flex items-center justify-center text-[10px]">
                                -
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <span className="w-4 h-4 rounded bg-emerald-600 inline-block"></span>
              <span>Hücreye tıklayarak görev durumunu (Görevde / Değil) değiştirebilirsiniz.</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">Sarı Sütunlar: Hafta Sonu</span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Yeşil Hücreler: Görevli Saatler</span>
          </div>
        </div>
      </div>

      {/* Auto Plan Modal */}
      {isAutoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wand2 className="w-5 h-5 text-emerald-300" />
                <h4 className="font-bold text-lg">Otomatik Planlı Görev (Yoklama) Oluştur</h4>
              </div>
              <button
                onClick={() => setIsAutoModalOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRunAutoPlan} className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Seçilen tarih aralığında OGM 2026 kurallarına göre tüm personeller için otomatik planlı görev (yoklama) kayıtları oluşturulacaktır.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Başlangıç Tarihi</label>
                  <input
                    type="date"
                    required
                    value={autoStartDate}
                    onChange={e => setAutoStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bitiş Tarihi</label>
                  <input
                    type="date"
                    required
                    value={autoEndDate}
                    onChange={e => setAutoEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Uygulama Modu</label>
                <select
                  value={autoMode}
                  onChange={e => setAutoMode(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="all">Tüm Günler (Hafta İçi & Hafta Sonu)</option>
                  <option value="weekends">Sadece Hafta Sonu (Cmt - Paz)</option>
                  <option value="weekdays">Sadece Hafta İçi (Pzt - Cuma)</option>
                </select>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 space-y-1">
                <p className="font-bold">Uygulanacak Kurallar:</p>
                <p>&bull; 18 Eylül - 21 Ekim arası: Hafta içi 1s, Hafta sonu 10s</p>
                <p>&bull; 21 Ekim sonrası: Hafta içi 0s, Hafta sonu 8s</p>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAutoModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-sm rounded-lg shadow-sm transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Otomatik Planı Uygula</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
