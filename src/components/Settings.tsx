import React, { useState, useEffect, useMemo } from 'react';
import { fetchEquipments, fetchCheckItems, addEquipment, deleteEquipment, updateEquipment, addCheckItem, deleteCheckItem, updateCheckItem, fetchOperators, addOperator, deleteOperator, updateOperator } from '../lib/db';
import { Equipment, CheckItem, Operator } from '../types';
import { Plus, Settings2, Users, MonitorSmartphone, QrCode, X, ListChecks, Info, Trash2, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';

const InlineCheckItemRow = ({ item, onDelete, onUpdate }: { item: CheckItem, onDelete: () => void, onUpdate: (updated: CheckItem) => Promise<void> }) => {
  const [local, setLocal] = useState<CheckItem>(item);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocal(item);
    setConfirmDelete(false);
    setIsSaving(false);
  }, [item]);

  const isDirty = (
    item.category !== local.category ||
    item.name !== local.name ||
    item.criteriaText !== local.criteriaText ||
    item.type !== local.type ||
    item.frequency !== local.frequency ||
    item.expectedBoolean !== local.expectedBoolean ||
    item.minValue !== local.minValue ||
    item.maxValue !== local.maxValue ||
    item.unit !== local.unit
  );

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate(local);
    setIsSaving(false);
  };

  return (
    <tr className={cn("border-b transition-colors", isDirty ? "bg-amber-50/50 border-amber-100" : "border-slate-100 hover:bg-slate-50")}>
       <td className="p-2">
          <input type="text" value={local.category || ''} onChange={e => setLocal({...local, category: e.target.value})} className="w-full text-xs px-2 py-1.5 border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded bg-transparent focus:bg-white" placeholder="Category" disabled={isSaving} />
       </td>
       <td className="p-2">
          <input type="text" value={local.name || ''} onChange={e => setLocal({...local, name: e.target.value})} className="w-full text-xs font-semibold px-2 py-1.5 border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded bg-transparent focus:bg-white" placeholder="Name" disabled={isSaving} />
       </td>
       <td className="p-2">
          <input type="text" value={local.criteriaText || ''} onChange={e => setLocal({...local, criteriaText: e.target.value})} className="w-full text-xs px-2 py-1.5 border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded bg-transparent focus:bg-white" placeholder="Criteria" disabled={isSaving} />
       </td>
       <td className="p-2 min-w-[100px]">
          <select value={local.frequency || 'daily'} onChange={e => setLocal({...local, frequency: e.target.value as any})} className="w-full text-xs px-2 py-1.5 border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded bg-transparent focus:bg-white" disabled={isSaving}>
             <option value="daily">Daily</option>
             <option value="on-use">On Use</option>
          </select>
       </td>
       <td className="p-2 min-w-[120px]">
          <select value={local.type || 'boolean'} onChange={e => setLocal({...local, type: e.target.value as any})} className="w-full text-xs px-2 py-1.5 border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded bg-transparent focus:bg-white" disabled={isSaving}>
             <option value="boolean">Pass / Fail</option>
             <option value="numeric">Numeric Input</option>
          </select>
       </td>
       <td className="p-2 min-w-[150px]">
          {local.type === 'boolean' ? (
             <select value={local.expectedBoolean !== false ? 'true' : 'false'} onChange={e => setLocal({...local, expectedBoolean: e.target.value === 'true'})} className="w-full text-xs px-2 py-1.5 border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded bg-transparent focus:bg-white" disabled={isSaving}>
                <option value="true">Normal = Pass</option>
                <option value="false">Normal = Fail</option>
             </select>
          ) : (
             <div className="flex gap-1 items-center">
                <input type="number" step="any" placeholder="LCL" value={local.minValue === undefined ? '' : local.minValue} onChange={e => setLocal({...local, minValue: e.target.value === '' ? undefined : Number(e.target.value)})} className="w-12 text-xs px-1 py-1 border border-slate-200 hover:border-slate-300 rounded text-center focus:border-indigo-500 bg-transparent focus:bg-white shadow-sm" disabled={isSaving} />
                <span className="text-slate-400">-</span>
                <input type="number" step="any" placeholder="UCL" value={local.maxValue === undefined ? '' : local.maxValue} onChange={e => setLocal({...local, maxValue: e.target.value === '' ? undefined : Number(e.target.value)})} className="w-12 text-xs px-1 py-1 border border-slate-200 hover:border-slate-300 rounded text-center focus:border-indigo-500 bg-transparent focus:bg-white shadow-sm" disabled={isSaving} />
                <input type="text" placeholder="Unit" value={local.unit || ''} onChange={e => setLocal({...local, unit: e.target.value})} className="w-12 text-xs px-1 py-1 border border-slate-200 hover:border-slate-300 rounded text-center focus:border-indigo-500 bg-transparent focus:bg-white shadow-sm" disabled={isSaving} />
             </div>
          )}
       </td>
       <td className="p-2 text-right w-fit">
          {isDirty ? (
             <div className="flex items-center justify-end gap-1">
                <button onClick={() => { setLocal({...item}); setIsSaving(false); }} className="px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200 hover:text-slate-700 rounded transition-colors" disabled={isSaving} title="Undo">Undo</button>
                <button onClick={handleSave} className="px-3 py-1 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-sm rounded transition-colors disabled:opacity-50 flex items-center justify-center min-w-[50px]" disabled={isSaving} title="Save Changes">
                    {isSaving ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Save'}
                </button>
             </div>
          ) : confirmDelete ? (
             <div className="flex items-center justify-end gap-1">
                <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200 hover:text-slate-700 rounded transition-colors" disabled={isSaving}>Cancel</button>
                <button onClick={onDelete} className="px-2 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm rounded transition-colors" disabled={isSaving}>Confirm</button>
             </div>
          ) : (
             <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors ml-auto block" disabled={isSaving} title="Delete Parameter">
                <Trash2 className="w-4 h-4" />
             </button>
          )}
       </td>
    </tr>
  );
};

const DraftCheckItemRow = ({ initialCategory, equipmentId, orderIndex, uniqueCategories, onSave, onCancel }: { initialCategory: string, equipmentId: string, orderIndex: number, uniqueCategories: string[], onSave: (item: Omit<CheckItem, 'id'>) => Promise<void>, onCancel: () => void }) => {
  const [local, setLocal] = useState({
     category: initialCategory,
     name: '',
     criteriaText: '',
     type: 'boolean',
     frequency: 'daily',
     expectedBoolean: true,
     minValue: '' as string | number,
     maxValue: '' as string | number,
     unit: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
     if(!local.name) return;
     setIsSaving(true);
     await onSave({
        equipmentId,
        category: local.category || 'General',
        name: local.name,
        criteriaText: local.criteriaText,
        type: local.type as any,
        frequency: local.frequency as any,
        isRequired: true,
        expectedBoolean: local.type === 'boolean' ? local.expectedBoolean : undefined,
        minValue: local.type === 'numeric' && local.minValue !== '' ? Number(local.minValue) : undefined,
        maxValue: local.type === 'numeric' && local.maxValue !== '' ? Number(local.maxValue) : undefined,
        unit: local.type === 'numeric' ? local.unit : undefined,
        orderIndex
     });
  };

  return (
    <tr className="bg-indigo-50/50 border-y border-indigo-100 shadow-sm relative z-10">
       <td className="p-2">
          <input type="text" list="cat-list-draft" value={local.category} onChange={e => setLocal({...local, category: e.target.value})} className="w-full text-xs px-2 py-1.5 border border-slate-300 focus:border-indigo-500 rounded bg-white shadow-sm" placeholder="Category" autoFocus={!initialCategory} />
          <datalist id="cat-list-draft">
             {uniqueCategories.map(c => <option key={c} value={c} />)}
          </datalist>
       </td>
       <td className="p-2">
          <input type="text" value={local.name} onChange={e => setLocal({...local, name: e.target.value})} className="w-full text-xs font-semibold px-2 py-1.5 border border-indigo-300 focus:border-indigo-500 rounded bg-white shadow-sm" placeholder="Name" autoFocus={!!initialCategory} />
       </td>
       <td className="p-2">
          <input type="text" value={local.criteriaText} onChange={e => setLocal({...local, criteriaText: e.target.value})} className="w-full text-xs px-2 py-1.5 border border-slate-300 focus:border-indigo-500 rounded bg-white shadow-sm" placeholder="Criteria" />
       </td>
       <td className="p-2 min-w-[100px]">
          <select value={local.frequency} onChange={e => setLocal({...local, frequency: e.target.value})} className="w-full text-xs px-2 py-1.5 border border-slate-300 focus:border-indigo-500 rounded bg-white shadow-sm">
             <option value="daily">Daily</option>
             <option value="on-use">On Use</option>
          </select>
       </td>
       <td className="p-2 min-w-[120px]">
          <select value={local.type} onChange={e => setLocal({...local, type: e.target.value})} className="w-full text-xs px-2 py-1.5 border border-slate-300 focus:border-indigo-500 rounded bg-white shadow-sm">
             <option value="boolean">Pass / Fail</option>
             <option value="numeric">Numeric Input</option>
          </select>
       </td>
       <td className="p-2 min-w-[150px]">
          {local.type === 'boolean' ? (
             <select value={local.expectedBoolean ? 'true' : 'false'} onChange={e => setLocal({...local, expectedBoolean: e.target.value === 'true'})} className="w-full text-xs px-2 py-1.5 border border-slate-300 focus:border-indigo-500 rounded bg-white shadow-sm">
                <option value="true">Normal = Pass</option>
                <option value="false">Normal = Fail</option>
             </select>
          ) : (
             <div className="flex gap-1 items-center bg-white p-0.5 rounded shadow-sm border border-slate-300">
                <input type="number" step="any" placeholder="LCL" value={local.minValue === undefined ? '' : local.minValue} onChange={e => setLocal({...local, minValue: e.target.value === '' ? undefined : e.target.value})} className="w-12 text-xs px-1 py-1 rounded text-center focus:outline-none" />
                <span className="text-slate-300">-</span>
                <input type="number" step="any" placeholder="UCL" value={local.maxValue === undefined ? '' : local.maxValue} onChange={e => setLocal({...local, maxValue: e.target.value === '' ? undefined : e.target.value})} className="w-12 text-xs px-1 py-1 rounded text-center focus:outline-none" />
                <input type="text" placeholder="Unit" value={local.unit || ''} onChange={e => setLocal({...local, unit: e.target.value})} className="w-12 text-xs px-1 py-1 border-l border-slate-200 rounded-r text-center focus:outline-none" />
             </div>
          )}
       </td>
       <td className="p-2 text-right w-fit">
          <div className="flex items-center justify-end gap-1">
             <button onClick={onCancel} disabled={isSaving} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors" title="Delete Draft">
                <Trash2 className="w-4 h-4" />
             </button>
             <button onClick={handleSave} disabled={isSaving || !local.name} className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 rounded shadow-sm transition-colors" title="Save Parameter">Save</button>
          </div>
       </td>
    </tr>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'equipment' | 'parameters' | 'qrcodes' | 'operators'>('equipment');
  
  // Data state
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  
  // Modal state
  const [qrModalEq, setQrModalEq] = useState<Equipment | null>(null);
  
  // Form State - Equipment
  const [newEqName, setNewEqName] = useState('');
  const [newEqCode, setNewEqCode] = useState('');
  const [newEqLoc, setNewEqLoc] = useState('');
  const [newEqDoc, setNewEqDoc] = useState('');
  
  const [editingEqId, setEditingEqId] = useState<string | null>(null);
  const [editingEqData, setEditingEqData] = useState<Partial<Equipment>>({});
  
  // Form State - Operator
  const [newOpName, setNewOpName] = useState('');
  const [newOpId, setNewOpId] = useState('');
  
  // Form State - CheckItem
  const [selectedEqIdForItems, setSelectedEqIdForItems] = useState<string>('');
  
  const [drafts, setDrafts] = useState<{id: string, category: string}[]>([]);

  // Derive unique categories for the datalist
  const uniqueCategories = useMemo(() => {
    const cats = checkItems.filter(i => i.equipmentId === selectedEqIdForItems).map(i => i.category || 'General');
    return Array.from(new Set(cats));
  }, [checkItems, selectedEqIdForItems]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [eqs, itms, ops] = await Promise.all([
      fetchEquipments(),
      fetchCheckItems(),
      fetchOperators()
    ]);
    setEquipments(eqs);
    setCheckItems(itms);
    setOperators(ops);
  };

  const handleAddEq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEqName || !newEqCode) return;
    
    // Check for duplicate code
    if (equipments.some(eq => eq.code.toLowerCase() === newEqCode.toLowerCase())) {
      alert("An equipment with this code already exists. Please use a unique code.");
      return;
    }

    await addEquipment({
      name: newEqName,
      code: newEqCode,
      location: newEqLoc,
      referenceDocNo: newEqDoc,
      status: 'active',
      createdAt: Date.now()
    });
    setNewEqName(''); setNewEqCode(''); setNewEqLoc(''); setNewEqDoc('');
    await loadData();
  };

  const handleStartEditEq = (eq: Equipment) => {
    setEditingEqId(eq.id!);
    setEditingEqData(eq);
  };

  const handleCancelEditEq = () => {
    setEditingEqId(null);
    setEditingEqData({});
  };

  const handleSaveEditEq = async (id: string) => {
    if (!editingEqData.name || !editingEqData.code) return;
    
    // Check for duplicate code (exclude self)
    if (equipments.some(eq => eq.id !== id && eq.code.toLowerCase() === editingEqData.code?.toLowerCase())) {
      alert("Another equipment with this code already exists. Please use a unique code.");
      return;
    }

    await updateEquipment(id, editingEqData);
    setEditingEqId(null);
    await loadData();
  };

  // Form State - Confirmations
  const [confirmDeleteEqId, setConfirmDeleteEqId] = useState<string | null>(null);

  const handleDeleteEq = async (id: string) => {
    if (confirmDeleteEqId === id) {
      setConfirmDeleteEqId(null);
      try {
        await deleteEquipment(id);
        await loadData();
      } catch (err) {
        alert("Failed to delete equipment. Setup Firebase rules to allow delete.");
      }
    } else {
      setConfirmDeleteEqId(id);
    }
  };

  const handleAddOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpName || !newOpId) return;
    await addOperator({
      name: newOpName,
      employeeId: newOpId,
      isActive: true
    });
    setNewOpName(''); setNewOpId('');
    await loadData();
  };

  const [confirmDeleteOpId, setConfirmDeleteOpId] = useState<string | null>(null);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editingOpName, setEditingOpName] = useState<string>('');

  const handleDeleteOperator = async (id: string) => {
    if (confirmDeleteOpId === id) {
      await deleteOperator(id);
      setConfirmDeleteOpId(null);
      await loadData();
    } else {
      setConfirmDeleteOpId(id);
    }
  };

  const handleEditOperator = (op: Operator) => {
    setEditingOpId(op.id!);
    setEditingOpName(op.name);
  };

  const submitEditOperator = async (id: string) => {
    if (editingOpName) {
      await updateOperator(id, editingOpName);
      setEditingOpId(null);
      await loadData();
    }
  };

  const handleAddDraft = (cat: string = '') => {
    setDrafts([...drafts, { id: Date.now().toString() + Math.random(), category: cat }]);
  };

  const handleSaveDraft = async (draftId: string, itemData: Omit<CheckItem, 'id'>) => {
    await addCheckItem(itemData);
    setDrafts(drafts.filter(d => d.id !== draftId));
    await loadData();
  };

  const handleCancelDraft = (draftId: string) => {
    setDrafts(drafts.filter(d => d.id !== draftId));
  };

  const handleDeleteItem = async (id: string) => {
    await deleteCheckItem(id);
    await loadData();
  };

  const handleUpdateItem = async (updated: CheckItem) => {
    if (updated.id) {
       await updateCheckItem(updated.id, updated);
       await loadData();
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-slate-900 drop-shadow-sm flex items-center gap-3">
             <Settings2 className="w-8 h-8 text-indigo-600" /> System Settings
          </h1>
          <p className="text-slate-500 mt-1.5 font-medium">Configure laboratory equipment, validation parameters, and operators.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto custom-scrollbar pb-2">
        <button 
          onClick={() => setActiveTab('equipment')}
          className={cn("px-4 sm:px-5 py-2.5 sm:py-3 rounded-t-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all duration-300 whitespace-nowrap outline-none", 
            activeTab === 'equipment' ? "bg-white border-b-2 border-indigo-600 text-indigo-700 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]" : "border-b-2 border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50")}
        >
          <MonitorSmartphone className="w-4 h-4" /> 1. Register Equipment
        </button>
        <button 
          onClick={() => setActiveTab('parameters')}
          className={cn("px-4 sm:px-5 py-2.5 sm:py-3 rounded-t-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all duration-300 whitespace-nowrap outline-none", 
            activeTab === 'parameters' ? "bg-white border-b-2 border-indigo-600 text-indigo-700 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]" : "border-b-2 border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50")}
        >
          <ListChecks className="w-4 h-4" /> 2. Control Parameters
        </button>
        <button 
          onClick={() => setActiveTab('qrcodes')}
          className={cn("px-4 sm:px-5 py-2.5 sm:py-3 rounded-t-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all duration-300 whitespace-nowrap outline-none", 
            activeTab === 'qrcodes' ? "bg-white border-b-2 border-indigo-600 text-indigo-700 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]" : "border-b-2 border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50")}
        >
          <QrCode className="w-4 h-4" /> 3. QR Codes
        </button>
        <button 
          onClick={() => setActiveTab('operators')}
          className={cn("px-4 sm:px-5 py-2.5 sm:py-3 rounded-t-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all duration-300 whitespace-nowrap outline-none", 
            activeTab === 'operators' ? "bg-white border-b-2 border-indigo-600 text-indigo-700 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]" : "border-b-2 border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50")}
        >
          <Users className="w-4 h-4" /> 4. Personnel
        </button>
      </div>

      <motion.div 
        key={activeTab} 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6"
      >
        {activeTab === 'operators' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-4 h-fit">
              <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">Add New Operator</h2>
              <form onSubmit={handleAddOperator} className="space-y-4">
                 <div>
                    <label className="block text-sm text-slate-700 mb-1">Operator Name</label>
                    <input type="text" required value={newOpName} onChange={e => setNewOpName(e.target.value)}
                           className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                 </div>
                 <div>
                    <label className="block text-sm text-slate-700 mb-1">Employee ID</label>
                    <input type="text" required value={newOpId} onChange={e => setNewOpId(e.target.value)}
                           className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                 </div>
                 <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                    <Plus className="w-4 h-4" /> Add Operator
                 </button>
              </form>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">Operator Roster</h2>
              <ul className="divide-y divide-slate-100">
                {operators.map(op => (
                  <li key={op.id} className="py-3 flex justify-between items-center group">
                    <div className="flex-1">
                       {editingOpId === op.id ? (
                          <input 
                            type="text" 
                            className="w-full max-w-xs px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={editingOpName}
                            onChange={(e) => setEditingOpName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') submitEditOperator(op.id!); else if (e.key === 'Escape') setEditingOpId(null); }}
                            autoFocus
                          />
                       ) : (
                          <>
                             <p className="font-medium text-slate-900">{op.name}</p>
                             <p className="text-xs text-slate-500">{op.employeeId}</p>
                          </>
                       )}
                    </div>
                    <div className="flex gap-2 items-center">
                       {editingOpId === op.id ? (
                          <button onClick={() => submitEditOperator(op.id!)} className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 rounded">Save</button>
                       ) : confirmDeleteOpId === op.id ? (
                          <>
                             <span className="text-xs font-semibold text-rose-500">Confirm Delete?</span>
                             <button onClick={() => handleDeleteOperator(op.id!)} className="px-2 py-1 text-xs font-bold text-white bg-rose-600 rounded">Yes</button>
                             <button onClick={() => setConfirmDeleteOpId(null)} className="px-2 py-1 text-xs font-semibold text-slate-600 bg-slate-100 rounded">No</button>
                          </>
                       ) : (
                          <>
                             <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-xs rounded-full font-medium">Active</span>
                             <button onClick={() => handleEditOperator(op)} className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded hidden group-hover:block transition-all">
                                <Edit2 className="w-4 h-4" />
                             </button>
                             <button onClick={() => handleDeleteOperator(op.id!)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded hidden group-hover:block transition-all">
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </>
                       )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {activeTab === 'equipment' && (
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-4 max-w-3xl mx-auto xl:mx-0">
              <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2">Register Equipment</h2>
              <form onSubmit={handleAddEq} className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="col-span-2">
                      <label className="block text-sm text-slate-700 mb-1">Equipment Name</label>
                      <input type="text" required value={newEqName} onChange={e => setNewEqName(e.target.value)}
                             className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                   </div>
                   <div>
                      <label className="block text-sm text-slate-700 mb-1">Barcode / Code</label>
                      <input type="text" required value={newEqCode} onChange={e => setNewEqCode(e.target.value)}
                             className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm" placeholder="e.g. CEN-01" />
                   </div>
                   <div className="col-span-2">
                      <label className="block text-sm text-slate-700 mb-1">Method / Ref Doc No.</label>
                      <input type="text" value={newEqDoc} onChange={e => setNewEqDoc(e.target.value)}
                             className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm" placeholder="e.g. PDS-F-1035 Rev.001" />
                   </div>
                   <div className="col-span-2">
                      <label className="block text-sm text-slate-700 mb-1">Location</label>
                      <input type="text" value={newEqLoc} onChange={e => setNewEqLoc(e.target.value)}
                             className="w-full px-3 py-2 border border-slate-200 rounded-lg" />
                   </div>
                 </div>
                 <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">
                    <Plus className="w-4 h-4" /> Save Equipment
                 </button>
              </form>
            </div>

            {equipments.length > 0 && (
               <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mt-6 max-w-3xl mx-auto xl:mx-0 overflow-hidden">
                  <div className="p-4 sm:p-6 border-b border-slate-100 font-semibold text-slate-800">
                     Registered Equipment
                  </div>
                  <ul className="divide-y divide-slate-100">
                     {equipments.map(eq => (
                        <li key={eq.id} className="p-4 hover:bg-slate-50 transition-colors">
                           {editingEqId === eq.id ? (
                              <div className="space-y-3 p-2 bg-indigo-50/50 rounded-lg">
                                 <div className="grid md:grid-cols-2 gap-3">
                                    <div>
                                       <label className="text-xs text-slate-500 mb-1 block">Name</label>
                                       <input type="text" value={editingEqData.name || ''} onChange={e => setEditingEqData({...editingEqData, name: e.target.value})} className="w-full text-sm px-2 py-1.5 border border-indigo-200 rounded focus:border-indigo-500 flex-1" />
                                    </div>
                                    <div>
                                       <label className="text-xs text-slate-500 mb-1 block">Code</label>
                                       <input type="text" value={editingEqData.code || ''} onChange={e => setEditingEqData({...editingEqData, code: e.target.value})} className="w-full text-sm font-mono px-2 py-1.5 border border-indigo-200 rounded focus:border-indigo-500" />
                                    </div>
                                    <div>
                                       <label className="text-xs text-slate-500 mb-1 block">Location</label>
                                       <input type="text" value={editingEqData.location || ''} onChange={e => setEditingEqData({...editingEqData, location: e.target.value})} className="w-full text-sm px-2 py-1.5 border border-indigo-200 rounded focus:border-indigo-500" />
                                    </div>
                                    <div>
                                       <label className="text-xs text-slate-500 mb-1 block">Reference Doc</label>
                                       <input type="text" value={editingEqData.referenceDocNo || ''} onChange={e => setEditingEqData({...editingEqData, referenceDocNo: e.target.value})} className="w-full text-sm px-2 py-1.5 border border-indigo-200 rounded focus:border-indigo-500" />
                                    </div>
                                 </div>
                                 <div className="flex justify-end gap-2 pt-2">
                                    <button onClick={handleCancelEditEq} className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50">Cancel</button>
                                    <button onClick={() => handleSaveEditEq(eq.id!)} className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded shadow-sm hover:bg-indigo-700">Save</button>
                                 </div>
                              </div>
                           ) : (
                              <div className="flex justify-between items-start group">
                                 <div>
                                    <div className="flex items-baseline gap-2">
                                       <p className="font-bold text-slate-800">{eq.name}</p>
                                       <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{eq.code}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex gap-3">
                                       {eq.location && <span>📍 {eq.location}</span>}
                                       {eq.referenceDocNo && <span>📄 {eq.referenceDocNo}</span>}
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-1">
                                    {confirmDeleteEqId === eq.id ? (
                                       <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-rose-500">Delete?</span>
                                          <button onClick={() => handleDeleteEq(eq.id!)} className="px-2 py-1 text-xs font-bold text-white bg-rose-600 border border-rose-600 hover:bg-rose-700 rounded shadow-sm">Yes</button>
                                          <button onClick={() => setConfirmDeleteEqId(null)} className="px-2 py-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded shadow-sm">No</button>
                                       </div>
                                    ) : (
                                       <>
                                          <button onClick={() => handleStartEditEq(eq)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded transition-colors" title="Edit">
                                             <Edit2 className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => handleDeleteEq(eq.id!)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded transition-colors" title="Delete">
                                             <Trash2 className="w-4 h-4" />
                                          </button>
                                       </>
                                    )}
                                 </div>
                              </div>
                           )}
                        </li>
                     ))}
                  </ul>
               </div>
            )}
          </div>
        )}

        {activeTab === 'parameters' && (
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 leading-tight">Add Control Parameters</h2>
                <p className="text-sm text-slate-500 mt-1">Define properties to check sequentially (layout extends horizontally)</p>
              </div>
              <div className="w-full md:w-80">
                 <label className="block text-sm text-slate-700 mb-1 font-semibold">1. Select Target Equipment</label>
                 <select required value={selectedEqIdForItems} onChange={e => setSelectedEqIdForItems(e.target.value)}
                         className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/30 rounded-lg font-medium text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">-- Select Equipment --</option>
                    {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.name} ({eq.code})</option>)}
                 </select>
              </div>
            </div>

            {selectedEqIdForItems ? (
               <div className="space-y-4">
                 <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                   <table className="w-full text-left border-collapse min-w-max">
                     <thead className="bg-slate-50 border-b border-slate-200">
                       <tr>
                         <th className="p-3 text-xs font-semibold text-slate-600">Category</th>
                         <th className="p-3 text-xs font-semibold text-slate-600">Parameter Name</th>
                         <th className="p-3 text-xs font-semibold text-slate-600">Criteria Text</th>
                         <th className="p-3 text-xs font-semibold text-slate-600 min-w-[100px]">Frequency</th>
                         <th className="p-3 text-xs font-semibold text-slate-600 min-w-[120px]">Format</th>
                         <th className="p-3 text-xs font-semibold text-slate-600 min-w-[200px]">Limits / Values</th>
                         <th className="p-3 text-xs font-semibold text-slate-600 text-right">Actions</th>
                       </tr>
                     </thead>
                     <tbody>
                       {uniqueCategories.map(cat => {
                          const catItems = checkItems.filter(i => i.equipmentId === selectedEqIdForItems && (i.category || 'General') === cat);
                          const catDrafts = drafts.filter(d => d.category === cat);
                          
                          return (
                             <React.Fragment key={cat}>
                                {catItems.map(item => (
                                   <InlineCheckItemRow 
                                      key={item.id} 
                                      item={item} 
                                      onUpdate={handleUpdateItem} 
                                      onDelete={() => handleDeleteItem(item.id!)} 
                                   />
                                ))}
                                {catDrafts.map(draft => (
                                   <DraftCheckItemRow 
                                      key={draft.id} 
                                      initialCategory={draft.category} 
                                      equipmentId={selectedEqIdForItems} 
                                      orderIndex={checkItems.filter(i => i.equipmentId === selectedEqIdForItems).length + 1}
                                      uniqueCategories={uniqueCategories}
                                      onSave={(data) => handleSaveDraft(draft.id, data)}
                                      onCancel={() => handleCancelDraft(draft.id)}
                                   />
                                ))}
                                <tr className="bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                   <td colSpan={7} className="p-2 border-b border-slate-100">
                                      <button onClick={() => handleAddDraft(cat)} className="text-xs font-semibold text-indigo-600 flex items-center justify-center gap-1 hover:text-indigo-800 transition-colors w-full rounded border border-dashed border-indigo-200 py-1.5 hover:bg-indigo-50/50">
                                         <Plus className="w-3 h-3" /> Add Row to '{cat}'
                                      </button>
                                   </td>
                                </tr>
                             </React.Fragment>
                          );
                       })}

                       {/* Unassociated Drafts (New Categories) */}
                       {drafts.filter(d => !uniqueCategories.includes(d.category)).map(draft => (
                          <DraftCheckItemRow 
                              key={draft.id} 
                              initialCategory={draft.category} 
                              equipmentId={selectedEqIdForItems} 
                              orderIndex={checkItems.filter(i => i.equipmentId === selectedEqIdForItems).length + 1}
                              uniqueCategories={uniqueCategories}
                              onSave={(data) => handleSaveDraft(draft.id, data)}
                              onCancel={() => handleCancelDraft(draft.id)}
                          />
                       ))}
                       
                       {/* Empty state when no unique categories exist at all */}
                       {uniqueCategories.length === 0 && drafts.length === 0 && (
                          <tr>
                             <td colSpan={7} className="p-8 text-center text-slate-400 italic font-medium bg-slate-50/50">
                                No parameters defined yet. Add the first one below.
                             </td>
                          </tr>
                       )}

                       <tr>
                          <td colSpan={7} className="p-4 bg-slate-50 border-t border-slate-200">
                             <button onClick={() => handleAddDraft('')} className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 w-fit mx-auto">
                                <Plus className="w-4 h-4" /> Add entirely New Category
                             </button>
                          </td>
                       </tr>
                     </tbody>
                   </table>
                 </div>
               </div>
             ) : (
                <div className="py-12 flex flex-col justify-center items-center text-slate-400 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
                   <ListChecks className="w-10 h-10 mb-3 text-slate-300" />
                   <p className="font-medium text-slate-500">Please select an equipment from the dropdown to manage its parameters.</p>
                </div>
            )}
          </div>
        )}

        {activeTab === 'qrcodes' && (
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-indigo-50 border border-indigo-100 p-4 sm:p-5 rounded-2xl flex gap-4 text-indigo-900 items-start">
               <div className="bg-white p-2 rounded-xl shrink-0 shadow-sm hidden sm:block">
                  <Info className="w-6 h-6 text-indigo-600" />
               </div>
               <div className="text-sm pt-0.5">
                  <h3 className="font-bold text-base text-indigo-800 mb-1 flex items-center gap-2"><Info className="w-5 h-5 text-indigo-600 sm:hidden" /> Equipment QR Code Information</h3>
                  <ul className="list-disc list-inside space-y-1.5 opacity-90 mt-2 text-indigo-800/80">
                    <li><strong>No Usage Limits:</strong> QR Codes encode a direct URL to the App scan page and never expire. You can scan them indefinitely.</li>
                    <li><strong>Anti-Fraud (Pencil Whipping) Active:</strong> Operators must physically be at the machine to scan the QR code to unlock the checklist.</li>
                    <li><strong>Scan Failures?</strong> If a camera is broken or the code is unreadable, operators can type in the equipment code manually as a fallback on the perform check page.</li>
                    <li><strong>Reprinting:</strong> You can click here to print new QR codes freely at any time.</li>
                  </ul>
               </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2 mb-4">Print Equipment QR Labels</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {equipments.map(eq => (
                  <div key={eq.id} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between hover:border-indigo-300 hover:shadow-md transition-all group bg-slate-50/50 hover:bg-white cursor-default relative overflow-hidden">
                    <div>
                       <p className="font-bold text-slate-900">{eq.name}</p>
                       <p className="text-xs text-slate-500 font-mono mt-0.5">{eq.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={() => setQrModalEq(eq)}
                         className="p-2.5 bg-white shadow-sm text-indigo-600 border border-slate-200 rounded-lg group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-colors"
                         title="Show QR Code"
                       >
                         <QrCode className="w-5 h-5" />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
              {equipments.length === 0 && <p className="text-sm text-slate-400 italic py-4">No equipment registered yet.</p>}
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {qrModalEq && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">Equipment QR</h3>
                  <p className="text-xs text-slate-500">Scan to open inspection terminal</p>
                </div>
                <button onClick={() => setQrModalEq(null)} className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 flex flex-col items-center justify-center bg-white space-y-6">
                <div className="p-4 bg-white border-2 border-slate-100 rounded-xl shadow-sm">
                  <QRCodeSVG 
                    value={`${window.location.origin}${window.location.pathname}?eqCode=${encodeURIComponent(qrModalEq.id)}`} 
                    size={200}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="text-center w-full">
                  <p className="font-bold text-lg text-slate-800">{qrModalEq.name}</p>
                  <p className="font-mono text-sm text-indigo-600 bg-indigo-50 py-1.5 px-3 rounded-lg w-fit mx-auto mt-2 border border-indigo-100">
                    {qrModalEq.code}
                  </p>
                </div>
                <button 
                  onClick={() => window.print()} 
                  className="w-full py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Print Label
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
