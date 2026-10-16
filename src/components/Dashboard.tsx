import React, { useState, useEffect } from 'react';
import { 
  fetchEquipments, 
  fetchLogs, 
  seedDummyData,
  fetchCheckItems,
  updateCheckLog,
  fetchEquipmentLogs,
  updateEquipment,
  saveCheckLog,
  fetchOperators,
  fetchTimeWindowSettings
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
import { Equipment, CheckLog, CheckItem, Operator, TimeWindowSettings } from '../types';
import { cn } from '../lib/utils';

const getShiftLeaderForDate = (dateStr: string, shift: 'DAY' | 'NIGHT', operatorsList: Operator[]) => {
  if (!dateStr) return 'ไม่ระบุ';
  const dateParts = dateStr.split('-');
  const targetDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]), 12, 0, 0);
  const anchorDate = new Date('2026-01-01T12:00:00');
  
  const diffTime = targetDate.getTime() - anchorDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const cycleDay = ((diffDays % 12) + 12) % 12 + 1;
  
  let currentGroup = 'A';
  if (shift === 'DAY') {
    if (cycleDay >= 1 && cycleDay <= 3) currentGroup = 'A';
    else if (cycleDay >= 4 && cycleDay <= 6) currentGroup = 'C';
    else if (cycleDay >= 7 && cycleDay <= 9) currentGroup = 'B';
    else if (cycleDay >= 10 && cycleDay <= 12) currentGroup = 'D';
  } else {
    // NIGHT shift
    if (cycleDay >= 1 && cycleDay <= 3) currentGroup = 'B';
    else if (cycleDay >= 4 && cycleDay <= 6) currentGroup = 'D';
    else if (cycleDay >= 7 && cycleDay <= 9) currentGroup = 'A';
    else if (cycleDay >= 10 && cycleDay <= 12) currentGroup = 'C';
  }
  
  const leader = operatorsList.find(o => 
    o.isActive && 
    (!o.classification || o.classification === 'employee') && 
    o.role === 'shift_leader' && 
    o.shiftGroup === currentGroup
  );
  
  return leader ? leader.name : (shift === 'DAY' ? 'Sarah Connor' : 'Tony Stark');
};

const getAssistantsForDate = (dateStr: string, shift: 'DAY' | 'NIGHT', operatorsList: Operator[]) => {
  if (!dateStr) return 'ไม่มีข้อมูลผู้ช่วย';
  const dateParts = dateStr.split('-');
  const targetDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]), 12, 0, 0);
  const anchorDate = new Date('2026-01-01T12:00:00');
  
  const diffTime = targetDate.getTime() - anchorDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const cycleDay = ((diffDays % 18) + 18) % 18 + 1;
  
  let currentGroup = 'C';
  if (cycleDay >= 1 && cycleDay <= 2) {
    currentGroup = shift === 'DAY' ? 'C' : 'A';
  } else if (cycleDay >= 3 && cycleDay <= 4) {
    currentGroup = shift === 'DAY' ? 'B' : 'A';
  } else if (cycleDay >= 5 && cycleDay <= 6) {
    currentGroup = shift === 'DAY' ? 'B' : 'C';
  } else if (cycleDay >= 7 && cycleDay <= 8) {
    currentGroup = shift === 'DAY' ? 'A' : 'C';
  } else if (cycleDay >= 9 && cycleDay <= 10) {
    currentGroup = shift === 'DAY' ? 'A' : 'B';
  } else if (cycleDay >= 11 && cycleDay <= 12) {
    currentGroup = shift === 'DAY' ? 'C' : 'B';
  } else if (cycleDay >= 13 && cycleDay <= 14) {
    currentGroup = shift === 'DAY' ? 'C' : 'A';
  } else if (cycleDay >= 15 && cycleDay <= 16) {
    currentGroup = shift === 'DAY' ? 'B' : 'A';
  } else if (cycleDay >= 17 && cycleDay <= 18) {
    currentGroup = shift === 'DAY' ? 'B' : 'C';
  }
  
  const assistants = operatorsList.filter(o => 
    o.isActive && 
    o.classification === 'assistant' && 
    o.shiftGroup === currentGroup
  );
  
  return assistants.length > 0 ? assistants.map(a => a.name).join(', ') : 'ไม่มีข้อมูลผู้ช่วย';
};

const getShiftLeaderForToday = (shift: 'DAY' | 'NIGHT', operatorsList: Operator[]) => {
  const today = new Date();
  const anchorDate = new Date('2026-01-01T00:00:00');
  
  const diffDays = Math.floor((today.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
  const cycleDay = ((diffDays % 12) + 12) % 12 + 1;
  
  let currentGroup = 'A';
  if (shift === 'DAY') {
    if (cycleDay >= 1 && cycleDay <= 3) currentGroup = 'A';
    else if (cycleDay >= 4 && cycleDay <= 6) currentGroup = 'C';
    else if (cycleDay >= 7 && cycleDay <= 9) currentGroup = 'B';
    else if (cycleDay >= 10 && cycleDay <= 12) currentGroup = 'D';
  } else {
    // NIGHT shift
    if (cycleDay >= 1 && cycleDay <= 3) currentGroup = 'B';
    else if (cycleDay >= 4 && cycleDay <= 6) currentGroup = 'D';
    else if (cycleDay >= 7 && cycleDay <= 9) currentGroup = 'A';
    else if (cycleDay >= 10 && cycleDay <= 12) currentGroup = 'C';
  }
  
  const leader = operatorsList.find(o => 
    o.isActive && 
    (!o.classification || o.classification === 'employee') && 
    o.role === 'shift_leader' && 
    o.shiftGroup === currentGroup
  );
  
  return leader ? leader.name : (shift === 'DAY' ? 'Sarah Connor' : 'Tony Stark');
};

const getShiftStatusInfo = (
  shift: 'DAY' | 'NIGHT',
  logsList: CheckLog[],
  activeEqsCount: number,
  timeSettings: TimeWindowSettings,
  dashboardDateStr: string
) => {
  const shiftLogs = logsList.filter(l => l.shift === shift);
  const uniqueCheckedEqs = new Set(shiftLogs.map(l => l.equipmentId));
  const checkedUniqueCount = uniqueCheckedEqs.size;
  const isComplete = checkedUniqueCount === activeEqsCount && activeEqsCount > 0;
  
  // Calculate average check time
  const checkTimes = shiftLogs.map(l => {
    const d = new Date(l.timestamp);
    return d.getHours() + d.getMinutes() / 60;
  });
  const avgCheckHour = checkTimes.length > 0 ? checkTimes.reduce((a, b) => a + b, 0) / checkTimes.length : null;

  const parseTimeToHours = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  const startHour = parseTimeToHours(shift === 'DAY' ? timeSettings.dayStart : timeSettings.nightStart);
  const endHour = parseTimeToHours(shift === 'DAY' ? timeSettings.dayEnd : timeSettings.nightEnd);

  const isToday = dashboardDateStr === format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  let status: 'perfect' | 'late_complete' | 'in_progress' | 'overdue' = 'overdue';
  let statusText = '';
  let colorClass = '';
  let badgeColor = '';
  let plotColor = '';

  if (isComplete) {
    const avgOnTime = avgCheckHour !== null && avgCheckHour >= startHour && avgCheckHour <= endHour;
    if (avgOnTime) {
      status = 'perfect';
      statusText = 'ตรวจครบตรงเวลากำหนด (On-Time Complete)';
      colorClass = 'border-emerald-500 bg-emerald-50/20 text-emerald-800';
      badgeColor = 'bg-emerald-500 text-white';
      plotColor = '#10B981'; // solid emerald
    } else {
      status = 'late_complete';
      statusText = 'ตรวจครบแต่ล่าช้าเกินเวลา (Late Complete)';
      colorClass = 'border-amber-500 bg-amber-50/20 text-amber-800';
      badgeColor = 'bg-amber-500 text-white';
      plotColor = '#F59E0B'; // orange-yellow
    }
  } else {
    // Incomplete
    if (isToday) {
      if (currentHour <= endHour) {
        status = 'in_progress';
        statusText = 'อยู่ระหว่างตรวจเช็ก (In Progress)';
        colorClass = 'border-indigo-500 bg-indigo-50/20 text-indigo-800';
        badgeColor = 'bg-indigo-600 text-white';
        plotColor = '#6366F1'; // indigo
      } else {
        status = 'overdue';
        statusText = 'ค้างตรวจ / ล่าช้าตกหล่น (Overdue)';
        colorClass = 'border-rose-500 bg-rose-50/20 text-rose-800';
        badgeColor = 'bg-rose-600 text-white';
        plotColor = '#EF4444'; // red
      }
    } else {
      status = 'overdue';
      statusText = 'ค้างตรวจตกหล่น (Incomplete)';
      colorClass = 'border-rose-500 bg-rose-50/20 text-rose-800';
      badgeColor = 'bg-rose-600 text-white';
      plotColor = '#EF4444'; // red
    }
  }

  return {
    status,
    statusText,
    colorClass,
    badgeColor,
    plotColor,
    avgCheckHour,
    isComplete,
    startHour,
    endHour,
    checkedUniqueCount
  };
};

const getHourString = (fh: number): string => {
  const h = Math.floor(fh);
  const m = Math.round((fh - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

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
  const [activeTab, setActiveTab] = useState<'equipments' | 'shift_monitor'>('equipments');
  const [operators, setOperators] = useState<Operator[]>([]);
  const [timeSettings, setTimeSettings] = useState<TimeWindowSettings>({
    dayStart: '08:00',
    dayEnd: '10:00',
    nightStart: '20:00',
    nightEnd: '22:00'
  });
  const [trendLogs, setTrendLogs] = useState<CheckLog[]>([]);

  // 1-Month audit filters and search states
  const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | 'perfect' | 'late_complete' | 'overdue'>('all');
  const [auditSearchLeader, setAuditSearchLeader] = useState('');

  const isLogIncomplete = (log: CheckLog, eqItems: CheckItem[]) => {
    const isIdle = log.notes?.includes('ไม่ได้ใช้งาน') || log.notes?.includes('ติดทดสอบ');
    if (isIdle) return false;
    const relevantItems = log.skipOnUse 
       ? eqItems.filter(item => !item.frequency || item.frequency === 'daily' || item.frequency === 'per-shift')
       : eqItems;
    const matchedIds = new Set();
    log.responses.forEach(r => matchedIds.add(r.checkItemId));
    return Math.max(0, relevantItems.length - matchedIds.size) > 0;
  };

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
                isIncomplete = isLogIncomplete(log, eqItems);
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
                isIncomplete = isLogIncomplete(log, eqItems);
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
    let [eqData, dateLogsData, itemsData, opData] = await Promise.all([
      fetchEquipments(),
      fetchLogs(dateStr),
      fetchCheckItems(),
      fetchOperators()
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

    // Generate dates range for 30 days of trends (1 month) to support both the 10-day graph and 30-day export
    const datesRange: string[] = [];
    for (let i = 29; i >= 0; i--) {
       const d = new Date(dateStr);
       d.setDate(d.getDate() - i);
       datesRange.push(format(d, 'yyyy-MM-dd'));
    }
    const logsArrays = await Promise.all(datesRange.map(d => fetchLogs(d)));
    const allTrendLogs = logsArrays.flat();
    setTrendLogs(allTrendLogs);

    setLatestLogsByEq(latestLogsRecord);
    setEquipments(eqData);
    setCheckItems(itemsData);
    setLogs(dateLogsData);
    setOperators(opData);
    const settings = fetchTimeWindowSettings();
    setTimeSettings(settings);
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

      {/* View Segmented Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200/50 shadow-inner">
         <button 
           onClick={() => setActiveTab('equipments')}
           className={cn("px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer", 
              activeTab === 'equipments' ? "bg-white text-indigo-950 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900"
           )}
         >
           📦 สถานะเครื่องจักรรายข้อ (Equipment Tracker)
         </button>
         <button 
           onClick={() => setActiveTab('shift_monitor')}
           className={cn("px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5", 
              activeTab === 'shift_monitor' ? "bg-white text-indigo-950 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900"
           )}
         >
           📊 ศูนย์ควบคุมและประเมินประสิทธิภาพกะ (Shift Leader Monitor)
         </button>
      </div>

      {activeTab === 'equipments' ? (
         <>
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
                const eqItems = checkItems.filter(item => item.equipmentId === eq.id);
                const hasIncomplete = eqLogsToday.some(l => isLogIncomplete(l, eqItems));
                const isChecked = eqLogsToday.length > 0 && !hasIncomplete;
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
                                 : hasIncomplete
                                   ? "bg-amber-50 border-amber-200 text-amber-600 font-bold"
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
                                        ⏳ ค้างตรวจ (เซ็ตเครื่องติดทดสอบ 💤)
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
                                        ⏳ ค้างตรวจ (เซ็ตเครื่องติดทดสอบ 💤)
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
                    const skippedCount = selectedLog.skipOnUse
                       ? logItems.filter(item => item.frequency === 'on-use' && !matchedResponseIds.has(item.id)).length
                       : 0;
                    const pendingCount = Math.max(0, logItems.length - matchedResponseIds.size - skippedCount);

                    return (
                       <div className="space-y-4 w-full text-left">
                          {/* Summary Statistics Dashboard within Modal */}
                          <div className={cn(
                             "grid grid-cols-2 gap-2",
                             skippedCount > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"
                          )}>
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
                             {skippedCount > 0 && (
                                <div className="bg-sky-50 border border-sky-100 rounded-2xl p-3 text-center">
                                   <span className="block text-[10px] font-extrabold text-sky-600 uppercase tracking-wider">ละเว้น (เครื่องติดคิวรันอยู่)</span>
                                   <span className="text-lg font-black text-sky-700 font-mono">{skippedCount} <span className="text-[11px] font-bold">ข้อ</span></span>
                                </div>
                             )}
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
                                            const isSkippedOnUse = selectedLog.skipOnUse && item.frequency === 'on-use' && !resp;
                                            return (
                                               <div 
                                                  key={item.id} 
                                                  className={cn(
                                                     "p-3 rounded-xl border flex flex-col justify-between text-xs font-semibold bg-white transition-all shadow-xs",
                                                     isSkippedOnUse
                                                        ? "border-sky-100 bg-sky-50/10 hover:border-sky-200"
                                                        : !resp 
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
                                                        ) : isSkippedOnUse ? (
                                                           <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100 text-[10px] font-extrabold">
                                                              ⏭️ เครื่องรันอยู่ (ตรวจเฉพาะประจำวัน)
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
      </>
      ) : (
         /* SHIFT & KPI MONITOR PANEL */
         <div className="space-y-6">
            {/* NEW GRAPH DASHBOARD CONTAINER */}
            {(() => {
               const activeEqs = equipments.filter(e => e.status === 'active');
               const dayLeader = getShiftLeaderForDate(dashboardDate, 'DAY', operators);
               const dayAssistants = getAssistantsForDate(dashboardDate, 'DAY', operators);
               const nightLeader = getShiftLeaderForDate(dashboardDate, 'NIGHT', operators);
               const nightAssistants = getAssistantsForDate(dashboardDate, 'NIGHT', operators);

               const dayStatus = getShiftStatusInfo('DAY', logs, activeEqs.length, timeSettings, dashboardDate);
               const nightStatus = getShiftStatusInfo('NIGHT', logs, activeEqs.length, timeSettings, dashboardDate);

               const now = new Date();
               const currentHour = now.getHours() + now.getMinutes() / 60;
               const isToday = dashboardDate === format(now, 'yyyy-MM-dd');

               // Calculate ticks & positions
               const parseTimeToHours = (timeStr: string): number => {
                 if (!timeStr) return 0;
                 const [h, m] = timeStr.split(':').map(Number);
                 return h + m / 60;
               };

               const dayStartH = parseTimeToHours(timeSettings.dayStart);
               const dayEndH = parseTimeToHours(timeSettings.dayEnd);
               const nightStartH = parseTimeToHours(timeSettings.nightStart);
               const nightEndH = parseTimeToHours(timeSettings.nightEnd);

               // Build deficiencies list
               const deficiencies: any[] = [];
               activeEqs.forEach(eq => {
                 const dayLog = logs.find(l => l.equipmentId === eq.id && l.shift === 'DAY');
                 const nightLog = logs.find(l => l.equipmentId === eq.id && l.shift === 'NIGHT');

                 if (!dayLog) {
                   const isOverdue = !isToday || currentHour > dayEndH;
                   if (isOverdue) {
                     deficiencies.push({
                       eq,
                       shift: 'DAY',
                       type: 'unchecked',
                       label: '❌ ค้างตรวจกะเช้า (Unchecked)',
                       time: 'ไม่มีบันทึก',
                       leader: dayLeader,
                       assistants: dayAssistants,
                       color: 'text-red-700 bg-red-50/70',
                       borderColor: 'border-red-200'
                     });
                   }
                 } else {
                   const eqItems = checkItems.filter(item => item.equipmentId === eq.id);
                   const isIncomplete = isLogIncomplete(dayLog, eqItems);
                   const logTime = new Date(dayLog.timestamp);
                   const logHour = logTime.getHours() + logTime.getMinutes() / 60;
                   const isLate = logHour < dayStartH || logHour > dayEndH;
                   const isFailed = dayLog.status === 'failed' || dayLog.status === 'needs_attention';

                   if (isIncomplete) {
                     deficiencies.push({
                       eq,
                       shift: 'DAY',
                       type: 'incomplete',
                       label: '⚠️ ตรวจกะเช้าไม่ครบหัวข้อ',
                       time: format(dayLog.timestamp, 'HH:mm น.'),
                       leader: dayLeader,
                       assistants: dayAssistants,
                       color: 'text-amber-750 bg-amber-50/70',
                       borderColor: 'border-amber-200'
                     });
                   } else if (isLate) {
                     deficiencies.push({
                       eq,
                       shift: 'DAY',
                       type: 'late',
                       label: '⏰ ตรวจกะเช้าล่าช้าเกินช่วงเวลา',
                       time: format(dayLog.timestamp, 'HH:mm น.'),
                       leader: dayLeader,
                       assistants: dayAssistants,
                       color: 'text-amber-700 bg-amber-50/70 shadow-xs',
                       borderColor: 'border-amber-200'
                     });
                   } else if (isFailed) {
                     deficiencies.push({
                       eq,
                       shift: 'DAY',
                       type: 'failed',
                       label: '🔴 อุปกรณ์พบพารามิเตอร์ผิดปกติ (Failed Spec)',
                       time: format(dayLog.timestamp, 'HH:mm น.'),
                       leader: dayLeader,
                       assistants: dayAssistants,
                       color: 'text-rose-700 bg-rose-50/70',
                       borderColor: 'border-rose-200'
                     });
                   }
                 }

                 if (!nightLog) {
                   const isOverdue = !isToday || currentHour > nightEndH;
                   if (isOverdue) {
                     deficiencies.push({
                       eq,
                       shift: 'NIGHT',
                       type: 'unchecked',
                       label: '❌ ค้างตรวจกะดึก (Unchecked)',
                       time: 'ไม่มีบันทึก',
                       leader: nightLeader,
                       assistants: nightAssistants,
                       color: 'text-red-700 bg-red-50/70',
                       borderColor: 'border-red-200'
                     });
                   }
                 } else {
                   const eqItems = checkItems.filter(item => item.equipmentId === eq.id);
                   const isIncomplete = isLogIncomplete(nightLog, eqItems);
                   const logTime = new Date(nightLog.timestamp);
                   const logHour = logTime.getHours() + logTime.getMinutes() / 60;
                   const isLate = logHour < nightStartH || logHour > nightEndH;
                   const isFailed = nightLog.status === 'failed' || nightLog.status === 'needs_attention';

                   if (isIncomplete) {
                     deficiencies.push({
                       eq,
                       shift: 'NIGHT',
                       type: 'incomplete',
                       label: '⚠️ ตรวจกะดึกไม่ครบหัวข้อ',
                       time: format(nightLog.timestamp, 'HH:mm น.'),
                       leader: nightLeader,
                       assistants: nightAssistants,
                       color: 'text-amber-750 bg-amber-50/70',
                       borderColor: 'border-amber-200'
                     });
                   } else if (isLate) {
                     deficiencies.push({
                       eq,
                       shift: 'NIGHT',
                       type: 'late',
                       label: '⏰ ตรวจกะดึกล่าช้าเกินช่วงเวลา',
                       time: format(nightLog.timestamp, 'HH:mm น.'),
                       leader: nightLeader,
                       assistants: nightAssistants,
                       color: 'text-amber-700 bg-amber-50/70',
                       borderColor: 'border-amber-200'
                     });
                   } else if (isFailed) {
                     deficiencies.push({
                       eq,
                       shift: 'NIGHT',
                       type: 'failed',
                       label: '🔴 อุปกรณ์พบพารามิเตอร์ผิดปกติ (Failed Spec)',
                       time: format(nightLog.timestamp, 'HH:mm น.'),
                       leader: nightLeader,
                       assistants: nightAssistants,
                       color: 'text-rose-700 bg-rose-50/70',
                       borderColor: 'border-rose-200'
                     });
                   }
                 }
               });

               // Generate 10-day dates range ending on dashboardDate
               const datesRange: string[] = [];
               for (let i = 9; i >= 0; i--) {
                  const d = new Date(dashboardDate);
                  d.setDate(d.getDate() - i);
                  datesRange.push(format(d, 'yyyy-MM-dd'));
               }

               // helper to format hours into HH:mm
               const getHourString = (fh: number): string => {
                 const h = Math.floor(fh);
                 const m = Math.round((fh - h) * 60);
                 return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
               };

               // Custom Y coordinate mappers for parallel, non-overlapping shift tracks
               // Day Shift Track: 8.0 น. to 12.0 น. maps to Y range [40, 120] (top of Day track to bottom of Day track)
               const getDayY = (hour: number) => {
                 const clampedHour = Math.max(8.0, Math.min(12.0, hour));
                 return 40 + ((clampedHour - 8.0) / (12.0 - 8.0)) * 80;
               };

               // Night Shift Track: 20.0 น. to 24.0 น. maps to Y range [160, 240] (top of Night track to bottom of Night track)
               const getNightY = (hour: number) => {
                 let adjustedHour = hour;
                 // If the check hour is in the early morning (e.g. 0:00 to 8:00), treat it as 24 + hour
                 if (hour >= 0 && hour < 8) {
                   adjustedHour = hour + 24;
                 }
                 const clampedHour = Math.max(20.0, Math.min(24.0, adjustedHour));
                 return 160 + ((clampedHour - 20.0) / (24.0 - 20.0)) * 80;
               };

               const trendPoints = datesRange.map((dateStr, index) => {
                  const dateLogs = trendLogs.filter(l => l.dateKey === dateStr);
                  const dayLogsOnDate = dateLogs.filter(l => l.shift === 'DAY');
                  const nightLogsOnDate = dateLogs.filter(l => l.shift === 'NIGHT');

                  // Day shift average check hour
                  const dayCheckHours = dayLogsOnDate.map(l => {
                    const d = new Date(l.timestamp);
                    return d.getHours() + d.getMinutes() / 60;
                  });
                  const dayAvgHour = dayCheckHours.length > 0 ? dayCheckHours.reduce((a, b) => a + b, 0) / dayCheckHours.length : null;
                  const dayStatusInfo = getShiftStatusInfo('DAY', dateLogs, activeEqs.length, timeSettings, dateStr);

                  // Night shift average check hour
                  const nightCheckHours = nightLogsOnDate.map(l => {
                    const d = new Date(l.timestamp);
                    return d.getHours() + d.getMinutes() / 60;
                  });
                  const nightAvgHour = nightCheckHours.length > 0 ? nightCheckHours.reduce((a, b) => a + b, 0) / nightCheckHours.length : null;
                  const nightStatusInfo = getShiftStatusInfo('NIGHT', dateLogs, activeEqs.length, timeSettings, dateStr);

                  // X-axis mapping: padding-left of 70px, width of 660px spanning index 0 to 9
                  const x = 70 + (index / 9) * 660;

                  return {
                     dateStr,
                     x,
                     dayAvgHour,
                     dayY: dayAvgHour !== null ? getDayY(dayAvgHour) : null,
                     dayStatusInfo,
                     nightAvgHour,
                     nightY: nightAvgHour !== null ? getNightY(nightAvgHour) : null,
                     nightStatusInfo
                  };
               });

               // Generate vertical ticks for each of the 10 dates
               const dateTicks = trendPoints.map((p, idx) => (
                  <g key={`dtick-${idx}`}>
                     <line x1={p.x} y1={40} x2={p.x} y2={290} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="2 3" />
                  </g>
               ));

               // Custom Y-axis ticks with right alignment for double tracks
               const hourTicks = [
                 { y: getDayY(8.0), label: '08:00 น.', isBold: true, color: '#F59E0B' },
                 { y: getDayY(10.0), label: '10:00 น.', isBold: false, color: '#94A3B8' },
                 { y: getDayY(12.0), label: '12:00 น. (เที่ยง)', isBold: true, color: '#EF4444' }, // Bottom boundary for day shift

                 { y: getNightY(20.0), label: '20:00 น.', isBold: true, color: '#6366F1' },
                 { y: getNightY(22.0), label: '22:00 น.', isBold: false, color: '#94A3B8' },
                 { y: getNightY(24.0), label: '24:00 น. (เที่ยงคืน)', isBold: true, color: '#4F46E5' }
               ].map((tick, idx) => (
                 <g key={`htick-${idx}`}>
                    <line 
                      x1={70} 
                      y1={tick.y} 
                      x2={730} 
                      y2={tick.y} 
                      stroke={tick.isBold ? '#E2E8F0' : '#F1F5F9'} 
                      strokeWidth={tick.isBold ? 1.5 : 1} 
                    />
                    <text 
                      x={62} 
                      y={tick.y + 3.5} 
                      textAnchor="end"
                      className={cn(
                        "text-[10px] font-sans font-bold fill-slate-500",
                        tick.isBold && "font-black text-slate-700"
                      )}
                    >
                       {tick.label}
                    </text>
                 </g>
               ));

               // Draw trend paths
               const dayPointsPath = trendPoints
                 .filter(p => p.dayY !== null)
                 .map(p => `${p.x},${p.dayY}`)
                 .join(' ');

               const nightPointsPath = trendPoints
                 .filter(p => p.nightY !== null)
                 .map(p => `${p.x},${p.nightY}`)
                 .join(' ');

               const dayYStart = getDayY(dayStartH);
               const dayYEnd = getDayY(dayEndH);
               const nightYStart = getNightY(nightStartH);
               const nightYEnd = getNightY(nightEndH);

               return (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm overflow-hidden relative">
                     <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                     
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                           <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-widest">
                              Historical Trend Chart
                           </span>
                           <h3 className="text-xl font-black text-slate-800 font-display mt-1.5">
                              📈 กราฟควบคุมแนวโน้มการตรวจสอบประจำวัน (Daily Trend Control Chart)
                           </h3>
                           <p className="text-xs text-slate-400 font-medium">
                              มอนิเตอร์เวลาสแกนตรวจเช็กค่าเฉลี่ยรายวัน ย้อนหลัง 10 วัน เทียบกับช่วงเวลาควบคุมสำหรับกะเช้า (🌞) และกะดึก (🌙)
                           </p>
                        </div>
                        
                        {/* Summary Legend */}
                        <div className="flex flex-wrap gap-3.5 text-[11px] font-extrabold">
                           <div className="flex items-center gap-1.5">
                              <span className="w-4 h-2 bg-amber-500/20 border-t border-b border-amber-400 block"></span>
                              <span className="text-slate-500">ช่วงกะเช้า (DAY Window)</span>
                           </div>
                           <div className="flex items-center gap-1.5">
                              <span className="w-4 h-2 bg-indigo-500/20 border-t border-b border-indigo-400 block"></span>
                              <span className="text-slate-500">ช่วงกะดึก (NIGHT Window)</span>
                           </div>
                           <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
                              <span className="text-slate-600">ผ่านเกณฑ์</span>
                           </div>
                           <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block"></span>
                              <span className="text-slate-600">เลยเวลา</span>
                           </div>
                           <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 block"></span>
                              <span className="text-slate-600">ค้างตรวจ</span>
                           </div>
                        </div>
                     </div>

                      {/* SVG GRAPH CONTAINER */}
                      <div className="w-full overflow-x-auto custom-scrollbar border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                         <div className="min-w-[780px]">
                            <svg viewBox="0 0 780 325" className="w-full h-auto overflow-visible select-none">
                               {/* Y-Axis Hour Gridlines */}
                               {hourTicks}

                               {/* Vertical Date Gridlines */}
                               {dateTicks}

                               {/* Highlighted Control Windows (Horizontal bands) */}
                               {/* Day Shift Window: from dayYStart down to dayYEnd */}
                               <rect x={70} y={dayYStart} width={660} height={dayYEnd - dayYStart} fill="#F59E0B" fillOpacity={0.06} stroke="#F59E0B" strokeWidth={1} strokeDasharray="2 3" />
                               <text x={75} y={dayYStart - 4} className="text-[9px] font-black fill-amber-600 tracking-wider">
                                  ช่วงเวลาควบคุมกะเช้า: {timeSettings.dayStart} - {timeSettings.dayEnd} น.
                               </text>

                               {/* Night Shift Window: from nightYStart down to nightYEnd */}
                               <rect x={70} y={nightYStart} width={660} height={nightYEnd - nightYStart} fill="#6366F1" fillOpacity={0.06} stroke="#6366F1" strokeWidth={1} strokeDasharray="2 3" />
                               <text x={75} y={nightYStart - 4} className="text-[9px] font-black fill-indigo-600 tracking-wider">
                                  ช่วงเวลาควบคุมกะดึก: {timeSettings.nightStart} - {timeSettings.nightEnd} น.
                               </text>

                               {/* Plot Trend Polylines */}
                               {dayPointsPath && (
                                  <polyline points={dayPointsPath} fill="none" stroke="#F59E0B" strokeWidth={2.5} opacity={0.8} />
                                )}
                               {nightPointsPath && (
                                  <polyline points={nightPointsPath} fill="none" stroke="#6366F1" strokeWidth={2.5} opacity={0.8} />
                                )}

                               {/* Day Shift Plot Points (Dots) */}
                               {trendPoints.map((p, idx) => {
                                  const isOut = p.dayStatusInfo.status === 'late_complete' || p.dayStatusInfo.status === 'overdue';
                                  const isPerfect = p.dayStatusInfo.status === 'perfect';
                                  const leaderName = getShiftLeaderForDate(p.dateStr, 'DAY', operators);

                                  if (p.dayY === null) {
                                     // Plot a red cross on the horizontal line of Day Shift center if overdue/incomplete
                                     const fallbackY = getDayY((dayStartH + dayEndH) / 2);
                                     return (
                                        <g key={`day-empty-${idx}`}>
                                           <title>{`กะเช้าวันที่ ${p.dateStr}\nสถานะกะ: ยังไม่มีการเข้าตรวจ (ค้างสแกนตรวจ)`}</title>
                                           <circle cx={p.x} cy={fallbackY} r={5} fill="none" stroke="#EF4444" strokeWidth={1} strokeDasharray="1.5 1.5" />
                                           <circle cx={p.x} cy={fallbackY} r={3} fill="#EF4444" stroke="#FFFFFF" strokeWidth={1} className="drop-shadow-sm" />
                                           <line x1={p.x - 1} y1={fallbackY - 1} x2={p.x + 1} y2={fallbackY + 1} stroke="#FFFFFF" strokeWidth={0.75} strokeLinecap="round" />
                                           <line x1={p.x + 1} y1={fallbackY - 1} x2={p.x - 1} y2={fallbackY + 1} stroke="#FFFFFF" strokeWidth={0.75} strokeLinecap="round" />

                                           {/* Direct Leader name displayed above the red overdue cross */}
                                           <rect x={p.x - 24} y={fallbackY - 21} width={48} height={11} rx={3} fill="#FEF2F2" stroke="#FCA5A5" strokeWidth={0.75} />
                                           <text x={p.x} y={fallbackY - 13} textAnchor="middle" className="text-[7px] font-sans font-black fill-red-700">
                                              ผก. {leaderName.split(' ')[0]}
                                           </text>
                                        </g>
                                     );
                                  }
                                  return (
                                     <g key={`day-point-${idx}`}>
                                        <title>{`กะเช้าวันที่ ${p.dateStr}\nเวลาตรวจจริงเฉลี่ย: ${getHourString(p.dayAvgHour!)} น. ${p.dayAvgHour! > 12 ? '(เกินเที่ยง - ติดขอบล่าง)' : ''}\nสถานะกะ: ${p.dayStatusInfo.statusText}`}</title>
                                        
                                        {isPerfect ? (
                                           // 🟢 Perfect: Clean emerald green circle with check icon
                                           <>
                                              <circle cx={p.x} cy={p.dayY} r={4.5} fill="none" stroke="#10B981" strokeWidth={1} opacity={0.2} />
                                              <circle cx={p.x} cy={p.dayY} r={2.5} fill="#10B981" stroke="#FFFFFF" strokeWidth={1} className="drop-shadow-xs" />
                                           </>
                                        ) : p.dayStatusInfo.status === 'late_complete' ? (
                                           // 🟠 Warning (Late / Out of window): Large contrasting marker with double border
                                           <>
                                              <circle cx={p.x} cy={p.dayY} r={5} fill="none" stroke="#F59E0B" strokeWidth={1} opacity={0.3} className="animate-pulse" />
                                              <circle cx={p.x} cy={p.dayY} r={3} fill="#F59E0B" stroke="#FFFFFF" strokeWidth={1} className="drop-shadow-xs cursor-help" />
                                              <text x={p.x} y={p.dayY + 1} textAnchor="middle" className="text-[6.5px] font-sans font-black fill-white">!</text>
                                           </>
                                        ) : (
                                           // 🔴 Incomplete/Overdue: Red dot with cross '✗'
                                           <>
                                              <circle cx={p.x} cy={p.dayY} r={5} fill="none" stroke="#EF4444" strokeWidth={1} opacity={0.3} className="animate-pulse" />
                                              <circle cx={p.x} cy={p.dayY} r={3} fill="#EF4444" stroke="#FFFFFF" strokeWidth={1} className="drop-shadow-xs cursor-help" />
                                              <line x1={p.x - 1} y1={p.dayY - 1} x2={p.x + 1} y2={p.dayY + 1} stroke="#FFFFFF" strokeWidth={0.75} strokeLinecap="round" />
                                              <line x1={p.x + 1} y1={p.dayY - 1} x2={p.x - 1} y2={p.dayY + 1} stroke="#FFFFFF" strokeWidth={0.75} strokeLinecap="round" />
                                           </>
                                        )}

                                        <text x={p.x} y={p.dayY - 7} textAnchor="middle" className="text-[7px] font-mono font-black fill-slate-500">
                                           {getHourString(p.dayAvgHour!)}
                                        </text>

                                        {/* Direct Leader Name for late/overdue points */}
                                        {isOut && (
                                           <g>
                                              <rect x={p.x - 24} y={p.dayY + 8} width={48} height={11} rx={3} fill="#FFFBEB" stroke="#FDE68A" strokeWidth={0.75} />
                                              <text x={p.x} y={p.dayY + 16} textAnchor="middle" className="text-[7px] font-sans font-black fill-amber-800">
                                                 ผก. {leaderName.split(' ')[0]}
                                              </text>
                                           </g>
                                        )}
                                     </g>
                                  );
                                })}

                               {/* Night Shift Plot Points (Dots) */}
                               {trendPoints.map((p, idx) => {
                                  const isOut = p.nightStatusInfo.status === 'late_complete' || p.nightStatusInfo.status === 'overdue';
                                  const isPerfect = p.nightStatusInfo.status === 'perfect';
                                  const leaderName = getShiftLeaderForDate(p.dateStr, 'NIGHT', operators);

                                  if (p.nightY === null) {
                                     // Plot a red cross on the horizontal line of Night Shift center if overdue/incomplete
                                     const fallbackY = getNightY((nightStartH + nightEndH) / 2);
                                     return (
                                        <g key={`night-empty-${idx}`}>
                                           <title>{`กะดึกวันที่ ${p.dateStr}\nสถานะกะ: ยังไม่มีการเข้าตรวจ (ค้างสแกนตรวจ)`}</title>
                                           <circle cx={p.x} cy={fallbackY} r={5} fill="none" stroke="#EF4444" strokeWidth={1} strokeDasharray="1.5 1.5" />
                                           <circle cx={p.x} cy={fallbackY} r={3} fill="#EF4444" stroke="#FFFFFF" strokeWidth={1} className="drop-shadow-sm" />
                                           <line x1={p.x - 1} y1={fallbackY - 1} x2={p.x + 1} y2={fallbackY + 1} stroke="#FFFFFF" strokeWidth={0.75} strokeLinecap="round" />
                                           <line x1={p.x + 1} y1={fallbackY - 1} x2={p.x - 1} y2={fallbackY + 1} stroke="#FFFFFF" strokeWidth={0.75} strokeLinecap="round" />

                                           {/* Direct Leader name displayed below the red overdue cross */}
                                           <rect x={p.x - 24} y={fallbackY + 10} width={48} height={11} rx={3} fill="#FEF2F2" stroke="#FCA5A5" strokeWidth={0.75} />
                                           <text x={p.x} y={fallbackY + 18} textAnchor="middle" className="text-[7px] font-sans font-black fill-red-700">
                                              ผก. {leaderName.split(' ')[0]}
                                           </text>
                                        </g>
                                     );
                                  }
                                  return (
                                     <g key={`night-point-${idx}`}>
                                        <title>{`กะดึกวันที่ ${p.dateStr}\nเวลาตรวจจริงเฉลี่ย: ${getHourString(p.nightAvgHour!)} น. ${(p.nightAvgHour! < 20 && p.nightAvgHour! >= 8) ? '(เกินเที่ยงคืน)' : ''}\nสถานะกะ: ${p.nightStatusInfo.statusText}`}</title>
                                        
                                        {isPerfect ? (
                                           // 🟢 Perfect: Clean emerald green circle with check icon
                                           <>
                                              <circle cx={p.x} cy={p.nightY} r={4.5} fill="none" stroke="#10B981" strokeWidth={1} opacity={0.2} />
                                              <circle cx={p.x} cy={p.nightY} r={2.5} fill="#10B981" stroke="#FFFFFF" strokeWidth={1} className="drop-shadow-xs" />
                                           </>
                                        ) : p.nightStatusInfo.status === 'late_complete' ? (
                                           // 🟠 Warning (Late Complete): Orange dot with '!'
                                           <>
                                              <circle cx={p.x} cy={p.nightY} r={5} fill="none" stroke="#F59E0B" strokeWidth={1} opacity={0.3} className="animate-pulse" />
                                              <circle cx={p.x} cy={p.nightY} r={3} fill="#F59E0B" stroke="#FFFFFF" strokeWidth={1} className="drop-shadow-xs cursor-help" />
                                              <text x={p.x} y={p.nightY + 1} textAnchor="middle" className="text-[6.5px] font-sans font-black fill-white">!</text>
                                           </>
                                        ) : (
                                           // 🔴 Incomplete/Overdue: Red dot with cross '✗'
                                           <>
                                              <circle cx={p.x} cy={p.nightY} r={5} fill="none" stroke="#EF4444" strokeWidth={1} opacity={0.3} className="animate-pulse" />
                                              <circle cx={p.x} cy={p.nightY} r={3} fill="#EF4444" stroke="#FFFFFF" strokeWidth={1} className="drop-shadow-xs cursor-help" />
                                              <line x1={p.x - 1} y1={p.nightY - 1} x2={p.x + 1} y2={p.nightY + 1} stroke="#FFFFFF" strokeWidth={0.75} strokeLinecap="round" />
                                              <line x1={p.x + 1} y1={p.nightY - 1} x2={p.x - 1} y2={p.nightY + 1} stroke="#FFFFFF" strokeWidth={0.75} strokeLinecap="round" />
                                           </>
                                        )}

                                        <text x={p.x} y={p.nightY - 7} textAnchor="middle" className="text-[7px] font-mono font-black fill-slate-500">
                                           {getHourString(p.nightAvgHour!)}
                                        </text>

                                        {/* Direct Leader Name for late/overdue points */}
                                        {isOut && (
                                           <g>
                                              <rect x={p.x - 24} y={p.nightY + 8} width={48} height={11} rx={3} fill="#FFFBEB" stroke="#FDE68A" strokeWidth={0.75} />
                                              <text x={p.x} y={p.nightY + 16} textAnchor="middle" className="text-[7px] font-sans font-black fill-amber-800">
                                                 ผก. {leaderName.split(' ')[0]}
                                              </text>
                                           </g>
                                        )}
                                     </g>
                                  );
                                })}

                               {/* X-Axis Base Line - shifted down to 290 */}
                               <line x1={70} y1={290} x2={730} y2={290} stroke="#94A3B8" strokeWidth={2} />

                               {/* X-Axis Date Labels - shifted down to 310 */}
                               {trendPoints.map((p, idx) => (
                                  <g key={`label-${idx}`}>
                                     <line x1={p.x} y1={290} x2={p.x} y2={296} stroke="#94A3B8" strokeWidth={2} />
                                     <text x={p.x} y={310} textAnchor="middle" className="text-[10px] font-sans font-black fill-slate-700">
                                        {(() => {
                                           const parts = p.dateStr.split('-');
                                           const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                                           const mIdx = Number(parts[1]) - 1;
                                           return `${parts[2]} ${months[mIdx]}`;
                                        })()}
                                     </text>
                                  </g>
                               ))}
                            </svg>
                         </div>
                      </div>

                      {/* LEGEND & GUIDELINES EXPLANATION BLOCK */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mt-4 space-y-3 relative z-10">
                         <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                            <Info className="w-3.5 h-3.5 text-indigo-500" />
                            คำอธิบายความหมายและสีของจุดตรวจควบคุม (Chart Legend & Symbol Guide)
                         </h4>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-start gap-2.5">
                               <div className="w-6 h-6 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center font-black text-emerald-700 shrink-0 text-xs">
                                  ✓
                               </div>
                               <div>
                                  <p className="text-xs font-black text-slate-800 leading-snug">🟢 ตรวจครบตรงเวลา (On-Time Complete)</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-medium">ตรวจเช็กอุปกรณ์สอดคล้องครบถ้วน 100% ภายในหน้าต่างเวลาควบคุมกะการทำงาน (เช้า {timeSettings.dayStart} - {timeSettings.dayEnd} น. หรือ ดึก {timeSettings.nightStart} - {timeSettings.nightEnd} น.)</p>
                               </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                               <div className="w-6 h-6 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center font-black text-amber-700 shrink-0 text-xs">
                                  !
                               </div>
                               <div>
                                  <p className="text-xs font-black text-slate-800 leading-snug">🟡 ตรวจครบแต่ช้า (Late Complete)</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-medium">ตรวจอุปกรณ์ครบทุกเครื่อง แต่ลงเวลาสแกนตรวจเลยเวลาควบคุมกะการทำงาน ถือว่าปฏิบัติงานเสร็จสิ้นแต่ล่าช้าสะสม</p>
                               </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                               <div className="w-6 h-6 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center font-black text-red-700 shrink-0 text-xs">
                                  ✗
                               </div>
                               <div>
                                  <p className="text-xs font-black text-slate-800 leading-snug">🔴 ค้างตรวจตกหล่น (Overdue / Missed)</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug font-medium">ค้างตรวจสแกนโดยไม่มีการเข้าบันทึกสถานะ หรือไม่มีบันทึกสแตนบายจนกระทั่งหมดกะ ถือเป็นข้อบกพร่องสะสมที่ต้องชี้แจง</p>
                               </div>
                            </div>
                         </div>
                      </div>

                     {/* DELINQUENCY & DIRECT ACCOUNTABILITY REPORT PANEL */}
                     <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                           <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                           🚨 ตารางติดตามข้อบกพร่องกะการทำงานและผู้รับผิดชอบหลัก (Roster Penalties & Active Accountability Board)
                        </h4>

                        {deficiencies.length === 0 ? (
                           <div className="p-6 text-center text-emerald-700 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex flex-col items-center justify-center">
                              <p className="font-black text-sm">🟢 ดีเยี่ยม! ไม่พบพฤติกรรมล่าช้าหรือการค้างสแกนตรวจเครื่องจักรในวันนี้</p>
                              <p className="text-[11px] font-bold text-emerald-600 mt-1">หัวหน้ากะทำงานทุกคนบริหารเวลาควบคุมพารามิเตอร์ได้อย่างยอดเยี่ยมและเคร่งครัด</p>
                           </div>
                        ) : (
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {deficiencies.map((def, idx) => (
                                 <div key={idx} className={cn("p-4 border rounded-2xl flex flex-col justify-between hover:shadow-md transition-all", def.color, def.borderColor)}>
                                    <div>
                                       <div className="flex justify-between items-start gap-1.5">
                                          <div>
                                             <h5 className="font-extrabold text-sm text-slate-900 leading-snug">{def.eq.name}</h5>
                                             <p className="text-[10px] text-slate-500 font-mono font-bold mt-0.5">{def.eq.code} · {def.eq.location}</p>
                                          </div>
                                          <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase border border-current shrink-0">
                                             {def.shift === 'DAY' ? '🌞 กะเช้า' : '🌙 กะดึก'}
                                          </span>
                                       </div>

                                       <div className="mt-3.5 space-y-1.5 border-t border-slate-200/50 pt-3">
                                          <p className="text-[11px] font-black flex items-center justify-between text-slate-800">
                                             <span>สถานะบกพร่อง:</span>
                                             <span className="font-bold underline">{def.label}</span>
                                          </p>
                                          <p className="text-[11px] font-semibold flex items-center justify-between text-slate-500">
                                             <span>เวลาบันทึกจริง:</span>
                                             <span className="font-mono font-bold text-slate-800">{def.time}</span>
                                          </p>
                                       </div>
                                    </div>

                                    {/* Direct Shift Leader Name displayed directly, holding them accountable! */}
                                    <div className="mt-4 pt-3 border-t border-slate-200/60 bg-white/50 p-2.5 rounded-xl border border-dashed border-slate-200">
                                       <p className="text-[9px] font-extrabold text-rose-800 uppercase tracking-widest leading-none mb-1">
                                          หัวหน้ากะผู้รับผิดชอบ (Hold Accountable)
                                       </p>
                                       <p className="text-xs font-black text-slate-900">{def.leader.split(' ')[0]}</p>
                                       <p className="text-[9px] text-slate-500 font-bold mt-1">
                                          <span className="font-black text-slate-400">ผู้ช่วยสนับสนุน:</span> {def.assistants.split(',').map(name => name.trim().split(' ')[0]).join(', ')}
                                       </p>
                                       <div className="mt-2 text-[9px] text-rose-700 bg-rose-50 border border-rose-100 p-1 rounded font-black text-center uppercase">
                                          ⚠️ ปฏิบัติงานล่าช้า/บกพร่อง - ต้องชี้แจงผู้จัดการ
                                       </div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>
               );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {/* 1. DAY SHIFT KPI STATUS CARD */}
               {(() => {
                  const activeEqs = equipments.filter(e => e.status === 'active');
                  const dayLeader = getShiftLeaderForDate(dashboardDate, 'DAY', operators);
                  const dayAssistants = getAssistantsForDate(dashboardDate, 'DAY', operators);
                  const dayLogs = logs.filter(l => l.shift === 'DAY');
                  const dayChecked = activeEqs.filter(eq => dayLogs.some(l => l.equipmentId === eq.id)).length;
                  const dayPending = activeEqs.length - dayChecked;
                  const dayLate = dayLogs.filter(l => l.isLate).length;
                  
                  const dayIncomplete = dayLogs.filter(l => {
                     const isIdle = l.notes?.includes('ไม่ได้ใช้งาน') || l.notes?.includes('ติดทดสอบ');
                     if (isIdle) return false;
                     const eqItems = checkItems.filter(item => item.equipmentId === l.equipmentId);
                     const matchedIds = new Set();
                     l.responses.forEach(r => matchedIds.add(r.checkItemId));
                     const relevantItems = l.skipOnUse 
                        ? eqItems.filter(item => !item.frequency || item.frequency === 'daily' || item.frequency === 'per-shift')
                        : eqItems;
                     return Math.max(0, relevantItems.length - matchedIds.size) > 0;
                  }).length;

                  const isFullyChecked = dayChecked === activeEqs.length;
                  const dayKpiStatus = !isFullyChecked 
                     ? 'incomplete' 
                     : (dayLate > 0 || dayIncomplete > 0) ? 'late' : 'perfect';

                  return (
                     <div className={cn(
                        "rounded-3xl p-6 border transition-all relative overflow-hidden shadow-sm bg-white",
                        dayKpiStatus === 'perfect' ? "border-emerald-200" :
                        dayKpiStatus === 'late' ? "border-amber-200" : "border-red-200"
                     )}>
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Shift Performance Center</span>
                              <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5 mt-0.5">
                                 🌞 กะกลางวัน (Day Shift)
                              </h3>
                              <p className="text-[10px] text-slate-400 font-bold font-mono">08:00 - 20:00 น.</p>
                           </div>
                           <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase shadow-xs",
                              dayKpiStatus === 'perfect' ? "bg-emerald-500 text-white" :
                              dayKpiStatus === 'late' ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                           )}>
                              {dayKpiStatus === 'perfect' ? '✓ ดีเยี่ยม (Perfect KPI)' :
                               dayKpiStatus === 'late' ? '⚠️ มีการล่าช้า / ตรวจไม่ครบข้อ' : '❌ ค้างตรวจกะทำงาน'}
                           </span>
                        </div>

                        {/* Shift Leader Info with accountability layout */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                           <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/50 flex items-center gap-2.5">
                              <div className="w-8 h-8 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center font-extrabold text-indigo-600 text-sm shrink-0">
                                 ⭐
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Shift Leader ประจำกะ</p>
                                 <p className="text-xs font-black text-slate-800 mt-1 truncate">{dayLeader.split(' ')[0]}</p>
                              </div>
                           </div>
                           <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/50 flex items-center gap-2.5">
                              <div className="w-8 h-8 bg-sky-50 border border-sky-100 rounded-lg flex items-center justify-center font-extrabold text-sky-600 text-sm shrink-0">
                                 👥
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">ผู้ช่วยสนับสนุน (4-2)</p>
                                 <p className="text-xs font-black text-slate-800 mt-1 truncate" title={dayAssistants}>{dayAssistants.split(',').map(name => name.trim().split(' ')[0]).join(', ')}</p>
                              </div>
                           </div>
                        </div>

                        {/* Stats Dashboard Grid */}
                        <div className="grid grid-cols-4 gap-2">
                           <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
                              <span className="block text-[9px] font-bold text-slate-400">ตรวจแล้ว</span>
                              <span className="text-base font-black text-slate-800 font-mono">{dayChecked} <span className="text-[9px] font-normal">เครื่อง</span></span>
                           </div>
                           <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
                              <span className="block text-[9px] font-bold text-slate-400">ค้างตรวจ</span>
                              <span className={cn("text-base font-black font-mono", dayPending > 0 ? "text-rose-600" : "text-slate-500")}>{dayPending} <span className="text-[9px] font-normal">เครื่อง</span></span>
                           </div>
                           <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
                              <span className="block text-[9px] font-bold text-slate-400">ตรวจล่าช้า</span>
                              <span className={cn("text-base font-black font-mono", dayLate > 0 ? "text-amber-600" : "text-slate-500")}>{dayLate} <span className="text-[9px] font-normal">ข้อ</span></span>
                           </div>
                           <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
                              <span className="block text-[9px] font-bold text-slate-400">ค้างบางข้อ</span>
                              <span className={cn("text-base font-black font-mono", dayIncomplete > 0 ? "text-amber-600" : "text-slate-500")}>{dayIncomplete} <span className="text-[9px] font-normal">เครื่อง</span></span>
                           </div>
                        </div>
                     </div>
                  );
               })()}

               {/* 2. NIGHT SHIFT KPI STATUS CARD */}
               {(() => {
                  const activeEqs = equipments.filter(e => e.status === 'active');
                  const nightLeader = getShiftLeaderForDate(dashboardDate, 'NIGHT', operators);
                  const nightAssistants = getAssistantsForDate(dashboardDate, 'NIGHT', operators);
                  const nightLogs = logs.filter(l => l.shift === 'NIGHT');
                  const nightChecked = activeEqs.filter(eq => nightLogs.some(l => l.equipmentId === eq.id)).length;
                  const nightPending = activeEqs.length - nightChecked;
                  const nightLate = nightLogs.filter(l => l.isLate).length;
                  
                  const nightIncomplete = nightLogs.filter(l => {
                     const isIdle = l.notes?.includes('ไม่ได้ใช้งาน') || l.notes?.includes('ติดทดสอบ');
                     if (isIdle) return false;
                     const eqItems = checkItems.filter(item => item.equipmentId === l.equipmentId);
                     const matchedIds = new Set();
                     l.responses.forEach(r => matchedIds.add(r.checkItemId));
                     const relevantItems = l.skipOnUse 
                        ? eqItems.filter(item => !item.frequency || item.frequency === 'daily' || item.frequency === 'per-shift')
                        : eqItems;
                     return Math.max(0, relevantItems.length - matchedIds.size) > 0;
                  }).length;

                  const isFullyChecked = nightChecked === activeEqs.length;
                  const nightKpiStatus = !isFullyChecked 
                     ? 'incomplete' 
                     : (nightLate > 0 || nightIncomplete > 0) ? 'late' : 'perfect';

                  return (
                     <div className={cn(
                        "rounded-3xl p-6 border transition-all relative overflow-hidden shadow-sm bg-white",
                        nightKpiStatus === 'perfect' ? "border-emerald-200" :
                        nightKpiStatus === 'late' ? "border-amber-200" : "border-red-200"
                     )}>
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Shift Performance Center</span>
                              <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5 mt-0.5">
                                 🌙 กะกลางคืน (Night Shift)
                              </h3>
                              <p className="text-[10px] text-slate-400 font-bold font-mono">20:00 - 08:00 น.</p>
                           </div>
                           <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase shadow-xs",
                              nightKpiStatus === 'perfect' ? "bg-emerald-500 text-white" :
                              nightKpiStatus === 'late' ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                           )}>
                              {nightKpiStatus === 'perfect' ? '✓ ดีเยี่ยม (Perfect KPI)' :
                               nightKpiStatus === 'late' ? '⚠️ มีการล่าช้า / ตรวจไม่ครบข้อ' : '❌ ค้างตรวจกะทำงาน'}
                           </span>
                        </div>

                        {/* Shift Leader Info with accountability layout */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                           <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/50 flex items-center gap-2.5">
                              <div className="w-8 h-8 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center font-extrabold text-indigo-600 text-sm shrink-0">
                                 ⭐
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Shift Leader ประจำกะ</p>
                                 <p className="text-xs font-black text-slate-800 mt-1 truncate">{nightLeader.split(' ')[0]}</p>
                              </div>
                           </div>
                           <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/50 flex items-center gap-2.5">
                              <div className="w-8 h-8 bg-sky-50 border border-sky-100 rounded-lg flex items-center justify-center font-extrabold text-sky-600 text-sm shrink-0">
                                 👥
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">ผู้ช่วยสนับสนุน (4-2)</p>
                                 <p className="text-xs font-black text-slate-800 mt-1 truncate" title={nightAssistants}>{nightAssistants.split(',').map(name => name.trim().split(' ')[0]).join(', ')}</p>
                              </div>
                           </div>
                        </div>

                        {/* Stats Dashboard Grid */}
                        <div className="grid grid-cols-4 gap-2">
                           <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
                              <span className="block text-[9px] font-bold text-slate-400">ตรวจแล้ว</span>
                              <span className="text-base font-black text-slate-800 font-mono">{nightChecked} <span className="text-[9px] font-normal">เครื่อง</span></span>
                           </div>
                           <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
                              <span className="block text-[9px] font-bold text-slate-400">ค้างตรวจ</span>
                              <span className={cn("text-base font-black font-mono", nightPending > 0 ? "text-rose-600" : "text-slate-500")}>{nightPending} <span className="text-[9px] font-normal">เครื่อง</span></span>
                           </div>
                           <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
                              <span className="block text-[9px] font-bold text-slate-400">ตรวจล่าช้า</span>
                              <span className={cn("text-base font-black font-mono", nightLate > 0 ? "text-amber-600" : "text-slate-500")}>{nightLate} <span className="text-[9px] font-normal">ข้อ</span></span>
                           </div>
                           <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100">
                              <span className="block text-[9px] font-bold text-slate-400">ค้างบางข้อ</span>
                              <span className={cn("text-base font-black font-mono", nightIncomplete > 0 ? "text-amber-600" : "text-slate-500")}>{nightIncomplete} <span className="text-[9px] font-normal">เครื่อง</span></span>
                           </div>
                        </div>
                     </div>
                  );
               })()}
            </div>

            {/* 1-MONTH COMPREHENSIVE COMPLIANCE AUDIT & CSV EXPORT PANEL */}
            {(() => {
               const auditReportData = (() => {
                  const range = [];
                  const activeEqs = equipments.filter(e => e.status === 'active');
                  const activeCount = activeEqs.length;

                  const parseTimeToHours = (timeStr: string): number => {
                     if (!timeStr) return 0;
                     const [h, m] = timeStr.split(':').map(Number);
                     return h + m / 60;
                  };

                  const dayStartH = parseTimeToHours(timeSettings.dayStart);
                  const dayEndH = parseTimeToHours(timeSettings.dayEnd);
                  const nightStartH = parseTimeToHours(timeSettings.nightStart);
                  const nightEndH = parseTimeToHours(timeSettings.nightEnd);

                  // Generate past 30 days
                  for (let i = 29; i >= 0; i--) {
                     const d = new Date(dashboardDate);
                     d.setDate(d.getDate() - i);
                     const dateStr = format(d, 'yyyy-MM-dd');
                     const dateDisplayStr = format(d, 'dd MMM yyyy');

                     const dateLogs = trendLogs.filter(l => l.dateKey === dateStr);

                     // Day Shift
                     const dayLogsOnDate = dateLogs.filter(l => l.shift === 'DAY');
                     const dayCheckHours = dayLogsOnDate.map(l => {
                        const logD = new Date(l.timestamp);
                        return logD.getHours() + logD.getMinutes() / 60;
                     });
                     const dayAvgHour = dayCheckHours.length > 0 ? dayCheckHours.reduce((a, b) => a + b, 0) / dayCheckHours.length : null;
                     const dayStatusInfo = getShiftStatusInfo('DAY', dateLogs, activeCount, timeSettings, dateStr);
                     const dayLeader = getShiftLeaderForDate(dateStr, 'DAY', operators);
                     const dayAssistants = getAssistantsForDate(dateStr, 'DAY', operators);

                     let dayLateMinutes = 0;
                     if (dayAvgHour !== null) {
                        if (dayAvgHour > dayEndH) {
                           dayLateMinutes = Math.round((dayAvgHour - dayEndH) * 60);
                        } else if (dayAvgHour < dayStartH) {
                           dayLateMinutes = Math.round((dayStartH - dayAvgHour) * 60);
                        }
                     }

                     let dayEvaluation = "";
                     if (dayStatusInfo.status === 'perfect') {
                        dayEvaluation = "ตรวจได้อยู่ในเวลาครบถ้วนดี";
                     } else if (dayStatusInfo.status === 'late_complete') {
                        dayEvaluation = "ตรวจนอกช่วงเวลา (เลยเวลากำหนด)";
                     } else {
                        dayEvaluation = "ตรวจนอกช่วงเวลา (ค้างตรวจกะ)";
                     }

                     range.push({
                        dateStr,
                        dateDisplayStr,
                        shift: 'DAY' as const,
                        leader: dayLeader,
                        assistants: dayAssistants,
                        status: dayStatusInfo.status,
                        statusText: dayStatusInfo.statusText,
                        plotColor: dayStatusInfo.plotColor,
                        avgTimeStr: dayAvgHour !== null ? getHourString(dayAvgHour) : '-',
                        lateMinutes: dayLateMinutes,
                        complianceEvaluation: dayEvaluation
                     });

                     // Night Shift
                     const nightLogsOnDate = dateLogs.filter(l => l.shift === 'NIGHT');
                     const nightCheckHours = nightLogsOnDate.map(l => {
                        const logD = new Date(l.timestamp);
                        return logD.getHours() + logD.getMinutes() / 60;
                     });
                     const nightAvgHour = nightCheckHours.length > 0 ? nightCheckHours.reduce((a, b) => a + b, 0) / nightCheckHours.length : null;
                     const nightStatusInfo = getShiftStatusInfo('NIGHT', dateLogs, activeCount, timeSettings, dateStr);
                     const nightLeader = getShiftLeaderForDate(dateStr, 'NIGHT', operators);
                     const nightAssistants = getAssistantsForDate(dateStr, 'NIGHT', operators);

                     let nightLateMinutes = 0;
                     if (nightAvgHour !== null) {
                        let adjustedHour = nightAvgHour;
                        if (nightAvgHour >= 0 && nightAvgHour < 8) {
                           adjustedHour = nightAvgHour + 24;
                        }
                        if (adjustedHour > nightEndH) {
                           nightLateMinutes = Math.round((adjustedHour - nightEndH) * 60);
                        } else if (adjustedHour < nightStartH) {
                           nightLateMinutes = Math.round((nightStartH - adjustedHour) * 60);
                        }
                     }

                     let nightEvaluation = "";
                     if (nightStatusInfo.status === 'perfect') {
                        nightEvaluation = "ตรวจได้อยู่ในเวลาครบถ้วนดี";
                     } else if (nightStatusInfo.status === 'late_complete') {
                        nightEvaluation = "ตรวจนอกช่วงเวลา (เลยเวลากำหนด)";
                     } else {
                        nightEvaluation = "ตรวจนอกช่วงเวลา (ค้างตรวจกะ)";
                     }

                     range.push({
                        dateStr,
                        dateDisplayStr,
                        shift: 'NIGHT' as const,
                        leader: nightLeader,
                        assistants: nightAssistants,
                        status: nightStatusInfo.status,
                        statusText: nightStatusInfo.statusText,
                        plotColor: nightStatusInfo.plotColor,
                        avgTimeStr: nightAvgHour !== null ? getHourString(nightAvgHour) : '-',
                        lateMinutes: nightLateMinutes,
                        complianceEvaluation: nightEvaluation
                     });
                  }
                  return range.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
               })();

               // Apply Filter & Search Search Leader Name
               const filteredAuditData = auditReportData.filter(row => {
                  const matchesSearch = row.leader.toLowerCase().includes(auditSearchLeader.toLowerCase()) || 
                                       row.assistants.toLowerCase().includes(auditSearchLeader.toLowerCase());
                  
                  if (!matchesSearch) return false;

                  if (auditStatusFilter === 'all') return true;
                  if (auditStatusFilter === 'perfect') return row.status === 'perfect';
                  if (auditStatusFilter === 'late_complete') return row.status === 'late_complete';
                  if (auditStatusFilter === 'overdue') return row.status === 'overdue';

                  return true;
               });

               // Calculate Audit Summary stats for display
               const totalCount = auditReportData.length;
               const perfectCount = auditReportData.filter(r => r.status === 'perfect').length;
               const lateCount = auditReportData.filter(r => r.status === 'late_complete').length;
               const overdueCount = auditReportData.filter(r => r.status === 'overdue').length;
               const perfectRate = totalCount === 0 ? 100 : Math.round((perfectCount / totalCount) * 100);

               const handleAuditExportCSV = () => {
                  const headers = ["วันที่", "กะการทำงาน", "ชื่อหัวหน้ากะ", "ผู้ช่วยสนับสนุน", "สถานะการตรวจสอบ", "ผลประเมินประสิทธิภาพกะ", "เวลาตรวจสอบเฉลี่ย", "ล่าช้า (นาที)"];
                  const csvRows = filteredAuditData.map(r => [
                     r.dateStr,
                     r.shift === 'DAY' ? 'กะกลางวัน (DAY)' : 'กะกลางคืน (NIGHT)',
                     r.leader,
                     r.assistants,
                     r.statusText,
                     r.complianceEvaluation,
                     r.avgTimeStr,
                     r.lateMinutes > 0 ? `${r.lateMinutes} นาที` : '-'
                  ]);
                  const csvContent = "\uFEFF" + [headers.join(','), ...csvRows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.setAttribute("href", url);
                  link.setAttribute("download", `รายงานผู้รับผิดชอบการตรวจสอบย้อนหลัง_30_วัน_${format(new Date(), 'yyyy-MM-dd')}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
               };

               return (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none"></div>
                     
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                        <div>
                           <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-widest">
                              Historical Compliance Audit Center
                           </span>
                           <h3 className="text-lg font-black text-slate-800 font-display mt-1">
                              📅 รายงานสรุปประสิทธิภาพและการตรวจสอบกะย้อนหลัง 30 วัน (1 Month Compliance Audit Roster)
                           </h3>
                           <p className="text-xs text-slate-400 font-medium">
                              สรุปรายชื่อหัวหน้ากะที่ปฏิบัติงานออกนอกช่วงเวลาควบคุม และกะที่ตรงเวลาสมบูรณ์แบบเพื่อการประเมินผล
                           </p>
                        </div>
                        
                        <button
                           onClick={handleAuditExportCSV}
                           className="px-4 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 transition-colors shadow-xs flex items-center gap-2 shrink-0 cursor-pointer animate-pulse"
                        >
                           📥 ส่งออกรายงาน CSV (Microsoft Excel)
                        </button>
                     </div>

                     {/* Stats Executive Widget Grid */}
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                           <span className="block text-[10px] font-black text-slate-400 uppercase">รวมช่วงกะที่วิเคราะห์</span>
                           <span className="text-xl font-black text-slate-800 font-mono mt-1 block">{totalCount} <span className="text-xs font-bold text-slate-400">กะ</span></span>
                        </div>
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-center">
                           <span className="block text-[10px] font-black text-emerald-600 uppercase">ตรงเวลาสมบูรณ์ (On-Time)</span>
                           <span className="text-xl font-black text-emerald-700 font-mono mt-1 block">{perfectCount} <span className="text-xs font-bold text-emerald-500">กะ</span></span>
                        </div>
                        <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 text-center">
                           <span className="block text-[10px] font-black text-amber-700 uppercase">สแกนล่าช้าเกินเวลา (Late)</span>
                           <span className="text-xl font-black text-amber-700 font-mono mt-1 block">{lateCount} <span className="text-xs font-bold text-amber-500">กะ</span></span>
                        </div>
                        <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-4 text-center">
                           <span className="block text-[10px] font-black text-rose-700 uppercase">ค้างสแกนตรวจ (Overdue)</span>
                           <span className="text-xl font-black text-rose-700 font-mono mt-1 block">{overdueCount} <span className="text-xs font-bold text-rose-500">กะ</span></span>
                        </div>
                     </div>

                     {/* Real Compliance Target Indicator */}
                     <div className="bg-slate-50/70 border border-slate-150 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                           <div className="flex justify-between text-xs font-black text-slate-700 mb-1.5">
                              <span>อัตราการตรวจสอบสำเร็จตรงเวลาเฉลี่ย (Perfect KPI Rate):</span>
                              <span className={cn("font-bold text-sm", perfectRate >= 80 ? "text-emerald-600" : "text-amber-600")}>{perfectRate}%</span>
                           </div>
                           <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                              <div 
                                 className={cn("h-full transition-all duration-500", perfectRate >= 80 ? "bg-emerald-500" : "bg-amber-500")}
                                 style={{ width: `${perfectRate}%` }}
                              />
                           </div>
                        </div>
                        <div className="shrink-0 text-center md:text-right text-[11px] font-bold text-slate-500 leading-tight">
                           {perfectRate >= 80 ? (
                              <p className="text-emerald-700 font-extrabold">🟢 ผลงานอยู่ในเกณฑ์ดีเยี่ยมผ่านค่าเป้าหมาย (KPI &gt; 80%)</p>
                           ) : (
                              <p className="text-amber-700 font-extrabold">⚠️ ควรส่งข้อชี้แจงเพื่อบริหารจัดการเวลาให้รอบคอบยิ่งขึ้น</p>
                           )}
                           <p className="mt-0.5 text-[10px]">เทียบเกณฑ์มาตรฐานโรงงาน ISO 9001:2015</p>
                        </div>
                     </div>

                     {/* Filters and Search controls */}
                     <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <div className="relative flex-1 w-full">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                           <input
                              type="text"
                              placeholder="ค้นหาชื่อหัวหน้ากะ หรือผู้ช่วย..."
                              value={auditSearchLeader}
                              onChange={e => setAuditSearchLeader(e.target.value)}
                              className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold text-slate-800"
                           />
                           {auditSearchLeader && (
                              <button onClick={() => setAuditSearchLeader('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                 <X className="w-3.5 h-3.5" />
                              </button>
                           )}
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-200/50 p-1 rounded-xl w-full sm:w-auto overflow-x-auto text-[11px] font-bold">
                           <button
                              onClick={() => setAuditStatusFilter('all')}
                              className={cn("px-2.5 py-1 rounded-lg transition-all", auditStatusFilter === 'all' ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800")}
                           >
                              ทั้งหมด
                           </button>
                           <button
                              onClick={() => setAuditStatusFilter('perfect')}
                              className={cn("px-2.5 py-1 rounded-lg transition-all flex items-center gap-1", auditStatusFilter === 'perfect' ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-emerald-700")}
                           >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ตรงเวลา
                           </button>
                           <button
                              onClick={() => setAuditStatusFilter('late_complete')}
                              className={cn("px-2.5 py-1 rounded-lg transition-all flex items-center gap-1", auditStatusFilter === 'late_complete' ? "bg-white text-amber-700 shadow-xs" : "text-slate-500 hover:text-amber-700")}
                           >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> เลยเวลา
                           </button>
                           <button
                              onClick={() => setAuditStatusFilter('overdue')}
                              className={cn("px-2.5 py-1 rounded-lg transition-all flex items-center gap-1", auditStatusFilter === 'overdue' ? "bg-white text-rose-700 shadow-xs" : "text-slate-500 hover:text-rose-700")}
                           >
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> ค้างตรวจ
                           </button>
                        </div>
                     </div>

                     {/* Audit Data List Table */}
                     <div className="overflow-y-auto max-h-[350px] custom-scrollbar border border-slate-100 rounded-2xl bg-white">
                        <table className="w-full text-left text-xs border-collapse">
                           <thead className="bg-slate-50 sticky top-0 z-10">
                              <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider text-[9px]">
                                 <th className="py-3 px-4">วันที่บันทึกกะ</th>
                                 <th className="py-3 px-2">กะการทำงาน</th>
                                 <th className="py-3 px-4">ชื่อหัวหน้ากะ</th>
                                 <th className="py-3 px-4">ผู้ช่วยสนับสนุน (Assistants)</th>
                                 <th className="py-3 px-2">เวลาตรวจจริงเฉลี่ย</th>
                                 <th className="py-3 px-3">ผลประเมินเวลาควบคุม</th>
                                 <th className="py-3 px-4 text-center">สถานะตรวจสอบกะ</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                              {filteredAuditData.length === 0 ? (
                                 <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                                       ไม่พบข้อมูลกะหรือรายชื่อหัวหน้ากะที่ตรงกับเงื่อนไขการค้นหา
                                    </td>
                                 </tr>
                              ) : (
                                 filteredAuditData.map((row, rIdx) => {
                                    const isOutShift = row.status === 'late_complete' || row.status === 'overdue';
                                    return (
                                       <tr key={`${row.dateStr}-${row.shift}-${rIdx}`} className={cn("hover:bg-slate-50/50 transition-colors", isOutShift ? "bg-rose-50/5" : "")}>
                                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                                             {row.dateDisplayStr}
                                          </td>
                                          <td className="py-3 px-2">
                                             <span className={cn(
                                                "px-2 py-0.5 rounded text-[10px] font-black uppercase border",
                                                row.shift === 'DAY' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                             )}>
                                                {row.shift === 'DAY' ? '🌞 เช้า' : '🌙 ดึก'}
                                             </span>
                                          </td>
                                          <td className="py-3 px-4">
                                             <div className="flex items-center gap-1.5">
                                                <div className={cn(
                                                   "w-1.5 h-1.5 rounded-full",
                                                   isOutShift ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                                                )}></div>
                                                <span className={isOutShift ? "text-rose-900 font-black" : "text-slate-800"}>
                                                   {row.leader.split(' ')[0]}
                                                 </span>
                                             </div>
                                          </td>
                                          <td className="py-3 px-4 text-slate-400 font-semibold text-[11px] truncate max-w-[200px]" title={row.assistants}>
                                             {row.assistants.split(',').map(name => name.trim().split(' ')[0]).join(', ')}
                                          </td>
                                          <td className="py-3 px-2 font-mono text-slate-700 font-black">
                                             {row.avgTimeStr} น.
                                          </td>
                                          <td className="py-3 px-3">
                                             <span className={cn(
                                                "px-2.5 py-1 rounded-xl text-[10px] font-extrabold border inline-block whitespace-nowrap shadow-xs",
                                                row.status === 'perfect' ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                                                row.status === 'late_complete' ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-200 text-red-800"
                                             )}>
                                                {row.complianceEvaluation}
                                             </span>
                                          </td>
                                          <td className="py-3 px-4 text-center">
                                             <span className={cn(
                                                "px-2.5 py-0.5 rounded-full text-[10px] font-black border inline-block whitespace-nowrap",
                                                row.status === 'perfect' ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                                                row.status === 'late_complete' ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-200 text-red-800"
                                             )}>
                                                {row.statusText}
                                             </span>
                                             {row.lateMinutes > 0 && (
                                                <span className="block text-[8px] font-black text-rose-600 mt-0.5">
                                                   (ล่าช้า {row.lateMinutes} นาที)
                                                </span>
                                             )}
                                          </td>
                                       </tr>
                                    );
                                 })
                              )}
                           </tbody>
                        </table>
                     </div>
                  </div>
               );
            })()}

            {/* 3. SHIFT INSPECTION MONITOR DETAIL TABLE */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-sm">
               <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-slate-100 pb-4">
                  <div>
                     <h3 className="text-base font-black text-slate-800">📋 ตารางวิเคราะห์คุณภาพการตรวจสอบรายข้อในกะทำงาน</h3>
                     <p className="text-xs text-slate-400 font-medium">รายการเครื่องจักรทั้งหมด และสถานะประเมินประสิทธิภาพกะ (KPI & Late Logs Analysis)</p>
                  </div>
               </div>

               <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                     <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                           <th className="py-3 px-2">รหัส / อุปกรณ์</th>
                           <th className="py-3 px-2">🌞 กะเช้า (DAY)</th>
                           <th className="py-3 px-2">เวลาบันทึก (เช้า)</th>
                           <th className="py-3 px-2">🌙 กะดึก (NIGHT)</th>
                           <th className="py-3 px-2">เวลาบันทึก (ดึก)</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {equipments.filter(e => e.status === 'active').map(eq => {
                           const dayLog = logs.find(l => l.equipmentId === eq.id && l.shift === 'DAY');
                           const nightLog = logs.find(l => l.equipmentId === eq.id && l.shift === 'NIGHT');

                           // Day shift logs metrics
                           let dayStatusText = "⏳ ค้างตรวจ";
                           let dayStatusColor = "bg-red-50 text-red-700 border border-red-200";
                           let dayTimeStr = "-";
                           
                           if (dayLog) {
                              const isIdle = dayLog.notes?.includes('ไม่ได้ใช้งาน') || dayLog.notes?.includes('ติดทดสอบ');
                              if (isIdle) {
                                 dayStatusText = "💤 สแตนบาย";
                                 dayStatusColor = "bg-sky-50 text-sky-700 border border-sky-200";
                              } else {
                                 const eqItems = checkItems.filter(item => item.equipmentId === eq.id);
                                 const matchedIds = new Set();
                                 dayLog.responses.forEach(r => matchedIds.add(r.checkItemId));
                                 const relevantItems = dayLog.skipOnUse 
                                    ? eqItems.filter(item => !item.frequency || item.frequency === 'daily' || item.frequency === 'per-shift')
                                    : eqItems;
                                 const isInc = Math.max(0, relevantItems.length - matchedIds.size) > 0;
                                 
                                 if (isInc) {
                                    dayStatusText = "⚠️ ตรวจไม่ครบ";
                                    dayStatusColor = "bg-amber-50 text-amber-700 border border-amber-200";
                                 } else {
                                    dayStatusText = "✓ ตรวจครบ";
                                    dayStatusColor = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                                 }
                              }
                              dayTimeStr = format(dayLog.timestamp, 'HH:mm น.');
                              if (dayLog.isLate) {
                                 dayTimeStr += " (ช้า ⏳)";
                              }
                           }

                           // Night shift logs metrics
                           let nightStatusText = "⏳ ค้างตรวจ";
                           let nightStatusColor = "bg-red-50 text-red-700 border border-red-200";
                           let nightTimeStr = "-";
                           
                           if (nightLog) {
                              const isIdle = nightLog.notes?.includes('ไม่ได้ใช้งาน') || nightLog.notes?.includes('ติดทดสอบ');
                              if (isIdle) {
                                 nightStatusText = "💤 สแตนบาย";
                                 nightStatusColor = "bg-sky-50 text-sky-700 border border-sky-200";
                              } else {
                                 const eqItems = checkItems.filter(item => item.equipmentId === eq.id);
                                 const matchedIds = new Set();
                                 nightLog.responses.forEach(r => matchedIds.add(r.checkItemId));
                                 const relevantItems = nightLog.skipOnUse 
                                    ? eqItems.filter(item => !item.frequency || item.frequency === 'daily' || item.frequency === 'per-shift')
                                    : eqItems;
                                 const isInc = Math.max(0, relevantItems.length - matchedIds.size) > 0;
                                 
                                 if (isInc) {
                                    nightStatusText = "⚠️ ตรวจไม่ครบ";
                                    nightStatusColor = "bg-amber-50 text-amber-700 border border-amber-200";
                                 } else {
                                    nightStatusText = "✓ ตรวจครบ";
                                    nightStatusColor = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                                 }
                              }
                              nightTimeStr = format(nightLog.timestamp, 'HH:mm น.');
                              if (nightLog.isLate) {
                                 nightTimeStr += " (ช้า ⏳)";
                              }
                           }

                           return (
                              <tr key={eq.id} className="hover:bg-slate-50 transition-colors">
                                 <td className="py-3 px-2">
                                    <p className="font-bold text-slate-800">{eq.name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{eq.code} · {eq.location}</p>
                                 </td>
                                 <td className="py-3 px-2">
                                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-black", dayStatusColor)}>
                                       {dayStatusText}
                                    </span>
                                 </td>
                                 <td className="py-3 px-2 font-mono text-[10px] text-slate-500">
                                    {dayLog ? (
                                       <div>
                                          <p className="font-bold text-slate-700">{dayTimeStr}</p>
                                          <p className="text-[8px] text-slate-400">ผู้ตรวจ: {dayLog.operatorName.split(' ')[0]}</p>
                                       </div>
                                    ) : (
                                       <span className="text-rose-500 font-black">⏳ ค้างตรวจ</span>
                                    )}
                                 </td>
                                 <td className="py-3 px-2">
                                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-black", nightStatusColor)}>
                                       {nightStatusText}
                                    </span>
                                 </td>
                                 <td className="py-3 px-2 font-mono text-[10px] text-slate-500">
                                    {nightLog ? (
                                       <div>
                                          <p className="font-bold text-slate-700">{nightTimeStr}</p>
                                          <p className="text-[8px] text-slate-400">ผู้ตรวจ: {nightLog.operatorName.split(' ')[0]}</p>
                                       </div>
                                    ) : (
                                       <span className="text-rose-500 font-black">⏳ ค้างตรวจ</span>
                                    )}
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      )}
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
