export type Frequency = 'daily' | 'weekly' | 'monthly' | 'on-use' | 'per-shift';
export type CheckItemType = 'boolean' | 'numeric' | 'text' | 'boolean_and_numeric';
export type ShiftType = 'DAY' | 'NIGHT' | 'OTHER' | 'NA';

export interface Equipment {
  id: string;
  name: string;
  code: string;
  location: string;
  referenceDocNo?: string; // For Document/Method Numbers
  status: 'active' | 'maintenance' | 'retired';
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

export interface Operator {
  id: string;
  name: string;
  employeeId: string;
  isActive: boolean;
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
}

export interface CheckResponse {
  checkItemId: string;
  type: CheckItemType;
  valueBoolean?: boolean;
  valueNumeric?: number;
  valueText?: string;
  isNormal: boolean; // Computed at time of check
}
