import React, { useState, useEffect } from 'react';
import { fetchEquipments, fetchLogs, fetchCheckItems, updateCheckLog, deleteCheckLog } from '../lib/db';
import { format } from 'date-fns';
import { 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Edit2, 
  MessageSquare, 
  Trash2, 
  Calendar, 
  Filter, 
  Clipboard, 
  User, 
  Clock, 
  Bookmark, 
  PlusCircle, 
  Sparkles,
  Info,
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Equipment, CheckLog, CheckItem } from '../types';
import { cn } from '../lib/utils';

export default function OocLogs({ selectedDept = 'all' }: { selectedDept?: string }) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [logs, setLogs] = useState<CheckLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filterDate, setFilterDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEqIdFilter, setSelectedEqIdFilter] = useState<string | null>(null);
  const [selectedEqItems, setSelectedEqItems] = useState<CheckItem[]>([]);

  // Edit log notes state
  const [selectedLog, setSelectedLog] = useState<CheckLog | null>(null);
  const [logItems, setLogItems] = useState<CheckItem[]>([]);
  const [logEq, setLogEq] = useState<Equipment | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editNotesText, setEditNotesText] = useState('');
  const [editStatusText, setEditStatusText] = useState<'passed' | 'failed' | 'needs_attention'>('passed');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    loadData(filterDate);
  }, [filterDate, selectedDept]);

  useEffect(() => {
    if (selectedEqIdFilter) {
      fetchCheckItems(selectedEqIdFilter).then(items => {
        setSelectedEqItems(items);
      });
    } else {
      setSelectedEqItems([]);
    }
  }, [selectedEqIdFilter]);

  const loadData = async (dateStr: string) => {
    setLoading(true);
    let [eqData, logsData] = await Promise.all([
      fetchEquipments(),
      fetchLogs(dateStr)
    ]);

    // Filter equipments by selectedDept if not 'all'
    if (selectedDept && selectedDept !== 'all') {
      eqData = eqData.filter(eq => {
        const loc = (eq.location || '').toLowerCase();
        const name = eq.name.toLowerCase();
        const code = eq.code.toLowerCase();
        if (selectedDept === 'qc') {
          return loc.includes('qc') || loc.includes('คุณภาพ') || loc.includes('สอบเทียบ') || name.includes('qc') || code.includes('qc');
        }
        if (selectedDept === 'rd') {
          return loc.includes('วิจัย') || loc.includes('r&d') || loc.includes('lab') || loc.includes('ทดสอบ') || loc.includes('ปฏิบัติการ') || name.includes('lab') || name.includes('rd');
        }
        if (selectedDept === 'production') {
          return loc.includes('ผลิต') || loc.includes('line') || loc.includes('โรงงาน') || loc.includes('เครื่องจักร') || name.includes('m') || name.includes('machine');
        }
        if (selectedDept === 'warehouse') {
          return loc.includes('คลัง') || loc.includes('warehouse') || loc.includes('จัดเก็บ') || loc.includes('สโตร์') || name.includes('wh');
        }
        return true;
      });
    }

    // Filter logs to match only filtered equipments
    const allowedEqIds = new Set(eqData.map(e => e.id));
    logsData = logsData.filter(l => allowedEqIds.has(l.equipmentId));

    setEquipments(eqData);
    setLogs(logsData);
    
    // Auto-select the first equipment in equipments when loading
    if (eqData.length > 0) {
       if (!selectedEqIdFilter || !eqData.some(e => e.id === selectedEqIdFilter)) {
          setSelectedEqIdFilter(eqData[0].id);
       }
    } else {
       setSelectedEqIdFilter(null);
    }
    
    setLoading(false);
  };

  const handleOpenLog = async (log: CheckLog) => {
    setSelectedLog(log);
    const eq = equipments.find(e => e.id === log.equipmentId) || null;
    setLogEq(eq);
    const items = await fetchCheckItems(log.equipmentId);
    setLogItems(items);
    setEditNotesText(log.notes || '');
    setEditStatusText(log.status);
    setEditingNotes(false);
    setConfirmDelete(false);
  };

  const handleSaveUpdate = async () => {
    if (!selectedLog) return;
    await updateCheckLog(selectedLog.id, {
        notes: editNotesText,
        status: editStatusText
    });
    // Update local state
    const updatedLog = { ...selectedLog, notes: editNotesText, status: editStatusText };
    setLogs(prev => prev.map(l => l.id === selectedLog.id ? updatedLog : l));
    setSelectedLog(updatedLog);
    setEditingNotes(false);
  };

  const handleDeleteLog = async () => {
    if (!selectedLog) return;
    if (confirmDelete) {
        await deleteCheckLog(selectedLog.id);
        setLogs(prev => prev.filter(l => l.id !== selectedLog.id));
        setSelectedLog(null);
        setConfirmDelete(false);
    } else {
        setConfirmDelete(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <RefreshCcw className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-semibold tracking-wider uppercase">กำลังโหลดข้อมูลประวัติ...</p>
      </div>
    );
  }

  // Calculate executive stats for this date
  const totalLogsCount = logs.length;
  const passedLogsCount = logs.filter(l => l.status === 'passed').length;
  const alertLogsCount = totalLogsCount - passedLogsCount;

  return (
    <div className="relative w-full mx-auto flex flex-col space-y-6">
       
       {/* Top Header & Overview */}
       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 pb-6 border-b border-slate-200/60 shrink-0">
         <div>
           <div className="flex items-center gap-2 text-indigo-600 font-mono text-xs font-bold tracking-widest uppercase mb-1">
             <Clipboard className="w-3.5 h-3.5" />
             Historical Audit & Inspection Hub
           </div>
           <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-display">
             ประวัติผลการตรวจสอบระบบ <span className="text-indigo-600">Inspection</span>
           </h1>
           <p className="text-slate-500 mt-1 text-sm font-medium">
             สืบค้นใบบันทึกผลอย่างละเอียดรายพารามิเตอร์ วิเคราะห์ความผิดปกติ และบันทึกมาตรการแก้ไข
           </p>
         </div>

         {/* Datepicker Filter */}
         <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-2xl shadow-sm shrink-0">
           <Calendar className="w-4 h-4 text-slate-400" />
           <div>
             <p className="text-[9px] font-bold tracking-widest uppercase text-slate-400 mb-0.5">ค้นหาตามวันที่ตรวจ</p>
             <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="text-sm font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0 cursor-pointer outline-none w-[120px]"
             />
           </div>
         </div>
       </div>

       {/* Executive Audit Stats */}
       <div className="grid grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
         <div className="flex flex-col justify-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">บันทึกตรวจรวม (Total Records)</span>
           <span className="text-xl sm:text-2xl font-black font-mono text-indigo-950 tabular-nums">{totalLogsCount}</span>
         </div>
         <div className="flex flex-col justify-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
           <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">ผ่านเกณฑ์ทั้งหมด (Normal)</span>
           <span className="text-xl sm:text-2xl font-black font-mono text-emerald-600 tabular-nums">{passedLogsCount}</span>
         </div>
         <div className="flex flex-col justify-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
           <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1">ผิดปกติ / หลุดสเปก (Out of Spec)</span>
           <span className="text-xl sm:text-2xl font-black font-mono text-rose-600 tabular-nums">{alertLogsCount}</span>
         </div>
       </div>

       {/* Central Workarea split */}
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
          {equipments.length === 0 ? (
             <div className="col-span-full p-16 flex flex-col items-center justify-center text-center bg-white border border-slate-200/60 rounded-3xl">
               <CheckCircle className="w-12 h-12 text-slate-200 mb-3" />
               <p className="text-lg font-bold text-slate-700">ไม่มีรายการเครื่องมือในระบบ</p>
               <p className="text-sm text-slate-400 mt-1 font-medium">ไม่พบอุปกรณ์หรือเครื่องมือแพทย์ที่ตรงกับฝ่ายงานในขณะนี้</p>
             </div>
          ) : (
             <>
                {/* Left side: Equipment Selector (Span 4) */}
                <div className="lg:col-span-4 flex flex-col gap-3 overflow-y-auto max-h-[600px] pr-1">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">รายชื่อเครื่องมือทั้งหมด ({equipments.length})</p>
                   
                   {equipments.map(eq => {
                      const eqLogs = logs.filter(l => l.equipmentId === eq.id);
                      const isSelected = selectedEqIdFilter === eq.id;
                      const isChecked = eqLogs.length > 0;
                      const hasFailures = eqLogs.some(l => l.status === 'failed' || l.status === 'needs_attention');

                      return (
                         <button 
                            key={eq.id}
                            onClick={() => setSelectedEqIdFilter(eq.id)}
                            className={cn(
                               "text-left p-4 rounded-2xl border-2 transition-all duration-300 min-w-0 flex flex-col justify-between group cursor-pointer relative overflow-hidden",
                               isSelected 
                                 ? "bg-indigo-600 border-indigo-700 shadow-md text-white transform scale-[1.01]" 
                                 : hasFailures 
                                   ? "bg-rose-50/50 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                                   : isChecked
                                     ? "bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50/60 hover:border-emerald-200"
                                     : "bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                            )}
                         >
                            {/* Accent color strip inside side button */}
                            {hasFailures && !isSelected && (
                              <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-rose-500"></div>
                             )}
                             {isChecked && !hasFailures && !isSelected && (
                               <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-emerald-500"></div>
                             )}

                            <div className="flex justify-between items-start w-full gap-2">
                               <h3 className={cn("font-bold text-sm sm:text-base truncate flex-1", isSelected ? "text-white" : "text-slate-950")} title={eq.name}>
                                  {eq.name}
                                </h3>
                                <span className={cn("text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg shrink-0 border whitespace-nowrap", 
                                  isSelected 
                                    ? "bg-indigo-700/50 border-indigo-400 text-indigo-100" 
                                    : isChecked
                                      ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                                      : "bg-amber-50 text-amber-800 border-amber-200"
                                )}>
                                   {isChecked ? `${eqLogs.length} บันทึก` : '⚠️ ค้างตรวจ'}
                                </span>
                            </div>
                            
                            {/* Unboxed Metadata (Zero Pill Style) */}
                            <div className="flex items-center gap-1.5 text-xs mt-2 font-mono">
                               <span className={cn("font-bold", isSelected ? "text-indigo-200" : "text-indigo-500")}>
                                 {eq.code}
                               </span>
                               <span className={isSelected ? "text-indigo-300" : "text-slate-400"} aria-hidden="true">·</span>
                               <span className={cn("truncate", isSelected ? "text-indigo-200" : "text-slate-400")}>
                                 {(eq.location || 'General Lab').replace('น้อง', 'ห้อง')}
                               </span>
                            </div>
                         </button>
                      );
                   })}
                </div>
 
                {/* Right side: Inspection Logs directly displaying the detail grid (Span 8) */}
                {selectedEqIdFilter && (
                   <div className="lg:col-span-8 shadow-sm border border-slate-200/60 rounded-3xl bg-white overflow-hidden flex flex-col">
                       {/* Panel Header */}
                       <div className="px-6 py-5 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
                            <div>
                              <h2 className="font-display font-black text-white text-lg sm:text-xl leading-tight">
                                {equipments.find(e => e.id === selectedEqIdFilter)?.name || 'Unknown Equipment'}
                              </h2>
                              {/* Unboxed Metadata inside header */}
                              <div className="flex items-center gap-2 text-xs text-indigo-200 font-mono mt-1 font-semibold">
                                <span>รหัส: {equipments.find(e => e.id === selectedEqIdFilter)?.code}</span>
                                <span aria-hidden="true">·</span>
                                <span>สถานที่: {(equipments.find(e => e.id === selectedEqIdFilter)?.location || 'Lab').replace('น้อง', 'ห้อง')}</span>
                              </div>
                            </div>
                       </div>

                       {/* Logs Content Flow */}
                       <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/40 max-h-[550px] custom-scrollbar">
                          {logs.filter(l => l.equipmentId === selectedEqIdFilter).length > 0 ? (
                             logs.filter(l => l.equipmentId === selectedEqIdFilter).map((log, logIdx) => {
                               const isPassed = log.status === 'passed';
                               return (
                                   <div key={log.id} 
                                      className={cn("p-5 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden bg-white shadow-sm hover:shadow-md",
                                         isPassed ? "border-emerald-100" : "border-rose-100"
                                      )} 
                                   >
                                      {/* Status vertical accent indicator */}
                                      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", 
                                         isPassed ? "bg-emerald-500" : "bg-rose-500"
                                      )}></div>

                                      {/* Executive Log summary header block */}
                                      <div className="flex flex-wrap justify-between items-center gap-3 pl-2 mb-4">
                                         <div className="flex flex-wrap items-center gap-2">
                                            <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide shadow-sm text-white", 
                                               isPassed ? "bg-emerald-500" : "bg-rose-500"
                                            )}>
                                               {isPassed ? '✓ ผ่านปกติ' : '✗ หลุดเกณฑ์ควบคุม'}
                                            </span>
                                            <span className="font-bold text-slate-700 text-xs bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/50">กะการทำงาน: {log.shift === 'DAY' ? 'กะกลางวัน (Day)' : 'กะกลางคืน (Night)'}</span>
                                            <span className="font-bold text-slate-500 text-xs bg-white px-2.5 py-1 rounded-lg border border-slate-100 shadow-xs font-mono">{format(log.timestamp, 'HH:mm น.')}</span>
                                         </div>

                                         <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                                            <User className="w-3.5 h-3.5" />
                                            <span>ผู้ตรวจ: SC-101 / {log.operatorName}</span>
                                         </div>
                                      </div>

                                      {/* DIRECT VISUAL PARAMETERS FEED (This satisfies "เอาให้ชัดว่าจะแสดงอะไร") */}
                                      <div className="pl-2 mt-4 space-y-3">
                                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ผลรายละเอียดรายข้อตรวจสอบ (Telemetry Feed)</p>
                                         
                                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                            {log.responses.map((resp, respIdx) => {
                                               return (
                                                  <div key={resp.checkItemId} className={cn(
                                                     "p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold bg-white shadow-xs",
                                                     resp.isNormal ? "border-slate-100" : "border-rose-200 bg-rose-50/30"
                                                  )}>
                                                     <div className="min-w-0 pr-2">
                                                        <p className="text-slate-900 truncate">ข้อที่ {respIdx + 1}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono truncate">ID: {resp.checkItemId}</p>
                                                     </div>
                                                     <div className="text-right shrink-0 flex items-center gap-1.5 font-mono">
                                                        <span className={resp.isNormal ? "text-emerald-600" : "text-rose-600 font-black"}>
                                                           {resp.type === 'boolean' ? (resp.valueBoolean ? 'PASS' : 'FAIL') : `${resp.valueNumeric}`}
                                                        </span>
                                                        {resp.isNormal ? (
                                                           <span className="text-emerald-500 text-[10px]">✓</span>
                                                        ) : (
                                                           <span className="text-rose-500 text-[10px] font-black">✗</span>
                                                        )}
                                                     </div>
                                                  </div>
                                               );
                                            })}
                                         </div>
                                      </div>

                                      {/* Speeches & Remarks actions */}
                                      <div className="pl-2 mt-4 flex items-start gap-3 bg-indigo-50/20 border border-slate-100 p-3.5 rounded-xl">
                                         <MessageSquare className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                         <div className="flex-1 min-w-0">
                                           <p className="text-xs font-black text-slate-400 uppercase tracking-wider">บันทึกหน้างาน / การแก้ไขข้อผิดพลาด</p>
                                           <p className="text-xs sm:text-sm text-slate-700 mt-1 leading-relaxed">
                                             {log.notes || "ไม่มีสิ่งบันทึกพิเศษเพิ่มเติม ทุกระบบทำงานสมบูรณ์"}
                                           </p>
                                         </div>
                                         
                                         <button 
                                           onClick={() => handleOpenLog(log)} 
                                           className="py-1 px-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-indigo-600 shadow-xs cursor-pointer flex items-center gap-1"
                                         >
                                           <Edit2 className="w-3 h-3" />
                                           จัดการบันทึก
                                         </button>
                                      </div>
                                   </div>
                               );
                             })
                          ) : (
                             /* Empty state display listing all uninspected parameters! */
                             <div className="p-4 sm:p-6 space-y-6 bg-white rounded-2xl border border-slate-200/60 shadow-xs">
                                <div className="p-6 bg-amber-500/5 border-2 border-dashed border-amber-300 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                                  <AlertTriangle className="w-10 h-10 text-amber-500 animate-bounce" />
                                  <h3 className="text-base font-bold text-amber-900">⚠️ เครื่องมือนี้ยังไม่ได้รับการตรวจสอบในวันที่เลือก</h3>
                                  <p className="text-xs text-amber-700 max-w-sm">เครื่องจักรมีสถานะพร้อมใช้งาน แต่ผู้ปฏิบัติงานในกะการทำงานยังไม่ได้สแกนตรวจเช็กค่าควบคุมในวันนี้</p>
                                </div>

                                <div className="space-y-3">
                                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest">พารามิเตอร์ที่ต้องตรวจสอบทั้งหมด ({selectedEqItems.length} ข้อ)</p>
                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {selectedEqItems.length === 0 ? (
                                         <p className="text-xs text-slate-400 col-span-full italic py-4 text-center">ยังไม่ได้กำหนดข้อคำถามพารามิเตอร์ตรวจสอบสำหรับเครื่องมือนี้</p>
                                      ) : (
                                         selectedEqItems.map((item, idx) => (
                                            <div key={item.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex justify-between items-center text-xs font-bold shadow-xs">
                                               <div className="min-w-0 pr-2">
                                                  <p className="text-slate-800 font-extrabold truncate">ข้อที่ {idx + 1}: {item.name}</p>
                                                  <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">ประเภท: {item.type === 'boolean' ? 'Pass/Fail' : `วัดค่าตัวเลข (${item.minValue ?? ''} - ${item.maxValue ?? ''} ${item.unit || ''})`}</p>
                                               </div>
                                               <span className="px-2 py-1 rounded bg-rose-50 text-rose-600 border border-rose-100 text-[10px] uppercase font-extrabold shrink-0 whitespace-nowrap">
                                                 ❌ ยังไม่ตรวจ
                                               </span>
                                            </div>
                                         ))
                                      )}
                                   </div>
                                </div>
                             </div>
                          )}
                       </div>
                   </div>
                )}
             </>
          )}
       </div>

       {/* Log Details / Action override Modal */}
       <AnimatePresence>
          {selectedLog && (
             <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm"
             >
                <motion.div 
                   initial={{ opacity: 0, scale: 0.95, y: 10 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.95, y: 10 }}
                   className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-100"
                >
                   <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                      <div>
                         <h2 className="text-lg font-bold text-slate-900 tracking-tight">แก้ไขข้อมูลผลการตรวจเช็กหน้างาน</h2>
                         <p className="text-xs text-slate-500 mt-0.5">{logEq?.name || 'Equipment'} • {format(selectedLog.timestamp, 'dd MMM yyyy, HH:mm น.')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                         {confirmDelete ? (
                             <div className="flex items-center gap-2 mr-2 bg-rose-50 p-1.5 rounded-xl border border-rose-100">
                                <span className="text-[11px] font-bold text-rose-700">ยืนยันการลบถาวร?</span>
                                <button onClick={handleDeleteLog} className="px-2.5 py-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer">ยืนยัน</button>
                                <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">ยกเลิก</button>
                             </div>
                         ) : (
                            <button onClick={handleDeleteLog} className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full transition-colors cursor-pointer" title="Delete Log">
                               <Trash2 className="w-4 h-4" />
                            </button>
                         )}
                         <button onClick={() => setSelectedLog(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors cursor-pointer" title="Close">
                            <X className="w-5 h-5" />
                         </button>
                      </div>
                   </div>
                   
                   <div className="p-6 overflow-y-auto flex-1 space-y-6">
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 space-y-4">
                          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <Edit2 className="w-4 h-4 text-indigo-500" />
                            ปรับสถานะและระบุรายละเอียดการจัดการความผิดปกติ (Corrective Action)
                          </h3>
                          
                          <div className="space-y-4">
                             <div>
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">บังคับเปลี่ยนสถานะผลรวม</label>
                                 <select value={editStatusText} onChange={e => setEditStatusText(e.target.value as any)} className="w-full text-sm p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none">
                                    <option value="passed">ผ่านการตรวจสอบเป็นปกติ (Passed)</option>
                                    <option value="needs_attention">พบพารามิเตอร์ผิดปกติแต่แก้ไขแล้ว (Needs Attention)</option>
                                    <option value="failed">ห้ามใช้งานเครื่องพังเสียหาย (Failed / Out of spec)</option>
                                 </select>
                             </div>
                             <div>
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">รายละเอียดการทำงาน / มาตรการตอบกลับหน้างาน</label>
                                 <textarea 
                                    value={editNotesText} 
                                    onChange={e => setEditNotesText(e.target.value)} 
                                    className="w-full text-sm p-3 bg-white border border-slate-200 rounded-xl min-h-[100px] focus:ring-1 focus:ring-indigo-500 outline-none" 
                                    placeholder="ระบุเหตุการณ์ความผิดปกติที่เกิดขึ้น หรือเขียนรายงานสรุปการแก้ไขเบื้องต้น..."
                                 />
                             </div>
                             <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <button onClick={() => setSelectedLog(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">ยกเลิก</button>
                                <button onClick={handleSaveUpdate} className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 cursor-pointer">บันทึกข้อมูลปรับปรุง</button>
                             </div>
                          </div>
                      </div>
                   </div>
                </motion.div>
             </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}
