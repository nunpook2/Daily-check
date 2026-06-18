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
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Operator Terminal</h2>
              <p className="text-slate-500">Scan equipment barcode or select from the list below.</p>
            </div>
            
            {/* Scan Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-6 md:p-8 flex flex-col items-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 border border-indigo-100">
                 <ScanLine className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Scan QR Code to Start Check</h3>
              <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
                To prevent remote checks, you must scan the QR code physically located on the equipment.
              </p>
              
              {showCamera ? (
                <div className="w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden shadow-inner mb-4 relative">
                  <Scanner 
                    onScan={(detectedCodes) => {
                      if (detectedCodes && detectedCodes.length > 0) {
                        const val = detectedCodes[0].rawValue;
                        let extractedCode = val;
                        try {
                          // Try to parse as URL
                          const url = new URL(val);
                          const searchParams = new URLSearchParams(url.search);
                          if (searchParams.has('eqCode')) {
                            extractedCode = searchParams.get('eqCode') as string;
                          }
                        } catch (e) {
                          // It's not a URL, so just use the raw value
                        }
                        
                        setScanCode(extractedCode);
                        // Trigger check immediately
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
                  <button onClick={() => setShowCamera(false)} className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-white/90 text-slate-800 font-medium rounded-full shadow backdrop-blur text-sm">
                    Close Camera
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => { setShowCamera(true); setScanError(''); }}
                  className="w-full max-w-sm py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow flex items-center justify-center gap-3 mb-4"
                >
                  <Camera className="w-5 h-5" />
                  Open Camera Scanner
                </button>
              )}

              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Manual selection has been disabled by admin to ensure onsite checks.</p>
              {scanError && <p className="mt-3 text-sm text-rose-500 font-medium bg-rose-50 px-4 py-2 rounded-lg">{scanError}</p>}
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
             className="bg-white rounded-xl shadow-sm border border-slate-200"
          >
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-md bg-white/90">
               <button 
                type="button"
                onClick={() => setSelectedEq(null)}
                className="p-2 hover:bg-slate-200/50 rounded-lg text-slate-500 transition-colors"
               >
                 <ArrowLeft className="w-5 h-5" />
               </button>
               <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">Check: {selectedEq.name}</h2>
                  <p className="text-xs md:text-sm text-slate-500">{selectedEq.code} • Form Protocol v1.0</p>
               </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-8">
               <div className="space-y-4 bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                 <h3 className="text-xs font-bold text-indigo-800 tracking-widest uppercase">Check Context</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Shift <span className="text-rose-500">*</span></label>
                      <select 
                        required 
                        value={shift}
                        onChange={e => setShift(e.target.value as any)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-900 shadow-sm"
                      >
                        <option value="DAY">Day Shift</option>
                        <option value="NIGHT">Night Shift</option>
                        <option value="OTHER">Other</option>
                        <option value="NA">N/A</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Select Operator <span className="text-rose-500">*</span></label>
                      <select 
                        required 
                        value={operatorId}
                        onChange={e => setOperatorId(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-900 shadow-sm"
                      >
                        <option value="">-- Employee ID --</option>
                        {operators.map(op => <option key={op.id} value={op.employeeId}>{op.name} ({op.employeeId})</option>)}
                        <option value="other">Other / Guest</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Check Cycle <span className="text-rose-500">*</span></label>
                      <select 
                        required 
                        value={checkType}
                        onChange={e => setCheckType(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-slate-900 shadow-sm"
                      >
                        <option value="all">All Parameters</option>
                        <option value="daily">Daily Only</option>
                        <option value="on-use">On Use Only</option>
                      </select>
                   </div>
                 </div>
               </div>

               <div className="space-y-6">
                  {filteredItems.length === 0 ? (
                    <p className="text-slate-400 italic text-sm">No specific parameters configured for this equipment with the selected check cycle.</p>
                  ) : (
                    Array.from(new Set(filteredItems.map(i => i.category || 'General'))).map((category, catIdx) => (
                      <div key={category} className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-700 tracking-widest uppercase border-b border-slate-200 pb-2 bg-slate-50/50 px-2 py-1.5 rounded">{category}</h3>
                        
                        {filteredItems.filter(item => (item.category || 'General') === category).map((item, idx) => (
                          <div key={item.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-indigo-100 transition-colors">
                            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-2">
                               <div>
                                 <label className="flex items-center gap-2 text-sm md:text-base font-semibold text-slate-900 leading-snug">
                                   {catIdx + 1}.{idx + 1} {item.name} 
                                   <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">{item.frequency || 'N/A'}</span>
                                   {item.isRequired && <span className="text-rose-500">*</span>}
                                 </label>
                                 {item.criteriaText && <p className="text-xs text-slate-500 font-medium mt-1">เกณฑ์: {item.criteriaText}</p>}
                               </div>
                               {(item.type === 'numeric' && item.minValue !== undefined && item.maxValue !== undefined) && (
                                 <span className="text-xs font-mono font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 whitespace-nowrap">LCL/UCL: {item.minValue} - {item.maxValue} {item.unit || ''}</span>
                               )}
                            </div>
                            
                            {item.type === 'boolean' ? (
                              <div className="flex flex-col sm:flex-row gap-3">
                                 <label className={cn(
                                   "flex items-center gap-3 cursor-pointer p-4 border rounded-xl flex-1 transition-colors",
                                   responses[item.id] === "true" ? "bg-emerald-50 border-emerald-500 text-emerald-900" : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                                 )}>
                                   <input type="radio" 
                                     name={item.id} 
                                     required={item.isRequired} 
                                     value="true"
                                     checked={responses[item.id] === "true"}
                                     onChange={e => setResponses({...responses, [item.id]: e.target.value})}
                                     className="w-5 h-5 text-emerald-600 focus:ring-emerald-500 border-slate-300 pointer-events-none"
                                   />
                                   <span className="text-sm md:text-base font-semibold">Pass / Normal {item.expectedBoolean === false && '(Unexpected)'}</span>
                                 </label>
                                 <label className={cn(
                                   "flex items-center gap-3 cursor-pointer p-4 border rounded-xl flex-1 transition-colors",
                                   responses[item.id] === "false" ? "bg-rose-50 border-rose-500 text-rose-900" : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                                 )}>
                                   <input type="radio" 
                                     name={item.id} 
                                     required={item.isRequired} 
                                     value="false"
                                     checked={responses[item.id] === "false"}
                                     onChange={e => setResponses({...responses, [item.id]: e.target.value})}
                                     className="w-5 h-5 text-rose-600 focus:ring-rose-500 border-slate-300 pointer-events-none"
                                   />
                                   <span className="text-sm md:text-base font-semibold">Fail / Abnormal {item.expectedBoolean === false && '(Expected)'}</span>
                                 </label>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                   <input 
                                     type="number" step="any"
                                     required={item.isRequired}
                                     value={responses[item.id] || ''}
                                     onChange={e => setResponses({...responses, [item.id]: e.target.value})}
                                     placeholder={`Enter ${item.unit || 'value'}`}
                                     className="w-full sm:max-w-xs px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-mono text-base font-medium shadow-inner"
                                   />
                                   {item.unit && <span className="font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-lg">{item.unit}</span>}
                                </div>
                                {responses[item.id] !== undefined && responses[item.id] !== '' && item.minValue !== undefined && item.maxValue !== undefined && (
                                   (Number(responses[item.id]) < item.minValue || Number(responses[item.id]) > item.maxValue) ? (
                                       <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-100 px-3 py-2.5 rounded-lg flex items-center gap-2 mt-1 w-fit transition-all duration-300">
                                          <AlertTriangle className="w-4 h-4 shrink-0" /> Value is OUT of control limits ({item.minValue} - {item.maxValue})
                                       </p>
                                   ) : (
                                       <p className="text-sm text-emerald-600 font-medium bg-emerald-50 border border-emerald-100 px-3 py-2.5 rounded-lg flex items-center gap-2 mt-1 w-fit transition-all duration-300">
                                          <CheckCircle className="w-4 h-4 shrink-0" /> Value is within control limits
                                       </p>
                                   )
                                )}
                              </div>
                            )}
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
