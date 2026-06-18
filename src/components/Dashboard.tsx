import React, { useState, useEffect } from 'react';
import { 
  fetchEquipments, 
  fetchLogs, 
  seedDummyData,
  fetchCheckItems,
  updateCheckLog,
  fetchEquipmentLogs
} from '../lib/db';
import { format } from 'date-fns';
import { Activity, CheckCircle, AlertTriangle, Clock, ServerCrash, RefreshCcw, X, Edit2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Equipment, CheckLog, CheckItem } from '../types';
import { cn } from '../lib/utils';

export default function Dashboard() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);
  const [logs, setLogs] = useState<CheckLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [selectedLog, setSelectedLog] = useState<CheckLog | null>(null);
  const [logItems, setLogItems] = useState<CheckItem[]>([]);
  const [logEq, setLogEq] = useState<Equipment | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editNotesText, setEditNotesText] = useState('');
  const [editStatusText, setEditStatusText] = useState<'passed' | 'failed' | 'needs_attention'>('passed');

  const [historyEq, setHistoryEq] = useState<Equipment | null>(null);
  const [historyLogs, setHistoryLogs] = useState<CheckLog[]>([]);
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('');

  const [latestLogsByEq, setLatestLogsByEq] = useState<Record<string, CheckLog>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const [eqData, todayLogsData, itemsData] = await Promise.all([
      fetchEquipments(),
      fetchLogs(today),
      fetchCheckItems()
    ]);
    
    // Fetch the absolute latest log for each active equipment
    const activeEqs = eqData.filter(e => e.status === 'active');
    const latestLogsRecord: Record<string, CheckLog> = {};
    
    await Promise.all(activeEqs.map(async (eq) => {
       const eqLogs = await fetchEquipmentLogs(eq.id!);
       if (eqLogs && eqLogs.length > 0) {
          latestLogsRecord[eq.id!] = eqLogs[0];
       }
    }));

    setLatestLogsByEq(latestLogsRecord);
    setEquipments(eqData);
    setCheckItems(itemsData);
    setLogs(todayLogsData);
    setLoading(false);
  };

  const handleSeed = async () => {
    setSeeding(true);
    const success = await seedDummyData();
    if (success) {
      await loadData();
    } else {
      await loadData();
    }
    setSeeding(false);
  };

  const handleViewHistory = async (eq: Equipment) => {
    setHistoryEq(eq);
    const logs = await fetchEquipmentLogs(eq.id!);
    setHistoryLogs(logs);
    if (logs.length > 0) {
      setHistoryDateFilter(format(logs[0].timestamp, 'yyyy-MM-dd'));
    } else {
      setHistoryDateFilter('');
    }
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
    setHistoryLogs(prev => prev.map(l => l.id === selectedLog.id ? updatedLog : l));
    
    // Update latest logs if this is the currently shown latest log
    setLatestLogsByEq(prev => {
        const currentLatest = prev[updatedLog.equipmentId];
        if (currentLatest && currentLatest.id === updatedLog.id) {
            return { ...prev, [updatedLog.equipmentId]: updatedLog };
        }
        return prev;
    });

    setSelectedLog(updatedLog);
    setEditingNotes(false);
  };

  if (loading) {
    return <div className="p-8 text-slate-500 animate-pulse">Loading dashboard metrics...</div>;
  }

  const activeEquipments = equipments.filter(e => e.status === 'active');
  
  // Equipment needs check if it has ANY check item with daily or per-shift frequency
  const dailyOrShiftEquipments = activeEquipments.filter(e => {
     const eqItems = checkItems.filter(item => item.equipmentId === e.id);
     return eqItems.some(item => item.frequency === 'daily' || item.frequency === 'per-shift');
  });
  
  const checkedEqIds = new Set(logs.map(l => l.equipmentId));
  const pendingCount = dailyOrShiftEquipments.filter(e => !checkedEqIds.has(e.id)).length;
  const checkedCount = dailyOrShiftEquipments.length - pendingCount;
  
  // Current OOC is based on the *latest* log of each equipment, not all logs today.
  const currentOocCount = activeEquipments.filter(eq => {
      const latestLog = latestLogsByEq[eq.id!];
      return latestLog && (latestLog.status === 'needs_attention' || latestLog.status === 'failed');
  }).length;

  const complianceRate = dailyOrShiftEquipments.length === 0 ? 100 : Math.round((checkedCount / dailyOrShiftEquipments.length) * 100);

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-slate-900 drop-shadow-sm">Live Dashboard</h1>
          <p className="text-slate-500 mt-1.5 font-medium">Real-time equipment readiness & compliance.</p>
        </div>
        <div className="text-left md:text-right bg-white/60 backdrop-blur border border-slate-200/60 px-5 py-3 rounded-2xl shadow-sm">
           <p className="text-[11px] font-bold tracking-wider uppercase text-indigo-500">System Time / Today</p>
           <p className="text-xl font-display font-bold text-slate-800">{format(new Date(), 'dd MMM yyyy')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <MetricCard 
          title="Inspection Progress" 
          value={`${complianceRate}%`} 
          subtitle={`${checkedCount} of ${dailyOrShiftEquipments.length} machines checked`}
          icon={<Activity className="w-6 h-6 text-emerald-600" />}
          trend={complianceRate === 100 ? 'positive' : 'neutral'}
        />
        <MetricCard 
          title="Pending Inspections" 
          value={pendingCount} 
          subtitle="Awaiting operator validation today"
          icon={<Clock className="w-6 h-6 text-amber-500" />}
          trend={pendingCount > 0 ? 'warning' : 'positive'}
        />
        <MetricCard 
          title="Active Alerts (OOC)" 
          value={currentOocCount} 
          subtitle="Currently requiring action / failed"
          icon={<AlertTriangle className={cn("w-6 h-6", currentOocCount > 0 ? "text-rose-500" : "text-slate-400")} />}
          trend={currentOocCount > 0 ? 'negative' : 'positive'}
        />
        <MetricCard 
          title="Total Equipment" 
          value={activeEquipments.length} 
          subtitle="Active equipment in system"
          icon={<ServerCrash className="w-6 h-6 text-indigo-500" />}
          trend="neutral"
        />
      </div>

      <div className="shadow-sm border border-slate-200/60 rounded-3xl bg-white/80 backdrop-blur-md overflow-hidden p-6 md:p-8 relative">
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
         <div className="flex justify-between items-center mb-6 relative z-10">
           <h2 className="text-xl font-display font-bold text-slate-900 tracking-tight">Equipment Overview Tracker</h2>
         </div>
         
         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 relative z-10">
           {equipments.filter(e => e.status === 'active').map(eq => {
             const eqLogsToday = logs.filter(l => l.equipmentId === eq.id);
             const eqItems = checkItems.filter(item => item.equipmentId === eq.id);
             
             // If no items are defined, we assume it's daily by default
             const hasDailyItems = eqItems.length === 0 || eqItems.some(i => i.frequency === 'daily' || !i.frequency || i.frequency === 'per-shift');
             const hasOnUseItems = eqItems.some(i => i.frequency === 'on-use');
             
             let dailyStatus = 'not_checked';
             let onUseStatus = 'not_checked';
             
             if (hasDailyItems) {
               const dailyLog = eqLogsToday.find(l => l.checkCycle === 'daily' || !l.checkCycle || l.checkCycle === 'all' || l.checkCycle === 'per-shift');
               if (dailyLog) dailyStatus = dailyLog.status;
             }
             if (hasOnUseItems) {
               const onUseLog = eqLogsToday.find(l => l.checkCycle === 'on-use' || !l.checkCycle || l.checkCycle === 'all');
               if (onUseLog) onUseStatus = onUseLog.status;
             }
             
             return (
               <div 
                  key={eq.id} 
                  onClick={() => handleViewHistory(eq)}
                  className="p-5 border rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex flex-col items-center justify-center text-center bg-white border-slate-200/80 group"
               >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 shadow-inner border border-slate-200/50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                     <ServerCrash className="w-6 h-6 text-slate-500" />
                  </div>
                  <h3 className="font-display font-bold text-slate-900 text-sm line-clamp-1 w-full" title={eq.name}>{eq.name}</h3>
                  <p className="text-[11px] text-indigo-400 font-mono font-medium tracking-wide mt-1">{eq.code}</p>
                  
                  <div className="mt-4 flex flex-col gap-2 w-full">
                     {hasDailyItems && (
                        <div className={cn("px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center justify-center w-full transition-colors",
                           dailyStatus === 'passed' ? "bg-emerald-50/80 border-emerald-200 text-emerald-700" :
                           (dailyStatus === 'failed' || dailyStatus === 'needs_attention') ? "bg-rose-50/80 border-rose-200 text-rose-700" :
                           "bg-indigo-600 border-indigo-700 text-white shadow-sm"
                        )}>
                           {dailyStatus === 'passed' ? 'Daily: OK' : 
                            (dailyStatus === 'failed' || dailyStatus === 'needs_attention') ? 'Daily: Action' : 
                            'Daily: Missing'}
                        </div>
                     )}
                     
                     {hasOnUseItems && (
                        <div className={cn("px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center justify-center w-full transition-colors",
                           onUseStatus === 'passed' ? "bg-emerald-50/80 border-emerald-200 text-emerald-700" :
                           (onUseStatus === 'failed' || onUseStatus === 'needs_attention') ? "bg-rose-50/80 border-rose-200 text-rose-700" :
                           "bg-slate-100 border-slate-200/60 text-slate-500"
                        )}>
                           {onUseStatus === 'passed' ? 'On Use: OK' : 
                            (onUseStatus === 'failed' || onUseStatus === 'needs_attention') ? 'On Use: Action' : 
                            'On Use: Standby'}
                        </div>
                     )}
                  </div>
               </div>
             );
           })}
           
           {equipments.filter(e => e.status === 'active').length === 0 && (
             <div className="col-span-full p-8 text-center text-slate-500 flex flex-col items-center border border-dashed border-slate-300 rounded-xl">
               <p className="mb-4 text-sm font-medium">No active equipment found.</p>
               <button 
                onClick={handleSeed}
                disabled={seeding}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 bg-white"
               >
                 <RefreshCcw className={cn("w-4 h-4", seeding && "animate-spin")} />
                 Seed Demo Database
               </button>
             </div>
           )}
         </div>
      </div>

      <AnimatePresence>
         {historyEq && !selectedLog && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            >
               <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
               >
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                     <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Inspection History</h2>
                        <p className="text-xs text-slate-500">{historyEq.name} • {historyEq.code}</p>
                     </div>
                     <div className="flex items-center gap-3">
                        <label className="text-sm text-slate-600 font-medium">Date:</label>
                        <select 
                           value={historyDateFilter}
                           onChange={(e) => setHistoryDateFilter(e.target.value)}
                           className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium min-w-[140px]"
                        >
                           <option value="">All History</option>
                           {Array.from(new Set(historyLogs.map(l => format(l.timestamp, 'yyyy-MM-dd')))).map(dateStr => (
                             <option key={dateStr} value={dateStr}>{format(new Date(dateStr + 'T00:00:00'), 'dd MMM yyyy')}</option>
                           ))}
                        </select>
                        <button onClick={() => { setHistoryDateFilter(''); setHistoryEq(null); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors ml-2">
                           <X className="w-5 h-5" />
                        </button>
                     </div>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 p-0">
                     <div className="divide-y divide-slate-100">
                        {historyLogs.filter(log => !historyDateFilter || format(log.timestamp, 'yyyy-MM-dd') === historyDateFilter).length === 0 ? (
                           <div className="p-8 text-center flex flex-col items-center">
                              <p className="text-slate-500">No inspection history found for this date.</p>
                              {historyDateFilter && (
                                <button onClick={() => setHistoryDateFilter('')} className="mt-2 text-indigo-600 text-sm font-medium hover:text-indigo-700">Clear filter to view all</button>
                              )}
                           </div>
                        ) : (
                           historyLogs.filter(log => !historyDateFilter || format(log.timestamp, 'yyyy-MM-dd') === historyDateFilter).map(log => (
                              <div key={log.id} onClick={() => handleOpenLog(log)} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors">
                                 <div>
                                    <p className="font-semibold text-slate-900 text-sm">{format(log.timestamp, 'dd MMM yyyy')} <span className="text-slate-500 font-normal ml-2">{format(log.timestamp, 'HH:mm')}</span></p>
                                    <p className="text-xs text-slate-500 mt-0.5">By {log.operatorName} • Shift: {log.shift}{log.checkCycle ? ` • Cycle: ${log.checkCycle}` : ''}</p>
                                 </div>
                                 <span className={cn("px-3 py-1 rounded-full text-xs font-semibold capitalize whitespace-nowrap", 
                                    log.status === 'passed' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                 )}>
                                    {log.status === 'needs_attention' ? 'OOC' : log.status}
                                 </span>
                              </div>
                           ))
                        )}
                     </div>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

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
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Log Details</h2>
                        <p className="text-xs text-slate-500">{logEq?.name || 'Equipment'} • {format(selectedLog.timestamp, 'dd MMM yyyy, HH:mm')}</p>
                     </div>
                     <button onClick={() => setSelectedLog(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                     </button>
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
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cycle</p>
                            <p className="font-medium text-slate-900 capitalize">{selectedLog.checkCycle || 'all'}</p>
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

function MetricCard({ title, value, subtitle, icon, trend }: { title: string, value: string | number, subtitle: string, icon: React.ReactNode, trend: 'positive' | 'negative' | 'warning' | 'neutral' }) {
  const trendStyles = {
    positive: 'from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-700',
    negative: 'from-rose-500/10 to-transparent border-rose-500/20 text-rose-700',
    warning: 'from-amber-500/10 to-transparent border-amber-500/20 text-amber-700',
    neutral: 'from-indigo-500/10 to-transparent border-indigo-500/20 text-indigo-700'
  };

  const bgGradient = trendStyles[trend].split(' ').slice(0, 2).join(' ');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all duration-300 min-h-[140px]"
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity group-hover:opacity-100", bgGradient)}></div>
      <div className="relative z-10 flex justify-between items-start mb-2 sm:mb-4">
        <p className="text-[10px] sm:text-[11px] font-bold text-slate-500/90 tracking-wide uppercase line-clamp-2 md:line-clamp-none pr-2">{title}</p>
        <div className="p-2 sm:p-2.5 bg-white rounded-xl shadow-sm border border-slate-100/50 group-hover:scale-110 transition-transform duration-300 shrink-0">{icon}</div>
      </div>
      <div className="relative z-10 mt-auto">
        <h3 className="text-2xl sm:text-4xl font-display font-extrabold tracking-tight text-slate-800 group-hover:text-indigo-900 transition-colors drop-shadow-sm">{value}</h3>
        <p className="text-[10px] sm:text-xs text-slate-500 mt-1 sm:mt-2 font-bold leading-snug line-clamp-2">{subtitle}</p>
      </div>
    </motion.div>
  )
}
