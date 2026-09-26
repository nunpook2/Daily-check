import React, { useState, useEffect } from 'react';
import { 
  fetchEquipments, 
  fetchLogs, 
  seedDummyData,
  fetchCheckItems,
  updateCheckLog,
  fetchEquipmentLogs,
  updateEquipment,
  saveCheckLog
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
  Calendar,
  Sun,
  Moon,
  User,
  Power
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

  const getShiftHistoryItems = () => {
    if (!historyEq) return [];
    
    const eqItems = checkItems.filter(item => item.equipmentId === historyEq.id);
    const timelineItems = [];

    const now = new Date();
    
    // Generate past 10 days of shifts
    for (let i = 0; i < 10; i++) {
       const d = new Date();
       d.setDate(now.getDate() - i);
       const dateStr = format(d, 'yyyy-MM-dd');
       const dateDisplay = format(d, 'dd MMM yyyy');

       const isToday = i === 0;
       const hours = now.getHours();

       // NIGHT shift (20:00 - 08:00)
       const nightShiftStarted = !isToday || hours >= 20;
       if (nightShiftStarted) {
          const log = historyLogs.find(l => l.dateKey === dateStr && l.shift === 'NIGHT');
          let isIdle = false;
          let isIncomplete = false;
          let isPassed = false;
          let operatorName = 'ไม่ได้ตรวจสอบ / ค้างตรวจ';

          if (log) {
             isIdle = log.notes?.includes('ไม่ได้ใช้งาน') || log.notes?.includes('ติดทดสอบ');
             isPassed = log.status === 'passed';
             operatorName = log.operatorName || 'ไม่ระบุ';
             
             if (!isIdle) {
                const matchedIds = new Set();
                eqItems.forEach(item => {
                   const resp = log.responses.find(r => r.checkItemId === item.id || (r.itemName && r.itemName.toLowerCase() === item.name.toLowerCase()));
                   if (resp) {
                      matchedIds.add(item.id);
                   }
                });
                const logPendingCount = Math.max(0, eqItems.length - matchedIds.size);
                isIncomplete = logPendingCount > 0;
             }
          }

          const nightTime = new Date(d);
          nightTime.setHours(20, 0, 0, 0);

          timelineItems.push({
             id: `${dateStr}-NIGHT`,
             dateKey: dateStr,
             dateDisplay,
             shift: 'NIGHT',
             log,
             isIdle,
             isIncomplete,
             isPassed,
             operatorName,
             timestamp: nightTime.getTime()
          });
       }

       // DAY shift (08:00 - 20:00)
       const dayShiftStarted = !isToday || hours >= 8;
       if (dayShiftStarted) {
          const log = historyLogs.find(l => l.dateKey === dateStr && l.shift === 'DAY');
          let isIdle = false;
          let isIncomplete = false;
          let isPassed = false;
          let operatorName = 'ไม่ได้ตรวจสอบ / ค้างตรวจ';

          if (log) {
             isIdle = log.notes?.includes('ไม่ได้ใช้งาน') || log.notes?.includes('ติดทดสอบ');
             isPassed = log.status === 'passed';
             operatorName = log.operatorName || 'ไม่ระบุ';
             
             if (!isIdle) {
                const matchedIds = new Set();
                eqItems.forEach(item => {
                   const resp = log.responses.find(r => r.checkItemId === item.id || (r.itemName && r.itemName.toLowerCase() === item.name.toLowerCase()));
                   if (resp) {
                      matchedIds.add(item.id);
                   }
                });
                const logPendingCount = Math.max(0, eqItems.length - matchedIds.size);
                isIncomplete = logPendingCount > 0;
             }
          }

          const dayTime = new Date(d);
          dayTime.setHours(8, 0, 0, 0);

          timelineItems.push({
             id: `${dateStr}-DAY`,
             dateKey: dateStr,
             dateDisplay,
             shift: 'DAY',
             log,
             isIdle,
             isIncomplete,
             isPassed,
             operatorName,
             timestamp: dayTime.getTime()
          });
       }
    }

    return timelineItems.sort((a, b) => b.timestamp - a.timestamp);
  };

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

  const handleQuickSetStandby = async (e: React.MouseEvent, eqId: string, shift: 'DAY' | 'NIGHT') => {
    e.stopPropagation(); // prevent modal opening!
    const confirmSet = window.confirm(`คุณต้องการเปลี่ยนสถานะของเครื่องนี้เป็น "ไม่ได้ใช้งาน / เครื่องติดทดสอบ" ในกะ${shift === 'DAY' ? 'กลางวัน (เช้า)' : 'กลางคืน (ดึก)'} หรือไม่? (ระบบจะออกใบบันทึกสแตนบายเพื่อให้ผ่านการตรวจโดยสมบูรณ์)`);
    if (!confirmSet) return;
    
    // Create passing responses for all check items for this equipment
    const eqItems = checkItems.filter(item => item.equipmentId === eqId);
    const responses = eqItems.map(item => ({
      checkItemId: item.id!,
      type: item.type,
      itemName: item.name,
      valueBoolean: item.type === 'boolean' ? true : undefined,
      valueNumeric: item.type === 'numeric' ? (item.minValue ?? 0) : undefined,
      isNormal: true
    }));

    const newLog = {
      equipmentId: eqId,
      timestamp: Date.now(),
      dateKey: dashboardDate,
      shift: shift,
      checkCycle: 'all',
      operatorId: 'sc-101',
      operatorName: 'Sarah Connor (แอดมิน Bypass)',
      status: 'passed' as const,
      notes: 'ไม่ได้ใช้งาน / เครื่องติดทดสอบ (Standby / Testing)',
      responses: responses
    };

    try {
      await saveCheckLog(newLog);
      alert(`บันทึกสถานะ "ไม่ได้ใช้งาน / เครื่องติดทดสอบ" ของกะ${shift === 'DAY' ? 'กลางวัน' : 'กลางคืน'} เรียบร้อยแล้ว`);
      loadData(dashboardDate);
    } catch (err) {
      alert("ไม่สามารถบันทึกสถานะได้ กรุณาลองใหม่อีกครั้ง");
    }
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
  
  // Calculate compliance statistics for shift
  const checkedEqIds = new Set(logs.map(l => l.equipmentId));
  const pendingCount = activeEquipments.filter(e => !checkedEqIds.has(e.id)).length;
  const checkedCount = activeEquipments.length - pendingCount;
  const complianceRate = activeEquipments.length === 0 ? 100 : Math.round((checkedCount / activeEquipments.length) * 100);

  // Filter Equipment for Tracker Table/Cards
  const filteredEquipments = equipments.filter(eq => {
    const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          eq.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (eq.location && eq.location.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

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
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Shift monitoring center
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-display">
            ระบบแผงควบคุมกลาง <span className="text-indigo-600">APEX INSPEC</span>
          </h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base font-medium">
            สถิติตรวจเช็คแยกตามกะทำงานแบบเรียลไทม์ และระบบตรวจสอบสถานะเครื่องค้างใช้งาน
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
            className="px-4 py-3 bg-slate-950 text-white font-bold rounded-2xl text-xs hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCcw className={cn("w-3.5 h-3.5", seeding && "animate-spin")} />
            {seeding ? "กำลังอัปเดต..." : "อัปเดตข้อมูลสาธิต"}
          </button>
        </div>
      </div>

      {/* Corporate Executive Analytics Dashboard Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <MetricCard 
          title="อัตราตรวจความสอดคล้อง" 
          engTitle="Inspected Compliance"
          value={`${complianceRate}%`} 
          subtitle="เป้าหมายรายวัน 100%"
          icon={<Activity className="w-6 h-6 text-indigo-600" />}
          trend={complianceRate >= 90 ? 'up' : 'down'}
        />
        <MetricCard 
          title="เครื่องมือตรวจแล้ววันนี้" 
          engTitle="Machines Inspected"
          value={checkedCount} 
          subtitle={`จากเครื่องจักรที่เปิดใช้ทั้งหมด ${activeEquipments.length} เครื่อง`}
          icon={<CheckCircle className="w-6 h-6 text-emerald-500" />}
          trend="neutral"
        />
        <MetricCard 
          title="เครื่องค้างส่งบันทึกตรวจ" 
          engTitle="Inspection Pending"
          value={pendingCount} 
          subtitle="ควรได้รับบันทึกสแตนบายหากไม่ทำงาน"
          icon={<AlertTriangle className={cn("w-6 h-6", pendingCount > 0 ? "text-amber-500" : "text-slate-400")} />}
          trend={pendingCount > 0 ? 'down' : 'up'}
        />
        <MetricCard 
          title="เครื่องที่ชำรุดเสียหาย" 
          engTitle="Breakdown Machines"
          value={maintenanceEquipments.length} 
          subtitle="ปิดล็อกหน้าสแกนตรวจเด็ดขาด"
          icon={<Wrench className={cn("w-6 h-6", maintenanceEquipments.length > 0 ? "text-red-500" : "text-slate-400")} />}
          trend={maintenanceEquipments.length > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {/* Smart Filter & Tracker Zone */}
      <div className="shadow-sm border border-slate-200/60 rounded-3xl bg-white overflow-hidden p-6 md:p-8 relative">
         <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
         
         {/* Filter controls */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-100 relative z-10">
           <div>
             <h2 className="text-xl font-bold text-slate-900 font-display">ศูนย์ติดตามสถานะเครื่องจักรรายวัน (Shift Monitor)</h2>
             <p className="text-xs text-slate-500 mt-1">มอนิเตอร์ความพร้อมของกะกลางวันและกลางคืนได้พร้อมกันในหน้าเดียว</p>
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
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all placeholder:text-slate-400 font-semibold text-slate-800"
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
               const isMaint = eq.status === 'maintenance';
               const isChecked = eqLogsToday.length > 0;
               const hasFailed = eqLogsToday.some(l => l.status === 'failed' || l.status === 'needs_attention');

               return (
                <div 
                   key={eq.id} 
                   onClick={() => handleViewHistory(eq)}
                   className={cn(
                     "p-4 border rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex flex-col justify-between group bg-white shadow-xs",
                     isMaint 
                      ? "border-l-4 border-l-red-600 border-red-200 bg-red-50/10 hover:bg-red-50/30" 
                      : hasFailed
                        ? "border-l-4 border-l-rose-500 border-rose-200 bg-rose-50/10 hover:bg-rose-50/30"
                        : isChecked
                          ? "border-l-4 border-l-emerald-500 border-emerald-100 bg-emerald-50/10 hover:bg-emerald-50/30"
                          : "border-l-4 border-l-amber-500 border-amber-200 bg-amber-50/10 hover:bg-amber-50/30"
                   )}
                >
                   <div>
                      {/* Card Header Info */}
                      <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl border flex items-center justify-center transition-all group-hover:scale-110",
                              isMaint 
                               ? "bg-red-50 border-red-200 text-red-600" 
                               : hasFailed
                                 ? "bg-rose-50 border-rose-200 text-rose-600"
                                 : isChecked
                                   ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                   : "bg-amber-50 border-amber-200 text-amber-700"
                            )}>
                               {isMaint ? (
                                 <Wrench className="w-5 h-5 text-red-600" />
                               ) : hasFailed ? (
                                 <AlertTriangle className="w-5 h-5 text-rose-600" />
                               ) : isChecked ? (
                                 <CheckCircle className="w-5 h-5 text-emerald-600" />
                               ) : (
                                 <Clock className="w-5 h-5 text-amber-500" />
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
                                <span className="truncate max-w-[100px]">{(eq.location || 'คลังวิจัย').replace('น้อง', 'ห้อง')}</span>
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
                   
                   {/* Dual Shift Monitoring - Day Shift & Night Shift */}
                   <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                      {isMaint ? (
                        <div className="py-2.5 rounded-xl text-[11px] font-extrabold uppercase text-center bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md flex items-center justify-center gap-1.5">
                           <Wrench className="w-3.5 h-3.5" />
                           ปิดเพื่อซ่อมบำรุง (Break Down)
                        </div>
                      ) : (
                        <div className="space-y-2 w-full">
                           {/* DAY SHIFT MONITOR ZONE */}
                           <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
                              <span className="font-black text-slate-700 flex items-center gap-1">
                                 🌞 กะกลางวัน (เช้า):
                              </span>
                              
                              {(() => {
                                 const dayLog = eqLogsToday.find(l => l.shift === 'DAY');
                                 if (dayLog) {
                                    const isIdle = dayLog.notes?.includes('ไม่ได้ใช้งาน') || dayLog.notes?.includes('ติดทดสอบ');
                                    if (isIdle) {
                                       return (
                                          <span className="px-2 py-1 rounded bg-sky-50 text-sky-700 border border-sky-200 font-black text-[10px] shadow-xs">
                                             💤 ไม่ใช้งาน / ติดทดสอบ
                                          </span>
                                       );
                                    }
                                    return dayLog.status === 'passed' ? (
                                       <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-[10px] shadow-xs truncate max-w-[120px]" title={`ผู้ตรวจ: ${dayLog.operatorName}`}>
                                          ✅ ตรวจผ่าน ({dayLog.operatorName.split(' ')[0]})
                                       </span>
                                    ) : (
                                       <span className="px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 font-black text-[10px] shadow-xs">
                                          ❌ พบปัญหาหน้างาน
                                        </span>
                                     );
                                  }
                                  return (
                                     <button 
                                        onClick={(e) => handleQuickSetStandby(e, eq.id!, 'DAY')}
                                        className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] border border-amber-600 shadow-sm transition-colors cursor-pointer"
                                        title="คลิกเพื่อบันทึกว่าเครื่องนี้ไม่ได้ใช้งาน หรือติดทำการทดสอบอยู่"
                                     >
                                        ⏳ ค้างตรวจ (บิดสแตนบาย 💤)
                                     </button>
                                  );
                               })()}
                           </div>

                           {/* NIGHT SHIFT MONITOR ZONE */}
                           <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
                              <span className="font-black text-slate-700 flex items-center gap-1">
                                 🌙 กะกลางคืน (ดึก):
                              </span>
                              
                              {(() => {
                                 const nightLog = eqLogsToday.find(l => l.shift === 'NIGHT');
                                 if (nightLog) {
                                    const isIdle = nightLog.notes?.includes('ไม่ได้ใช้งาน') || nightLog.notes?.includes('ติดทดสอบ');
                                    if (isIdle) {
                                       return (
                                          <span className="px-2 py-1 rounded bg-sky-50 text-sky-700 border border-sky-200 font-black text-[10px] shadow-xs">
                                             💤 ไม่ใช้งาน / ติดทดสอบ
                                          </span>
                                       );
                                    }
                                    return nightLog.status === 'passed' ? (
                                       <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-[10px] shadow-xs truncate max-w-[120px]" title={`ผู้ตรวจ: ${nightLog.operatorName}`}>
                                          ✅ ตรวจผ่าน ({nightLog.operatorName.split(' ')[0]})
                                       </span>
                                    ) : (
                                       <span className="px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 font-black text-[10px] shadow-xs">
                                          ❌ พบปัญหาหน้างาน
                                        </span>
                                     );
                                  }
                                  return (
                                     <button 
                                        onClick={(e) => handleQuickSetStandby(e, eq.id!, 'NIGHT')}
                                        className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] border border-amber-600 shadow-sm transition-colors cursor-pointer"
                                        title="คลิกเพื่อบันทึกว่าเครื่องนี้ไม่ได้ใช้งาน หรือติดทำการทดสอบอยู่"
                                     >
                                        ⏳ ค้างตรวจ (บิดสแตนบาย 💤)
                                     </button>
                                  );
                               })()}
                           </div>
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
        {historyEq && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-100"
            >
              {/* Modal header with active details */}
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
                 <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">{historyEq.name}</h2>
                      <span className={cn("text-xs font-extrabold px-2.5 py-0.5 rounded-full border", 
                        historyEq.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                      )}>
                        {historyEq.status === 'active' ? 'กำลังเปิดใช้งาน' : 'ปิดซ่อมบำรุง'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-1 font-bold">
                      <span>รหัสบาร์โค้ด: {historyEq.code}</span>
                      <span aria-hidden="true">·</span>
                      <span>สถานที่: {(historyEq.location || 'Laboratory').replace('น้อง', 'ห้อง')}</span>
                    </div>
                 </div>
                 <button onClick={() => { setHistoryDateFilter(''); setHistoryEq(null); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                   <X className="w-5 h-5" />
                 </button>
              </div>

              {/* Scrollable log listing and actions */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Log entries timeline */}
                    <div className="md:col-span-7 space-y-4">
                       <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <History className="w-4 h-4 text-indigo-500" /> บันทึกประวัติเครื่องย้อนหลัง
                       </h3>
                       
                       <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                           {getShiftHistoryItems().length === 0 ? (
                              <p className="text-xs font-bold text-slate-400 italic py-6 text-center bg-slate-50 border border-slate-100 rounded-xl">ไม่มีข้อมูลกะการทำงานในช่วงเวลาที่เลือก</p>
                           ) : (
                              getShiftHistoryItems().map(item => {
                                 if (item.log) {
                                    return (
                                       <div key={item.id} onClick={() => handleOpenLog(item.log)} className="p-3.5 rounded-xl border border-slate-200/60 hover:border-indigo-300 hover:shadow-sm bg-white transition-all cursor-pointer flex justify-between items-center text-xs">
                                          <div>
                                             <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800">{item.dateDisplay}</span>
                                                <span className="font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[10px]">
                                                   {item.shift === 'DAY' ? '🌞 กะเช้า (08.00 - 20.00 น.)' : '🌙 กะดึก (20.00 - 08.00 น.)'}
                                                </span>
                                             </div>
                                             <p className="text-[10px] text-slate-400 mt-1 font-semibold truncate max-w-[200px]">ผู้บันทึก: {item.operatorName}</p>
                                          </div>
                                          <span className={cn("px-2 py-0.5 rounded font-extrabold text-[10px]", 
                                             item.isIdle 
                                               ? "bg-sky-50 text-sky-700 border border-sky-200" 
                                               : item.isIncomplete
                                                 ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                 : item.isPassed 
                                                   ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                                   : "bg-rose-50 text-rose-700 border-rose-200"
                                          )}>
                                             {item.isIdle ? '💤 สแตนบาย' : item.isIncomplete ? '⚠️ ตรวจไม่ครบ' : item.isPassed ? 'ผ่านปกติ' : 'ผิดสเปก'}
                                         </span>
                                       </div>
                                    );
                                 } else {
                                    return (
                                       <div key={item.id} className="p-3.5 rounded-xl border border-amber-200/40 bg-amber-500/5 flex justify-between items-center text-xs">
                                          <div>
                                             <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-400">{item.dateDisplay}</span>
                                                <span className="font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded text-[10px]">
                                                   {item.shift === 'DAY' ? '🌞 กะเช้า (08.00 - 20.00 น.)' : '🌙 กะดึก (20.00 - 08.00 น.)'}
                                                </span>
                                             </div>
                                             <p className="text-[10px] text-rose-600 font-extrabold mt-1">
                                                ⚠️ ค้างการสแกนตรวจเช็กค่าควบคุมประจำกะ
                                             </p>
                                          </div>
                                          <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                                             ⏳ ค้างตรวจ
                                          </span>
                                       </div>
                                    );
                                 }
                              })
                           )}
                        </div>
                    </div>

                    {/* Maintenance Actions Trigger Deck */}
                    <div className="md:col-span-5 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-6 space-y-4">
                       <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                         <Wrench className="w-4 h-4 text-indigo-500" /> จัดการบำรุงรักษา (Maintenance Desk)
                       </h3>
                       
                       {historyEq.status === 'active' ? (
                          <div className="space-y-4">
                             {!showMaintForm ? (
                                <button 
                                  onClick={() => setShowMaintForm(true)}
                                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-red-500/10 cursor-pointer"
                                >
                                   <AlertTriangle className="w-4 h-4" />
                                   สั่งระงับใช้เครื่อง / ส่งชำรุด (Breakdown)
                                </button>
                             ) : (
                                <div className="space-y-3 bg-red-50/50 p-4 rounded-2xl border border-red-100">
                                   <div>
                                      <label className="block text-[10px] font-bold text-red-800 uppercase mb-1">สาเหตุความผิดปกติ / อาการเสีย *</label>
                                      <input type="text" required value={maintReason} onChange={e => setMaintReason(e.target.value)} className="w-full text-xs p-2 bg-white border border-red-200 rounded-lg focus:ring-1 focus:ring-red-500" placeholder="เช่น อุณหภูมิพุ่งสูงเกิน 300°C" />
                                   </div>
                                   <div>
                                      <label className="block text-[10px] font-bold text-red-800 uppercase mb-1">หมายเหตุเพิ่มเติม</label>
                                      <textarea value={maintNotes} onChange={e => setMaintNotes(e.target.value)} className="w-full text-xs p-2 bg-white border border-red-200 rounded-lg focus:ring-1 focus:ring-red-500" placeholder="ระบุอาการอื่นเพิ่มเติม..." />
                                   </div>
                                   <div>
                                      <label className="block text-[10px] font-bold text-red-800 uppercase mb-1">ผู้สั่งปิดเครื่องบำรุงรักษา *</label>
                                      <input type="text" required value={maintBy} onChange={e => setMaintBy(e.target.value)} className="w-full text-xs p-2 bg-white border border-red-200 rounded-lg focus:ring-1 focus:ring-red-500" placeholder="เช่น SC-101 / แอดมิน" />
                                   </div>
                                   <div className="flex gap-2 pt-2">
                                      <button onClick={() => setShowMaintForm(false)} className="flex-1 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600">ยกเลิก</button>
                                      <button onClick={handleStartMaintenance} className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold shadow-xs">สั่งหยุดใช้งานทันที</button>
                                   </div>
                                </div>
                             )}
                          </div>
                       ) : (
                          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl space-y-3.5">
                             <div className="space-y-1">
                                <h4 className="text-xs font-extrabold text-emerald-900 uppercase">อยู่ระหว่างการแก้ไขปัญหาระบบ</h4>
                                <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
                                   <strong>ผู้สั่งหยุดเครื่อง:</strong> {historyEq.maintenanceBy}<br/>
                                   <strong>อาการเสีย:</strong> {historyEq.maintenanceReason}
                                </p>
                             </div>
                             <button 
                               onClick={handleCompleteMaintenance}
                               className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 cursor-pointer"
                             >
                                <CheckCircle className="w-4 h-4" /> ปล่อยคืนเครื่อง / ซ่อมบำรุงเสร็จสิ้น
                             </button>
                          </div>
                       )}
                    </div>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log Details Modal (Nested display inside history) */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col border border-slate-100"
            >
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
                 <div>
                    <h2 className="text-lg font-bold text-slate-900">บันทึกตรวจเช็คฉบับจริงหน้างาน</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{logEq?.name || 'Equipment'} • {format(selectedLog.timestamp, 'dd MMM yyyy, HH:mm น.')}</p>
                 </div>
                 <button onClick={() => setSelectedLog(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                   <X className="w-5 h-5" />
                 </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                 {(() => {
                    const itemsWithResponses = logItems.map(item => {
                       const resp = selectedLog.responses.find(r => r.checkItemId === item.id || (r.itemName && r.itemName.toLowerCase() === item.name.toLowerCase()));
                       return { item, resp };
                    });
                    const matchedResponseIds = new Set();
                    itemsWithResponses.forEach(x => {
                       if (x.resp) matchedResponseIds.add(x.resp.checkItemId);
                    });
                    const orphanResponses = selectedLog.responses.filter(r => !matchedResponseIds.has(r.checkItemId));

                     // Group itemsWithResponses by category
                     const groups: Record<string, typeof itemsWithResponses> = {};
                     itemsWithResponses.forEach((entry) => {
                        const cat = entry.item.category || 'ตรวจสอบความพร้อมของเครื่องมือ';
                        if (!groups[cat]) {
                           groups[cat] = [];
                        }
                        groups[cat].push(entry);
                     });
                    
                    const totalItemsCount = logItems.length + orphanResponses.length;
                    const passedCount = selectedLog.responses.filter(r => r.isNormal).length;
                    const failedCount = selectedLog.responses.filter(r => !r.isNormal).length;
                    const pendingCount = Math.max(0, logItems.length - matchedResponseIds.size);

                    return (
                       <div className="space-y-4 w-full text-left">
                          {/* Summary Statistics Dashboard within Modal */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                             <div className="bg-slate-100/80 border border-slate-200/50 rounded-2xl p-3 text-center">
                                <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">รายการทั้งหมด</span>
                                <span className="text-lg font-black text-slate-800 font-mono">{totalItemsCount} <span className="text-[11px] font-bold">ข้อ</span></span>
                             </div>
                             <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                                <span className="block text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">ตรวจแล้วผ่าน</span>
                                <span className="text-lg font-black text-emerald-700 font-mono">{passedCount} <span className="text-[11px] font-bold">ข้อ</span></span>
                             </div>
                             <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-center">
                                <span className="block text-[10px] font-extrabold text-rose-600 uppercase tracking-wider">พบสิ่งผิดปกติ / พัง</span>
                                <span className="text-lg font-black text-rose-700 font-mono">{failedCount} <span className="text-[11px] font-bold">ข้อ</span></span>
                             </div>
                             <div className={cn(
                                "border rounded-2xl p-3 text-center transition-all",
                                pendingCount > 0 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100"
                             )}>
                                <span className={cn("block text-[10px] font-extrabold uppercase tracking-wider", pendingCount > 0 ? "text-amber-600" : "text-slate-400")}>ค้างตรวจ / ไม่ระบุ</span>
                                <span className={cn("text-lg font-black font-mono", pendingCount > 0 ? "text-amber-700" : "text-slate-500")}>{pendingCount} <span className="text-[11px] font-bold">ข้อ</span></span>
                             </div>
                          </div>

                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 space-y-4">
                             <div className="flex justify-between items-center border-b border-slate-200/60 pb-3">
                                <span className="text-xs font-bold text-slate-500 uppercase">สถานะประเมินสรุป</span>
                                <span className={cn("px-2.5 py-1 rounded text-xs font-extrabold shadow-xs text-white", 
                                   selectedLog.status === 'passed' ? "bg-emerald-500" : "bg-rose-500"
                                )}>{selectedLog.status === 'passed' ? 'ผ่านการตรวจสอบ' : 'พบพารามิเตอร์ผิดปกติ'}</span>
                             </div>

                             <div className="space-y-4">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">รายละเอียดสถานะรายข้อตรวจสอบ (Inspection Details)</p>
                                
                                {Object.entries(groups).map(([category, entries]) => (
                                   <div key={category} className="space-y-3">
                                      {/* Category Header with Clean Line */}
                                      <div className="flex items-center gap-2 mt-4">
                                         <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                         <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">{category}</span>
                                         <div className="h-px bg-slate-200/80 flex-1"></div>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                         {entries.map(({ item, resp }) => {
                                            const isRequired = item.isRequired;
                                            return (
                                               <div 
                                                  key={item.id} 
                                                  className={cn(
                                                     "p-3 rounded-xl border flex flex-col justify-between text-xs font-semibold bg-white transition-all shadow-xs",
                                                     !resp 
                                                        ? "border-amber-200/70 bg-amber-50/20" 
                                                        : resp.isNormal 
                                                           ? "border-emerald-100 bg-emerald-50/10 hover:border-emerald-200" 
                                                           : "border-rose-200 bg-rose-50/30 hover:border-rose-300"
                                                  )}
                                               >
                                                  <div className="flex justify-between items-start gap-1.5 mb-2">
                                                     <div className="min-w-0">
                                                        <span className="font-extrabold text-slate-800 leading-snug">{item.name}</span>
                                                     </div>
                                                     {isRequired && (
                                                        <span className="text-[9px] font-black text-red-500 bg-red-50 px-1 rounded border border-red-100 shrink-0">จำเป็น</span>
                                                     )}
                                                  </div>

                                                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[11px] font-bold">
                                                     <div className="text-slate-500 font-semibold">
                                                        เกณฑ์: <span className="text-slate-700 font-bold">{item.criteriaText || (item.type === 'boolean' ? (item.expectedBoolean ? 'PASS' : 'FAIL') : `${item.minValue} - ${item.maxValue} ${item.unit || ''}`)}</span>
                                                     </div>

                                                     <div className="shrink-0 font-mono">
                                                        {resp ? (
                                                           <span className={cn(
                                                              "px-2 py-0.5 rounded font-black text-xs",
                                                              resp.isNormal ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                                           )}>
                                                              {resp.type === 'boolean' ? (resp.valueBoolean ? 'PASS' : 'FAIL') : `${resp.valueNumeric} ${item.unit || ''}`}
                                                           </span>
                                                        ) : (
                                                           <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black">
                                                              ⚠️ ค้างตรวจ / ไม่ระบุ
                                                           </span>
                                                        )}
                                                     </div>
                                                  </div>
                                               </div>
                                            );
                                         })}
                                      </div>
                                   </div>
                                ))}

                                {/* Orphan historical responses */}
                                {orphanResponses.length > 0 && (
                                   <div className="space-y-3">
                                      <div className="flex items-center gap-2 mt-4">
                                         <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                         <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">ประวัติบันทึกเดิมนอกรายการ</span>
                                         <div className="h-px bg-slate-200/80 flex-1"></div>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                         {orphanResponses.map((resp, idx) => (
                                            <div 
                                               key={resp.checkItemId} 
                                               className={cn(
                                                  "p-3 rounded-xl border flex flex-col justify-between text-xs font-semibold bg-white transition-all shadow-xs",
                                                  resp.isNormal ? "border-emerald-100 bg-emerald-50/10" : "border-rose-200 bg-rose-50/30"
                                               )}
                                            >
                                               <div className="flex justify-between items-start gap-1.5 mb-2">
                                                  <div className="min-w-0">
                                                     <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">ประวัติเดิม</span>
                                                     <span className="font-extrabold text-slate-800 leading-snug">{resp.itemName || `พารามิเตอร์ข้อที่ ${idx + 1}`}</span>
                                                  </div>
                                               </div>

                                               <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[11px] font-bold">
                                                  <div className="text-slate-500 font-semibold">
                                                     เกณฑ์: <span className="text-slate-700 font-bold">ตรวจบันทึกประวัติเดิม</span>
                                                  </div>

                                                  <div className="shrink-0 font-mono">
                                                     <span className={cn(
                                                        "px-2 py-0.5 rounded font-black text-xs",
                                                        resp.isNormal ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                                     )}>
                                                        {resp.type === 'boolean' ? (resp.valueBoolean ? 'PASS' : 'FAIL') : `${resp.valueNumeric}`}
                                                     </span>
                                                  </div>
                                               </div>
                                            </div>
                                         ))}
                                      </div>
                                   </div>
                                )}
                             </div>

                             <div className="pt-3 border-t border-slate-200/60">
                                <span className="block text-xs font-bold text-slate-500 uppercase mb-1">หมายเหตุรายงาน</span>
                                <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                                  {selectedLog.notes || "ไม่มีข้อมูลหมายเหตุเพิ่มเติมหน้างาน"}
                                </p>
                             </div>
                          </div>
                       </div>
                    );
                 })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricCard({ title, engTitle, value, subtitle, icon, trend }: { title: string, engTitle: string, value: string | number, subtitle: string, icon: React.ReactNode, trend?: 'up' | 'down' | 'neutral' | 'warning' }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 p-5 sm:p-6 flex flex-col justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden group cursor-default">
      {/* Decorative colored glow on top corner */}
      <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-bl-full translate-x-6 -translate-y-6 opacity-10 group-hover:scale-110 transition-transform blur-[5px]", 
         trend === 'up' ? "bg-emerald-400" : trend === 'down' ? "bg-rose-400" : trend === 'warning' ? "bg-red-400" : "bg-indigo-400"
      )}></div>

      <div className="flex justify-between items-start mb-3 relative z-10">
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{engTitle}</span>
          <h3 className="text-slate-800 text-xs sm:text-sm font-black leading-snug mt-0.5">{title}</h3>
        </div>
        <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-indigo-50/50 transition-colors">
          {icon}
        </div>
      </div>

      <div className="mt-2 relative z-10">
        <span className={cn("text-2xl sm:text-3xl font-black font-mono tracking-tight", 
           trend === 'up' ? "text-indigo-950" : trend === 'down' ? "text-rose-950" : trend === 'warning' ? "text-red-950" : "text-slate-900"
        )}>{value}</span>
        <p className="text-[10px] text-slate-500 font-bold mt-1.5 leading-snug flex items-center gap-1">
           {trend === 'up' && <span className="text-emerald-500 font-black">▲</span>}
           {trend === 'down' && <span className="text-rose-500 font-black">▼</span>}
           {subtitle}
        </p>
      </div>
    </div>
  );
}

function FilterTab({ active, onClick, label, theme }: { active: boolean, onClick: () => void, label: string, theme?: 'all' | 'emerald' | 'amber' | 'rose' | 'indigo' }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-lg text-xs font-extrabold uppercase transition-all whitespace-nowrap outline-none cursor-pointer",
        active 
          ? theme === 'emerald' ? "bg-emerald-500 text-white shadow-sm" :
            theme === 'amber' ? "bg-amber-500 text-white shadow-sm" :
            theme === 'rose' ? "bg-rose-500 text-white shadow-sm" :
            theme === 'indigo' ? "bg-indigo-500 text-white shadow-sm" :
            "bg-slate-900 text-white shadow-sm"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
      )}
    >
      {label}
    </button>
  );
}
