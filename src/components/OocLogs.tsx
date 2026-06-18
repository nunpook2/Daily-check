import React, { useState, useEffect } from 'react';
import { fetchEquipments, fetchLogs, fetchCheckItems, updateCheckLog, deleteCheckLog } from '../lib/db';
import { format } from 'date-fns';
import { CheckCircle, AlertTriangle, X, Edit2, MessageSquare, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Equipment, CheckLog, CheckItem } from '../types';
import { cn } from '../lib/utils';

export default function OocLogs() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [logs, setLogs] = useState<CheckLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedLog, setSelectedLog] = useState<CheckLog | null>(null);
  const [logItems, setLogItems] = useState<CheckItem[]>([]);
  const [logEq, setLogEq] = useState<Equipment | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editNotesText, setEditNotesText] = useState('');
  const [editStatusText, setEditStatusText] = useState<'passed' | 'failed' | 'needs_attention'>('passed');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const [eqData, logsData] = await Promise.all([
      fetchEquipments(),
      fetchLogs(today) // Note: ideally we might want to fetch all OOC logs, but for now we fetch today's
    ]);
    setEquipments(eqData);
    setLogs(logsData);
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
    return <div className="p-8 text-slate-500 animate-pulse">Loading inspection history...</div>;
  }

  // Sort all loaded logs
  const allLogs = [...logs].sort((a,b) => b.timestamp - a.timestamp);

  // Group by equipment
  const logsByEquipment: Record<string, CheckLog[]> = {};
  allLogs.forEach(log => {
      if (!logsByEquipment[log.equipmentId]) {
          logsByEquipment[log.equipmentId] = [];
      }
      logsByEquipment[log.equipmentId].push(log);
  });

  return (
    <div className="space-y-6 relative max-w-4xl mx-auto">
       <div className="flex justify-between items-end mb-6">
         <div>
           <h1 className="text-3xl font-bold tracking-tight text-slate-900">Inspection History</h1>
           <p className="text-slate-500 mt-1">Review all inspection records and update statuses.</p>
         </div>
       </div>

       <div className="space-y-6">
          {Object.keys(logsByEquipment).length === 0 ? (
             <div className="p-16 flex flex-col items-center justify-center text-center text-slate-400 bg-white shadow-sm border border-slate-200 rounded-xl">
               <CheckCircle className="w-12 h-12 text-slate-300 mb-4" />
               <p className="text-lg font-medium text-slate-600">No Records Found</p>
               <p className="text-sm mt-1">No inspections recorded today.</p>
             </div>
          ) : (
             Object.entries(logsByEquipment).map(([eqId, eqLogs]) => {
                const eqRef = equipments.find(e => e.id === eqId);
                return (
                   <div key={eqId} className="shadow-sm border border-slate-200 rounded-xl bg-white overflow-hidden">
                       <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                           <h2 className="font-bold text-slate-800 tracking-tight">{eqRef?.name || 'Unknown Equipment'} <span className="font-mono text-slate-500 font-normal text-sm ml-2">{eqRef?.code}</span></h2>
                           <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-1 rounded-full">{eqLogs.length} Records</span>
                       </div>
                       <div className="divide-y divide-slate-100">
                          {eqLogs.map(log => {
                            const isPassed = log.status === 'passed';
                            return (
                                <div key={log.id} 
                                   className={cn("p-5 border-l-4 cursor-pointer transition-colors",
                                      isPassed ? "border-emerald-500 bg-white hover:bg-slate-50" : "border-rose-500 bg-rose-50/20 hover:bg-rose-50/60"
                                   )} 
                                   onClick={() => handleOpenLog(log)}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                       <p className="font-bold text-slate-900 text-base">Shift: {log.shift}</p>
                                       <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase", 
                                          isPassed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                       )}>
                                          {isPassed ? 'Passed' : 'Action Req.'}
                                       </span>
                                    </div>
                                    <span className="text-sm text-slate-600 font-medium">{format(log.timestamp, 'dd MMM yyyy, HH:mm')}</span>
                                  </div>
                                  <p className="text-sm text-slate-500 mb-3">Operator: {log.operatorName}</p>
                                  <p className={cn("text-sm font-medium p-3 rounded-lg leading-relaxed border", 
                                     isPassed ? "text-slate-700 bg-slate-50 border-slate-200" : "text-rose-700 bg-rose-100/50 border-rose-200/50"
                                  )}>
                                    {log.notes || (isPassed ? 'All parameters normal' : 'Values out of control limits.')}
                                  </p>
                                </div>
                            );
                          })}
                       </div>
                   </div>
                );
             })
          )}
       </div>

       <AnimatePresence>
         {selectedLog && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            >
               <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
               >
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                     <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Inspection Record Details</h2>
                        <p className="text-xs text-slate-500">{logEq?.name || 'Equipment'} • {format(selectedLog.timestamp, 'dd MMM yyyy, HH:mm')}</p>
                     </div>
                     <div className="flex items-center gap-2">
                        {confirmDelete ? (
                            <div className="flex items-center gap-2 mr-2">
                               <span className="text-xs font-semibold text-rose-600">Delete permanently?</span>
                               <button onClick={handleDeleteLog} className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-full transition-colors">Yes, Delete</button>
                               <button onClick={() => setConfirmDelete(false)} className="px-3 py-1 text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-full transition-colors">Cancel</button>
                            </div>
                        ) : (
                           <button onClick={handleDeleteLog} className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full transition-colors" title="Delete Log">
                              <Trash2 className="w-5 h-5" />
                           </button>
                        )}
                        <button onClick={() => setSelectedLog(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors" title="Close">
                           <X className="w-5 h-5" />
                        </button>
                     </div>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1">
                     <div className="mb-6 flex gap-4">
                        <div className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Operator</p>
                            <p className="font-medium text-slate-900">{selectedLog.operatorName}</p>
                        </div>
                        <div className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Shift</p>
                            <p className="font-medium text-slate-900">{selectedLog.shift}</p>
                        </div>
                        <div className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</p>
                            <span className={cn("px-2.5 py-0.5 rounded capitalize text-sm font-semibold", 
                               selectedLog.status === 'passed' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            )}>
                               {selectedLog.status === 'needs_attention' ? 'OOC (Action Req.)' : selectedLog.status}
                            </span>
                        </div>
                     </div>

                     <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-100 pb-2">Inspection Responses</h3>
                     <div className="space-y-3 mb-8">
                        {logItems.length === 0 ? (
                           <p className="text-sm text-slate-500 italic">No parameters recorded or items deleted.</p>
                        ) : (
                           logItems.map(item => {
                               const response = selectedLog.responses.find(r => r.checkItemId === item.id);
                               const isOOC = response && !response.isNormal;
                               return (
                                   <div key={item.id} className={cn("p-3 rounded-xl border flex justify-between items-center", isOOC ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200")}>
                                      <div>
                                         <p className="font-medium text-sm text-slate-900">{item.name}</p>
                                         <p className="text-xs text-slate-500">{item.criteriaText || 'No criteria'}</p>
                                      </div>
                                      <div className="text-right">
                                         {response ? (
                                             <div className="flex items-center gap-2">
                                                <span className={cn("font-bold font-mono text-sm", isOOC ? "text-rose-600" : "text-emerald-600")}>
                                                   {response.type === 'boolean' ? (response.valueBoolean ? "Pass/True" : "Fail/False") : `${response.valueNumeric} ${item.unit || ''}`}
                                                </span>
                                                {isOOC ? <AlertTriangle className="w-4 h-4 text-rose-500" /> : <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                             </div>
                                         ) : (
                                             <span className="text-xs text-slate-400 italic">No response mapped</span>
                                         )}
                                      </div>
                                   </div>
                               )
                           })
                        )}
                     </div>

                     <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                         <div className="flex justify-between items-start mb-3">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-slate-500" /> Remarks & Actions</h3>
                            {!editingNotes && (
                               <button onClick={() => setEditingNotes(true)} className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                                  <Edit2 className="w-3 h-3" /> Update Record
                               </button>
                            )}
                         </div>
                         
                         {editingNotes ? (
                             <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Status Override</label>
                                    <select value={editStatusText} onChange={e => setEditStatusText(e.target.value as any)} className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500">
                                       <option value="needs_attention">Needs Attention (OOC)</option>
                                       <option value="passed">Passed (Resolved / Verified)</option>
                                       <option value="failed">Failed (Do Not Use)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Action Taken</label>
                                    <textarea 
                                       value={editNotesText} 
                                       onChange={e => setEditNotesText(e.target.value)} 
                                       className="w-full text-sm p-3 border border-slate-300 rounded-lg min-h-[80px] focus:ring-2 focus:ring-indigo-500" 
                                       placeholder="Provide updates or actions taken..."
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                   <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-200 rounded hover:bg-slate-300 transition-colors">Cancel</button>
                                   <button onClick={handleSaveUpdate} className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors">Save Updates</button>
                                </div>
                             </div>
                         ) : (
                             <p className={cn("text-sm", selectedLog.notes ? "text-slate-700" : "text-slate-400 italic")}>
                                {selectedLog.notes || "No remarks provided."}
                             </p>
                         )}
                     </div>
                  </div>
               </motion.div>
            </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
}
