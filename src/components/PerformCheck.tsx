import React, { useState, useEffect, useRef, useMemo } from 'react';
import { fetchEquipments, fetchCheckItems, fetchLogs, saveCheckLog, fetchOperators } from '../lib/db';
import { Equipment, CheckItem, CheckResponse, Operator } from '../types';
import { format } from 'date-fns';
import { ChevronRight, ArrowLeft, CheckCircle, ScanLine, Search, AlertTriangle, Camera } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Scanner } from '@yudiel/react-qr-scanner';

export default function PerformCheck({ onSaved, initialEqCode }: { onSaved?: () => void, initialEqCode?: string }) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [todaysLogs, setTodaysLogs] = useState<Set<string>>(new Set());
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Scanner state
  const [scanCode, setScanCode] = useState('');
  const [scanError, setScanError] = useState('');
  const [showCamera, setShowCamera] = useState(false);

  // Form State
  const [items, setItems] = useState<CheckItem[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [operatorId, setOperatorId] = useState('');
  const [shift, setShift] = useState<'DAY' | 'NIGHT' | 'OTHER' | 'NA'>('DAY');
  const [checkType, setCheckType] = useState<string>('all');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  
  const scanInputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (checkType === 'all') return true;
      if (checkType === 'daily' && (!item.frequency || item.frequency === 'daily')) return true;
      return item.frequency === checkType;
    });
  }, [items, checkType]);

  useEffect(() => {
    loadEq();
  }, []);

  const loadEq = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const [eqData, logsData, opData] = await Promise.all([
      fetchEquipments(),
      fetchLogs(today),
      fetchOperators()
    ]);
    const activeEq = eqData.filter(e => e.status === 'active');
    setEquipments(activeEq);
    setTodaysLogs(new Set(logsData.map(l => l.equipmentId)));
    setOperators(opData.filter(o => o.isActive));
    setLoading(false);

    if (initialEqCode) {
       const eqToSelect = activeEq.find(e => e.code.toLowerCase() === initialEqCode.toLowerCase());
       if (eqToSelect) {
         const itms = await fetchCheckItems(eqToSelect.id);
         setItems(itms);
         // Reset form
         setResponses({});
         setOperatorId('');
         setShift('DAY');
         setNotes('');
         setSelectedEq(eqToSelect);
       }
    }
  };
  
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScanError('');
    if (!scanCode.trim()) return;
    
    // Find equipment by code
    const eq = equipments.find(e => e.code.toLowerCase() === scanCode.trim().toLowerCase());
    if (eq) {
      handleSelect(eq); // Allow re-scanning even if done today for editing or re-verifying
    } else {
      setScanError(`No equipment found with code: ${scanCode}`);
    }
    setScanCode('');
  };

  const handleSelect = async (eq: Equipment) => {
    // Show a loading indicator in a real app, but for now just wait
    const itms = await fetchCheckItems(eq.id);
    setItems(itms);
    setSelectedEq(eq); // Set it after fetching items to prevent UI flicker
    setResponses({});
    setOperatorId('');
    setShift('DAY');
    setNotes('');
  };

  const evalIsNormal = (item: CheckItem, value: any): boolean => {
    if (value === undefined || value === null || value === '') return false;
    if (item.type === 'boolean') {
      const boolVal = String(value) === 'true';
      return boolVal === item.expectedBoolean;
    } else if (item.type === 'numeric') {
      const num = Number(value);
      if (isNaN(num)) return false;
      if (typeof item.minValue === 'number' && num < item.minValue) return false;
      if (typeof item.maxValue === 'number' && num > item.maxValue) return false;
      return true;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEq || !operatorId) return;

    setSaving(true);
    let allNormal = true;
    const finalResponses: CheckResponse[] = filteredItems.map(item => {
       const val = responses[item.id!];
       const normal = evalIsNormal(item, val);
       if (!normal) allNormal = false;
       
       const resp: any = {
         checkItemId: item.id,
         type: item.type,
         isNormal: normal
       };
       if (item.type === 'boolean') {
           resp.valueBoolean = val === 'true' || val === true;
       } else if (item.type === 'numeric') {
           resp.valueNumeric = Number(val);
       }
       return resp;
    });

    const logStatus = allNormal ? 'passed' : 'needs_attention';
    const computedNotes = notes ? notes : (allNormal ? 'All parameters normal' : 'Some parameters out of defined limits');

    // Find operator name
    const op = operators.find(o => o.employeeId === operatorId);
    const opName = op ? op.name : operatorId;

    await saveCheckLog({
      equipmentId: selectedEq.id,
      timestamp: Date.now(),
      dateKey: format(new Date(), 'yyyy-MM-dd'),
      shift: shift,
      checkCycle: checkType,
      operatorId: operatorId,
      operatorName: opName,
      status: logStatus,
      notes: computedNotes,
      actionTaken: notes, // For now mapping general notes to action if failure
      responses: finalResponses
    });

    setSaving(false);
    setSelectedEq(null);
    await loadEq();
    if (onSaved) onSaved();
  };

  if (loading && equipments.length === 0) return <div className="p-8 text-slate-500 animate-pulse">Loading equipment list...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <AnimatePresence mode="wait">
        {!selectedEq ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
             <div>
               <h2 className="text-3xl font-display font-bold tracking-tight text-slate-900 drop-shadow-sm mb-1.5">Operator Terminal</h2>
               <p className="text-slate-600 font-bold tracking-wide text-sm">Strict validation mode requires physical QR scan.</p>
             </div>
            
            {/* Scan Area */}
            <div className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden flex flex-col items-center p-8 md:p-12 relative group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-indigo-200/50">
                 <ScanLine className="w-10 h-10 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900 mb-3 text-center">Scan Asset Code</h3>
              <p className="text-sm font-medium text-slate-500 text-center max-w-sm mb-8 leading-relaxed">
                To prevent remote checks, you must scan the unique QR code physically affixed to the equipment.
              </p>
              
              {showCamera ? (
                <div className="w-full max-w-[320px] aspect-square bg-slate-900/5 rounded-[2rem] overflow-hidden shadow-inner mb-6 relative border-[8px] border-slate-100 ring-1 ring-slate-200 group relative">
                  <Scanner 
                    onScan={(detectedCodes) => {
                      if (detectedCodes && detectedCodes.length > 0) {
                        const val = detectedCodes[0].rawValue;
                        let extractedCode = val;
                        try {
                          const url = new URL(val);
                          const searchParams = new URLSearchParams(url.search);
                          if (searchParams.has('eqCode')) {
                            extractedCode = searchParams.get('eqCode') as string;
                          }
                        } catch (e) {
                          // Ignore
                        }
                        
                        setScanCode(extractedCode);
                        const eq = equipments.find(e => e.id === extractedCode || e.code.toLowerCase() === extractedCode.toLowerCase());
                        if (eq) {
                          setShowCamera(false);
                          handleSelect(eq);
                        } else {
                          setScanError(`No equipment found with code: ${extractedCode}`);
                        }
                      }
                    }} 
                  />
                  {/* Decorative corner scanning reticles */}
                  <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl opacity-70"></div>
                  <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl opacity-70"></div>
                  <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl opacity-70"></div>
                  <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-emerald-500 rounded-br-xl opacity-70"></div>
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>

                  <button onClick={() => setShowCamera(false)} className="absolute bottom-6 left-1/2 transform -translate-x-1/2 px-5 py-2.5 bg-white/95 text-slate-800 font-bold rounded-full shadow-lg backdrop-blur text-sm hover:scale-105 transition-transform duration-300 border border-slate-200/50">
                    Close Camera
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => { setShowCamera(true); setScanError(''); }}
                  className="w-full max-w-[320px] py-5 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 outline-none text-white font-bold rounded-2xl transition-all shadow-[0_8px_30px_rgb(79,70,229,0.25)] hover:shadow-[0_8px_40px_rgb(79,70,229,0.4)] hover:-translate-y-1 flex items-center justify-center gap-3 mb-6 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-white/20 w-1/2 -skew-x-[30deg] -translate-x-[150%] group-hover:translate-x-[250%] transition-transform duration-1000"></div>
                  <Camera className="w-[22px] h-[22px]" />
                  <span className="tracking-wide text-[15px]">Open Camera Scanner</span>
                </button>
              )}

              <p className="text-[11px] font-mono tracking-wider text-slate-400 mt-2 flex items-center gap-1.5 uppercase font-semibold"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Manual selection locked for audit integrity</p>
              {scanError && <p className="mt-4 text-[13px] text-rose-600 font-bold bg-rose-50 border border-rose-100 px-5 py-3 rounded-xl shadow-sm">{scanError}</p>}
            </div>

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <h3 className="font-semibold text-amber-800 flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4" /> Anti-Fraud Measures Active</h3>
              <p className="text-amber-700 text-xs mt-1">
                 Manual equipment selection has been disabled. You must physically be present and scan the equipment QR code to perform a check. If scanning fails, you may enter the asset code manually above.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
             key="form"
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: 20 }}
             className="bg-white/90 backdrop-blur-md rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden"
          >
            <div className="p-5 md:p-8 border-b border-slate-100 flex items-center gap-5 bg-white sticky top-0 z-10">
               <button 
                type="button"
                onClick={() => setSelectedEq(null)}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl transition-colors border border-slate-200"
               >
                 <ArrowLeft className="w-5 h-5" />
               </button>
               <div>
                  <h2 className="text-2xl font-display font-bold tracking-tight text-slate-900 leading-tight">Check: {selectedEq.name}</h2>
                  <p className="text-sm font-medium tracking-wide text-indigo-500/80 mt-0.5">{selectedEq.code} • Validation Protocol</p>
               </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 md:p-8 space-y-8">
               <div className="space-y-4 bg-indigo-50/50 border border-indigo-100/50 p-6 rounded-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-[40px] pointer-events-none"></div>
                 <h3 className="text-xs font-bold text-indigo-800 tracking-widest uppercase mb-4 opacity-80">Inspection Context</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
                   <div>
                      <label className="block text-[13px] font-bold text-slate-700 tracking-wide mb-2 uppercase">Shift <span className="text-rose-500">*</span></label>
                      <select 
                        required 
                        value={shift}
                        onChange={e => setShift(e.target.value as any)}
                        className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-800 shadow-sm"
                      >
                        <option value="DAY">Day Shift</option>
                        <option value="NIGHT">Night Shift</option>
                        <option value="OTHER">Other</option>
                        <option value="NA">N/A</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-[13px] font-bold text-slate-700 tracking-wide mb-2 uppercase">Operator <span className="text-rose-500">*</span></label>
                      <select 
                        required 
                        value={operatorId}
                        onChange={e => setOperatorId(e.target.value)}
                        className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-800 shadow-sm"
                      >
                        <option value="">-- Select Identity --</option>
                        {operators.map(op => <option key={op.id} value={op.employeeId}>{op.name} ({op.employeeId})</option>)}
                        <option value="other">Other / Guest</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-[13px] font-bold text-slate-700 tracking-wide mb-2 uppercase">Check Cycle <span className="text-rose-500">*</span></label>
                      <select 
                        required 
                        value={checkType}
                        onChange={e => setCheckType(e.target.value)}
                        className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-800 shadow-sm"
                      >
                        <option value="all">All Parameters</option>
                        <option value="daily">Daily Only</option>
                        <option value="on-use">On Use Only</option>
                      </select>
                   </div>
                 </div>
               </div>

               <div className="space-y-8">
                  {filteredItems.length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center bg-slate-50/50">
                       <p className="text-slate-500 font-medium">No check parameters configured for this cycle.</p>
                    </div>
                  ) : (
                    Array.from(new Set(filteredItems.map(i => i.category || 'General'))).map((category, catIdx) => (
                      <div key={category} className="space-y-5">
                        <div className="flex items-center gap-3">
                           <div className="h-px bg-slate-200 flex-1"></div>
                           <h3 className="text-[11px] font-bold text-slate-500 tracking-[0.2em] uppercase bg-white px-2">{category}</h3>
                           <div className="h-px bg-slate-200 flex-1"></div>
                        </div>
                        
                        {filteredItems.filter(item => (item.category || 'General') === category).map((item, idx) => (
                          <div key={item.id} className="bg-white border-2 border-slate-200/80 p-6 md:p-8 rounded-[1.5rem] shadow-sm hover:border-indigo-300 hover:shadow-lg transition-all duration-300 group relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-slate-200 group-hover:bg-indigo-500 transition-colors duration-300"></div>
                            <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4 pl-4">
                               <div>
                                 <label className="flex flex-wrap items-center gap-2.5 text-base md:text-xl font-display font-bold text-slate-900 leading-snug">
                                   <span className="text-indigo-500 font-mono text-sm border border-indigo-200 bg-indigo-50 px-2 py-0.5 rounded-lg shadow-sm"> {catIdx + 1}.{idx + 1} </span> 
                                   {item.name} 
                                   <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm ml-1">{item.frequency || 'N/A'}</span>
                                   {item.isRequired && <span className="text-rose-500 font-bold ml-1">*</span>}
                                 </label>
                                 {item.criteriaText && <p className="text-sm text-slate-600 font-bold mt-3 sm:mt-2 sm:ml-[3.5rem] flex items-center gap-2">
                                    <span className="opacity-70 uppercase tracking-widest text-[10px]">Criteria:</span> 
                                    <span className="text-slate-800 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200">{item.criteriaText}</span>
                                 </p>}
                               </div>
                               {(item.type === 'numeric' && item.minValue !== undefined && item.maxValue !== undefined) && (
                                 <div className="flex flex-col items-start sm:items-end shrink-0 pl-0 sm:pl-0 mt-4 sm:mt-0 w-full sm:w-auto bg-slate-50 sm:bg-transparent p-4 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-slate-200">
                                   <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Acceptable Range</span>
                                   <span className="text-sm md:text-base font-mono font-bold text-indigo-700 bg-indigo-50 px-3 md:px-4 py-2 rounded-xl border-2 border-indigo-200 shadow-sm whitespace-nowrap bg-white">{item.minValue} - {item.maxValue} <span className="text-indigo-400 font-bold ml-1">{item.unit || ''}</span></span>
                                 </div>
                               )}
                            </div>
                            
                            <div className="pl-4">
                              {item.type === 'boolean' ? (
                                <div className="flex flex-col sm:flex-row gap-4">
                                   <label className={cn(
                                     "flex items-center gap-4 cursor-pointer p-4 md:p-5 border-2 rounded-2xl flex-1 transition-all duration-300 relative overflow-hidden group/btn",
                                     responses[item.id] === "true" ? "bg-emerald-50/80 border-emerald-500/80 text-emerald-900 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30" : "bg-slate-50/50 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:shadow-sm"
                                   )}>
                                     {responses[item.id] === "true" && <div className="absolute inset-0 bg-emerald-500/5 mix-blend-multiply"></div>}
                                     <div className={cn(
                                       "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors z-10",
                                       responses[item.id] === "true" ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white group-hover/btn:border-emerald-400"
                                     )}>
                                        {responses[item.id] === "true" && <CheckCircle className="w-4 h-4 text-white" />}
                                     </div>
                                     <input type="radio" 
                                       name={item.id} 
                                       required={item.isRequired} 
                                       value="true"
                                       checked={responses[item.id] === "true"}
                                       onChange={e => setResponses({...responses, [item.id]: e.target.value})}
                                       className="sr-only"
                                     />
                                     <span className="text-sm md:text-base font-bold tracking-wide z-10">Pass / Normal {item.expectedBoolean === false && <span className="text-xs font-normal text-slate-500">(Unexpected)</span>}</span>
                                   </label>
                                   <label className={cn(
                                     "flex items-center gap-4 cursor-pointer p-4 md:p-5 border-2 rounded-2xl flex-1 transition-all duration-300 relative overflow-hidden group/btn",
                                     responses[item.id] === "false" ? "bg-rose-50/80 border-rose-500/80 text-rose-900 shadow-[0_0_15px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/30" : "bg-slate-50/50 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:shadow-sm"
                                   )}>
                                     {responses[item.id] === "false" && <div className="absolute inset-0 bg-rose-500/5 mix-blend-multiply"></div>}
                                     <div className={cn(
                                       "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors z-10",
                                       responses[item.id] === "false" ? "border-rose-500 bg-rose-500" : "border-slate-300 bg-white group-hover/btn:border-rose-400"
                                     )}>
                                        {responses[item.id] === "false" && <div className="w-2.5 h-2.5 rounded-full bg-white"></div>}
                                     </div>
                                     <input type="radio" 
                                       name={item.id} 
                                       required={item.isRequired} 
                                       value="false"
                                       checked={responses[item.id] === "false"}
                                       onChange={e => setResponses({...responses, [item.id]: e.target.value})}
                                       className="sr-only"
                                     />
                                     <span className="text-sm md:text-base font-bold tracking-wide z-10">Fail / Abnormal {item.expectedBoolean === false && <span className="text-xs font-normal text-slate-500">(Expected)</span>}</span>
                                   </label>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-4">
                                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                     <div className="relative flex-1 max-w-[320px]">
                                        <input 
                                          type="number" step="any"
                                          required={item.isRequired}
                                          value={responses[item.id] || ''}
                                          onChange={e => setResponses({...responses, [item.id]: e.target.value})}
                                          placeholder={`Enter numeric value...`}
                                          className="w-full pl-5 pr-12 py-4 bg-slate-50/80 border-2 border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/80 hover:border-slate-300 font-mono text-lg font-semibold shadow-inner transition-all placeholder:font-sans placeholder:font-normal placeholder:text-base"
                                        />
                                        {item.unit && <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-slate-400 font-bold">{item.unit}</div>}
                                     </div>
                                     {responses[item.id] !== undefined && responses[item.id] !== '' && item.minValue !== undefined && item.maxValue !== undefined && (
                                        (Number(responses[item.id]) < item.minValue || Number(responses[item.id]) > item.maxValue) ? (
                                            <div className="text-sm text-rose-700 font-bold bg-rose-50 border border-rose-200 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm h-full animate-in fade-in slide-in-from-left-2">
                                               <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                                                 <AlertTriangle className="w-4 h-4 text-rose-600" /> 
                                               </div>
                                               OUT of limits
                                            </div>
                                        ) : (
                                            <div className="text-sm text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm h-full animate-in fade-in slide-in-from-left-2">
                                               <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                                               </div>
                                               Within limits
                                            </div>
                                        )
                                     )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
               </div>

               <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Additional Notes / Findings</label>
                    <textarea 
                      rows={3}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Optional details if anomalies observed..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm shadow-inner"
                    />
                  </div>
               </div>

               <div className="pt-6 flex justify-end pb-10">
                  <button 
                    type="submit" disabled={saving}
                    className={cn(
                      "w-full sm:w-auto px-8 py-4 rounded-xl font-bold tracking-tight text-white md:text-lg transition-all shadow-sm",
                      saving ? "bg-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98]"
                    )}
                  >
                    {saving ? 'Submitting Log...' : 'Confirm & Submit Validation'}
                  </button>
               </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
