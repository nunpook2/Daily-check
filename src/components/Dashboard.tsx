import React, { useState, useEffect } from 'react';
import { 
  fetchEquipments, 
  fetchLogs, 
  seedDummyData,
  fetchCheckItems,
  updateCheckLog,
  fetchEquipmentLogs,
  updateEquipment
} from '../lib/db';
import { format } from 'date-fns';
import { 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  ServerCrash, 
  RefreshCcw, 
  X, 
  Edit2, 
  MessageSquare, 
  Wrench, 
  ShieldAlert, 
  History,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Info,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Equipment, CheckLog, CheckItem } from '../types';
import { cn } from '../lib/utils';

export default function Dashboard({ selectedDept = 'all' }: { selectedDept?: string }) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);
  const [logs, setLogs] = useState<CheckLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'maintenance' | 'checked' | 'pending' | 'failed'>('all');

  // Log details modal state
  const [selectedLog, setSelectedLog] = useState<CheckLog | null>(null);
  const [logItems, setLogItems] = useState<CheckItem[]>([]);
  const [logEq, setLogEq] = useState<Equipment | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editNotesText, setEditNotesText] = useState('');
  const [editStatusText, setEditStatusText] = useState<'passed' | 'failed' | 'needs_attention'>('passed');

  // History / Status Detail Modal state
  const [historyEq, setHistoryEq] = useState<Equipment | null>(null);
  const [historyLogs, setHistoryLogs] = useState<CheckLog[]>([]);
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('');

  // Maintenance toggle state
  const [showMaintForm, setShowMaintForm] = useState(false);
  const [maintReason, setMaintReason] = useState('');
  const [maintNotes, setMaintNotes] = useState('');
  const [maintBy, setMaintBy] = useState('');

  const [dashboardDate, setDashboardDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [latestLogsByEq, setLatestLogsByEq] = useState<Record<string, CheckLog>>({});

  useEffect(() => {
    loadData(dashboardDate);
  }, [dashboardDate, selectedDept]);

  const loadData = async (dateStr: string) => {
    setLoading(true);
    let [eqData, dateLogsData, itemsData] = await Promise.all([
      fetchEquipments(),
      fetchLogs(dateStr),
      fetchCheckItems()
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
    
    const activeEqs = eqData.filter(e => e.status === 'active');
    const latestLogsRecord: Record<string, CheckLog> = {};
    
    await Promise.all(activeEqs.map(async (eq) => {
       const eqLogs = await fetchEquipmentLogs(eq.id!);
       if (eqLogs && eqLogs.length > 0) {
          const relevantLog = eqLogs.find(l => format(l.timestamp, 'yyyy-MM-dd') <= dateStr);
          if (relevantLog) {
             latestLogsRecord[eq.id!] = relevantLog;
          }
       }
    }));

    setLatestLogsByEq(latestLogsRecord);
    setEquipments(eqData);
    setCheckItems(itemsData);
    setLogs(dateLogsData);
    setLoading(false);
  };

  const handleSeed = async () => {
    setSeeding(true);
    const success = await seedDummyData();
    await loadData(dashboardDate);
    setSeeding(false);
  };

  const handleViewHistory = async (eq: Equipment) => {
    setHistoryEq(eq);
    setShowMaintForm(false);
    setMaintReason('');
    setMaintNotes('');
    setMaintBy('');
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

  // Maintenance Toggle actions
  const handleStartMaintenance = async () => {
    if (!historyEq || !maintReason.trim() || !maintBy.trim()) return;

    const updates: Partial<Equipment> = {
      status: 'maintenance',
      maintenanceReason: maintReason,
      maintenanceNotes: maintNotes,
      maintenanceAt: Date.now(),
      maintenanceBy: maintBy
    };

    await updateEquipment(historyEq.id, updates);
    
    // Update local equipments list
    const updatedEq = { ...historyEq, ...updates };
    setEquipments(prev => prev.map(e => e.id === historyEq.id ? updatedEq : e));
    setHistoryEq(updatedEq);
    setShowMaintForm(false);
  };

  const handleCompleteMaintenance = async () => {
    if (!historyEq) return;

    const updates: Partial<Equipment> = {
      status: 'active',
      maintenanceReason: '',
      maintenanceNotes: '',
      maintenanceAt: undefined,
      maintenanceBy: undefined
    };

    await updateEquipment(historyEq.id, updates);

    // Update local equipments list
    const updatedEq = { ...historyEq, ...updates };
    setEquipments(prev => prev.map(e => e.id === historyEq.id ? updatedEq : e));
    setHistoryEq(updatedEq);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <RefreshCcw className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-semibold tracking-wider uppercase">กำลังโหลดข้อมูลระบบ...</p>
      </div>
    );
  }

  const activeEquipments = equipments.filter(e => e.status === 'active');
  const maintenanceEquipments = equipments.filter(e => e.status === 'maintenance');
  
  // Equipment needs check if it has ANY check item with daily or per-shift frequency
  const dailyOrShiftEquipments = activeEquipments.filter(e => {
     const eqItems = checkItems.filter(item => item.equipmentId === e.id);
     return eqItems.some(item => item.frequency === 'daily' || item.frequency === 'per-shift');
  });
  
  const checkedEqIds = new Set(logs.map(l => l.equipmentId));
  const pendingCount = dailyOrShiftEquipments.filter(e => !checkedEqIds.has(e.id)).length;
  const checkedCount = dailyOrShiftEquipments.length - pendingCount;
  
  const currentOocCount = activeEquipments.filter(eq => {
      const latestLog = latestLogsByEq[eq.id!];
      return latestLog && (latestLog.status === 'needs_attention' || latestLog.status === 'failed');
  }).length;

  const complianceRate = dailyOrShiftEquipments.length === 0 ? 100 : Math.round((checkedCount / dailyOrShiftEquipments.length) * 100);

  // Filter Equipment for Tracker Table/Cards
  const filteredEquipments = equipments.filter(eq => {
    // Search matching
    const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          eq.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (eq.location && eq.location.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    // Status matching
    const eqLogsToday = logs.filter(l => l.equipmentId === eq.id);
    const hasLog = eqLogsToday.length > 0;
    const isFailed = eqLogsToday.some(l => l.status === 'failed' || l.status === 'needs_attention');
    
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return eq.status === 'active';
    if (statusFilter === 'maintenance') return eq.status === 'maintenance';
    if (statusFilter === 'checked') return eq.status === 'active' && hasLog && !isFailed;
    if (statusFilter === 'pending') return eq.status === 'active' && !hasLog;
    if (statusFilter === 'failed') return eq.status === 'active' && isFailed;

    return true;
  });

  return (
    <div className="space-y-8 relative">
      {/* Upper Brand Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6 pb-6 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-mono text-xs font-bold tracking-widest uppercase mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Monitoring System
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-display">
            ระบบแผงควบคุมกลาง <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">LabControl</span>
          </h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base font-medium">
            ข้อมูลความพร้อมเครื่องจักร อัตราการตรวจสอบ และการจัดการความผิดปกติแบบเรียลไทม์
          </p>
        </div>

        {/* Date Filter & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-white border border-slate-200 shadow-sm px-4 py-2.5 rounded-2xl">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[9px] font-bold tracking-widest uppercase text-slate-400 mb-0.5">เลือกวันที่แสดงผล</p>
              <input 
                 type="date" 
                 value={dashboardDate}
                 onChange={(e) => setDashboardDate(e.target.value)}
                 max={format(new Date(), 'yyyy-MM-dd')}
                 className="text-sm font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0 cursor-pointer outline-none w-[120px]"
              />
            </div>
            {dashboardDate !== format(new Date(), 'yyyy-MM-dd') && (
               <button 
                 onClick={() => setDashboardDate(format(new Date(), 'yyyy-MM-dd'))}
                 className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors ml-1"
                 title="กลับสู่วันนี้"
               >
                 <RefreshCcw className="w-3.5 h-3.5" />
               </button>
            )}
          </div>

          <button 
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-3 bg-slate-950 text-white font-bold rounded-2xl text-xs hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm shrink-0"
          >
            <RefreshCcw className={cn("w-3.5 h-3.5", seeding && "animate-spin")} />
            {seeding ? "กำลังอัปเดต..." : "อัปเดตข้อมูลสาธิต"}
          </button>
        </div>
      </div>

      {/* Main Smart Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard 
          title="อัตราการตรวจเช็กสะสม" 
          engTitle="Inspection Rate"
          value={`${complianceRate}%`} 
          subtitle={`ตรวจแล้ว ${checkedCount} จากทั้งหมด ${dailyOrShiftEquipments.length} เครื่อง`}
          icon={<Activity className="w-6 h-6 text-emerald-600" />}
          trend={complianceRate === 100 ? 'positive' : 'neutral'}
        />
        <MetricCard 
          title="รอดำเนินการตรวจ" 
          engTitle="Pending Checks"
          value={pendingCount} 
          subtitle="เครื่องจักรที่ยังไม่สแกนยืนยันวันนี้"
          icon={<Clock className="w-6 h-6 text-amber-500" />}
          trend={pendingCount > 0 ? 'warning' : 'positive'}
        />
        <MetricCard 
          title="ความผิดปกติ / หลุดสเปก" 
          engTitle="Active Alerts (OOC)"
          value={currentOocCount} 
          subtitle={currentOocCount > 0 ? "ต้องการการบำรุงรักษาด่วน" : "เครื่องจักรทุกเครื่องทำงานปกติ"}
          icon={<AlertTriangle className={cn("w-6 h-6", currentOocCount > 0 ? "text-rose-500 animate-bounce" : "text-slate-400")} />}
          trend={currentOocCount > 0 ? 'negative' : 'positive'}
        />
        <MetricCard 
          title="กำลังปิดซ่อมบำรุง" 
          engTitle="Maintenance Mode"
          value={maintenanceEquipments.length} 
          subtitle="ล็อคสถานะชั่วคราว ห้ามสแกนตรวจ"
          icon={<Wrench className={cn("w-6 h-6", maintenanceEquipments.length > 0 ? "text-indigo-600 animate-pulse" : "text-slate-400")} />}
          trend={maintenanceEquipments.length > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {/* Smart Filter & Tracker Zone */}
      <div className="shadow-sm border border-slate-200/60 rounded-3xl bg-white overflow-hidden p-6 md:p-8 relative">
         <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
         
         {/* Filter controls */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-100 relative z-10">
           <div>
             <h2 className="text-xl font-bold text-slate-900 font-display">ศูนย์ติดตามสถานะเครื่องจักรรายวัน</h2>
             <p className="text-xs text-slate-500 mt-1">คลิกที่การ์ดเพื่อดูข้อมูลประวัติ สถิติการตรวจเช็ก หรือส่งซ่อมบำรุง</p>
           </div>
           
           <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
             {/* Search input */}
             <div className="relative flex-1 md:w-64 min-w-[200px]">
               <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="ค้นหาชื่อ, รหัส, สถานที่..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all placeholder:text-slate-400 font-semibold"
               />
               {searchTerm && (
                 <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                   <X className="w-3.5 h-3.5" />
                 </button>
               )}
             </div>

             {/* Status tabs filter */}
             <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
               <FilterTab active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="ทั้งหมด" />
               <FilterTab active={statusFilter === 'checked'} onClick={() => setStatusFilter('checked')} label="ปกติ" theme="emerald" />
               <FilterTab active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} label="ค้างตรวจ" theme="amber" />
               <FilterTab active={statusFilter === 'failed'} onClick={() => setStatusFilter('failed')} label="ผิดปกติ" theme="rose" />
               <FilterTab active={statusFilter === 'maintenance'} onClick={() => setStatusFilter('maintenance')} label="ปิดซ่อม" theme="indigo" />
             </div>
           </div>
         </div>

         {/* Grid displaying the smart cards */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative z-10">
           {filteredEquipments.map(eq => {
              const eqLogsToday = logs.filter(l => l.equipmentId === eq.id);
              const eqItems = checkItems.filter(item => item.equipmentId === eq.id);
              
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
              
              const isMaint = eq.status === 'maintenance';
              const isChecked = eqLogsToday.length > 0;
              const hasFailed = eqLogsToday.some(l => l.status === 'failed' || l.status === 'needs_attention');

              return (
                <div 
                   key={eq.id} 
                   onClick={() => handleViewHistory(eq)}
                   className={cn(
                     "p-4 border rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex flex-col justify-between group",
                     isMaint 
                      ? "bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/70" 
                      : hasFailed
                        ? "bg-rose-50/40 border-rose-200/80 hover:bg-rose-50"
                        : isChecked
                          ? "bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50/60"
                          : "bg-white border-slate-200/70 hover:border-indigo-200"
                   )}
                >
                   <div>
                     {/* Card Header Info */}
                     <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                           <div className={cn(
                             "w-10 h-10 rounded-xl border flex items-center justify-center transition-all group-hover:scale-110",
                             isMaint 
                              ? "bg-amber-100/80 border-amber-200 text-amber-700" 
                              : hasFailed
                                ? "bg-rose-100/80 border-rose-200 text-rose-700"
                                : isChecked
                                  ? "bg-emerald-100/80 border-emerald-200 text-emerald-700"
                                  : "bg-slate-50 border-slate-200/60 text-slate-500"
                           )}>
                              {isMaint ? (
                                <Wrench className="w-5 h-5" />
                              ) : hasFailed ? (
                                <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
                              ) : isChecked ? (
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <ServerCrash className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                              )}
                           </div>
                           <div>
                             <h3 className="font-bold text-slate-900 text-sm group-hover:text-indigo-900 transition-colors" title={eq.name}>
                               {eq.name}
                             </h3>
                             {/* Clean Unboxed Metadata (Zero Pill Style) */}
                             <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                               <span>{eq.code}</span>
                               <span aria-hidden="true">·</span>
                               <span className="truncate max-w-[100px]">{eq.location || 'คลังวิจัย'}</span>
                             </div>
                           </div>
                        </div>
                     </div>

                     {/* Specification details / Reference */}
                     {eq.referenceDocNo && (
                       <p className="text-[10px] text-slate-400 font-mono mt-1 mb-4 truncate">
                         Ref Doc: {eq.referenceDocNo}
                       </p>
                     )}
                   </div>
                   
                   {/* Visual Status Pills (Only Interactive / Informational, Beautiful Segmented Look) */}
                   <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                      {isMaint ? (
                        <div className="py-2 rounded-xl text-[11px] font-bold uppercase text-center bg-amber-500 text-white shadow-sm flex items-center justify-center gap-1.5">
                           <Wrench className="w-3.5 h-3.5" />
                           ปิดเพื่อซ่อมบำรุง
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {hasDailyItems && (
                             <div className={cn("px-3 py-2 rounded-xl border text-[10px] font-bold text-center flex-1 flex flex-col items-center justify-center shadow-sm",
                                dailyStatus === 'passed' ? "bg-emerald-500/10 border-emerald-300 text-emerald-800" :
                                (dailyStatus === 'failed' || dailyStatus === 'needs_attention') ? "bg-rose-500/10 border-rose-300 text-rose-800" :
                                "bg-amber-500/10 border-amber-300 text-amber-800"
                             )}>
                                <span className="opacity-60 text-[9px] uppercase tracking-wider mb-0.5">ประจำวัน</span>
                                <span className="font-extrabold">
                                  {dailyStatus === 'passed' ? '✓ ปกติ' : 
                                   (dailyStatus === 'failed' || dailyStatus === 'needs_attention') ? '✗ หลุดสเปก' : 
                                   'รอการตรวจ'}
                                </span>
                             </div>
                          )}
                          
                          {hasOnUseItems && (
                             <div className={cn("px-3 py-2 rounded-xl border text-[10px] font-bold text-center flex-1 flex flex-col items-center justify-center shadow-sm",
                                onUseStatus === 'passed' ? "bg-emerald-500/10 border-emerald-300 text-emerald-800" :
                                (onUseStatus === 'failed' || onUseStatus === 'needs_attention') ? "bg-rose-500/10 border-rose-300 text-rose-800" :
                                "bg-slate-50 border-slate-200 text-slate-400"
                             )}>
                                <span className="opacity-60 text-[9px] uppercase tracking-wider mb-0.5">ระหว่างใช้</span>
                                <span className="font-extrabold">
                                  {onUseStatus === 'passed' ? '✓ ผ่าน' : 
                                   (onUseStatus === 'failed' || onUseStatus === 'needs_attention') ? '✗ ผิดปกติ' : 
                                   'Standby'}
                                </span>
                             </div>
                          )}
                        </div>
                      )}
                   </div>
                </div>
              );
           })}
           
           {filteredEquipments.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-500 flex flex-col items-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                <p className="mb-4 text-base font-bold text-slate-600">ไม่พบข้อมูลเครื่องจักรตามตัวกรองนี้</p>
                <button 
                 onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                 className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              </div>
           )}
         </div>
      </div>

      {/* Equipment History & Maintenance Modal */}
      <AnimatePresence>
         {historyEq && !selectedLog && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm"
            >
               <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-100"
               >
                  <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                     <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                          <History className="w-5 h-5 text-indigo-500" />
                          ข้อมูลเครื่องจักรและประวัติย้อนหลัง
                        </h2>
                        {/* Unboxed breadcrumb metadata */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <span>{historyEq.name}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-indigo-600 font-bold">{historyEq.code}</span>
                          <span aria-hidden="true">·</span>
                          <span>สถานที่: {historyEq.location || 'Laboratory'}</span>
                        </div>
                     </div>
                     <button onClick={() => { setHistoryDateFilter(''); setHistoryEq(null); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                  </div>
                  
                  <div className="overflow-y-auto flex-1 p-6 space-y-6">
                     {/* Asset Maintenance Banner / Panel */}
                     <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-slate-50 shadow-sm">
                       <div className="px-4 py-3 bg-slate-100 flex justify-between items-center border-b border-slate-200/50">
                         <h4 className="text-xs font-bold text-slate-700 tracking-wider uppercase flex items-center gap-1.5">
                           <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                           สถานะการส่งซ่อมบำรุง (Maintenance Status)
                         </h4>
                         <span className={cn(
                           "text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider",
                           historyEq.status === 'maintenance' ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
                         )}>
                           {historyEq.status === 'maintenance' ? 'ปิดปรับปรุง' : 'พร้อมใช้งาน'}
                         </span>
                       </div>
                       
                       <div className="p-4 space-y-4">
                         {historyEq.status === 'maintenance' ? (
                           <div className="space-y-3">
                             <div className="p-4 bg-amber-500/10 border border-amber-300 rounded-xl space-y-1">
                               <p className="text-[10px] text-amber-800 font-extrabold uppercase tracking-wider">อาการชำรุดที่พบ:</p>
                               <p className="text-sm font-semibold text-slate-800">{historyEq.maintenanceReason || "ไม่ระบุพฤติกรรมผิดปกติ"}</p>
                               {historyEq.maintenanceNotes && (
                                 <p className="text-xs text-slate-600 italic mt-2 bg-white p-2.5 rounded-lg border border-slate-100">{historyEq.maintenanceNotes}</p>
                               )}
                               <p className="text-[11px] text-slate-400 mt-2">
                                 ทำรายการเมื่อ: {historyEq.maintenanceAt ? format(historyEq.maintenanceAt, 'dd MMM yyyy, HH:mm') : 'N/A'} โดยคุณ <b>{historyEq.maintenanceBy || 'Admin'}</b>
                               </p>
                             </div>
                             
                             <button
                               type="button"
                               onClick={handleCompleteMaintenance}
                               className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                             >
                               <CheckCircle className="w-4 h-4" />
                               ซ่อมบำรุงเสร็จสิ้น (คืนสถานะพร้อมใช้งาน)
                             </button>
                           </div>
                         ) : (
                           <div>
                             {!showMaintForm ? (
                               <div className="flex items-center justify-between gap-3">
                                 <p className="text-xs font-semibold text-slate-500">เครื่องมือทำงานเป็นปกติ พร้อมสำหรับการสแกนตรวจสอบ</p>
                                 <button
                                   type="button"
                                   onClick={() => setShowMaintForm(true)}
                                   className="py-1.5 px-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                 >
                                   <Wrench className="w-3.5 h-3.5" />
                                   แจ้งเครื่องชำรุด / ส่งซ่อม
                                 </button>
                               </div>
                             ) : (
                               <div className="p-4 bg-amber-500/5 border border-amber-200 rounded-2xl space-y-3.5 animate-in fade-in slide-in-from-top-2">
                                 <div className="grid grid-cols-2 gap-3">
                                   <div>
                                     <label className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">รหัสผู้แจ้งซ่อม *</label>
                                     <input 
                                       type="text" 
                                       required
                                       value={maintBy}
                                       onChange={e => setMaintBy(e.target.value)}
                                       placeholder="รหัสพนักงาน SC-101" 
                                       className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-amber-500"
                                     />
                                   </div>
                                   <div>
                                     <label className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">อาการ/ปัญหาที่พบ *</label>
                                     <input 
                                       type="text" 
                                       required
                                       value={maintReason}
                                       onChange={e => setMaintReason(e.target.value)}
                                       placeholder="หน้าจอควบคุมกะพริบถี่ / ค่าความร้อนไม่ตรง" 
                                       className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-amber-500"
                                     />
                                   </div>
                                 </div>
                                 <div>
                                   <label className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">รายละเอียดทางเทคนิคเพิ่มเติม</label>
                                   <textarea 
                                     rows={2}
                                     value={maintNotes}
                                     onChange={e => setMaintNotes(e.target.value)}
                                     placeholder="ระบุความเสียหายโดยละเอียด หรือ ข้อควรระวังเพิ่มเติม..." 
                                     className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-amber-500"
                                   />
                                 </div>
                                 
                                 <div className="flex justify-end gap-2 pt-1">
                                   <button 
                                     type="button" 
                                     onClick={() => setShowMaintForm(false)} 
                                     className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
                                   >
                                     ยกเลิก
                                   </button>
                                   <button 
                                     type="button" 
                                     onClick={handleStartMaintenance}
                                     className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-500 shadow-sm cursor-pointer"
                                   >
                                     ยืนยันล็อคสถานะปิดซ่อม
                                   </button>
                                 </div>
                               </div>
                             )}
                           </div>
                         )}
                       </div>
                     </div>

                     {/* Log History */}
                     <div className="space-y-3.5">
                        <div className="flex justify-between items-center px-1">
                           <h3 className="text-xs font-extrabold text-slate-500 tracking-wider uppercase">ประวัติการบันทึกเครื่องจักร</h3>
                           <select 
                              value={historyDateFilter}
                              onChange={(e) => setHistoryDateFilter(e.target.value)}
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                           >
                              <option value="">ทั้งหมด</option>
                              {Array.from(new Set(historyLogs.map(l => format(l.timestamp, 'yyyy-MM-dd')))).map(dateStr => (
                                <option key={dateStr} value={dateStr}>{format(new Date(dateStr + 'T00:00:00'), 'dd MMM yyyy')}</option>
                              ))}
                           </select>
                        </div>

                        <div className="border border-slate-200/60 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white max-h-[300px] overflow-y-auto shadow-sm">
                           {historyLogs.filter(log => !historyDateFilter || format(log.timestamp, 'yyyy-MM-dd') === historyDateFilter).length === 0 ? (
                              <div className="p-8 text-center text-slate-400 text-xs italic">
                                 ไม่พบประวัติผลการตรวจในช่วงตัวกรองนี้
                              </div>
                           ) : (
                              historyLogs.filter(log => !historyDateFilter || format(log.timestamp, 'yyyy-MM-dd') === historyDateFilter).map(log => (
                                 <div key={log.id} onClick={() => handleOpenLog(log)} className="p-4 px-5 flex items-center justify-between hover:bg-indigo-50/20 cursor-pointer transition-colors">
                                    <div>
                                       <p className="font-bold text-slate-900 text-sm">{format(log.timestamp, 'dd MMM yyyy')} <span className="text-slate-400 font-normal ml-2 font-mono text-xs">{format(log.timestamp, 'HH:mm')} น.</span></p>
                                       <p className="text-[11px] text-slate-500 mt-1">ผู้ตรวจ: {log.operatorName} · กะ: {log.shift}{log.checkCycle ? ` · รอบตรวจ: ${log.checkCycle === 'all' ? 'ทั้งหมด' : log.checkCycle}` : ''}</p>
                                    </div>
                                    <span className={cn("px-2.5 py-1 rounded-xl text-[10px] font-extrabold capitalize tracking-wider whitespace-nowrap border shadow-sm", 
                                       log.status === 'passed' ? "bg-emerald-500/10 border-emerald-300 text-emerald-800" : "bg-rose-500/10 border-rose-300 text-rose-800"
                                    )}>
                                       {log.status === 'passed' ? 'ปกติ' : 'ผิดปกติ'}
                                    </span>
                                 </div>
                              ))
                           )}
                        </div>
                     </div>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      {/* Log Details Modal */}
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
                  <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                     <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">รายละเอียดใบบันทึกผลการตรวจเช็ก</h2>
                        <p className="text-xs text-slate-500 mt-1">{logEq?.name || 'Equipment'} · รหัส {logEq?.code} · บันทึกเวลา {format(selectedLog.timestamp, 'dd MMM yyyy, HH:mm น.')}</p>
                     </div>
                     <button onClick={() => setSelectedLog(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 space-y-6">
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ผู้สแกนตรวจสอบ</p>
                            <p className="font-semibold text-slate-800 text-xs sm:text-sm">{selectedLog.operatorName}</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">กะการทำงาน (Shift)</p>
                            <p className="font-semibold text-slate-800 text-xs sm:text-sm">{selectedLog.shift === 'DAY' ? 'กะกลางวัน' : selectedLog.shift === 'NIGHT' ? 'กะกลางคืน' : 'กะพิเศษ'}</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ประเภทการตรวจเช็ก</p>
                            <p className="font-semibold text-slate-800 text-xs sm:text-sm capitalize">{selectedLog.checkCycle === 'all' ? 'ทุกพารามิเตอร์' : selectedLog.checkCycle === 'daily' ? 'รายวันเท่านั้น' : 'ระหว่างใช้งาน'}</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ประเมินสถานะรวม</p>
                            <span className={cn("px-2.5 py-0.5 rounded-lg text-xs font-bold inline-block mt-0.5 border shadow-sm", 
                               selectedLog.status === 'passed' ? "bg-emerald-500/10 border-emerald-300 text-emerald-800" : "bg-rose-500/10 border-rose-300 text-rose-800"
                            )}>
                               {selectedLog.status === 'passed' ? 'ผ่าน (ปกติ)' : 'หลุดสเปก / ต้องแก้ไข'}
                            </span>
                        </div>
                     </div>

                     <div>
                       <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">ผลพารามิเตอร์รายพารามิเตอร์</h3>
                       <div className="space-y-3">
                          {logItems.length === 0 ? (
                             <p className="text-sm text-slate-500 italic">ไม่มีข้อมูลพารามิเตอร์ หรือค่ากำหนดถูกลบออกแล้ว</p>
                          ) : (
                             logItems.map(item => {
                                 const response = selectedLog.responses.find(r => r.checkItemId === item.id);
                                 const isOOC = response && !response.isNormal;
                                 return (
                                     <div key={item.id} className={cn("p-4 rounded-xl border flex justify-between items-center transition-colors", isOOC ? "bg-rose-500/5 border-rose-300" : "bg-white border-slate-200")}>
                                        <div>
                                           <p className="font-bold text-sm text-slate-900">{item.name}</p>
                                           <p className="text-xs text-slate-500 mt-0.5">เกณฑ์มาตรฐาน: {item.criteriaText || 'ไม่มีเกณฑ์เพิ่มเติม'}</p>
                                        </div>
                                        <div className="text-right">
                                           {response ? (
                                               <div className="flex items-center gap-2">
                                                  <span className={cn("font-bold font-mono text-sm", isOOC ? "text-rose-600" : "text-emerald-600")}>
                                                     {response.type === 'boolean' ? (response.valueBoolean ? "ผ่าน (Pass)" : "ไม่ผ่าน (Fail)") : `${response.valueNumeric} ${item.unit || ''}`}
                                                  </span>
                                                  {isOOC ? <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" /> : <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
                                               </div>
                                           ) : (
                                               <span className="text-xs text-slate-400 italic">ไม่มีข้อมูลการตอบกลับ</span>
                                           )}
                                        </div>
                                     </div>
                                 )
                             })
                          )}
                       </div>
                     </div>

                     <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                          <div className="flex justify-between items-start mb-3">
                             <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                               <MessageSquare className="w-4 h-4 text-slate-500" /> 
                               ข้อความบันทึกเพิ่มเติมและการดำเนินการแก้ไข
                             </h3>
                             {!editingNotes && (
                                <button onClick={() => setEditingNotes(true)} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-indigo-100 transition-colors cursor-pointer">
                                   <Edit2 className="w-3 h-3" /> แก้ไขประวัติ
                                </button>
                             )}
                          </div>
                          
                          {editingNotes ? (
                              <div className="space-y-4">
                                 <div>
                                     <label className="block text-xs font-semibold text-slate-700 mb-1">บังคับเปลี่ยนสถานะผลตรวจ</label>
                                     <select value={editStatusText} onChange={e => setEditStatusText(e.target.value as any)} className="w-full text-sm p-2.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none">
                                        <option value="passed">ผ่านการตรวจสอบ / ทำงานปกติ (Passed)</option>
                                        <option value="needs_attention">พบสิ่งต้องดูแล / เฝ้าระวัง (OOC)</option>
                                        <option value="failed">ห้ามใช้งานเด็ดขาด / ชำรุดพัง (Failed)</option>
                                     </select>
                                 </div>
                                 <div>
                                     <label className="block text-xs font-semibold text-slate-700 mb-1">รายละเอียด / การแก้ไขที่ทำไปแล้ว</label>
                                     <textarea 
                                        value={editNotesText} 
                                        onChange={e => setEditNotesText(e.target.value)} 
                                        className="w-full text-sm p-3 border border-slate-200 rounded-xl min-h-[80px] focus:ring-1 focus:ring-indigo-500 outline-none bg-white" 
                                        placeholder="ระบุแนวทางประคองงาน บันทึกผลสอบเทียบ หรือการเปลี่ยนอะไหล่..."
                                     />
                                 </div>
                                 <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors cursor-pointer">ยกเลิก</button>
                                    <button onClick={handleSaveUpdate} className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer">บันทึกข้อมูลปรับปรุง</button>
                                 </div>
                              </div>
                          ) : (
                              <p className={cn("text-sm leading-relaxed", selectedLog.notes ? "text-slate-700" : "text-slate-400 italic")}>
                                 {selectedLog.notes || "ไม่มีข้อสังเกตพิเศษระบุไว้"}
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

function FilterTab({ active, onClick, label, theme = 'indigo' }: { active: boolean, onClick: () => void, label: string, theme?: 'indigo' | 'emerald' | 'amber' | 'rose' }) {
  const activeStyles = {
    indigo: 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700',
    emerald: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
    amber: 'bg-amber-500 text-white shadow-sm hover:bg-amber-600',
    rose: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700'
  };

  return (
    <button 
      onClick={onClick} 
      className={cn(
        "px-3 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer whitespace-nowrap",
        active ? activeStyles[theme] : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
      )}
    >
      {label}
    </button>
  );
}

function MetricCard({ title, engTitle, value, subtitle, icon, trend }: { title: string, engTitle: string, value: string | number, subtitle: string, icon: React.ReactNode, trend: 'positive' | 'negative' | 'warning' | 'neutral' }) {
  const trendStyles = {
    positive: 'from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-800',
    negative: 'from-rose-500/10 to-transparent border-rose-500/20 text-rose-800',
    warning: 'from-amber-500/10 to-transparent border-amber-500/20 text-amber-800',
    neutral: 'from-indigo-500/10 to-transparent border-indigo-500/20 text-indigo-800'
  };

  const bgGradient = trendStyles[trend].split(' ').slice(0, 2).join(' ');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-5 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all duration-300 min-h-[140px]"
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity group-hover:opacity-100", bgGradient)}></div>
      <div className="relative z-10 flex justify-between items-start mb-3">
        <div>
          <p className="text-xs font-extrabold text-slate-800 tracking-wide">{title}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{engTitle}</p>
        </div>
        <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-300 shrink-0">{icon}</div>
      </div>
      <div className="relative z-10 mt-auto">
        <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-800 group-hover:text-indigo-900 transition-colors drop-shadow-sm font-mono tabular-nums">{value}</h3>
        <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5 font-semibold leading-relaxed line-clamp-1">{subtitle}</p>
      </div>
    </motion.div>
  );
}
