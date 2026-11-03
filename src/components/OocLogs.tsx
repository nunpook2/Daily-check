import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Search,
  Server,
  Clock,
  Calendar,
  Activity,
  ChevronRight,
  User,
  Edit,
  Trash2,
  X,
  Plus,
  Save,
  Lock,
  FlaskConical,
  Sun,
  Moon,
  Columns2
} from 'lucide-react';
import {
  fetchEquipments,
  fetchCheckItems,
  fetchLogs,
  saveCheckLog,
  updateCheckLog,
  deleteCheckLog
} from '../lib/db';
import {
  CheckLog,
  Equipment,
  CheckItem,
  CheckResponse,
  getEquipmentShiftScope
} from '../types';
import { cn } from '../lib/utils';

// Helper to determine if an item is an On-Use / STD parameter
function isItemStdParameter(item: CheckItem): boolean {
  const isAlwaysRequired =
    item.name.includes('สภาพทั่วไป') ||
    item.name.includes('ความพร้อมใช้งาน') ||
    item.name.includes('สถานะการใช้งาน') ||
    item.name.includes('สถานะทั่วไป') ||
    item.name.includes('เปิดเครื่อง') ||
    item.category?.includes('สภาพทั่วไป');

  if (isAlwaysRequired) return false;

  return Boolean(
    item.frequency === 'on-use' ||
      item.category?.includes('เมื่อมีการใช้งาน') ||
      item.category?.includes('เมื่อใช้งาน') ||
      item.category?.includes('ก่อนใช้งาน') ||
      item.category?.includes('ก่อนทดสอบ') ||
      item.name.includes('เมื่อมีการใช้งาน') ||
      item.name.includes('เมื่อใช้งาน') ||
      item.name.includes('วัด STD') ||
      item.name.includes('ค่ามาตรฐาน') ||
      item.name.includes('ก่อนทดสอบ') ||
      item.name.includes('สอบเทียบ')
  );
}

// Helper to classify a log as Routine Daily Check vs Pre-Test STD Calibration
function classifyLogType(
  log: CheckLog,
  sameShiftEqLogs: CheckLog[],
  allCheckItems: CheckItem[]
): 'routine_shift' | 'std_calibration' {
  if (
    log.isStdTest ||
    log.checkPhase === 'std_calibration' ||
    log.checkCycle === 'std_calibration' ||
    log.notes?.includes('[บันทึกผล STD ก่อนทดสอบ]') ||
    log.notes?.includes('บันทึกค่า STD')
  ) {
    return 'std_calibration';
  }
  if (
    log.checkPhase === 'routine_shift' ||
    log.notes?.includes('[ตรวจเช็คประจำกะ Daily Check]')
  ) {
    return 'routine_shift';
  }

  // Legacy logs fallback: if there are multiple logs for the same machine in the same shift,
  // the earliest log is the Routine Daily Check, and subsequent logs with STD parameters are STD Calibration
  if (sameShiftEqLogs.length > 1) {
    const sorted = [...sameShiftEqLogs].sort((a, b) => a.timestamp - b.timestamp);
    if (sorted[0].id !== log.id) {
      const eqItems = allCheckItems.filter(i => i.equipmentId === log.equipmentId);
      const hasStdResult = log.responses?.some(r => {
        const item = eqItems.find(i => i.id === r.checkItemId);
        return item && isItemStdParameter(item) && (r.valueNumeric !== undefined || r.valueBoolean !== undefined || r.valueText);
      });
      if (hasStdResult) return 'std_calibration';
    }
  }
  return 'routine_shift';
}

export default function OocLogs() {
  const [logs, setLogs] = useState<CheckLog[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDate, setFilterDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null);
  const [shiftViewMode, setShiftViewMode] = useState<'COMPARE_BOTH' | 'DAY_ONLY' | 'NIGHT_ONLY'>('COMPARE_BOTH');

  // Admin Passcode Protection States
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'manage' | 'create';
    log?: CheckLog;
    defaultShift?: 'DAY' | 'NIGHT';
    defaultCheckType?: 'routine_shift' | 'std_calibration';
  } | null>(null);

  // Manage / Edit / Create Modal States
  const [managingLog, setManagingLog] = useState<CheckLog | null>(null);
  const [isCreatingLog, setIsCreatingLog] = useState(false);
  const [editOperator, setEditOperator] = useState('');
  const [editShift, setEditShift] = useState<'DAY' | 'NIGHT'>('DAY');
  const [editCheckType, setEditCheckType] = useState<'routine_shift' | 'std_calibration'>('routine_shift');
  const [editTime, setEditTime] = useState('08:30');
  const [editNotes, setEditNotes] = useState('');
  const [editResults, setEditResults] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [eqData, itemsData, logData] = await Promise.all([
        fetchEquipments(),
        fetchCheckItems(),
        fetchLogs(filterDate)
      ]);
      const sortedEqs = [...eqData].sort((a, b) => a.code.localeCompare(b.code));
      setEquipments(sortedEqs);
      setCheckItems(itemsData);

      const sortedLogs = [...logData].sort((a, b) => b.timestamp - a.timestamp);
      setLogs(sortedLogs);

      if (sortedEqs.length > 0 && !selectedEq) {
        const activeEqs = sortedEqs.filter(e => e.status === 'active');
        if (activeEqs.length > 0) setSelectedEq(activeEqs[0]);
      } else if (selectedEq) {
        const updated = sortedEqs.find(e => e.id === selectedEq.id);
        if (updated) setSelectedEq(updated);
      }
    } catch (e) {
      console.error('Failed to load OocLogs data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [filterDate]);

  const requestAdminAction = (
    type: 'manage' | 'create',
    log?: CheckLog,
    defaultShift: 'DAY' | 'NIGHT' = 'DAY',
    defaultCheckType: 'routine_shift' | 'std_calibration' = 'routine_shift'
  ) => {
    setPendingAction({ type, log, defaultShift, defaultCheckType });
    setPasscodeInput('');
    setPasscodeError(false);
    setIsPasscodeModalOpen(true);
  };

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput === '1234') {
      setIsPasscodeModalOpen(false);
      if (pendingAction?.type === 'manage' && pendingAction.log) {
        proceedOpenManageModal(pendingAction.log);
      } else if (pendingAction?.type === 'create') {
        proceedOpenCreateModal(
          pendingAction.defaultShift || 'DAY',
          pendingAction.defaultCheckType || 'routine_shift'
        );
      }
      setPendingAction(null);
    } else {
      setPasscodeError(true);
    }
  };

  const proceedOpenManageModal = (log: CheckLog) => {
    setManagingLog(log);
    setIsCreatingLog(false);
    setConfirmDelete(false);
    setEditOperator(log.operatorName);
    setEditShift(log.shift === 'NIGHT' ? 'NIGHT' : 'DAY');
    const sameShiftLogs = logs.filter(
      l =>
        l.shift === log.shift &&
        (l.equipmentId === log.equipmentId || l.equipmentCode === log.equipmentCode)
    );
    setEditCheckType(classifyLogType(log, sameShiftLogs, checkItems));
    setEditTime(format(new Date(log.timestamp), 'HH:mm'));
    setEditNotes(log.notes || '');

    const resMap: Record<string, any> = {};
    log.responses?.forEach(r => {
      if (r.type === 'boolean') {
        resMap[r.checkItemId] = r.valueBoolean ? 'pass' : 'fail';
      } else if (r.type === 'numeric') {
        resMap[r.checkItemId] = r.valueNumeric ?? 0;
      } else {
        resMap[r.checkItemId] = r.valueText ?? '';
      }
    });
    setEditResults(resMap);
  };

  const proceedOpenCreateModal = (
    defaultShift: 'DAY' | 'NIGHT' = 'DAY',
    defaultCheckType: 'routine_shift' | 'std_calibration' = 'routine_shift'
  ) => {
    if (!selectedEq) return;
    setManagingLog(null);
    setIsCreatingLog(true);
    setConfirmDelete(false);
    setEditOperator('');
    setEditShift(defaultShift);
    setEditCheckType(defaultCheckType);
    setEditTime(defaultShift === 'DAY' ? '08:30' : '20:30');
    setEditNotes(
      defaultCheckType === 'std_calibration'
        ? '[บันทึกผล STD ก่อนทดสอบ]'
        : '[ตรวจเช็คประจำกะ Daily Check]'
    );

    const eqItems = checkItems.filter(i => i.equipmentId === selectedEq.id);
    const resMap: Record<string, any> = {};
    eqItems.forEach(item => {
      if (item.type === 'boolean') {
        resMap[item.id] = 'pass';
      } else if (item.type === 'numeric' || item.type === 'boolean_and_numeric') {
        resMap[item.id] = item.minValue !== undefined ? item.minValue : 0;
      } else {
        resMap[item.id] = 'ปกติ';
      }
    });
    setEditResults(resMap);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEq || !editOperator.trim()) return;
    setSaving(true);

    try {
      const eqItems = checkItems.filter(i => i.equipmentId === selectedEq.id);
      let overallStatus: 'passed' | 'needs_attention' | 'failed' = 'passed';

      const newResponses: CheckResponse[] = eqItems.map(item => {
        const val = editResults[item.id];
        let isNormal = true;

        if (item.type === 'boolean') {
          const boolVal = val === 'pass' || val === true;
          const expected = item.expectedBoolean !== undefined ? item.expectedBoolean : true;
          isNormal = boolVal === expected;
          if (!isNormal) overallStatus = 'failed';
          return {
            checkItemId: item.id,
            itemName: item.name,
            type: item.type,
            valueBoolean: boolVal,
            isNormal
          };
        } else if (item.type === 'numeric' || item.type === 'boolean_and_numeric') {
          const numVal = parseFloat(val);
          if (isNaN(numVal)) {
            isNormal = false;
          } else {
            if (item.minValue !== undefined && numVal < item.minValue) isNormal = false;
            if (item.maxValue !== undefined && numVal > item.maxValue) isNormal = false;
          }
          if (!isNormal) overallStatus = 'failed';
          return {
            checkItemId: item.id,
            itemName: item.name,
            type: item.type,
            valueNumeric: isNaN(numVal) ? 0 : numVal,
            valueBoolean: true,
            isNormal
          };
        } else {
          const textVal = String(val || '').trim();
          isNormal = textVal.length > 0;
          if (!isNormal) overallStatus = 'failed';
          return {
            checkItemId: item.id,
            itemName: item.name,
            type: item.type,
            valueText: textVal,
            isNormal
          };
        }
      });

      const [hours, minutes] = editTime.split(':').map(Number);
      const logDateObj = new Date(filterDate);
      logDateObj.setHours(hours || 0, minutes || 0, 0, 0);
      const timestamp = logDateObj.getTime();

      // STD Calibration logs are NEVER marked as late!
      let isLate = false;
      if (editCheckType === 'routine_shift') {
        const timeDecimal = (hours || 0) + (minutes || 0) / 60;
        if (editShift === 'DAY') {
          isLate = timeDecimal < 8 || timeDecimal > 10;
        } else {
          isLate = timeDecimal < 20 || timeDecimal > 22;
        }
      }

      const tagPrefix =
        editCheckType === 'std_calibration'
          ? '[บันทึกผล STD ก่อนทดสอบ]'
          : '[ตรวจเช็คประจำกะ Daily Check]';
      const cleanedNotes = editNotes
        .replace('[บันทึกผล STD ก่อนทดสอบ]', '')
        .replace('[ตรวจเช็คประจำกะ Daily Check]', '')
        .trim();
      const finalNotes = cleanedNotes ? `${tagPrefix} ${cleanedNotes}` : tagPrefix;

      if (isCreatingLog) {
        await saveCheckLog({
          equipmentId: selectedEq.id,
          equipmentCode: selectedEq.code,
          equipmentName: selectedEq.name,
          timestamp,
          dateKey: filterDate,
          shift: editShift,
          checkPhase: editCheckType,
          checkCycle: editCheckType === 'std_calibration' ? 'std_calibration' : 'daily',
          isStdTest: editCheckType === 'std_calibration',
          operatorId: 'manual_admin',
          operatorName: editOperator.trim(),
          status: overallStatus,
          responses: newResponses,
          notes: finalNotes,
          isLate
        });
      } else if (managingLog) {
        await updateCheckLog(managingLog.id, {
          operatorName: editOperator.trim(),
          shift: editShift,
          checkPhase: editCheckType,
          checkCycle: editCheckType === 'std_calibration' ? 'std_calibration' : 'daily',
          isStdTest: editCheckType === 'std_calibration',
          timestamp,
          status: overallStatus,
          responses: newResponses,
          notes: finalNotes,
          isLate
        });
      }

      setManagingLog(null);
      setIsCreatingLog(false);
      await fetchAllData();
    } catch (err) {
      console.error('Error saving log:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLog = async () => {
    if (!managingLog) return;
    setSaving(true);
    try {
      await deleteCheckLog(managingLog.id);
      setManagingLog(null);
      setConfirmDelete(false);
      await fetchAllData();
    } catch (err) {
      console.error('Error deleting log:', err);
    } finally {
      setSaving(false);
    }
  };

  // Filter Active Equipments by Search
  const filteredEquipments = equipments
    .filter(e => e.status === 'active')
    .filter(eq => {
      return (
        eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        eq.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        eq.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

  // Helper to get logs for an equipment on the selected date
  const getEquipmentShiftBreakdown = (eq: Equipment) => {
    const eqLogs = logs.filter(
      l => l.equipmentId === eq.id || l.equipmentId === eq.code || l.equipmentCode === eq.code
    );
    const dayLogs = eqLogs.filter(l => l.shift === 'DAY').sort((a, b) => a.timestamp - b.timestamp);
    const nightLogs = eqLogs.filter(l => l.shift === 'NIGHT').sort((a, b) => a.timestamp - b.timestamp);

    const dayRoutineLogs = dayLogs.filter(l => classifyLogType(l, dayLogs, checkItems) === 'routine_shift');
    const dayStdLogs = dayLogs.filter(l => classifyLogType(l, dayLogs, checkItems) === 'std_calibration');

    const nightRoutineLogs = nightLogs.filter(l => classifyLogType(l, nightLogs, checkItems) === 'routine_shift');
    const nightStdLogs = nightLogs.filter(l => classifyLogType(l, nightLogs, checkItems) === 'std_calibration');

    return {
      eqLogs,
      dayLogs,
      nightLogs,
      dayRoutineLogs,
      dayStdLogs,
      nightRoutineLogs,
      nightStdLogs
    };
  };

  const selectedEqItems = selectedEq
    ? checkItems.filter(item => item.equipmentId === selectedEq.id)
    : [];
  const selectedRoutineItems = selectedEqItems.filter(item => !isItemStdParameter(item));
  const selectedStdItems = selectedEqItems.filter(item => isItemStdParameter(item));

  // Render telemetry parameter card for a log
  const renderLogParametersGrid = (
    log: CheckLog,
    targetItems: CheckItem[],
    fallbackAllItems: CheckItem[]
  ) => {
    const itemsToDisplay = targetItems.length > 0 ? targetItems : fallbackAllItems;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
        {itemsToDisplay.map((item, idx) => {
          const resp = log.responses?.find(
            r => r.checkItemId === item.id || (r.itemName && r.itemName === item.name)
          );
          const isNumeric = item.type === 'numeric' || item.type === 'boolean_and_numeric';
          const hasResult =
            resp !== undefined &&
            (resp.valueNumeric !== undefined ||
              resp.valueBoolean !== undefined ||
              (resp.valueText !== undefined && resp.valueText !== ''));
          const isPassed = resp?.isNormal !== false;
          const isIdle =
            String(resp?.valueText || '').includes('ไม่ได้ใช้งาน') ||
            Boolean(log.skipOnUse && isItemStdParameter(item) && !hasResult);

          let displayVal = 'ไม่ได้ระบุค่า';
          if (hasResult && resp) {
            if (item.type === 'boolean') {
              displayVal = resp.valueBoolean ? '✓ ปกติ (Pass)' : '✗ ผิดปกติ (Fail)';
            } else if (item.type === 'numeric' || item.type === 'boolean_and_numeric') {
              displayVal =
                resp.valueNumeric !== undefined
                  ? `${resp.valueNumeric} ${item.unit || ''}`.trim()
                  : resp.valueBoolean
                  ? '✓ ปกติ (Pass)'
                  : '✗ ผิดปกติ';
            } else {
              displayVal = resp.valueText || '-';
            }
          } else if (isIdle) {
            displayVal = '💤 สแตนบาย (ยังไม่เดินงาน)';
          }

          return (
            <div
              key={item.id}
              className={cn(
                'p-3 rounded-xl border transition-all flex flex-col justify-between gap-2',
                !hasResult && !isIdle
                  ? 'bg-slate-50/70 border-slate-200/70'
                  : isIdle
                  ? 'bg-sky-50/40 border-sky-200'
                  : isPassed
                  ? 'bg-white border-slate-200/90 shadow-2xs'
                  : 'bg-rose-50/50 border-rose-200'
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-400">#{idx + 1}</span>
                  {item.category && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                      {item.category}
                    </span>
                  )}
                </div>
                <p className="text-xs font-extrabold text-slate-800 mt-1 leading-snug">{item.name}</p>
                {isNumeric && (item.minValue !== undefined || item.maxValue !== undefined) && (
                  <p className="text-[10px] font-mono font-bold text-indigo-600 mt-0.5">
                    เกณฑ์มาตรฐาน: {item.minValue ?? '-'} ถึง {item.maxValue ?? '-'} {item.unit || ''}
                  </p>
                )}
                {item.criteriaText && (
                  <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                    เกณฑ์: {item.criteriaText}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-400">ค่าที่บันทึก:</span>
                {hasResult || isIdle ? (
                  <span
                    className={cn(
                      'font-mono font-black text-xs px-2 py-0.5 rounded-lg border',
                      isIdle
                        ? 'bg-sky-100/70 text-sky-800 border-sky-200'
                        : isPassed
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    )}
                  >
                    {displayVal}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 italic">ไม่ได้ระบุค่า</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render a complete Shift Column (Day Shift OR Night Shift) for the selected machine
  const renderShiftColumn = (shift: 'DAY' | 'NIGHT') => {
    if (!selectedEq) return null;
    const isDay = shift === 'DAY';
    const eqScope = getEquipmentShiftScope(selectedEq);
    const isShiftApplicable = isDay ? eqScope !== 'NIGHT' : eqScope !== 'DAY';

    const breakdown = getEquipmentShiftBreakdown(selectedEq);
    const routineLogs = isDay ? breakdown.dayRoutineLogs : breakdown.nightRoutineLogs;
    const stdLogs = isDay ? breakdown.dayStdLogs : breakdown.nightStdLogs;

    return (
      <div
        className={cn(
          'rounded-3xl border overflow-hidden shadow-xs flex flex-col',
          isDay ? 'border-amber-200/90 bg-amber-50/10' : 'border-indigo-200/90 bg-indigo-50/10'
        )}
      >
        {/* SHIFT COLUMN HEADER BANNER */}
        <div
          className={cn(
            'p-4 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3',
            isDay
              ? 'bg-gradient-to-r from-amber-500/15 via-amber-50 to-white border-amber-200/80'
              : 'bg-gradient-to-r from-indigo-600/15 via-indigo-50 to-white border-indigo-200/80'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs shrink-0 border',
                isDay
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-indigo-600 text-white border-indigo-700'
              )}
            >
              {isDay ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={cn('text-base font-black', isDay ? 'text-amber-950' : 'text-indigo-950')}>
                  {isDay ? '🌞 กะเช้า (Day Shift)' : '🌙 กะดึก (Night Shift)'}
                </h3>
                <span
                  className={cn(
                    'text-[10px] font-black px-2 py-0.5 rounded-full border',
                    isDay
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                  )}
                >
                  {isDay ? '08:00 - 20:00 น.' : '20:00 - 08:00 น.'}
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                เวลาควบคุม Daily Check: {isDay ? '08:00 - 10:00 น.' : '20:00 - 22:00 น.'} · บันทึก STD ได้ตลอดกะเมื่อเดินงานจริง
              </p>
            </div>
          </div>

          {/* Quick summary badges for this shift */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                'px-2.5 py-1 rounded-xl text-[10px] font-black border',
                routineLogs.length > 0
                  ? 'bg-emerald-500 text-white border-emerald-600'
                  : !isShiftApplicable
                  ? 'bg-slate-200 text-slate-600 border-slate-300'
                  : 'bg-rose-100 text-rose-700 border-rose-200'
              )}
            >
              {routineLogs.length > 0
                ? '✓ ตรวจ Daily แล้ว'
                : !isShiftApplicable
                ? '⚪ ไม่กำหนดตรวจกะนี้'
                : '⏳ ค้างตรวจ Daily'}
            </span>
            <span
              className={cn(
                'px-2.5 py-1 rounded-xl text-[10px] font-black border',
                stdLogs.length > 0
                  ? 'bg-purple-600 text-white border-purple-700'
                  : 'bg-white text-slate-500 border-slate-200'
              )}
            >
              {stdLogs.length > 0 ? `🧪 บันทึก STD (${stdLogs.length} ครั้ง)` : '⚪ ไม่มีบันทึก STD'}
            </span>
          </div>
        </div>

        {/* SHIFT COLUMN BODY: TWO CLEARLY SEPARATED SECTIONS */}
        <div className="p-4 sm:p-5 space-y-5 flex-1">
          {/* =====================================================================
              SECTION 1: ผลตรวจเช็คสภาพเครื่องประจำกะ (DAILY CHECK)
             ===================================================================== */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs border border-emerald-200">
                  1
                </span>
                <div>
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    📅 ส่วนที่ 1: ผลตรวจเช็คสภาพเครื่องประจำกะ (Daily Check)
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    เดินตรวจความพร้อมเครื่องช่วงต้นกะ ({isDay ? '08:00 - 10:00 น.' : '20:00 - 22:00 น.'})
                  </p>
                </div>
              </div>

              <button
                onClick={() => requestAdminAction('create', undefined, shift, 'routine_shift')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" /> เพิ่มบันทึก Daily
              </button>
            </div>

            {routineLogs.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-1.5">
                <p className="text-xs font-black text-slate-600">
                  {!isShiftApplicable
                    ? `⚪ เครื่อง ${selectedEq.code} กำหนดตรวจเฉพาะ${isDay ? 'กะดึก' : 'กะเช้า'}`
                    : `⏳ ยังไม่มีบันทึกตรวจ Daily Check ใน${isDay ? 'กะเช้า' : 'กะดึก'}ของวันที่เลือก`}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  พารามิเตอร์สำหรับ Daily Check ({selectedRoutineItems.length || selectedEqItems.length} รายการ):{' '}
                  {(selectedRoutineItems.length > 0 ? selectedRoutineItems : selectedEqItems)
                    .map(i => i.name)
                    .join(' · ')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {routineLogs.map(log => {
                  const isIdle =
                    log.skipOnUse ||
                    log.notes?.includes('ไม่ได้ใช้งาน') ||
                    log.notes?.includes('ติดทดสอบ');
                  const isPass = log.status === 'passed';
                  const cleanNotes = log.notes
                    ?.replace('[ตรวจเช็คประจำกะ Daily Check]', '')
                    .replace('[บันทึกผล STD ก่อนทดสอบ]', '')
                    .trim();

                  return (
                    <div
                      key={log.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-[11px] font-black border',
                              isIdle && isPass
                                ? 'bg-sky-100 text-sky-800 border-sky-200'
                                : isPass
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                            )}
                          >
                            {isIdle && isPass
                              ? '💤 สภาพปกติ · สแตนบายรอเดินงาน'
                              : isPass
                              ? '✓ สภาพเครื่องปกติ (Passed)'
                              : '❌ พบความผิดปกติ (Failed)'}
                          </span>

                          <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-mono text-xs font-black text-slate-800 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-indigo-500" />
                            เวลาตรวจ: {format(new Date(log.timestamp), 'HH:mm น.')}
                          </span>

                          {log.isLate ? (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-black">
                              ⏰ ตรวจนอกช่วงเวลาควบคุม
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                              ✓ ตรงตามเวลาควบคุมกะ
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => requestAdminAction('manage', log)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="w-3 h-3 text-indigo-600" /> แก้ไข/ลบ
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white p-2.5 rounded-xl border border-slate-200/70">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-500" />
                          ผู้เดินตรวจกะ:{' '}
                          <strong className="font-black text-slate-900">{log.operatorName}</strong>
                        </span>
                        {cleanNotes && (
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                            หมายเหตุ: {cleanNotes}
                          </span>
                        )}
                      </div>

                      {/* Daily Check Parameters Grid */}
                      {renderLogParametersGrid(log, selectedRoutineItems, selectedEqItems)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* =====================================================================
              SECTION 2: ผลบันทึกค่ามาตรฐาน STD ก่อนทดสอบ (PRE-TEST STD CALIBRATION)
             ===================================================================== */}
          <div className="bg-white rounded-2xl border border-purple-200/90 p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-purple-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs border border-purple-200">
                  2
                </span>
                <div>
                  <h4 className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                    🧪 ส่วนที่ 2: ผลบันทึกค่ามาตรฐาน STD ก่อนทดสอบ (Pre-Test STD Calibration)
                  </h4>
                  <p className="text-[10px] text-purple-600 font-bold">
                    บันทึกเมื่อมีงานเดินเครื่องทดสอบจริง · แยกจาก Daily Check และไม่นับเป็นการตรวจล่าช้า
                  </p>
                </div>
              </div>

              <button
                onClick={() => requestAdminAction('create', undefined, shift, 'std_calibration')}
                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" /> เพิ่มผล STD
              </button>
            </div>

            {stdLogs.length === 0 ? (
              <div className="p-4 rounded-xl bg-purple-50/40 border border-dashed border-purple-200 text-center space-y-1.5">
                <p className="text-xs font-black text-purple-900">
                  ⚪ ยังไม่มีการบันทึกผล STD ก่อนทดสอบใน{isDay ? 'กะเช้า' : 'กะดึก'}ของวันนี้
                </p>
                <p className="text-[11px] text-purple-600/80 font-medium">
                  (ลงบันทึกเฉพาะเมื่อมีคิวเดินเครื่องทดสอบจริง ไม่จำเป็นต้องลงพร้อมรอบเดินตรวจเช้า/ดึก)
                </p>
                {selectedStdItems.length > 0 && (
                  <div className="pt-2 flex flex-wrap justify-center gap-1.5">
                    {selectedStdItems.map(item => (
                      <span
                        key={item.id}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white text-purple-900 border border-purple-200 shadow-2xs"
                      >
                        🧪 {item.name}
                        {(item.minValue !== undefined || item.maxValue !== undefined) &&
                          ` (${item.minValue ?? '-'} - ${item.maxValue ?? '-'} ${item.unit || ''})`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {stdLogs.map((log, sIdx) => {
                  const isPass = log.status === 'passed';
                  const cleanNotes = log.notes
                    ?.replace('[บันทึกผล STD ก่อนทดสอบ]', '')
                    .replace('[ตรวจเช็คประจำกะ Daily Check]', '')
                    .trim();

                  return (
                    <div
                      key={log.id}
                      className="rounded-xl border border-purple-200 bg-purple-50/30 p-3.5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[10px] font-black">
                            🧪 รอบทดสอบ STD #{stdLogs.length - sIdx}
                          </span>

                          <span
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-[11px] font-black border',
                              isPass
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                            )}
                          >
                            {isPass ? '✓ ค่า STD ผ่านเกณฑ์ (Pass)' : '❌ ค่า STD ตกเกณฑ์ (Out of Spec)'}
                          </span>

                          <span className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 font-mono text-xs font-black text-purple-950 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-purple-600" />
                            เวลาลงผล STD: {format(new Date(log.timestamp), 'HH:mm น.')}
                          </span>

                          <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-black">
                            ✨ ไม่นับว่าล่าช้า (บันทึกเมื่อเดินงานจริง)
                          </span>
                        </div>

                        <button
                          onClick={() => requestAdminAction('manage', log)}
                          className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-800 border border-purple-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="w-3 h-3 text-purple-600" /> แก้ไข/ลบ
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white p-2.5 rounded-xl border border-purple-200/70">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
                          ผู้ทดสอบค่า STD:{' '}
                          <strong className="font-black text-slate-900">{log.operatorName}</strong>
                        </span>
                        {cleanNotes && (
                          <span className="text-[11px] font-bold text-purple-900 bg-purple-100/70 px-2.5 py-0.5 rounded-lg">
                            หมายเหตุ: {cleanNotes}
                          </span>
                        )}
                      </div>

                      {/* STD Parameters Grid */}
                      {renderLogParametersGrid(log, selectedStdItems, selectedEqItems)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[11px] font-black uppercase tracking-widest">
              <Activity className="w-3.5 h-3.5" /> Shift Comparison & Telemetry Inspector
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight font-display">
              ประวัติและเปรียบเทียบค่าพารามิเตอร์ (กะเช้า vs กะดึก)
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-3xl font-normal">
              เลือกเครื่องมือเพื่อเปรียบเทียบข้อมูล <strong>🌞 กะเช้า (08:00-20:00)</strong> และ{' '}
              <strong>🌙 กะดึก (20:00-08:00)</strong> แบบเคียงข้างกัน โดยแยกชัดเจนระหว่าง{' '}
              <span className="text-emerald-300 font-bold">📅 1. ผลตรวจ Daily Check ประจำกะ</span> กับ{' '}
              <span className="text-purple-300 font-bold">🧪 2. ผลบันทึกค่ามาตรฐาน STD ก่อนทดสอบ</span>
            </p>
          </div>

          {/* Date Picker Control */}
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/15 flex items-center gap-3 self-start md:self-center shrink-0">
            <Calendar className="w-5 h-5 text-indigo-300 ml-1" />
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-200">
                วันที่ตรวจสอบข้อมูล (Inspection Date)
              </label>
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="bg-transparent text-white font-mono text-sm font-black focus:outline-none cursor-pointer mt-0.5"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Equipment Directory with Clear Day & Night Shift Badges */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col max-h-[820px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-4 h-4 text-indigo-600" /> เลือกเครื่องจักร ({filteredEquipments.length})
              </span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">{filterDate}</span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อเครื่อง หรือ รหัส เช่น MI-035, DSC1..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200/90 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-slate-800"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">
                กำลังโหลดรายการเครื่องจักร...
              </div>
            ) : filteredEquipments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">ไม่พบเครื่องจักรที่ค้นหา</div>
            ) : (
              filteredEquipments.map(eq => {
                const isSelected = selectedEq?.id === eq.id;
                const eqScope = getEquipmentShiftScope(eq);
                const isDayApp = eqScope !== 'NIGHT';
                const isNightApp = eqScope !== 'DAY';

                const { dayRoutineLogs, dayStdLogs, nightRoutineLogs, nightStdLogs } =
                  getEquipmentShiftBreakdown(eq);

                return (
                  <button
                    key={eq.id}
                    onClick={() => setSelectedEq(eq)}
                    className={cn(
                      'w-full p-3.5 text-left transition-all flex items-start justify-between gap-2 hover:bg-slate-50/90 cursor-pointer',
                      isSelected && 'bg-indigo-50/70 hover:bg-indigo-50/90 border-l-4 border-indigo-600'
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {eq.code}
                          </span>
                          <p
                            className={cn(
                              'font-black text-xs truncate',
                              isSelected ? 'text-indigo-950' : 'text-slate-800'
                            )}
                          >
                            {eq.name}
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                          📍 {eq.location}
                        </p>
                      </div>

                      {/* Clear Mini Shift Comparison Pills on Each Card */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {/* Day Shift Pill */}
                        <div
                          className={cn(
                            'px-2 py-1 rounded-lg border text-[9px] font-black flex items-center justify-between gap-1',
                            dayRoutineLogs.length > 0
                              ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                              : !isDayApp
                              ? 'bg-slate-50 border-slate-200 text-slate-400'
                              : 'bg-rose-50/60 border-rose-200 text-rose-700'
                          )}
                        >
                          <span>🌞 เช้า:</span>
                          <span className="truncate">
                            {dayRoutineLogs.length > 0 ? '✓ Daily' : !isDayApp ? 'เว้น' : '⏳ ค้าง'}
                            {dayStdLogs.length > 0 ? ' +STD' : ''}
                          </span>
                        </div>

                        {/* Night Shift Pill */}
                        <div
                          className={cn(
                            'px-2 py-1 rounded-lg border text-[9px] font-black flex items-center justify-between gap-1',
                            nightRoutineLogs.length > 0
                              ? 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
                              : !isNightApp
                              ? 'bg-slate-50 border-slate-200 text-slate-400'
                              : 'bg-rose-50/60 border-rose-200 text-rose-700'
                          )}
                        >
                          <span>🌙 ดึก:</span>
                          <span className="truncate">
                            {nightRoutineLogs.length > 0 ? '✓ Daily' : !isNightApp ? 'เว้น' : '⏳ ค้าง'}
                            {nightStdLogs.length > 0 ? ' +STD' : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      className={cn(
                        'w-4 h-4 shrink-0 mt-1 transition-transform',
                        isSelected ? 'text-indigo-600 translate-x-0.5' : 'text-slate-300'
                      )}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Selected Equipment Day vs Night & Daily vs STD Inspector */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-5">
          {!selectedEq ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
              <Server className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">เลือกเครื่องจักรจากแถบด้านซ้าย</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                คลิกที่ชื่อเครื่องจักรเพื่อดูตารางเปรียบเทียบผลตรวจกะเช้า vs กะดึก และแยกดูผลตรวจ Daily Check กับผลบันทึกค่า STD ก่อนทดสอบ
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* SELECTED EQUIPMENT TOP CONTROL BAR */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-mono text-xs font-black">
                        {selectedEq.code}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-display">
                        {selectedEq.name}
                      </h2>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                        📍 {selectedEq.location}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      ข้อมูลประจำวันที่ <strong className="font-mono text-slate-800">{filterDate}</strong> ·
                      แยกแสดงผลชัดเจนระหว่าง <strong>🌞 กะเช้า</strong> กับ <strong>🌙 กะดึก</strong> และแยก{' '}
                      <strong>📅 Daily Check</strong> กับ <strong>🧪 ผล STD ก่อนทดสอบ</strong>
                    </p>
                  </div>

                  {/* SHIFT VIEW SWITCHER */}
                  <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80 shadow-inner shrink-0">
                    <button
                      onClick={() => setShiftViewMode('COMPARE_BOTH')}
                      className={cn(
                        'px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5',
                        shiftViewMode === 'COMPARE_BOTH'
                          ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                          : 'text-slate-500 hover:text-slate-900'
                      )}
                    >
                      <Columns2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>เทียบ 2 กะคู่กัน (เช้า vs ดึก)</span>
                    </button>
                    <button
                      onClick={() => setShiftViewMode('DAY_ONLY')}
                      className={cn(
                        'px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5',
                        shiftViewMode === 'DAY_ONLY'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-600 hover:text-amber-800'
                      )}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>เฉพาะกะเช้า</span>
                    </button>
                    <button
                      onClick={() => setShiftViewMode('NIGHT_ONLY')}
                      className={cn(
                        'px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5',
                        shiftViewMode === 'NIGHT_ONLY'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-indigo-800'
                      )}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>เฉพาะกะดึก</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SIDE-BY-SIDE OR SINGLE SHIFT COMPARISON GRID */}
              <div
                className={cn(
                  'grid gap-6',
                  shiftViewMode === 'COMPARE_BOTH' ? 'grid-cols-1 2xl:grid-cols-2' : 'grid-cols-1'
                )}
              >
                {(shiftViewMode === 'COMPARE_BOTH' || shiftViewMode === 'DAY_ONLY') &&
                  renderShiftColumn('DAY')}
                {(shiftViewMode === 'COMPARE_BOTH' || shiftViewMode === 'NIGHT_ONLY') &&
                  renderShiftColumn('NIGHT')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PASSCODE VERIFICATION MODAL */}
      {isPasscodeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">ยืนยันสิทธิ์ผู้ดูแล (Admin)</h3>
                  <p className="text-[11px] text-slate-400">กรอกรหัสผ่านเพื่อแก้ไขหรือเพิ่มประวัติย้อนหลัง</p>
                </div>
              </div>
              <button
                onClick={() => setIsPasscodeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifyPasscode} className="space-y-3">
              <input
                type="password"
                value={passcodeInput}
                onChange={e => {
                  setPasscodeInput(e.target.value);
                  setPasscodeError(false);
                }}
                placeholder="รหัสผ่านผู้ดูแล (ค่าเริ่มต้น 1234)"
                autoFocus
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono text-lg font-black tracking-widest focus:outline-none focus:border-indigo-500"
              />
              {passcodeError && (
                <p className="text-xs text-rose-600 font-bold text-center">
                  ❌ รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPasscodeModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer"
                >
                  ยืนยันรหัส
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE / EDIT / CREATE LOG MODAL */}
      {(managingLog || isCreatingLog) && selectedEq && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  {isCreatingLog ? 'Create Inspection Record' : 'Edit Inspection Record'}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  {isCreatingLog ? 'เพิ่มบันทึกผลตรวจย้อนหลัง' : 'แก้ไขข้อมูลบันทึกผลตรวจ'} · {selectedEq.name} ({selectedEq.code})
                </h3>
              </div>
              <button
                onClick={() => {
                  setManagingLog(null);
                  setIsCreatingLog(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLog} className="space-y-4">
              {/* Select Check Type: Daily Check vs STD Calibration */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  ประเภทการบันทึก (แยกออกจากกันเพื่อไม่ให้เวลาทับกัน)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditCheckType('routine_shift')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all cursor-pointer',
                      editCheckType === 'routine_shift'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-black'
                        : 'bg-slate-50 border-slate-200 text-slate-600 font-bold'
                    )}
                  >
                    <p className="text-xs font-black">📅 1. ตรวจ Daily Check ประจำกะ</p>
                    <p className="text-[10px] opacity-80 mt-0.5">ประเมินตามช่วงเวลาควบคุมต้นกะ</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCheckType('std_calibration')}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all cursor-pointer',
                      editCheckType === 'std_calibration'
                        ? 'bg-purple-50 border-purple-400 text-purple-950 font-black'
                        : 'bg-slate-50 border-slate-200 text-slate-600 font-bold'
                    )}
                  >
                    <p className="text-xs font-black">🧪 2. บันทึกค่า STD ก่อนทดสอบ</p>
                    <p className="text-[10px] opacity-80 mt-0.5">เมื่อเริ่มเดินงานจริง (ไม่นับว่าล่าช้า)</p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อผู้ตรวจ / ผู้บันทึก</label>
                  <input
                    type="text"
                    required
                    value={editOperator}
                    onChange={e => setEditOperator(e.target.value)}
                    placeholder="ระบุชื่อพนักงาน..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">กะการทำงาน (Shift)</label>
                  <select
                    value={editShift}
                    onChange={e => setEditShift(e.target.value as 'DAY' | 'NIGHT')}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="DAY">🌞 กะเช้า (DAY 08:00-20:00)</option>
                    <option value="NIGHT">🌙 กะดึก (NIGHT 20:00-08:00)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">เวลาที่บันทึกจริง</label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={e => setEditTime(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <p className="text-xs font-black text-slate-800">ค่าพารามิเตอร์ของเครื่อง ({selectedEqItems.length} รายการ)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-1">
                  {selectedEqItems.map(item => {
                    const isNum = item.type === 'numeric' || item.type === 'boolean_and_numeric';
                    return (
                      <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-800">{item.name}</label>
                        {item.type === 'boolean' ? (
                          <select
                            value={editResults[item.id] || 'pass'}
                            onChange={e => setEditResults({ ...editResults, [item.id]: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                          >
                            <option value="pass">✓ ปกติ (Pass)</option>
                            <option value="fail">✗ ผิดปกติ (Fail)</option>
                          </select>
                        ) : (
                          <input
                            type={isNum ? 'number' : 'text'}
                            step="any"
                            value={editResults[item.id] ?? ''}
                            onChange={e => setEditResults({ ...editResults, [item.id]: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                {!isCreatingLog && managingLog ? (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleDeleteLog}
                        className="px-3 py-2 bg-rose-600 text-white rounded-xl text-xs font-black cursor-pointer"
                      >
                        ยืนยันลบบันทึกนี้
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" /> ลบบันทึกนี้
                    </button>
                  )
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setManagingLog(null);
                      setIsCreatingLog(false);
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    ปิดหน้าต่าง
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    <Save className="w-4 h-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
