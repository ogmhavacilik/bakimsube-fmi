import React from 'react';
import { Info, Calendar, Clock, AlertCircle } from 'lucide-react';

export const RuleExplanationCard: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 shadow-sm mb-6">
      <div className="flex items-start space-x-4">
        <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md">
          <Info className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-emerald-900">
              OGM 1. Oturum 2026 Yılı Mesai Hesaplama Esasları
            </h3>
            <span className="bg-emerald-200 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full">
              Sadece 2026 Yılı Geçerli
            </span>
          </div>
          <p className="text-sm text-emerald-700 mt-1">
            Belirtilen kurallar yalnızca OGM 1. oturumundaki personel için 2026 takvim yılında aşağıdaki dönemlere göre otomatik olarak hesaplanmaktadır:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
              <div className="flex items-center space-x-2 text-emerald-800 font-semibold mb-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>1. Dönem: 18 Eylül - 21 Ekim Arası</span>
              </div>
              <ul className="space-y-1.5 text-sm text-slate-700">
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Hafta İçi (Pzt-Cum):</span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">1 Saat / Gün</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Hafta Sonu (Cmt-Paz):</span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">10 Saat / Gün</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
              <div className="flex items-center space-x-2 text-emerald-800 font-semibold mb-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>2. Dönem: 21 Ekim Sonrası (22 Ekim ve Sonrası)</span>
              </div>
              <ul className="space-y-1.5 text-sm text-slate-700">
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Hafta İçi (Pzt-Cum):</span>
                  <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">0 Saat / Gün</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Hafta Sonu (Cmt-Paz):</span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">8 Saat / Gün</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-4 flex items-center space-x-2 text-xs text-emerald-800 bg-emerald-100/70 p-3 rounded-lg border border-emerald-200">
            <AlertCircle className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Not: Belirtilen tarihler dışındaki günler veya 2026 yılı dışındaki dönemler için mesai saati 0 olarak kabul edilir. Kişinin o gün görevde olması şarttır.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
