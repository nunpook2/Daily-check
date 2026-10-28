import React, { useState, useEffect, useMemo } from 'react';
import { differenceInCalendarDays, addDays, format } from 'date-fns';
import { fetchEquipments, fetchCheckItems, addEquipment, deleteEquipment, updateEquipment, addCheckItem, deleteCheckItem, updateCheckItem, fetchOperators, addOperator, deleteOperator, updateOperator, fetchTimeWindowSettings, fetchTimeWindowSettingsAsync, saveTimeWindowSettings } from '../lib/db';
import { Equipment, CheckItem, Operator, TimeWindowSettings, ShiftScope, getEquipmentShiftScope, getCheckItemShiftScope, calculate33ShiftGroups } from '../types';
import { Plus, Settings2, Users, MonitorSmartphone, QrCode, X, ListChecks, Info, Trash2, Edit2, Calendar, Printer, Clock, ArrowRight, Shuffle, Search, Briefcase, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';

// Helper for 3-3 rotation (12-Day Continuous Cycle based on Official Factory Shift Table)
// Automatically handles 2026, 2027, 2028, 2029, and beyond with 100% precision
const calculate33Groups = (date: Date) => {
  return calculate33ShiftGroups(date);
};

// Helper for 4-2 rotation (18-Day Cycle)
const calculate42Groups = (date: Date) => {
  const anchorDate = new Date('2026-01-01T00:00:00');
  const diffDays = differenceInCalendarDays(date, anchorDate);
  const cycleDay = ((diffDays % 18) + 18) % 18 + 1;
  
  let dayGroup: 'A' | 'B' | 'C' = 'C';
  let nightGroup: 'A' | 'B' | 'C' = 'A';
  let offGroup: 'A' | 'B' | 'C' = 'B';
  
  if (cycleDay >= 1 && cycleDay <= 2) {
    dayGroup = 'C'; nightGroup = 'A'; offGroup = 'B';
  } else if (cycleDay >= 3 && cycleDay <= 4) {
    dayGroup = 'B'; nightGroup = 'A'; offGroup = 'C';
  } else if (cycleDay >= 5 && cycleDay <= 6) {
    dayGroup = 'B'; nightGroup = 'C'; offGroup = 'A';
  } else if (cycleDay >= 7 && cycleDay <= 8) {
    dayGroup = 'A'; nightGroup = 'C'; offGroup = 'B';
  } else if (cycleDay >= 9 && cycleDay <= 10) {
    dayGroup = 'A'; nightGroup = 'B'; offGroup = 'C';
  } else if (cycleDay >= 11 && cycleDay <= 12) {
    dayGroup = 'C'; nightGroup = 'B'; offGroup = 'A';
  } else if (cycleDay >= 13 && cycleDay <= 14) {
    dayGroup = 'C'; nightGroup = 'A'; offGroup = 'B';
  } else if (cycleDay >= 15 && cycleDay <= 16) {
    dayGroup = 'B'; nightGroup = 'A'; offGroup = 'C';
  } else if (cycleDay >= 17 && cycleDay <= 18) {
    dayGroup = 'B'; nightGroup = 'C'; offGroup = 'A';
  }
  
  return { cycleDay, dayGroup, nightGroup, offGroup };
};

// Thai Date Formatter helpers
const getThaiDayName = (date: Date) => {
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  return days[date.getDay()];
};

const getThaiMonthName = (date: Date) => {
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return months[date.getMonth()];
};

const formatThaiDate = (date: Date) => {
  return `วัน${getThaiDayName(date)}ที่ ${date.getDate()} ${getThaiMonthName(date)} ${date.getFullYear() + 543}`;
};

const InlineCheckItemRow = ({ item, onDelete, onUpdate }: { item: CheckItem, onDelete: () => void, onUpdate: (updated: CheckItem) => Promise<void>, key?: any }) => {
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

const DraftCheckItemRow = ({ initialCategory, equipmentId, orderIndex, uniqueCategories, onSave, onCancel }: { initialCategory: string, equipmentId: string, orderIndex: number, uniqueCategories: string[], onSave: (item: Omit<CheckItem, 'id'>) => Promise<void>, onCancel: () => void, key?: any }) => {
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
  const [newOpRole, setNewOpRole] = useState<'operator' | 'shift_leader' | 'assistant'>('operator');
  const [newOpShift, setNewOpShift] = useState<'DAY' | 'NIGHT'>('DAY');

  // Personnel configuration and shift roster helper states
  const [personnelSubTab, setPersonnelSubTab] = useState<'directory' | 'calculator'>('directory');
  const [newOpClassification, setNewOpClassification] = useState<'employee' | 'assistant'>('employee');
  const [newOpShiftGroup, setNewOpShiftGroup] = useState<'A' | 'B' | 'C' | 'D'>('A');

  const [editingOpClassification, setEditingOpClassification] = useState<'employee' | 'assistant'>('employee');
  const [editingOpShiftGroup, setEditingOpShiftGroup] = useState<'A' | 'B' | 'C' | 'D'>('A');

  // Roster calculator states
  const [calendarYear, setCalendarYear] = useState<number>(2026);
  const [singleDate, setSingleDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const initialTw = useMemo(() => fetchTimeWindowSettings(), []);
  const [dayStart, setDayStart] = useState(initialTw.dayStart || '08:00');
  const [dayEnd, setDayEnd] = useState(initialTw.dayEnd || '10:00');
  const [nightStart, setNightStart] = useState(initialTw.nightStart || '20:00');
  const [nightEnd, setNightEnd] = useState(initialTw.nightEnd || '22:00');
  const [isSavingTw, setIsSavingTw] = useState(false);
  const [twSavedSuccess, setTwSavedSuccess] = useState(false);
  const [twError, setTwError] = useState<string | null>(null);
  
  // Modal state
  const [qrModalEq, setQrModalEq] = useState<Equipment | null>(null);
  
  // Form State - Equipment
  const [newEqName, setNewEqName] = useState('');
  const [newEqCode, setNewEqCode] = useState('');
  const [newEqLoc, setNewEqLoc] = useState('');
  const [newEqDoc, setNewEqDoc] = useState('');
  const [newEqShift, setNewEqShift] = useState<ShiftScope>('ALL');
  
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
    const [eqs, itms, ops, tw] = await Promise.all([
      fetchEquipments(),
      fetchCheckItems(),
      fetchOperators(),
      fetchTimeWindowSettingsAsync()
    ]);
    if (tw) {
      setDayStart(tw.dayStart || '08:00');
      setDayEnd(tw.dayEnd || '10:00');
      setNightStart(tw.nightStart || '20:00');
      setNightEnd(tw.nightEnd || '22:00');
    }
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
      applicableShift: newEqShift,
      status: 'active',
      createdAt: Date.now()
    });
    setNewEqName(''); setNewEqCode(''); setNewEqLoc(''); setNewEqDoc(''); setNewEqShift('ALL');
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
    
    let finalRole: 'operator' | 'shift_leader' | 'assistant' = 'operator';
    if (newOpClassification === 'assistant') {
      finalRole = 'assistant';
    } else {
      // If it's currently set to 'assistant' but they are an employee, fall back to 'operator'
      finalRole = (newOpRole === 'assistant' ? 'operator' : newOpRole) as any;
    }

    await addOperator({
      name: newOpName,
      employeeId: newOpId,
      isActive: true,
      role: finalRole,
      classification: newOpClassification,
      shiftGroup: newOpShiftGroup,
      shift: (newOpClassification === 'employee' && (newOpShiftGroup === 'A' || newOpShiftGroup === 'C')) ? 'DAY' : 'NIGHT'
    });
    setNewOpName(''); setNewOpId('');
    await loadData();
  };

  const [confirmDeleteOpId, setConfirmDeleteOpId] = useState<string | null>(null);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editingOpName, setEditingOpName] = useState<string>('');
  const [editingOpRole, setEditingOpRole] = useState<'operator' | 'shift_leader' | 'assistant'>('operator');
  const [editingOpShift, setEditingOpShift] = useState<'DAY' | 'NIGHT'>('DAY');

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
    setEditingOpRole(op.role || 'operator');
    setEditingOpClassification(op.classification || 'employee');
    setEditingOpShiftGroup(op.shiftGroup || 'A');
    setEditingOpShift(op.shift || 'DAY');
  };

  const handleSaveTimeWindows = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsSavingTw(true);
    setTwSavedSuccess(false);
    setTwError(null);
    try {
      await saveTimeWindowSettings({
        dayStart,
        dayEnd,
        nightStart,
        nightEnd
      });
      setIsSavingTw(false);
      setTwSavedSuccess(true);
      setTimeout(() => setTwSavedSuccess(false), 4500);
    } catch (err: any) {
      console.error("Save time windows error:", err);
      setIsSavingTw(false);
      setTwError(err?.message || 'ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const submitEditOperator = async (id: string) => {
    if (editingOpName) {
      let finalRole = editingOpRole;
      if (editingOpClassification === 'assistant') {
        finalRole = 'assistant';
      } else if (editingOpRole === 'assistant') {
        finalRole = 'operator';
      }

      await updateOperator(id, {
        name: editingOpName,
        role: finalRole,
        classification: editingOpClassification,
        shiftGroup: editingOpShiftGroup,
        shift: (editingOpClassification === 'employee' && (editingOpShiftGroup === 'A' || editingOpShiftGroup === 'C')) ? 'DAY' : 'NIGHT'
      });
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
          <div className="xl:col-span-2 space-y-6">
            {/* Sub-navigation for Personnel section */}
            <div className="flex flex-col sm:flex-row gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setPersonnelSubTab('directory')}
                className={cn("px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all outline-none border cursor-pointer",
                  personnelSubTab === 'directory' 
                    ? "bg-indigo-600 text-white shadow-sm border-indigo-600" 
                    : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200")}
              >
                <Users className="w-4 h-4 text-current" />
                <span>1. จัดการรายชื่อและตำแหน่งพนักงาน (Personnel Setup)</span>
              </button>
              <button
                type="button"
                onClick={() => setPersonnelSubTab('calculator')}
                className={cn("px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all outline-none border cursor-pointer",
                  personnelSubTab === 'calculator' 
                    ? "bg-indigo-600 text-white shadow-sm border-indigo-600" 
                    : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200")}
              >
                <Calendar className="w-4 h-4 text-current" />
                <span>2. ระบบจัดเวรกะประจำวันตามรอบวงโคจร (Roster Calculator)</span>
              </button>
            </div>

            {personnelSubTab === 'directory' ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Add Personnel and Settings on the Left */}
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-4 h-fit">
                    <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      ลงทะเบียนพนักงาน/ผู้ช่วยใหม่
                    </h2>
                    <form onSubmit={handleAddOperator} className="space-y-4">
                       <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">ชื่อพนักงาน *</label>
                          <input type="text" required value={newOpName} onChange={e => setNewOpName(e.target.value)}
                                 className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium text-sm" placeholder="เช่น นายสมชาย จริงใจ" />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">รหัสพนักงาน (Employee ID) *</label>
                          <input type="text" required value={newOpId} onChange={e => setNewOpId(e.target.value)}
                                 className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm" placeholder="เช่น SC-101" />
                       </div>
                       
                       <div className="grid grid-cols-2 gap-3">
                          <div>
                             <label className="block text-xs font-bold text-slate-700 mb-1">ประเภทกำลังพล (Type) *</label>
                             <select 
                                value={newOpClassification} 
                                onChange={e => {
                                  const val = e.target.value as any;
                                  setNewOpClassification(val);
                                  if (val === 'assistant') {
                                    setNewOpRole('assistant');
                                    setNewOpShiftGroup('A');
                                  } else {
                                    setNewOpRole('operator');
                                    setNewOpShiftGroup('A');
                                  }
                                }}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-xs font-semibold"
                             >
                                <option value="employee">พนักงานปฏิบัติงาน (Employee - 3-3 Pattern)</option>
                                <option value="assistant">ผู้ช่วยสนับสนุน (Assistant - 4-2 Pattern)</option>
                             </select>
                          </div>
                          <div>
                             <label className="block text-xs font-bold text-slate-700 mb-1">กลุ่มเวรกะ (Shift Group) *</label>
                             <select 
                                value={newOpShiftGroup} 
                                onChange={e => setNewOpShiftGroup(e.target.value as any)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-xs font-bold"
                             >
                                <option value="A">กะ A (Group A)</option>
                                <option value="B">กะ B (Group B)</option>
                                <option value="C">กะ C (Group C)</option>
                                {newOpClassification === 'employee' && <option value="D">กะ D (Group D)</option>}
                             </select>
                          </div>
                       </div>

                       <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">ตำแหน่งปฏิบัติการ (Roster Role)</label>
                          <select 
                             value={newOpRole} 
                             onChange={e => setNewOpRole(e.target.value as any)}
                             disabled={newOpClassification === 'assistant'}
                             className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-xs font-semibold disabled:bg-slate-50 disabled:text-slate-500"
                          >
                             {newOpClassification === 'employee' ? (
                               <>
                                 <option value="operator">สมาชิกกะ (Shift Member / Operator)</option>
                                 <option value="shift_leader">หัวหน้ากะประจำกลุ่ม (Shift Leader)</option>
                               </>
                             ) : (
                               <option value="assistant">ผู้ช่วยปฏิบัติงานกะ (Assistant)</option>
                             )}
                          </select>
                       </div>

                       <button type="submit" className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors w-full cursor-pointer text-xs">
                          <Plus className="w-4 h-4" /> เพิ่มพนักงานเข้าระบบจัดกะ
                       </button>
                    </form>
                  </div>
                  
                  {/* Time Window Settings */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-600" />
                        ⏰ ตั้งค่าเกณฑ์รอบเวลาตรวจสอบ (Time Windows)
                      </h2>
                      {twSavedSuccess && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black rounded-full animate-pulse">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          บันทึกสำเร็จ
                        </span>
                      )}
                    </div>
                    
                    <form onSubmit={handleSaveTimeWindows} className="space-y-4">
                        <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
                           กำหนดช่วงเวลาสำหรับเช็กประจำรอบ (Daily) หากผู้ปฏิบัติงานสแกนคีย์นอกช่วงเวลานี้ ระบบจะขึ้นสถานะ "ตรวจช้า (Late)" บนไทม์ไลน์
                        </p>

                        {/* Interactive Status Banners */}
                        {twSavedSuccess && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs font-bold shadow-xs">
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>✓ บันทึกเกณฑ์รอบเวลาตรวจสอบเรียบร้อยแล้ว (เช้า: {dayStart} - {dayEnd} น. / ดึก: {nightStart} - {nightEnd} น.) ข้อมูลซิงค์ทุกอุปกรณ์ทันที</span>
                          </div>
                        )}

                        {twError && (
                          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-bold">
                            <span>❌ {twError}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                           <div>
                              <label className="block text-[11px] font-black text-slate-700 mb-1">🌞 กะเช้า เริ่ม (Day Start)</label>
                              <input type="time" required value={dayStart} onChange={e => setDayStart(e.target.value)}
                                     className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white" />
                           </div>
                           <div>
                              <label className="block text-[11px] font-black text-slate-700 mb-1">🌞 กะเช้า สิ้นสุด (Day End)</label>
                              <input type="time" required value={dayEnd} onChange={e => setDayEnd(e.target.value)}
                                     className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white" />
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           <div>
                              <label className="block text-[11px] font-black text-slate-700 mb-1">🌙 กะดึก เริ่ม (Night Start)</label>
                              <input type="time" required value={nightStart} onChange={e => setNightStart(e.target.value)}
                                     className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white" />
                           </div>
                           <div>
                              <label className="block text-[11px] font-black text-slate-700 mb-1">🌙 กะดึก สิ้นสุด (Night End)</label>
                              <input type="time" required value={nightEnd} onChange={e => setNightEnd(e.target.value)}
                                     className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white" />
                           </div>
                        </div>

                        <button 
                          type="button" 
                          onClick={() => handleSaveTimeWindows()}
                          disabled={isSavingTw}
                          className={cn(
                            "w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-black rounded-xl transition-all text-xs cursor-pointer shadow-xs active:scale-[0.99]",
                            twSavedSuccess 
                              ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" 
                              : "bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400"
                          )}
                        >
                          {isSavingTw ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>กำลังบันทึกข้อมูล...</span>
                            </>
                          ) : twSavedSuccess ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span>✓ บันทึกเกณฑ์เวลาสำเร็จเรียบร้อยแล้ว</span>
                            </>
                          ) : (
                            <>
                              <span>บันทึกเกณฑ์รอบเวลาตรวจ</span>
                            </>
                          )}
                        </button>
                    </form>
                  </div>
                </div>

                {/* Operator List on the Right */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      ทำเนียบพนักงานและผู้ช่วย ({operators.length} คน)
                    </h2>
                  </div>

                  {/* Search box */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="ค้นหาชื่อ หรือรหัสพนักงาน..." 
                      value={singleDate === 'SEARCH_PLACEHOLDER' ? '' : (singleDate === 'SEARCH_PLACEHOLDER_TEMP' ? '' : (window as any)._opSearch || '')}
                      onChange={e => {
                        (window as any)._opSearch = e.target.value;
                        loadData(); // trigger re-render
                      }}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-xs font-medium" 
                    />
                  </div>

                  <ul className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto pr-1">
                    {operators
                      .filter(op => {
                        const q = ((window as any)._opSearch || '').toLowerCase();
                        if (!q) return true;
                        return op.name.toLowerCase().includes(q) || op.employeeId.toLowerCase().includes(q);
                      })
                      .map(op => {
                        const opClass = op.classification || 'employee';
                        const opGroup = op.shiftGroup || 'A';
                        
                        return (
                          <li key={op.id} className="py-4 flex justify-between items-start sm:items-center gap-4 group">
                            <div className="flex-1 min-w-0">
                               {editingOpId === op.id ? (
                                  <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                     <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ชื่อพนักงาน</label>
                                        <input 
                                          type="text" 
                                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:border-indigo-500 bg-white font-bold"
                                          value={editingOpName}
                                          onChange={(e) => setEditingOpName(e.target.value)}
                                          autoFocus
                                        />
                                     </div>
                                     
                                     <div className="grid grid-cols-2 gap-2">
                                        <div>
                                           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ประเภท</label>
                                           <select
                                              value={editingOpClassification}
                                              onChange={e => {
                                                const val = e.target.value as any;
                                                setEditingOpClassification(val);
                                                if (val === 'assistant') {
                                                  setEditingOpRole('assistant');
                                                  setEditingOpShiftGroup('A');
                                                } else {
                                                  setEditingOpRole('operator');
                                                  setEditingOpShiftGroup('A');
                                                }
                                              }}
                                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-bold"
                                           >
                                              <option value="employee">พนักงาน (3-3)</option>
                                              <option value="assistant">ผู้ช่วย (4-2)</option>
                                           </select>
                                        </div>
                                        <div>
                                           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">กลุ่มเวรกะ</label>
                                           <select
                                              value={editingOpShiftGroup}
                                              onChange={e => setEditingOpShiftGroup(e.target.value as any)}
                                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-bold"
                                           >
                                              <option value="A">กะ A</option>
                                              <option value="B">กะ B</option>
                                              <option value="C">กะ C</option>
                                              {editingOpClassification === 'employee' && <option value="D">กะ D</option>}
                                           </select>
                                        </div>
                                     </div>

                                     <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ตำแหน่งในกะ</label>
                                        <select
                                           value={editingOpRole}
                                           onChange={e => setEditingOpRole(e.target.value as any)}
                                           disabled={editingOpClassification === 'assistant'}
                                           className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-bold disabled:bg-slate-100"
                                        >
                                           {editingOpClassification === 'employee' ? (
                                             <>
                                               <option value="operator">พนักงานกะ (Operator)</option>
                                               <option value="shift_leader">หัวหน้ากะ (Shift Leader)</option>
                                             </>
                                           ) : (
                                             <option value="assistant">ผู้ช่วยกะ (Assistant)</option>
                                           )}
                                        </select>
                                     </div>
                                  </div>
                               ) : (
                                  <div>
                                     <p className="font-extrabold text-slate-900 text-sm flex flex-wrap items-center gap-1.5">
                                        {op.name}
                                        <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase", 
                                           opClass === 'employee' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-cyan-50 text-cyan-700 border border-cyan-100"
                                        )}>
                                           {opClass === 'employee' ? 'พนักงาน 3-3' : 'ผู้ช่วย 4-2'}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-indigo-50 text-indigo-700 border border-indigo-150">
                                           กะ {opGroup}
                                        </span>
                                        <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black uppercase", 
                                           op.role === 'shift_leader' ? "bg-purple-100 text-purple-800 border border-purple-200" : 
                                           op.role === 'assistant' ? "bg-sky-100 text-sky-800 border border-sky-200" : "bg-slate-100 text-slate-700 border border-slate-200"
                                        )}>
                                           {op.role === 'shift_leader' ? '⭐ Leader' : op.role === 'assistant' ? 'Assistant' : 'Member'}
                                        </span>
                                     </p>
                                     <p className="text-[10px] text-slate-500 font-mono mt-0.5 font-bold">รหัส: {op.employeeId}</p>
                                  </div>
                               )}
                            </div>
                            <div className="flex gap-1 items-center shrink-0">
                               {editingOpId === op.id ? (
                                  <div className="flex flex-col sm:flex-row gap-1">
                                     <button onClick={() => submitEditOperator(op.id!)} className="px-3 py-1.5 text-[10px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer">Save</button>
                                     <button onClick={() => setEditingOpId(null)} className="px-3 py-1.5 text-[10px] font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer">Cancel</button>
                                  </div>
                               ) : confirmDeleteOpId === op.id ? (
                                  <div className="flex items-center gap-1">
                                     <span className="text-[10px] font-bold text-rose-500">Confirm?</span>
                                     <button onClick={() => handleDeleteOperator(op.id!)} className="px-2 py-1 text-[10px] font-bold text-white bg-rose-600 rounded cursor-pointer">Yes</button>
                                     <button onClick={() => setConfirmDeleteOpId(null)} className="px-2 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 rounded cursor-pointer">No</button>
                                  </div>
                               ) : (
                                  <div className="flex items-center gap-1">
                                     <button onClick={() => handleEditOperator(op)} className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent rounded-lg sm:hidden group-hover:block transition-all cursor-pointer">
                                        <Edit2 className="w-3.5 h-3.5" />
                                     </button>
                                     <button onClick={() => handleDeleteOperator(op.id!)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 border border-transparent rounded-lg sm:hidden group-hover:block transition-all cursor-pointer">
                                        <Trash2 className="w-3.5 h-3.5" />
                                     </button>
                                  </div>
                               )}
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              </div>
            ) : (
              /* SHIFT ROSTER CALCULATOR SUBTAB */
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-4 sm:p-6 text-white shadow-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-indigo-400" />
                    โปรแกรมคำนวณเวรกะประจำวันอัตโนมัติ (Shift Roster Matrix)
                  </h2>
                  <p className="text-indigo-200/90 text-xs mt-1.5 font-bold leading-relaxed max-w-4xl">
                     คำนวณกลุ่มปฏิบัติงานตามวงโคจรรอบ 12 วันของพนักงาน (3-3 Pattern) และรอบ 18 วันของผู้ช่วย (4-2 Pattern) จากจุดเริ่มอ้างอิง Anchor Date วันที่ 1 มกราคม พ.ศ. 2569 (2026-01-01) เที่ยงตรง ได้แม่นยำทุกวัน
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Day Query View */}
                  <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 h-fit">
                    <h3 className="text-sm font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      1. ตรวจเช็คเวรประจำวันเดี่ยว
                    </h3>
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">เลือกวันที่ต้องการตรวจสอบ</label>
                      <input 
                        type="date" 
                        value={singleDate} 
                        onChange={e => setSingleDate(e.target.value)}
                        className="w-full px-3 py-2 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm bg-indigo-50/20 text-indigo-900" 
                      />
                    </div>

                    {/* Calculation Results Card */}
                    {(() => {
                      const queryD = new Date(singleDate + 'T00:00:00');
                      const r33 = calculate33Groups(queryD);
                      const r42 = calculate42Groups(queryD);
                      
                      const employeesOnDay = operators.filter(o => o.isActive && (!o.classification || o.classification === 'employee') && o.shiftGroup === r33.dayGroup);
                      const employeesOnNight = operators.filter(o => o.isActive && (!o.classification || o.classification === 'employee') && o.shiftGroup === r33.nightGroup);
                      const employeesOff = operators.filter(o => o.isActive && (!o.classification || o.classification === 'employee') && (o.shiftGroup === r33.offDayGroup || o.shiftGroup === r33.offNightGroup));

                      const assistantsOnDay = operators.filter(o => o.isActive && o.classification === 'assistant' && o.shiftGroup === r42.dayGroup);
                      const assistantsOnNight = operators.filter(o => o.isActive && o.classification === 'assistant' && o.shiftGroup === r42.nightGroup);
                      const assistantsOff = operators.filter(o => o.isActive && o.classification === 'assistant' && o.shiftGroup === r42.offGroup);

                      return (
                        <div className="space-y-4 pt-2">
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-center">
                            <p className="text-xs font-extrabold text-slate-500 uppercase">วันที่คำนวณ</p>
                            <p className="text-base font-black text-slate-900">{formatThaiDate(queryD)}</p>
                            <div className="flex justify-center gap-2 pt-1.5">
                              <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-150">
                                รอบ 3-3: วันที่ {r33.cycleDay}/12
                              </span>
                              <span className="text-[10px] font-black bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded border border-cyan-150">
                                รอบ 4-2: วันที่ {r42.cycleDay}/18
                              </span>
                            </div>
                          </div>

                          {/* Quick details */}
                          <div className="space-y-3.5">
                            {/* Day Shift details */}
                            <div className="border-l-4 border-amber-500 bg-amber-50/20 p-3 rounded-r-xl space-y-2">
                              <h4 className="text-xs font-black text-amber-800 uppercase flex items-center justify-between">
                                <span className="flex items-center gap-1">🌞 กะเช้า (DAY - 08:00 - 20:00)</span>
                              </h4>
                              <div className="text-[11px] space-y-1 text-slate-700 font-medium">
                                <p className="font-bold text-slate-900">พนักงานกะ (Group {r33.dayGroup}):</p>
                                {employeesOnDay.length > 0 ? (
                                  <ul className="list-disc list-inside pl-1 space-y-0.5 font-semibold">
                                    {employeesOnDay.map(o => (
                                      <li key={o.id}>{o.name} <span className="text-slate-400 font-mono text-[9px]">({o.role === 'shift_leader' ? '⭐ Leader' : 'Member'})</span></li>
                                    ))}
                                  </ul>
                                ) : <p className="text-slate-400 pl-1">ไม่มีข้อมูลพนักงานที่ลงทะเบียนในกะ {r33.dayGroup}</p>}

                                <p className="font-bold text-slate-900 mt-2">ผู้ช่วยสนับสนุน (Group {r42.dayGroup}):</p>
                                {assistantsOnDay.length > 0 ? (
                                  <ul className="list-disc list-inside pl-1 space-y-0.5 font-semibold">
                                    {assistantsOnDay.map(o => <li key={o.id}>{o.name} <span className="text-slate-400 font-mono text-[9px]">(Assistant)</span></li>)}
                                  </ul>
                                ) : <p className="text-slate-400 pl-1">ไม่มีข้อมูลผู้ช่วยที่ลงทะเบียนในกะ {r42.dayGroup}</p>}
                              </div>
                            </div>

                            {/* Night Shift details */}
                            <div className="border-l-4 border-indigo-600 bg-indigo-50/20 p-3 rounded-r-xl space-y-2">
                              <h4 className="text-xs font-black text-indigo-900 uppercase flex items-center justify-between">
                                <span className="flex items-center gap-1">🌙 กะดึก (NIGHT - 20:00 - 08:00)</span>
                              </h4>
                              <div className="text-[11px] space-y-1 text-slate-700 font-medium">
                                <p className="font-bold text-slate-900">พนักงานกะ (Group {r33.nightGroup}):</p>
                                {employeesOnNight.length > 0 ? (
                                  <ul className="list-disc list-inside pl-1 space-y-0.5 font-semibold">
                                    {employeesOnNight.map(o => (
                                      <li key={o.id}>{o.name} <span className="text-slate-400 font-mono text-[9px]">({o.role === 'shift_leader' ? '⭐ Leader' : 'Member'})</span></li>
                                    ))}
                                  </ul>
                                ) : <p className="text-slate-400 pl-1">ไม่มีข้อมูลพนักงานที่ลงทะเบียนในกะ {r33.nightGroup}</p>}

                                <p className="font-bold text-slate-900 mt-2">ผู้ช่วยสนับสนุน (Group {r42.nightGroup}):</p>
                                {assistantsOnNight.length > 0 ? (
                                  <ul className="list-disc list-inside pl-1 space-y-0.5 font-semibold">
                                    {assistantsOnNight.map(o => <li key={o.id}>{o.name} <span className="text-slate-400 font-mono text-[9px]">(Assistant)</span></li>)}
                                  </ul>
                                ) : <p className="text-slate-400 pl-1">ไม่มีข้อมูลผู้ช่วยที่ลงทะเบียนในกะ {r42.nightGroup}</p>}
                              </div>
                            </div>

                            {/* Off Duty details */}
                            <div className="border-l-4 border-slate-400 bg-slate-50/50 p-3 rounded-r-xl space-y-2">
                              <h4 className="text-xs font-black text-slate-600 uppercase flex items-center gap-1">
                                <Shuffle className="w-3.5 h-3.5" /> เวรหยุดกะ (OFF DUTY)
                              </h4>
                              <div className="text-[11px] space-y-1 text-slate-500 font-medium leading-relaxed">
                                <p><span className="font-bold text-slate-700">พนักงานพัก (Groups {r33.offDayGroup}, {r33.offNightGroup}):</span> {employeesOff.length > 0 ? employeesOff.map(o => o.name).join(', ') : 'ไม่มีข้อมูล'}</p>
                                <p><span className="font-bold text-slate-700">ผู้ช่วยพัก (Group {r42.offGroup}):</span> {assistantsOff.length > 0 ? assistantsOff.map(o => o.name).join(', ') : 'ไม่มีข้อมูล'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right Column: Range Report View */}
                  <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Printer className="w-4 h-4" />
                        2. พิมพ์ตารางเวรแบบช่วงวันที่ (Roster Range Matrix)
                      </h3>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg text-xs hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        <Printer className="w-3.5 h-3.5" /> พิมพ์เอกสารตารางเวร
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">วันที่เริ่มต้น (Start Date)</label>
                        <input 
                          type="date" 
                          value={startDate} 
                          onChange={e => setStartDate(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 focus:bg-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">วันที่สิ้นสุด (End Date)</label>
                        <input 
                          type="date" 
                          value={endDate} 
                          onChange={e => setEndDate(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 focus:bg-white" 
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-150 rounded-xl shadow-xs print:border-none print:shadow-none max-h-[500px] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold sticky top-0 z-15">
                            <th className="p-3">วันที่ & วันธรรมดา</th>
                            <th className="p-3 border-l">พนักงานปฏิบัติการ 3-3 (Employees)</th>
                            <th className="p-3 border-l">ผู้ช่วยสนับสนุน 4-2 (Assistants)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {(() => {
                            const rows = [];
                            let current = new Date(startDate + 'T00:00:00');
                            const last = new Date(endDate + 'T00:00:00');
                            
                            // limit safe iteration to prevent browser freeze
                            let iterations = 0;
                            while (current <= last && iterations < 31) {
                              iterations++;
                              const queryD = new Date(current);
                              const r33 = calculate33Groups(queryD);
                              const r42 = calculate42Groups(queryD);

                              // Active people lists
                              const employeesOnDay = operators.filter(o => o.isActive && (!o.classification || o.classification === 'employee') && o.shiftGroup === r33.dayGroup);
                              const employeesOnNight = operators.filter(o => o.isActive && (!o.classification || o.classification === 'employee') && o.shiftGroup === r33.nightGroup);
                              const employeesOff = operators.filter(o => o.isActive && (!o.classification || o.classification === 'employee') && (o.shiftGroup === r33.offDayGroup || o.shiftGroup === r33.offNightGroup));

                              const assistantsOnDay = operators.filter(o => o.isActive && o.classification === 'assistant' && o.shiftGroup === r42.dayGroup);
                              const assistantsOnNight = operators.filter(o => o.isActive && o.classification === 'assistant' && o.shiftGroup === r42.nightGroup);
                              const assistantsOff = operators.filter(o => o.isActive && o.classification === 'assistant' && o.shiftGroup === r42.offGroup);

                              rows.push(
                                <tr key={queryD.getTime()} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3 font-semibold text-slate-900 bg-slate-50/50 min-w-[130px]">
                                    <div className="font-extrabold">{getThaiDayName(queryD)} {queryD.getDate()} {getThaiMonthName(queryD).substring(0, 6)}</div>
                                    <div className="text-[10px] text-slate-400 font-semibold font-mono mt-0.5">
                                      3-3: D{r33.cycleDay} | 4-2: D{r42.cycleDay}
                                    </div>
                                  </td>
                                  <td className="p-3 border-l space-y-1.5 text-[11px] leading-relaxed">
                                    <div>
                                      <span className="inline-block px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-black text-[9px] mr-1">🌞 DAY (กะ {r33.dayGroup})</span>
                                      <span className="font-semibold text-slate-800">
                                        {employeesOnDay.map(o => `${o.name}${o.role === 'shift_leader' ? ' (Leader)' : ''}`).join(', ') || 'ไม่มีข้อมูล'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="inline-block px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded font-black text-[9px] mr-1">🌙 NIGHT (กะ {r33.nightGroup})</span>
                                      <span className="font-semibold text-slate-800">
                                        {employeesOnNight.map(o => `${o.name}${o.role === 'shift_leader' ? ' (Leader)' : ''}`).join(', ') || 'ไม่มีข้อมูล'}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 leading-none">
                                      <span className="font-bold">OFF (พัก กะ {r33.offDayGroup}, {r33.offNightGroup}):</span> {employeesOff.map(o => o.name).join(', ') || 'ไม่มีข้อมูล'}
                                    </div>
                                  </td>
                                  <td className="p-3 border-l space-y-1.5 text-[11px] leading-relaxed">
                                    <div>
                                      <span className="inline-block px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-black text-[9px] mr-1">🌞 DAY (กะ {r42.dayGroup})</span>
                                      <span className="font-semibold text-slate-800">
                                        {assistantsOnDay.map(o => o.name).join(', ') || 'ไม่มีข้อมูล'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="inline-block px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded font-black text-[9px] mr-1">🌙 NIGHT (กะ {r42.nightGroup})</span>
                                      <span className="font-semibold text-slate-800">
                                        {assistantsOnNight.map(o => o.name).join(', ') || 'ไม่มีข้อมูล'}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 leading-none">
                                      <span className="font-bold">OFF (พัก กะ {r42.offGroup}):</span> {assistantsOff.map(o => o.name).join(', ') || 'ไม่มีข้อมูล'}
                                    </div>
                                  </td>
                                </tr>
                              );
                              current = addDays(current, 1);
                            }
                            return rows;
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* 3. OFFICIAL 12-MONTH ANNUAL SHIFT MASTER TABLE (Matching Factory Standard) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                          Standard 3-3 Master Shift Calendar
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          ✓ คำนวณอัตโนมัติข้ามปี
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
                        <span>📅 ตารางเวรกะ 3 วัน หยุด 3 วัน ประจำปี (12 เดือนเต็ม)</span>
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        โครงสร้างตรงตามเอกสารตารางกะทางการของโรงงาน และหมุนเวียนต่อเนื่องอัตโนมัติสำหรับปี 2026, 2027, 2028, 2029 เป็นต้นไป
                      </p>
                    </div>

                    {/* Year Selector */}
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
                      <span className="text-xs font-black text-slate-600 pl-2">เลือกปี:</span>
                      <select 
                        value={calendarYear}
                        onChange={e => setCalendarYear(Number(e.target.value))}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-black text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                      >
                        {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map(y => (
                          <option key={y} value={y}>
                            ค.ศ. {y} (พ.ศ. {y + 543}) {y === 2026 ? '★ ปีปัจจุบัน' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Legend & Summary */}
                  <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                    <span className="font-bold text-slate-500">สัญลักษณ์กลุ่มกะ:</span>
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> กะ A
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> กะ B
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span> กะ C
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span> กะ D
                    </span>
                    <span className="ml-auto text-[11px] text-slate-400 font-mono">
                      สูตรหมุนเวียน 12 วัน: A → C → B → D
                    </span>
                  </div>

                  {/* 12-Month Table matching PDF style */}
                  <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-2xl bg-white shadow-2xs">
                    <table className="w-full text-center border-collapse min-w-[980px] text-[10px]">
                      <thead>
                        <tr className="bg-slate-900 text-white font-mono text-[10px]">
                          <th className="p-2 border-r border-slate-800 w-32 text-left pl-3 font-sans font-black">เดือน / กะ</th>
                          {Array.from({ length: 31 }, (_, i) => (
                            <th key={i + 1} className="p-1 border-r border-slate-800 w-7 font-black">
                              {i + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono">
                        {(() => {
                          const thaiMonthDefs = [
                            { num: 1, th: 'มกราคม', en: 'JANUARY' },
                            { num: 2, th: 'กุมภาพันธ์', en: 'FEBRUARY' },
                            { num: 3, th: 'มีนาคม', en: 'MARCH' },
                            { num: 4, th: 'เมษายน', en: 'APRIL' },
                            { num: 5, th: 'พฤษภาคม', en: 'MAY' },
                            { num: 6, th: 'มิถุนายน', en: 'JUNE' },
                            { num: 7, th: 'กรกฎาคม', en: 'JULY' },
                            { num: 8, th: 'สิงหาคม', en: 'AUGUST' },
                            { num: 9, th: 'กันยายน', en: 'SEPTEMBER' },
                            { num: 10, th: 'ตุลาคม', en: 'OCTOBER' },
                            { num: 11, th: 'พฤศจิกายน', en: 'NOVEMBER' },
                            { num: 12, th: 'ธันวาคม', en: 'DECEMBER' }
                          ];

                          const dayShortNames = ['SU', 'M', 'TU', 'W', 'TH', 'F', 'SA'];

                          const getGroupStyle = (g: string) => {
                            if (g === 'A') return 'bg-emerald-100 text-emerald-800 font-black';
                            if (g === 'B') return 'bg-amber-100 text-amber-800 font-black';
                            if (g === 'C') return 'bg-sky-100 text-sky-800 font-black';
                            if (g === 'D') return 'bg-purple-100 text-purple-800 font-black';
                            return 'text-slate-400';
                          };

                          return thaiMonthDefs.map((mDef) => {
                            const daysInMonth = new Date(calendarYear, mDef.num, 0).getDate();
                            const monthData = Array.from({ length: 31 }, (_, dayIdx) => {
                              const dayNum = dayIdx + 1;
                              if (dayNum > daysInMonth) return null;
                              const d = new Date(calendarYear, mDef.num - 1, dayNum, 12, 0, 0);
                              const shiftInfo = calculate33ShiftGroups(d);
                              const dayOfWeek = dayShortNames[d.getDay()];
                              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                              return {
                                dayNum,
                                dayOfWeek,
                                isWeekend,
                                ...shiftInfo
                              };
                            });

                            return (
                              <React.Fragment key={mDef.num}>
                                {/* Month Header & Day of Week */}
                                <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-slate-600">
                                  <td className="p-1 text-left pl-3 font-sans font-black text-slate-800 border-r border-slate-200 text-[11px]">
                                    {mDef.th} <span className="text-[9px] text-slate-400 block font-mono font-normal">{mDef.en}</span>
                                  </td>
                                  {monthData.map((d, idx) => (
                                    <td 
                                      key={idx} 
                                      className={cn(
                                        "p-0.5 border-r border-slate-200 font-mono text-[9px]",
                                        !d ? "bg-slate-100/40 text-transparent" : (d.isWeekend ? "bg-amber-50 text-amber-900 font-black" : "text-slate-600")
                                      )}
                                    >
                                      {d ? d.dayOfWeek : ''}
                                    </td>
                                  ))}
                                </tr>

                                {/* DAY Shift Row */}
                                <tr className="hover:bg-slate-50 transition-colors">
                                  <td className="p-1 text-left pl-3 font-sans font-bold text-slate-700 border-r border-slate-200 bg-amber-50/20 text-[10px]">
                                    ☀️ DAY
                                  </td>
                                  {monthData.map((d, idx) => (
                                    <td 
                                      key={idx} 
                                      className={cn(
                                        "p-1 border-r border-slate-200 text-[10px]",
                                        d ? getGroupStyle(d.dayGroup) : "bg-slate-50 text-transparent"
                                      )}
                                    >
                                      {d ? d.dayGroup : ''}
                                    </td>
                                  ))}
                                </tr>

                                {/* NIGHT Shift Row */}
                                <tr className="hover:bg-slate-50 transition-colors">
                                  <td className="p-1 text-left pl-3 font-sans font-bold text-slate-700 border-r border-slate-200 bg-indigo-50/20 text-[10px]">
                                    🌙 NIGHT
                                  </td>
                                  {monthData.map((d, idx) => (
                                    <td 
                                      key={idx} 
                                      className={cn(
                                        "p-1 border-r border-slate-200 text-[10px]",
                                        d ? getGroupStyle(d.nightGroup) : "bg-slate-50 text-transparent"
                                      )}
                                    >
                                      {d ? d.nightGroup : ''}
                                    </td>
                                  ))}
                                </tr>

                                {/* Off Day Row */}
                                <tr className="hover:bg-slate-50 transition-colors text-slate-500 bg-slate-50/40">
                                  <td className="p-0.5 text-left pl-3 font-sans text-slate-400 border-r border-slate-200 text-[9px]">
                                    Off day
                                  </td>
                                  {monthData.map((d, idx) => (
                                    <td 
                                      key={idx} 
                                      className={cn(
                                        "p-0.5 border-r border-slate-200 text-[9px] font-bold",
                                        d ? "text-slate-500" : "text-transparent"
                                      )}
                                    >
                                      {d ? d.offDayGroup : ''}
                                    </td>
                                  ))}
                                </tr>

                                {/* Off Night Row */}
                                <tr className="hover:bg-slate-50 transition-colors text-slate-500 bg-slate-50/40 border-b border-slate-300">
                                  <td className="p-0.5 text-left pl-3 font-sans text-slate-400 border-r border-slate-200 text-[9px]">
                                    Off night
                                  </td>
                                  {monthData.map((d, idx) => (
                                    <td 
                                      key={idx} 
                                      className={cn(
                                        "p-0.5 border-r border-slate-200 text-[9px] font-bold",
                                        d ? "text-slate-500" : "text-transparent"
                                      )}
                                    >
                                      {d ? d.offNightGroup : ''}
                                    </td>
                                  ))}
                                </tr>
                              </React.Fragment>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
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
                   <div className="col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">กะที่ต้องตรวจ (Applicable Shift)</label>
                      <select 
                        value={newEqShift} 
                        onChange={e => setNewEqShift(e.target.value as ShiftScope)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-medium"
                      >
                         <option value="ALL">🔄 ตรวจทุกกะ (All Shifts - กะเช้าและกะดึก)</option>
                         <option value="DAY">☀️ ตรวจเฉพาะกะเช้า (Day Shift Only - ไม่ค้างในกะดึก)</option>
                         <option value="NIGHT">🌙 ตรวจเฉพาะกะดึก (Night Shift Only - ไม่ค้างในกะเช้า)</option>
                      </select>
                      <p className="text-[11px] text-slate-400 mt-1">
                        กำหนดว่าอุปกรณ์นี้ต้องถูกตรวจในกะใด หากเลือกกะใดกะหนึ่ง อีกกะหนึ่งจะไม่ถูกนับเป็นรายการค้างตรวจ
                      </p>
                   </div>
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
                                     <div className="md:col-span-2">
                                        <label className="text-xs text-slate-500 mb-1 block font-bold">กะที่ต้องตรวจ (Applicable Shift)</label>
                                        <select 
                                          value={editingEqData.applicableShift || getEquipmentShiftScope(editingEqData as Equipment)} 
                                          onChange={e => setEditingEqData({...editingEqData, applicableShift: e.target.value as ShiftScope})}
                                          className="w-full text-sm px-2 py-1.5 border border-indigo-200 rounded focus:border-indigo-500 bg-white font-medium"
                                        >
                                           <option value="ALL">🔄 ตรวจทุกกะ (All Shifts - กะเช้าและกะดึก)</option>
                                           <option value="DAY">☀️ ตรวจเฉพาะกะเช้า (Day Shift Only - ไม่ค้างในกะดึก)</option>
                                           <option value="NIGHT">🌙 ตรวจเฉพาะกะดึก (Night Shift Only - ไม่ค้างในกะเช้า)</option>
                                        </select>
                                     </div>
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
                                        {getEquipmentShiftScope(eq) === 'DAY' && (
                                           <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                              ☀️ เฉพาะกะเช้า
                                           </span>
                                        )}
                                        {getEquipmentShiftScope(eq) === 'NIGHT' && (
                                           <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                              🌙 เฉพาะกะดึก
                                           </span>
                                        )}
                                        {getEquipmentShiftScope(eq) === 'ALL' && (
                                           <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                              🔄 ทุกกะ
                                           </span>
                                        )}
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
