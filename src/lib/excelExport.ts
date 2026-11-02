import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { CheckLog, Equipment, CheckItem, Operator } from '../types';
import { fetchLogsRange, fetchEquipments, fetchCheckItems, fetchOperators } from './db';

export interface ExcelExportOptions {
  mode: 'month' | 'range' | 'today';
  yearMonth?: string; // e.g. "2026-10" or "2026-11"
  startDate?: string; // "YYYY-MM-DD"
  endDate?: string;   // "YYYY-MM-DD"
  phaseFilter?: 'all' | 'routine_only' | 'std_only';
  departmentFilter?: string;
}

// Helper to determine if a log is an STD test run
export function isLogStdTest(log: CheckLog): boolean {
  if (log.isStdTest) return true;
  if (log.checkPhase === 'std_calibration') return true;
  if (log.checkCycle === 'std_calibration' || log.checkCycle === 'on-use') return true;
  const n = (log.notes || '').toLowerCase();
  const a = (log.actionTaken || '').toLowerCase();
  return n.includes('std') || n.includes('calibration') || n.includes('สอบเทียบ') || n.includes('ค่ามาตรฐาน') ||
         a.includes('std') || a.includes('calibration') || a.includes('สอบเทียบ');
}

// Helper to determine human-readable check phase
export function getLogPhaseLabel(log: CheckLog): string {
  if (isLogStdTest(log)) {
    return '🧪 ทดสอบค่ามาตรฐาน STD (ก่อนเริ่มงานจริง)';
  }
  if (log.notes?.includes('ไม่ได้ใช้งาน') || log.notes?.includes('ติดทดสอบ')) {
    return '💤 ตรวจสภาพเครื่อง (เครื่องติดคิว/ไม่ได้ใช้งาน)';
  }
  return '📋 ตรวจสภาพความพร้อมประจำกะ (Routine Shift)';
}

// Helper to calculate column widths dynamically
function autoFitColumns(rows: any[][]): { wch: number }[] {
  if (!rows || rows.length === 0) return [];
  const maxCols = Math.max(...rows.map(r => r.length));
  const colWidths: number[] = new Array(maxCols).fill(10);

  rows.forEach(row => {
    row.forEach((cell, colIdx) => {
      if (cell !== undefined && cell !== null) {
        const str = String(cell);
        // Thai characters count approximately 1.5 - 2 visual width in monospaced/Excel view
        let len = 0;
        for (let i = 0; i < str.length; i++) {
          const code = str.charCodeAt(i);
          len += (code >= 0x0E00 && code <= 0x0E7F) ? 1.4 : 1.0;
        }
        if (len > colWidths[colIdx]) {
          colWidths[colIdx] = Math.ceil(len);
        }
      }
    });
  });

  return colWidths.map(w => ({ wch: Math.min(Math.max(w + 3, 12), 65) }));
}

export async function generateAndDownloadExcel(options: ExcelExportOptions): Promise<{ totalLogs: number; fileName: string }> {
  // Determine date bounds
  let start = options.startDate;
  let end = options.endDate;

  if (options.mode === 'today') {
    const today = format(new Date(), 'yyyy-MM-dd');
    start = today;
    end = today;
  } else if (options.mode === 'month') {
    const ym = options.yearMonth || format(new Date(), 'yyyy-MM');
    start = `${ym}-01`;
    // Find last day of month
    const [yStr, mStr] = ym.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    const lastDay = new Date(year, month, 0).getDate();
    end = `${ym}-${String(lastDay).padStart(2, '0')}`;
  } else {
    // Range
    if (!start) start = format(new Date(), 'yyyy-MM-01');
    if (!end) end = format(new Date(), 'yyyy-MM-dd');
  }

  // Fetch all necessary data
  const [logsRaw, equipments, allCheckItems, operators] = await Promise.all([
    fetchLogsRange(start, end),
    fetchEquipments(),
    fetchCheckItems(),
    fetchOperators()
  ]);

  // Filter logs by date range & phase
  let logs = logsRaw.filter(l => l.dateKey >= start! && l.dateKey <= end!);

  if (options.phaseFilter === 'routine_only') {
    logs = logs.filter(l => !isLogStdTest(l));
  } else if (options.phaseFilter === 'std_only') {
    logs = logs.filter(l => isLogStdTest(l));
  }

  // Sort logs chronologically (dateKey ASC, timestamp ASC)
  logs.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    return a.timestamp - b.timestamp;
  });

  // Create Excel Workbook
  const wb = XLSX.utils.book_new();

  // =========================================================================
  // SHEET 1: สรุปภาพรวมรายเดือน (Monthly / Date-Range Summary)
  // =========================================================================
  const summaryRows: any[][] = [];
  summaryRows.push(['รายงานสรุปการตรวจเช็กและทดสอบเครื่องมือวิทยาศาสตร์ (QC Inspection & STD Calibration Report)']);
  summaryRows.push([`ช่วงเวลาการประเมิน: ${start} ถึง ${end}`]);
  summaryRows.push([`วันที่จัดทำรายงาน: ${format(new Date(), 'dd/MM/yyyy HH:mm น.')}`]);
  summaryRows.push([]); // Empty line

  // Summary Table Header
  summaryRows.push([
    'วันที่ (Date)',
    'วัน (Day)',
    'กะเช้า: จำนวนตรวจ (เครื่อง)',
    'กะเช้า: สแตนด์บาย/ติดคิว',
    'กะเช้า: หลุดเกณฑ์ (OOC)',
    'กะดึก: จำนวนตรวจ (เครื่อง)',
    'กะดึก: สแตนด์บาย/ติดคิว',
    'กะดึก: หลุดเกณฑ์ (OOC)',
    'รวมบันทึกทดสอบค่า STD',
    '% อัตราความสมบูรณ์',
    'หมายเหตุประจำวัน'
  ]);

  // Generate unique date keys list in range
  const dateKeysSet = new Set<string>();
  const cur = new Date(start + 'T12:00:00');
  const stop = new Date(end + 'T12:00:00');
  while (cur <= stop) {
    dateKeysSet.add(format(cur, 'yyyy-MM-dd'));
    cur.setDate(cur.getDate() + 1);
  }
  const sortedDates = Array.from(dateKeysSet).sort();

  const dayNamesThai = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  sortedDates.forEach(dateStr => {
    const dLogs = logsRaw.filter(l => l.dateKey === dateStr);
    const dayLogs = dLogs.filter(l => l.shift === 'DAY');
    const nightLogs = dLogs.filter(l => l.shift === 'NIGHT');

    const dayChecked = dayLogs.length;
    const dayStandby = dayLogs.filter(l => l.notes?.includes('ไม่ได้ใช้งาน') || l.notes?.includes('ติดทดสอบ')).length;
    const dayOoc = dayLogs.filter(l => l.status === 'failed' || l.status === 'needs_attention').length;

    const nightChecked = nightLogs.length;
    const nightStandby = nightLogs.filter(l => l.notes?.includes('ไม่ได้ใช้งาน') || l.notes?.includes('ติดทดสอบ')).length;
    const nightOoc = nightLogs.filter(l => l.status === 'failed' || l.status === 'needs_attention').length;

    const stdCount = dLogs.filter(isLogStdTest).length;
    const totalChecks = dayChecked + nightChecked;

    // Approximate expected total per day (active equipments count)
    const activeEqsCount = equipments.filter(e => e.status === 'active').length;
    const targetDailyTotal = activeEqsCount > 0 ? activeEqsCount : 14;
    const complianceRate = Math.min(100, Math.round((totalChecks / targetDailyTotal) * 100));

    const dateObj = new Date(dateStr + 'T12:00:00');
    const dayName = dayNamesThai[dateObj.getDay()];

    let dayNotes = '';
    if (stdCount > 0) dayNotes += `มีการทดสอบค่า STD ${stdCount} ครั้ง; `;
    if (dayOoc + nightOoc > 0) dayNotes += `พบหลุดเกณฑ์ ${dayOoc + nightOoc} จุด; `;
    if (!dayNotes) dayNotes = totalChecks > 0 ? 'การปฏิบัติงานปกติ' : 'ไม่มีบันทึกการตรวจ';

    summaryRows.push([
      dateStr,
      dayName,
      dayChecked,
      dayStandby,
      dayOoc,
      nightChecked,
      nightStandby,
      nightOoc,
      stdCount,
      `${complianceRate}%`,
      dayNotes.trim()
    ]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = autoFitColumns(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปภาพรวมรายเดือน');

  // =========================================================================
  // SHEET 2: ประวัติการตรวจรายวัน (Detailed Daily Inspection Logs)
  // =========================================================================
  const dailyLogsRows: any[][] = [];
  dailyLogsRows.push([
    'ลำดับ (No.)',
    'วันที่ (Date)',
    'เวลา (Time น.)',
    'กะ (Shift)',
    'ประเภทขั้นตอนการตรวจ (Inspection Phase)',
    'รหัสเครื่องจักร (Code)',
    'ชื่อเครื่องจักร (Equipment Name)',
    'สถานที่ / ห้อง (Location)',
    'ผู้บันทึกตรวจ (Inspector)',
    'รหัสพนักงาน (Staff ID)',
    'ผลการประเมิน (Status)',
    'การประเมินเวลา (Timing Evaluation)',
    'สรุปผลตรวจวัด / พารามิเตอร์ (Measurements Summary)',
    'บันทึกหน้างาน / การดำเนินการ (Remarks & Actions)'
  ]);

  logs.forEach((log, index) => {
    const eq = equipments.find(e => 
      e.id === log.equipmentId || 
      e.code === log.equipmentId || 
      (log.equipmentCode && e.code === log.equipmentCode) ||
      (log.equipmentName && (e.name === log.equipmentName || e.name.toLowerCase() === log.equipmentName.toLowerCase()))
    );

    const isStd = isLogStdTest(log);
    const phaseLabel = getLogPhaseLabel(log);

    // Status label
    let statusLabel = 'ผ่านเกณฑ์ปกติ (PASSED)';
    if (log.status === 'failed') statusLabel = 'หลุดเกณฑ์ควบคุม (FAILED)';
    else if (log.status === 'needs_attention') statusLabel = 'ต้องติดตามแก้ไข (ATTENTION)';
    if (log.notes?.includes('ไม่ได้ใช้งาน') || log.notes?.includes('ติดทดสอบ')) {
      statusLabel = 'ไม่ได้ใช้งาน / เครื่องติดทดสอบ (STANDBY)';
    }

    // Timing evaluation
    let timingLabel = '✅ ตรวจในเวลาปกติ';
    if (isStd) {
      timingLabel = '🧪 ทดสอบค่า STD เริ่มงานจริง (ยกเว้นล่าช้า)';
    } else if (log.isLate) {
      timingLabel = '⏳ นอกช่วงเวลาควบคุมกะ (Late)';
    }

    // Responses summary
    const measurements = (log.responses || []).map(r => {
      let val = '';
      if (r.type === 'boolean') val = r.valueBoolean ? 'PASS' : 'FAIL';
      else if (r.type === 'numeric') val = `${r.valueNumeric}`;
      else val = r.valueText || '-';
      return `${r.itemName || 'ข้อ'}: ${val}${r.isNormal ? '' : ' [OOC]'}`;
    }).join('; ');

    const timeStr = format(new Date(log.timestamp), 'HH:mm');

    dailyLogsRows.push([
      index + 1,
      log.dateKey,
      timeStr,
      log.shift === 'DAY' ? 'กะกลางวัน (Day)' : 'กะกลางคืน (Night)',
      phaseLabel,
      eq?.code || log.equipmentCode || log.equipmentId,
      eq?.name || log.equipmentName || 'เครื่องมือห้องปฏิบัติการ',
      (eq?.location || 'Lab').replace('น้อง', 'ห้อง'),
      log.operatorName || 'ไม่ระบุ',
      log.operatorId || '-',
      statusLabel,
      timingLabel,
      measurements || 'ตรวจสภาพภายนอกปกติ',
      log.notes || log.actionTaken || '-'
    ]);
  });

  const wsDailyLogs = XLSX.utils.aoa_to_sheet(dailyLogsRows);
  wsDailyLogs['!cols'] = autoFitColumns(dailyLogsRows);
  XLSX.utils.book_append_sheet(wb, wsDailyLogs, 'ประวัติการตรวจรายวัน');

  // =========================================================================
  // SHEET 3: บันทึกทดสอบค่า_STD (Dedicated STD Calibration Run Details)
  // =========================================================================
  const stdRows: any[][] = [];
  stdRows.push([
    'ลำดับ',
    'วันที่ทดสอบ (Date)',
    'เวลาทดสอบ (Time น.)',
    'กะ (Shift)',
    'รหัสเครื่อง (Code)',
    'ชื่อเครื่องจักร (Equipment Name)',
    'สถานที่ตั้ง (Location)',
    'หัวข้อทดสอบค่า STD / พารามิเตอร์ (Parameter)',
    'หมวดหมู่ (Category)',
    'เกณฑ์มาตรฐาน / ค่าควบคุม (Target / Spec)',
    'ค่า STD ที่วัดได้จริง (Measured Value)',
    'หน่วย (Unit)',
    'ผลการสอบเทียบ (Result)',
    'ผู้ทดสอบ (Tester / Operator)',
    'หมายเหตุหน้างาน (Notes)'
  ]);

  let stdCounter = 1;
  logs.forEach(log => {
    const isStd = isLogStdTest(log);
    const eq = equipments.find(e => 
      e.id === log.equipmentId || 
      e.code === log.equipmentId || 
      (log.equipmentCode && e.code === log.equipmentCode) ||
      (log.equipmentName && (e.name === log.equipmentName || e.name.toLowerCase() === log.equipmentName.toLowerCase()))
    );

    const timeStr = format(new Date(log.timestamp), 'HH:mm');

    // Extract STD/on-use responses or all responses if marked as STD test
    (log.responses || []).forEach(r => {
      // Find matching checkItem to retrieve criteria / units
      const item = allCheckItems.find(i => 
        i.id === r.checkItemId || 
        (r.itemName && i.name.toLowerCase() === r.itemName.toLowerCase())
      );

      const isOnUse = item?.frequency === 'on-use';
      const isStdKeyword = (r.itemName || '').toLowerCase().includes('std') || 
                           (r.itemName || '').toLowerCase().includes('calibration') ||
                           (r.itemName || '').toLowerCase().includes('มาตรฐาน') ||
                           (item?.category || '').toLowerCase().includes('ทดสอบ');

      if (isStd || isOnUse || isStdKeyword) {
        let valStr = '';
        if (r.type === 'boolean') valStr = r.valueBoolean ? 'PASS' : 'FAIL';
        else if (r.type === 'numeric') valStr = String(r.valueNumeric);
        else valStr = r.valueText || '-';

        let criteria = item?.criteriaText || '';
        if (!criteria && item) {
          if (typeof item.minValue === 'number' && typeof item.maxValue === 'number') {
            criteria = `${item.minValue} - ${item.maxValue} ${item.unit || ''}`;
          } else if (typeof item.targetValue === 'number') {
            criteria = `Target: ${item.targetValue} ${item.unit || ''}`;
          }
        }

        stdRows.push([
          stdCounter++,
          log.dateKey,
          timeStr,
          log.shift === 'DAY' ? 'กะเช้า' : 'กะดึก',
          eq?.code || log.equipmentCode || log.equipmentId,
          eq?.name || log.equipmentName || 'เครื่องมือ',
          (eq?.location || 'Lab').replace('น้อง', 'ห้อง'),
          r.itemName || item?.name || 'พารามิเตอร์ STD',
          item?.category || (isStd ? 'การทดสอบค่ามาตรฐาน STD' : 'ตรวจสอบก่อนใช้งาน'),
          criteria || 'ตามมาตรฐานโรงงาน',
          valStr,
          item?.unit || '-',
          r.isNormal ? 'ผ่านเกณฑ์ (PASS)' : 'ตกเกณฑ์ (FAIL)',
          log.operatorName || 'ไม่ระบุ',
          log.notes || '-'
        ]);
      }
    });
  });

  const wsStd = XLSX.utils.aoa_to_sheet(stdRows);
  wsStd['!cols'] = autoFitColumns(stdRows);
  XLSX.utils.book_append_sheet(wb, wsStd, 'บันทึกทดสอบค่า_STD');

  // =========================================================================
  // SHEET 4: ทะเบียนเครื่องมือ (Equipment Master List)
  // =========================================================================
  const masterRows: any[][] = [];
  masterRows.push([
    'รหัสเครื่องจักร (Code)',
    'ชื่อเครื่องมือ (Equipment Name)',
    'สถานที่ / แผนก (Location)',
    'เลขที่เอกสาร SOP อ้างอิง (Reference Doc No.)',
    'กะที่ต้องตรวจสอบ (Applicable Shift)',
    'สถานะปัจจุบัน (Status)',
    'จำนวนหัวข้อที่ต้องตรวจ (Check Items Count)'
  ]);

  equipments.forEach(eq => {
    const eqItems = allCheckItems.filter(i => i.equipmentId === eq.id || i.equipmentId === eq.code);
    let shiftScopeLabel = 'ทุกกะ (เช้าและดึก)';
    if (eq.applicableShift === 'DAY') shiftScopeLabel = 'กะเช้าเท่านั้น (Day Only)';
    else if (eq.applicableShift === 'NIGHT') shiftScopeLabel = 'กะดึกเท่านั้น (Night Only)';

    masterRows.push([
      eq.code,
      eq.name,
      (eq.location || 'ห้องปฏิบัติการ').replace('น้อง', 'ห้อง'),
      eq.referenceDocNo || '-',
      shiftScopeLabel,
      eq.status === 'active' ? 'พร้อมใช้งาน (Active)' : eq.status === 'maintenance' ? 'ปิดซ่อมบำรุง' : 'ยกเลิกใช้งาน',
      eqItems.length
    ]);
  });

  const wsMaster = XLSX.utils.aoa_to_sheet(masterRows);
  wsMaster['!cols'] = autoFitColumns(masterRows);
  XLSX.utils.book_append_sheet(wb, wsMaster, 'ทะเบียนเครื่องมือ');

  // Generate Filename
  let fileName = `QC_Inspection_Report_${start}_to_${end}.xlsx`;
  if (options.mode === 'month') {
    fileName = `QC_Inspection_Monthly_${options.yearMonth || format(new Date(), 'yyyy-MM')}.xlsx`;
  } else if (options.mode === 'today') {
    fileName = `QC_Inspection_Daily_${start}.xlsx`;
  }

  // Trigger browser download
  XLSX.writeFile(wb, fileName);

  return {
    totalLogs: logs.length,
    fileName
  };
}
