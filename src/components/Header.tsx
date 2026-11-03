import React from 'react';
import { Shield, FileSpreadsheet, Printer, Calendar, Users, BarChart3, HelpCircle } from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'personnel' | 'calendar' | 'rules';
  setActiveTab: (tab: 'dashboard' | 'personnel' | 'calendar' | 'rules') => void;
  onExportExcel: () => void;
  onPrint: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onExportExcel, onPrint }) => {
  return (
    <header className="bg-emerald-900 text-white shadow-lg border-b border-emerald-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-800 rounded-xl border border-emerald-700 shadow-inner flex items-center justify-center">
              <Shield className="w-8 h-8 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-emerald-700 text-emerald-100 text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  2026 Yılı Özel Mevzuat
                </span>
                <span className="text-xs text-emerald-300 font-medium">OGM 1. Oturum</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5">
                Orman Genel Müdürlüğü Mesai & Görev Takip Sistemi
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onExportExcel}
              className="hidden sm:flex items-center space-x-2 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-sm font-medium px-4 py-2.5 rounded-lg border border-emerald-700 shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Excel İndir</span>
            </button>
            <button
              onClick={onPrint}
              className="hidden sm:flex items-center space-x-2 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-sm font-medium px-4 py-2.5 rounded-lg border border-emerald-700 shadow-sm transition-all"
            >
              <Printer className="w-4 h-4 text-emerald-300" />
              <span>Yazdır / PDF</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto pb-3 pt-1 border-t border-emerald-800">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-emerald-800 text-white shadow-sm border border-emerald-700'
                : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-300" />
            <span>Özet & Raporlar</span>
          </button>

          <button
            onClick={() => setActiveTab('personnel')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'personnel'
                ? 'bg-emerald-800 text-white shadow-sm border border-emerald-700'
                : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-300" />
            <span>Personel Yönetimi</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'calendar'
                ? 'bg-emerald-800 text-white shadow-sm border border-emerald-700'
                : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-300" />
            <span>Günlük Görev / Mesai Matrisi</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'rules'
                ? 'bg-emerald-800 text-white shadow-sm border border-emerald-700'
                : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-emerald-300" />
            <span>Mevzuat & Rapor</span>
          </button>
        </div>
      </div>
    </header>
  );
};
