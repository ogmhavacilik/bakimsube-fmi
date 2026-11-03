import React, { useState, useEffect } from 'react';
import { OgmPersonnel, DutyRecord } from './types/ogm';
import { INITIAL_PERSONNEL, generateDefaultDutyRecords, calculatePersonnelSummaries } from './utils/calculator';
import { exportToExcel, printReport } from './utils/exportUtils';
import { Header } from './components/Header';
import { RuleExplanationCard } from './components/RuleExplanationCard';
import { DashboardSummary } from './components/DashboardSummary';
import { PersonnelManagement } from './components/PersonnelManagement';
import { DutyCalendarMatrix } from './components/DutyCalendarMatrix';
import { ReportView } from './components/ReportView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'personnel' | 'calendar' | 'rules'>('dashboard');

  // Load from localStorage or initial
  const [personnelList, setPersonnelList] = useState<OgmPersonnel[]>(() => {
    const saved = localStorage.getItem('ogm_personnel_2026');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_PERSONNEL;
  });

  const [dutyRecords, setDutyRecords] = useState<DutyRecord[]>(() => {
    const saved = localStorage.getItem('ogm_duty_records_2026');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    // Generate default records for sample personnel
    return generateDefaultDutyRecords(INITIAL_PERSONNEL.map(p => p.id));
  });

  useEffect(() => {
    localStorage.setItem('ogm_personnel_2026', JSON.stringify(personnelList));
  }, [personnelList]);

  useEffect(() => {
    localStorage.setItem('ogm_duty_records_2026', JSON.stringify(dutyRecords));
  }, [dutyRecords]);

  // Personnel CRUD handlers
  const handleAddPersonnel = (newPersonData: Omit<OgmPersonnel, 'id'>) => {
    const newId = Date.now().toString();
    const newPerson: OgmPersonnel = { id: newId, ...newPersonData };
    setPersonnelList(prev => [...prev, newPerson]);
  };

  const handleUpdatePersonnel = (updated: OgmPersonnel) => {
    setPersonnelList(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleDeletePersonnel = (id: string) => {
    setPersonnelList(prev => prev.filter(p => p.id !== id));
    setDutyRecords(prev => prev.filter(r => r.personId !== id));
  };

  // Duty toggle handler
  const handleToggleDuty = (personId: string, dateStr: string, isOnDuty: boolean) => {
    setDutyRecords(prev => {
      const existingIndex = prev.findIndex(r => r.personId === personId && r.date === dateStr);
      if (existingIndex >= 0) {
        if (!isOnDuty) {
          return prev.filter((_, idx) => idx !== existingIndex);
        } else {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], isOnDuty: true };
          return updated;
        }
      } else {
        if (isOnDuty) {
          return [...prev, { id: `rec_${Date.now()}_${Math.random()}`, personId, date: dateStr, isOnDuty: true }];
        }
        return prev;
      }
    });
  };

  const handleBulkDutySet = (dateStr: string, isOnDuty: boolean) => {
    // Optional bulk set
  };

  const handleAutoPlanDuties = (startDateStr: string, endDateStr: string, mode: 'all' | 'weekdays' | 'weekends') => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    const newRecords: DutyRecord[] = [...dutyRecords];
    const recordMap = new Set(newRecords.map(r => `${r.personId}_${r.date}`));

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      if (year !== 2026) continue;
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (mode === 'weekdays' && isWeekend) continue;
      if (mode === 'weekends' && !isWeekend) continue;

      personnelList.forEach(p => {
        const key = `${p.id}_${dateStr}`;
        if (!recordMap.has(key)) {
          newRecords.push({
            id: `auto_${Date.now()}_${Math.random()}`,
            personId: p.id,
            date: dateStr,
            isOnDuty: true,
            note: isWeekend ? 'Otomatik Hafta Sonu Nöbeti' : 'Otomatik Hafta İçi Görev'
          });
          recordMap.add(key);
        }
      });
    }

    setDutyRecords(newRecords);
  };

  const handleExportExcel = () => {
    const summaries = calculatePersonnelSummaries(personnelList, dutyRecords);
    exportToExcel(summaries, personnelList);
  };

  const handleNavigateCalendar = (personId?: string) => {
    setActiveTab('calendar');
  };

  const summaries = calculatePersonnelSummaries(personnelList, dutyRecords);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-emerald-500 selection:text-white">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExportExcel={handleExportExcel}
        onPrint={printReport}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RuleExplanationCard />

        {activeTab === 'dashboard' && (
          <DashboardSummary
            summaries={summaries}
            personnelList={personnelList}
            onExportExcel={handleExportExcel}
            onPrint={printReport}
            onNavigateCalendar={handleNavigateCalendar}
          />
        )}

        {activeTab === 'personnel' && (
          <PersonnelManagement
            personnelList={personnelList}
            onAddPersonnel={handleAddPersonnel}
            onUpdatePersonnel={handleUpdatePersonnel}
            onDeletePersonnel={handleDeletePersonnel}
          />
        )}

        {activeTab === 'calendar' && (
          <DutyCalendarMatrix
            personnelList={personnelList}
            dutyRecords={dutyRecords}
            onToggleDuty={handleToggleDuty}
            onBulkDutySet={handleBulkDutySet}
            onAutoPlanDuties={handleAutoPlanDuties}
          />
        )}

        {activeTab === 'rules' && (
          <ReportView
            summaries={summaries}
            personnelList={personnelList}
            onExportExcel={handleExportExcel}
            onPrint={printReport}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12 print:hidden">
        <p>OGM 1. Oturum 2026 Yılı Mesai ve Görev Takip Sistemi &bull; Tüm Hakları Saklıdır.</p>
      </footer>
    </div>
  );
}
