import React, { useState } from 'react';
import { OgmPersonnel } from '../types/ogm';
import { UserPlus, Trash2, Edit2, Users, Shield, Save, X } from 'lucide-react';

interface PersonnelManagementProps {
  personnelList: OgmPersonnel[];
  onAddPersonnel: (person: Omit<OgmPersonnel, 'id'>) => void;
  onUpdatePersonnel: (person: OgmPersonnel) => void;
  onDeletePersonnel: (id: string) => void;
}

export const PersonnelManagement: React.FC<PersonnelManagementProps> = ({
  personnelList,
  onAddPersonnel,
  onUpdatePersonnel,
  onDeletePersonnel,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<OgmPersonnel | null>(null);

  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('Havacılık Şubesi');

  const handleOpenAdd = () => {
    setEditingPerson(null);
    setFullName('');
    setTitle('');
    setUnit('Havacılık Şubesi');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (person: OgmPersonnel) => {
    setEditingPerson(person);
    setFullName(person.fullName);
    setTitle(person.title);
    setUnit(person.unit);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !title.trim()) return;

    if (editingPerson) {
      onUpdatePersonnel({
        ...editingPerson,
        fullName,
        title,
        unit,
      });
    } else {
      onAddPersonnel({
        fullName,
        title,
        session: '1. Oturum',
        unit,
      });
    }

    setIsModalOpen(false);
    setFullName('');
    setTitle('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">OGM 1. Oturum Personel Listesi</h3>
              <p className="text-sm text-slate-500">Sisteme kayıtlı pilot, teknisyen ve görevli personel yönetimi</p>
            </div>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Yeni Personel Ekle</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Ad Soyad</th>
                <th className="py-3.5 px-4">Unvan</th>
                <th className="py-3.5 px-4">Oturum Grubu</th>
                <th className="py-3.5 px-4">Birim / Şube</th>
                <th className="py-3.5 px-4 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {personnelList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    Henüz personel eklenmemiş.
                  </td>
                </tr>
              ) : (
                personnelList.map((person, idx) => (
                  <tr key={person.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-500">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                        {person.fullName.charAt(0)}
                      </div>
                      <span>{person.fullName}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-800">{person.title}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-emerald-50 text-emerald-800 font-semibold px-2.5 py-1 rounded-full text-xs border border-emerald-200">
                        {person.session}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{person.unit}</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleOpenEdit(person)}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeletePersonnel(person.id)}
                          className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-emerald-300" />
                <h4 className="font-bold text-lg">
                  {editingPerson ? 'Personel Bilgisini Düzenle' : 'Yeni Personel Ekle'}
                </h4>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet Yılmaz"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unvan</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Kaptan Pilot, Teknisyen"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Oturum Grubu</label>
                <input
                  type="text"
                  disabled
                  value="1. Oturum"
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Birim / Şube</label>
                <select
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="Havacılık Şubesi">Havacılık Şubesi</option>
                  <option value="Bakım Şubesi">Bakım Şubesi</option>
                  <option value="Operasyon">Operasyon</option>
                  <option value="Orman Yangınları Mücadele">Orman Yangınları Mücadele</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-sm rounded-lg shadow-sm transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingPerson ? 'Güncelle' : 'Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
