export type Frequency = 'daily' | 'weekly' | 'monthly' | 'on-use' | 'per-shift';
export type CheckItemType = 'boolean' | 'numeric' | 'text' | 'boolean_and_numeric';
export type ShiftType = 'DAY' | 'NIGHT' | 'OTHER' | 'NA';
export type ShiftScope = 'ALL' | 'DAY' | 'NIGHT';

export interface Equipment {
  id: string;
  name: string;
  code: string;
  location: string;
  referenceDocNo?: string; // For Document/Method Numbers
  status: 'active' | 'maintenance' | 'retired';
  applicableShift?: ShiftScope; // 'ALL' = both shifts, 'DAY' = morning only, 'NIGHT' = night only
  maintenanceReason?: string;
  maintenanceNotes?: string;
  maintenanceAt?: number;
  maintenanceBy?: string;
  createdAt: number;
}

export interface CheckItem {
  id: string;
  equipmentId: string;
  name: string;
  category: string; // e.g. "ตรวจสอบสภาพเครื่อง (Daily)", "ตรวจสอบความพร้อม (Before Test)"
  criteriaText?: string; // e.g. "230 °C", "ไม่มีรอยบิ่น"
  type: CheckItemType;
  frequency: Frequency;
  applicableShift?: ShiftScope; // 'ALL' = both shifts, 'DAY' = morning only, 'NIGHT' = night only
  
  // For boolean checks (e.g. Pass/Fail, Clean/Dirty, true means pass)
  expectedBoolean?: boolean; 
  
  // For numeric checks
  targetValue?: number;
  minValue?: number; // Maps to LCL (Lower Control Limit)
  maxValue?: number; // Maps to UCL (Upper Control Limit)
  unit?: string;
  isRequired: boolean;
  orderIndex: number;
}

// Smart helper to determine if an equipment is for ALL, DAY only, or NIGHT only
export function getEquipmentShiftScope(eq: Equipment): ShiftScope {
  if (eq.applicableShift) return eq.applicableShift;
  const str = `${eq.name} ${eq.code} ${eq.location || ''} ${eq.referenceDocNo || ''}`.toLowerCase();
  // Check for night shift keywords
  if (str.includes('กะดึก') || str.includes('กะไนท์') || str.includes('night') || str.includes('กลางคืน') || str.includes('ไนท์')) {
    return 'NIGHT';
  }
  // Check for day shift keywords
  if (str.includes('กะเช้า') || str.includes('กะเดย์') || str.includes('day') || str.includes('กลางวัน') || str.includes('เดย์')) {
    return 'DAY';
  }
  return 'ALL';
}

// Smart helper to determine if a check item is for ALL, DAY only, or NIGHT only
export function getCheckItemShiftScope(item: CheckItem): ShiftScope {
  if (item.applicableShift) return item.applicableShift;
  const str = `${item.name} ${item.category || ''} ${item.criteriaText || ''}`.toLowerCase();
  if (str.includes('กะดึก') || str.includes('กะไนท์') || str.includes('night') || str.includes('กลางคืน') || str.includes('ไนท์')) {
    return 'NIGHT';
  }
  if (str.includes('กะเช้า') || str.includes('กะเดย์') || str.includes('day') || str.includes('กลางวัน') || str.includes('เดย์')) {
    return 'DAY';
  }
  return 'ALL';
}

export interface Operator {
  id: string;
  name: string;
  employeeId: string;
  isActive: boolean;
  role: 'operator' | 'shift_leader' | 'assistant';
  shift?: 'DAY' | 'NIGHT';
  classification?: 'employee' | 'assistant';
  shiftGroup?: 'A' | 'B' | 'C' | 'D';
}

export interface CheckLog {
  id: string;
  equipmentId: string;
  timestamp: number;
  dateKey: string; // YYYY-MM-DD string for easy querying
  shift: ShiftType;
  checkCycle?: string; // Type of check that was performed (e.g. daily, on-use, all)
  operatorId: string;
  operatorName: string;
  status: 'passed' | 'failed' | 'needs_attention';
  actionTaken?: string;
  notes?: string;
  responses: CheckResponse[];
  isLate?: boolean;
  skipOnUse?: boolean;
}

export interface TimeWindowSettings {
  dayStart: string; // e.g. "08:00"
  dayEnd: string;   // e.g. "10:00"
  nightStart: string; // e.g. "20:00"
  nightEnd: string;   // e.g. "22:00"
}

export interface CheckResponse {
  checkItemId: string;
  type: CheckItemType;
  itemName?: string; // Cache name at check time to prevent matching failures
  valueBoolean?: boolean;
  valueNumeric?: number;
  valueText?: string;
  isNormal: boolean; // Computed at time of check
}

// ==========================================
// 3-3 ROTATION SHIFT SCHEDULE (12-DAY CYCLE)
// Continuous rotation matching Official Factory Shift Table:
// DAY: A (3d) -> C (3d) -> B (3d) -> D (3d) -> repeats continuously
// NIGHT: B (3d) -> D (3d) -> A (3d) -> C (3d) -> repeats continuously
// OFF DAY: D (3d) -> A (3d) -> C (3d) -> B (3d) -> repeats continuously
// OFF NIGHT: C (3d) -> B (3d) -> D (3d) -> A (3d) -> repeats continuously
// Cycle Anchor: 2025-12-31 was Day 1 of Group A (index 0)
// 2026-01-01 is Day 2 of Group A (index 1) -> DAY=A, NIGHT=B
// Automatically extends accurately to 2027, 2028, 2029, and beyond!
// ==========================================
export const DAY_33_SEQUENCE = ['A', 'A', 'A', 'C', 'C', 'C', 'B', 'B', 'B', 'D', 'D', 'D'] as const;
export const NIGHT_33_SEQUENCE = ['B', 'B', 'B', 'D', 'D', 'D', 'A', 'A', 'A', 'C', 'C', 'C'] as const;
export const OFF_DAY_33_SEQUENCE = ['D', 'D', 'D', 'A', 'A', 'A', 'C', 'C', 'C', 'B', 'B', 'B'] as const;
export const OFF_NIGHT_33_SEQUENCE = ['C', 'C', 'C', 'B', 'B', 'B', 'D', 'D', 'D', 'A', 'A', 'A'] as const;

export interface Shift33Result {
  cycleDay: number; // 1 to 12
  cycleIndex: number; // 0 to 11
  dayGroup: 'A' | 'B' | 'C' | 'D';
  nightGroup: 'A' | 'B' | 'C' | 'D';
  offDayGroup: 'A' | 'B' | 'C' | 'D';
  offNightGroup: 'A' | 'B' | 'C' | 'D';
}

export function calculate33ShiftGroups(targetDate: Date | string): Shift33Result {
  let dateObj: Date;
  if (typeof targetDate === 'string') {
    const parts = targetDate.split('T')[0].split('-');
    dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
  } else {
    dateObj = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 12, 0, 0);
  }

  // Anchor date: 2025-12-31 12:00:00 (Day 1 of Group A, index 0 of 12-day cycle)
  const anchorDate = new Date(2025, 11, 31, 12, 0, 0);
  const diffTime = dateObj.getTime() - anchorDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const cycleIndex = ((diffDays % 12) + 12) % 12;
  const cycleDay = cycleIndex + 1; // 1 to 12

  return {
    cycleDay,
    cycleIndex,
    dayGroup: DAY_33_SEQUENCE[cycleIndex],
    nightGroup: NIGHT_33_SEQUENCE[cycleIndex],
    offDayGroup: OFF_DAY_33_SEQUENCE[cycleIndex],
    offNightGroup: OFF_NIGHT_33_SEQUENCE[cycleIndex],
  };
}
