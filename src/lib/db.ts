import { 
  collection, 
  getDocs, 
  addDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  doc,
  writeBatch,
  updateDoc,
  deleteField
} from "firebase/firestore";
import { db } from "./firebase";
import { Equipment, CheckItem, CheckLog, Operator, TimeWindowSettings, getEquipmentShiftScope } from "../types";
import { format } from "date-fns";

// Mock Fallback in case of Firebase Permission issues (ensures demo always works for CEO)
const getLocalStorage = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

const setLocalStorage = <T,>(key: string, value: T) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(e);
  }
};

// Helper to recursively remove undefined properties from nested objects/arrays before Firestore saving
export function cleanObject<T>(obj: T): T {
  if (obj === undefined) return undefined as any;
  if (obj === null) return null as any;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item)).filter(item => item !== undefined) as any;
  }
  if (typeof obj === 'object') {
    const clean: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = cleanObject(value);
      }
    }
    return clean;
  }
  return obj;
}

let mockEquipments: Equipment[] = getLocalStorage('lab_equipments', [
  { id: '1', name: 'MI 035', code: 'MI-035', location: 'Lab OTR', referenceDocNo: 'PDS-F-1035 Rev.001', status: 'active', createdAt: Date.now() },
  { id: '2', name: 'HPLC System', code: 'HPLC-001', location: 'Analytical Lab', status: 'active', createdAt: Date.now() },
]);

let mockCheckItems: CheckItem[] = getLocalStorage('lab_check_items', [
  { id: 'c1', equipmentId: '1', category: 'ตรวจสอบสภาพเครื่อง (ทำทุกวัน)', name: 'Temp Standby', criteriaText: '230 °C', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 1, frequency: 'daily' },
  { id: 'c2', equipmentId: '1', category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'Orifice', criteriaText: 'ไม่มีรอยบิ่น', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 2, frequency: 'on-use' },
  { id: 'c3', equipmentId: '1', category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'Dia. Orifice', criteriaText: 'วัดด้วย Go ,no-Go', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 3, frequency: 'on-use' },
  { id: 'c4', equipmentId: '1', category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'Piston', criteriaText: 'ไม่งอ ไม่มีรอยชำรุด ไม่เบี้ยว', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 4, frequency: 'on-use' },
  { id: 'c5', equipmentId: '1', category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'วัด STD P601F', criteriaText: 'บันทึกค่าที่ได้', type: 'numeric', minValue: 9.0, maxValue: 11.0, isRequired: true, orderIndex: 5, frequency: 'on-use' },
  { id: 'c6', equipmentId: '2', category: 'ตรวจสอบสภาพเครื่อง (ทำทุกวัน)', name: 'System Pressure', criteriaText: '100 - 250 bar', type: 'numeric', minValue: 100, maxValue: 250, unit: 'bar', isRequired: true, orderIndex: 1, frequency: 'daily' },
  { id: 'c7', equipmentId: '2', category: 'ตรวจสอบสภาพเครื่อง (ทำทุกวัน)', name: 'Mobile Phase Level', criteriaText: 'มีปริมาณเพียงพอ > 100 ml', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 2, frequency: 'daily' },
  { id: 'c8', equipmentId: '2', category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'Column Temperature', criteriaText: '30 - 45 °C', type: 'numeric', minValue: 30, maxValue: 45, unit: '°C', isRequired: true, orderIndex: 3, frequency: 'on-use' },
  { id: 'c9', equipmentId: '2', category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'No Leakage', criteriaText: 'ไม่มีการรั่วซึมตามข้อต่อ', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 4, frequency: 'on-use' },
]);

const defaultThaiOperators: Operator[] = [
  // 3-3 พนักงานตรวจหลัก (กะ A, B, C, D)
  { id: 'o1', name: 'สมชาย ใจดี', employeeId: 'SC-101', isActive: true, role: 'shift_leader', shift: 'DAY', classification: 'employee', shiftGroup: 'A' },
  { id: 'o2', name: 'สมพงษ์ สดใส', employeeId: 'SP-102', isActive: true, role: 'operator', shift: 'DAY', classification: 'employee', shiftGroup: 'A' },
  { id: 'o3', name: 'วิชัย เจริญสุข', employeeId: 'WC-303', isActive: true, role: 'shift_leader', shift: 'NIGHT', classification: 'employee', shiftGroup: 'B' },
  { id: 'o4', name: 'ธีระพงษ์ รุ่งเรือง', employeeId: 'TP-404', isActive: true, role: 'operator', shift: 'NIGHT', classification: 'employee', shiftGroup: 'B' },
  { id: 'o5', name: 'ประสิทธิ์ มั่นคง', employeeId: 'PS-505', isActive: true, role: 'shift_leader', shift: 'DAY', classification: 'employee', shiftGroup: 'C' },
  { id: 'o6', name: 'นครินทร์ มีชัย', employeeId: 'NK-606', isActive: true, role: 'operator', shift: 'DAY', classification: 'employee', shiftGroup: 'C' },
  { id: 'o7', name: 'วรพล เกียรติคุณ', employeeId: 'WP-707', isActive: true, role: 'shift_leader', shift: 'NIGHT', classification: 'employee', shiftGroup: 'D' },
  { id: 'o8', name: 'อนันต์ สุขสมบูรณ์', employeeId: 'AN-808', isActive: true, role: 'operator', shift: 'NIGHT', classification: 'employee', shiftGroup: 'D' },
  
  // 4-2 ผู้ช่วยสนับสนุน (กะ A, B, C)
  { id: 'a1', name: 'กานต์ดา บุญมี', employeeId: 'KD-901', isActive: true, role: 'assistant', shift: 'DAY', classification: 'assistant', shiftGroup: 'A' },
  { id: 'a2', name: 'วนิดา มณีรัตน์', employeeId: 'WN-902', isActive: true, role: 'assistant', shift: 'DAY', classification: 'assistant', shiftGroup: 'A' },
  { id: 'a3', name: 'ศิริพร รักสงบ', employeeId: 'SP-903', isActive: true, role: 'assistant', shift: 'NIGHT', classification: 'assistant', shiftGroup: 'B' },
  { id: 'a4', name: 'กฤษณา เลิศล้ำ', employeeId: 'KN-904', isActive: true, role: 'assistant', shift: 'NIGHT', classification: 'assistant', shiftGroup: 'B' },
  { id: 'a5', name: 'นภาพร ศรีสวัสดิ์', employeeId: 'NP-905', isActive: true, role: 'assistant', shift: 'DAY', classification: 'assistant', shiftGroup: 'C' },
  { id: 'a6', name: 'อนุสรณ์ จิตต์ชอบ', employeeId: 'AS-906', isActive: true, role: 'assistant', shift: 'DAY', classification: 'assistant', shiftGroup: 'C' },
];

// Helper to generate realistic 10-day check logs covering Green, Yellow, and Incomplete Red shifts
// Helper to generate realistic 10-day check logs covering Green, Yellow, and Incomplete Red shifts
const generateInitialLogs = (): CheckLog[] => {
  const logs: CheckLog[] = [];
  const now = new Date();
  const allActiveEqs = mockEquipments.filter(e => e.status !== 'maintenance');
  const targetEqs = allActiveEqs.length > 0 ? allActiveEqs : [
    { id: '1', name: 'MI 035' },
    { id: '2', name: 'HPLC System' }
  ] as Equipment[];

  // Define 10-day shift outcome blueprint (d: 9 = 9 days ago, d: 0 = today)
  // Types: 'perfect' (100% On-Time Green), 'late' (100% Late Yellow), 'incomplete' (Red <100%), 'missed' (0% Red)
  const shiftSchedule = [
    { d: 9, dayType: 'perfect', dayEndH: 9, dayEndM: 15, nightType: 'perfect', nightEndH: 21, nightEndM: 10, leaderD: 'สมชาย ใจดี', leaderN: 'วิชัย เจริญสุข' },
    { d: 8, dayType: 'perfect', dayEndH: 9, dayEndM: 35, nightType: 'late', nightEndH: 22, nightEndM: 40, leaderD: 'สมพงษ์ สดใส', leaderN: 'ธีระพงษ์ รุ่งเรือง' },
    { d: 7, dayType: 'late', dayEndH: 10, dayEndM: 45, nightType: 'perfect', nightEndH: 21, nightEndM: 20, leaderD: 'นครินทร์ มีชัย', leaderN: 'อนันต์ สุขสมบูรณ์' },
    { d: 6, dayType: 'incomplete', dayEndH: 8, dayEndM: 40, incompleteCount: Math.max(1, targetEqs.length - 2), nightType: 'perfect', nightEndH: 21, nightEndM: 5, leaderD: 'ประสิทธิ์ มั่นคง', leaderN: 'วรพล เกียรติคุณ' },
    { d: 5, dayType: 'perfect', dayEndH: 8, dayEndM: 50, nightType: 'late', nightEndH: 23, nightEndM: 15, leaderD: 'สมชาย ใจดี', leaderN: 'วิชัย เจริญสุข' },
    { d: 4, dayType: 'late', dayEndH: 13, dayEndM: 10, nightType: 'incomplete', nightEndH: 21, nightEndM: 30, incompleteCount: Math.max(1, targetEqs.length - 3), leaderD: 'สมพงษ์ สดใส', leaderN: 'ธีระพงษ์ รุ่งเรือง' },
    { d: 3, dayType: 'perfect', dayEndH: 9, dayEndM: 10, nightType: 'perfect', nightEndH: 20, nightEndM: 55, leaderD: 'นครินทร์ มีชัย', leaderN: 'อนันต์ สุขสมบูรณ์' },
    { d: 2, dayType: 'perfect', dayEndH: 8, dayEndM: 40, nightType: 'perfect', nightEndH: 21, nightEndM: 30, leaderD: 'ประสิทธิ์ มั่นคง', leaderN: 'วรพล เกียรติคุณ' },
    { d: 1, dayType: 'incomplete', dayEndH: 8, dayEndM: 28, incompleteCount: Math.max(1, targetEqs.length - 1), nightType: 'perfect', nightEndH: 21, nightEndM: 45, leaderD: 'สมชาย ใจดี', leaderN: 'วิชัย เจริญสุข' },
    { d: 0, dayType: 'incomplete', dayEndH: 9, dayEndM: 18, incompleteCount: Math.max(1, Math.min(3, targetEqs.length)), nightType: 'missed', nightEndH: 20, nightEndM: 0, leaderD: 'สมพงษ์ สดใส', leaderN: 'ธีระพงษ์ รุ่งเรือง' },
  ];

  shiftSchedule.forEach((plan, planIdx) => {
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() - plan.d);
    const dateKey = format(dayDate, 'yyyy-MM-dd');

    const dayCandidates = targetEqs.filter(e => getEquipmentShiftScope(e) !== 'NIGHT');
    const nightCandidates = targetEqs.filter(e => getEquipmentShiftScope(e) !== 'DAY');

    // Day Shift Logs
    if (plan.dayType !== 'missed') {
      const dayEqsToLog = plan.dayType === 'incomplete' 
        ? dayCandidates.slice(0, Math.max(1, Math.min(plan.incompleteCount || (dayCandidates.length - 1), dayCandidates.length - 1))) 
        : dayCandidates;
      
      const count = dayEqsToLog.length;
      dayEqsToLog.forEach((eq, eqIdx) => {
        // distribute timestamps up to dayEndH:dayEndM
        const dt = new Date(dayDate);
        const totalMinutesBeforeEnd = (count - 1 - eqIdx) * 4;
        const totalEndMinutes = plan.dayEndH * 60 + plan.dayEndM - totalMinutesBeforeEnd;
        const h = Math.floor(totalEndMinutes / 60);
        const m = Math.max(0, totalEndMinutes % 60);
        dt.setHours(h, m, 0, 0);

        logs.push({
          id: `init-log-d-${plan.d}-${eq.id}`,
          equipmentId: eq.id!,
          timestamp: dt.getTime(),
          dateKey,
          shift: 'DAY',
          operatorId: 'o1',
          operatorName: plan.leaderD,
          status: 'passed',
          notes: eqIdx === 0 && plan.d === 2 ? 'เครื่องติดคิวทดสอบอยู่ (Testing)' : 'ตรวจเช็กสมบูรณ์ตามเกณฑ์',
          actionTaken: 'ตรวจสอบเรียบร้อย',
          responses: [
            { checkItemId: 'c1', type: 'boolean', valueBoolean: true, isNormal: true },
            { checkItemId: 'c6', type: 'numeric', valueNumeric: 150, isNormal: true }
          ]
        });
      });
    }

    // Night Shift Logs
    if (plan.nightType !== 'missed') {
      const nightEqsToLog = plan.nightType === 'incomplete' 
        ? nightCandidates.slice(0, Math.max(1, Math.min(plan.incompleteCount || (nightCandidates.length - 1), nightCandidates.length - 1))) 
        : nightCandidates;

      const count = nightEqsToLog.length;
      nightEqsToLog.forEach((eq, eqIdx) => {
        const dt = new Date(dayDate);
        const totalMinutesBeforeEnd = (count - 1 - eqIdx) * 5;
        const totalEndMinutes = plan.nightEndH * 60 + plan.nightEndM - totalMinutesBeforeEnd;
        const h = Math.floor(totalEndMinutes / 60);
        const m = Math.max(0, totalEndMinutes % 60);
        dt.setHours(h, m, 0, 0);

        logs.push({
          id: `init-log-n-${plan.d}-${eq.id}`,
          equipmentId: eq.id!,
          timestamp: dt.getTime(),
          dateKey,
          shift: 'NIGHT',
          operatorId: 'o3',
          operatorName: plan.leaderN,
          status: 'passed',
          notes: 'ตรวจเช็กสมบูรณ์ตามเกณฑ์',
          actionTaken: 'ตรวจสอบเรียบร้อย',
          responses: [
            { checkItemId: 'c1', type: 'boolean', valueBoolean: true, isNormal: true },
            { checkItemId: 'c6', type: 'numeric', valueNumeric: 150, isNormal: true }
          ]
        });
      });
    }
  });

  return logs;
};

// Check if existing stored operators contain outdated mock names
const getSanitizedOperators = (): Operator[] => {
  const raw = getLocalStorage<Operator[]>('lab_operators', []);
  if (!raw || raw.length === 0 || raw.some(o => o.name.includes('Sarah') || o.name.includes('Tony Stark'))) {
    setLocalStorage('lab_operators', defaultThaiOperators);
    return defaultThaiOperators;
  }
  return raw;
};

// Check if existing stored logs contain outdated logs or incomplete coverage
const getSanitizedLogs = (): CheckLog[] => {
  const isUpToDate = getLocalStorage<string>('lab_logs_version', '') === 'v4.1';
  const raw = getLocalStorage<CheckLog[]>('lab_logs', []);
  if (!isUpToDate || !raw || raw.length < 15 || raw.some(l => l.operatorName?.includes('Sarah'))) {
    const initialLogs = generateInitialLogs();
    setLocalStorage('lab_logs', initialLogs);
    setLocalStorage('lab_logs_version', 'v4.1');
    return initialLogs;
  }
  return raw;
};

let mockLogs: CheckLog[] = getSanitizedLogs();
let mockOperators: Operator[] = getSanitizedOperators();

export async function fetchEquipments(): Promise<Equipment[]> {
  try {
    const q = query(collection(db, "equipments"));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
    if (list.length > 0) {
      mockEquipments = list;
      setLocalStorage('lab_equipments', list);
      return list;
    }
    return mockEquipments;
  } catch (error) {
    console.warn("Firestore access error, serving fallback data.", error);
    return mockEquipments;
  }
}

export async function addEquipment(equipment: Omit<Equipment, 'id'>): Promise<Equipment> {
  const cleanEq = cleanObject(equipment);
  try {
    const docRef = await addDoc(collection(db, "equipments"), cleanEq);
    const newEq = { ...equipment, id: docRef.id };
    mockEquipments.push(newEq);
    setLocalStorage('lab_equipments', mockEquipments);
    return newEq;
  } catch (error) {
    console.warn("Firestore save failed, using local mock.", error);
    const mockId = Math.random().toString(36).substring(7);
    const newEq = { ...equipment, id: mockId };
    mockEquipments.push(newEq);
    setLocalStorage('lab_equipments', mockEquipments);
    return newEq;
  }
}

export async function deleteEquipment(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "equipments", id));
  } catch (error) {
    console.warn("Firestore delete failed, using local mock.", error);
  }
  mockEquipments = mockEquipments.filter(e => e.id !== id);
  setLocalStorage('lab_equipments', mockEquipments);
}

export async function updateEquipment(id: string, updates: Partial<Equipment>): Promise<void> {
  try {
    await updateDoc(doc(db, "equipments", id), updates);
  } catch (error) {
    console.warn("Firestore update failed, using local mock.", error);
  }
  mockEquipments = mockEquipments.map(e => e.id === id ? { ...e, ...updates } : e);
  setLocalStorage('lab_equipments', mockEquipments);
}


export async function fetchCheckItems(equipmentId?: string): Promise<CheckItem[]> {
  try {
    let q = query(collection(db, "check_items"));
    if (equipmentId) {
      q = query(collection(db, "check_items"), where("equipmentId", "==", equipmentId));
    }
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckItem));
    if (list.length > 0) {
      if (equipmentId) {
        // Merge with existing
        mockCheckItems = mockCheckItems.filter(i => i.equipmentId !== equipmentId).concat(list);
      } else {
        mockCheckItems = list;
      }
      setLocalStorage('lab_check_items', mockCheckItems);
      return list;
    }
    return equipmentId ? mockCheckItems.filter(i => i.equipmentId === equipmentId) : mockCheckItems;
  } catch (error) {
    console.warn("Firestore access error, serving fallback data.", error);
    return equipmentId ? mockCheckItems.filter(i => i.equipmentId === equipmentId) : mockCheckItems;
  }
}

export async function addCheckItem(item: Omit<CheckItem, 'id'>): Promise<CheckItem> {
  const cleanItem = cleanObject(item);
  try {
    const docRef = await addDoc(collection(db, "check_items"), cleanItem);
    const newItem = { ...item, id: docRef.id };
    mockCheckItems.push(newItem);
    setLocalStorage('lab_check_items', mockCheckItems);
    return newItem;
  } catch (error) {
    console.warn("Firestore save failed, using local mock.", error);
    const mockId = Math.random().toString(36).substring(7);
    const newItem = { ...item, id: mockId };
    mockCheckItems.push(newItem);
    setLocalStorage('lab_check_items', mockCheckItems);
    return newItem;
  }
}

export async function deleteCheckItem(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "check_items", id));
  } catch (error) {
    console.warn("Firestore delete failed, using local mock.", error);
  }
  mockCheckItems = mockCheckItems.filter(i => i.id !== id);
  setLocalStorage('lab_check_items', mockCheckItems);
}

export async function updateCheckItem(id: string, updates: Partial<CheckItem>): Promise<void> {
  try {
    const docRef = doc(db, "check_items", id);
    const cleanUpdates: any = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id') continue; // Do not write the id field into doc data
      if (value === undefined) {
        cleanUpdates[key] = deleteField();
      } else {
        cleanUpdates[key] = value;
      }
    }
    await updateDoc(docRef, cleanUpdates);
  } catch (error) {
    console.warn("Firestore update failed, using local mock.", error);
  }
  mockCheckItems = mockCheckItems.map(i => i.id === id ? { ...i, ...updates } : i);
  setLocalStorage('lab_check_items', mockCheckItems);
}

export async function fetchOperators(): Promise<Operator[]> {
  try {
    const q = query(collection(db, "operators"));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Operator));
    if (list.length > 0) {
      mockOperators = list;
      setLocalStorage('lab_operators', list);
      return list;
    }
    return mockOperators;
  } catch (error) {
    console.warn("Firestore access error, serving fallback operators.", error);
    return mockOperators;
  }
}

export async function addOperator(op: Omit<Operator, 'id'>): Promise<Operator> {
  try {
    const docRef = await addDoc(collection(db, "operators"), op);
    const newOp = { ...op, id: docRef.id };
    mockOperators.push(newOp);
    setLocalStorage('lab_operators', mockOperators);
    return newOp;
  } catch (error) {
    console.warn("Firestore save failed, using local mock.", error);
    const mockId = Math.random().toString(36).substring(7);
    const newOp = { ...op, id: mockId };
    mockOperators.push(newOp);
    setLocalStorage('lab_operators', mockOperators);
    return newOp;
  }
}

export async function deleteOperator(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "operators", id));
  } catch (error) {
    console.warn("Firestore delete failed, using local mock.", error);
  }
  mockOperators = mockOperators.filter(o => o.id !== id);
  setLocalStorage('lab_operators', mockOperators);
}

export async function updateOperator(id: string, updates: Partial<Operator>): Promise<void> {
  try {
    await updateDoc(doc(db, "operators", id), updates);
  } catch (error) {
    console.warn("Firestore update failed, using local mock.", error);
  }
  const m = mockOperators.find(o => o.id === id);
  if (m) Object.assign(m, updates);
  setLocalStorage('lab_operators', mockOperators);
}

export async function fetchEquipmentLogs(equipmentId: string): Promise<CheckLog[]> {
  try {
    const q = query(collection(db, "logs"), where("equipmentId", "==", equipmentId));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as CheckLog))
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.warn("Firestore access error, serving fallback data.", error);
    return mockLogs.filter(l => l.equipmentId === equipmentId).sort((a, b) => b.timestamp - a.timestamp);
  }
}

export async function fetchLogs(dateKey: string): Promise<CheckLog[]> {
  try {
    const q = query(collection(db, "logs"), where("dateKey", "==", dateKey));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckLog));
    if (list.length > 0) {
      // Merge unique logs
      const otherLogs = mockLogs.filter(l => l.dateKey !== dateKey);
      mockLogs = [...otherLogs, ...list];
      setLocalStorage('lab_logs', mockLogs);
      return list;
    }
    return mockLogs.filter(l => l.dateKey === dateKey);
  } catch (error) {
    console.warn("Firestore access error, serving fallback data.", error);
    return mockLogs.filter(l => l.dateKey === dateKey);
  }
}

export async function saveCheckLog(log: Omit<CheckLog, 'id'>): Promise<string> {
  const cleanLog = cleanObject(log);
  try {
    const docRef = await addDoc(collection(db, "logs"), cleanLog);
    const newLog = { ...log, id: docRef.id };
    mockLogs.unshift(newLog);
    setLocalStorage('lab_logs', mockLogs);
    return docRef.id;
  } catch (error) {
    console.error("Failed to save log to Firestore, saving locally.", error);
    const mockId = Math.random().toString(36).substring(7);
    mockLogs.unshift({ ...log, id: mockId });
    setLocalStorage('lab_logs', mockLogs);
    return mockId;
  }
}

export async function updateCheckLog(id: string, updates: Partial<CheckLog>): Promise<void> {
  try {
    await updateDoc(doc(db, "logs", id), updates);
  } catch (error) {
    console.warn("Firestore update failed, using local mock.", error);
  }
  const m = mockLogs.find(l => l.id === id);
  if (m) Object.assign(m, updates);
  setLocalStorage('lab_logs', mockLogs);
}

export async function deleteCheckLog(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "logs", id));
  } catch (error) {
    console.warn("Firestore delete failed, using local mock.", error);
  }
  const idx = mockLogs.findIndex(l => l.id === id);
  if (idx >= 0) mockLogs.splice(idx, 1);
  setLocalStorage('lab_logs', mockLogs);
}

// Admin utility to seed basic data if DB is empty
export async function seedDummyData() {
  try {
    const batch = writeBatch(db);
    
    // Check if empty first
    const snapshot = await getDocs(query(collection(db, "equipments")));
    if (!snapshot.empty) return false; // Already has data

    // Seed first equipment: MI 035
    const eq1Ref = doc(collection(db, "equipments"));
    batch.set(eq1Ref, { name: 'MI 035', code: 'MI-035', location: 'Lab OTR', referenceDocNo: 'PDS-F-1035 Rev.001', status: 'active', createdAt: Date.now() });

    // Seed second equipment: HPLC System
    const eq2Ref = doc(collection(db, "equipments"));
    batch.set(eq2Ref, { name: 'HPLC System', code: 'HPLC-001', location: 'Analytical Lab', status: 'active', createdAt: Date.now() });

    // Seed check items for MI 035
    const item1Ref = doc(collection(db, "check_items"));
    batch.set(item1Ref, { equipmentId: eq1Ref.id, category: 'ตรวจสอบสภาพเครื่อง (ทำทุกวัน)', name: 'Temp Standby', criteriaText: '230 °C', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 1, frequency: 'daily' });

    const item2Ref = doc(collection(db, "check_items"));
    batch.set(item2Ref, { equipmentId: eq1Ref.id, category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'Orifice', criteriaText: 'ไม่มีรอยบิ่น', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 2, frequency: 'on-use' });

    const item3Ref = doc(collection(db, "check_items"));
    batch.set(item3Ref, { equipmentId: eq1Ref.id, category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'Dia. Orifice', criteriaText: 'วัดด้วย Go ,no-Go', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 3, frequency: 'on-use' });

    const item4Ref = doc(collection(db, "check_items"));
    batch.set(item4Ref, { equipmentId: eq1Ref.id, category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'Piston', criteriaText: 'ไม่งอ ไม่มีรอยชำรุด ไม่เบี้ยว', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 4, frequency: 'on-use' });

    const item5Ref = doc(collection(db, "check_items"));
    batch.set(item5Ref, { equipmentId: eq1Ref.id, category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'วัด STD P601F', criteriaText: 'บันทึกค่าที่ได้ (ขอบเขต 9.0 - 11.0)', type: 'numeric', minValue: 9.0, maxValue: 11.0, isRequired: true, orderIndex: 5, frequency: 'on-use' });

    // Seed check items for HPLC System
    const hplc1Ref = doc(collection(db, "check_items"));
    batch.set(hplc1Ref, { equipmentId: eq2Ref.id, category: 'ตรวจสอบสภาพเครื่อง (ทำทุกวัน)', name: 'System Pressure', criteriaText: '100 - 250 bar', type: 'numeric', minValue: 100, maxValue: 250, unit: 'bar', isRequired: true, orderIndex: 1, frequency: 'daily' });

    const hplc2Ref = doc(collection(db, "check_items"));
    batch.set(hplc2Ref, { equipmentId: eq2Ref.id, category: 'ตรวจสอบสภาพเครื่อง (ทำทุกวัน)', name: 'Mobile Phase Level', criteriaText: 'มีปริมาณเพียงพอ > 100 ml', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 2, frequency: 'daily' });

    const hplc3Ref = doc(collection(db, "check_items"));
    batch.set(hplc3Ref, { equipmentId: eq2Ref.id, category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'Column Temperature', criteriaText: '30 - 45 °C', type: 'numeric', minValue: 30, maxValue: 45, unit: '°C', isRequired: true, orderIndex: 3, frequency: 'on-use' });

    const hplc4Ref = doc(collection(db, "check_items"));
    batch.set(hplc4Ref, { equipmentId: eq2Ref.id, category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'No Leakage', criteriaText: 'ไม่มีการรั่วซึมตามข้อต่อ', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 4, frequency: 'on-use' });

    const op1Ref = doc(collection(db, "operators"));
    batch.set(op1Ref, { name: 'สมชาย ใจดี', employeeId: 'SC-101', isActive: true, role: 'shift_leader', shift: 'DAY' });

    const op2Ref = doc(collection(db, "operators"));
    batch.set(op2Ref, { name: 'สมพงษ์ สดใส', employeeId: 'SP-102', isActive: true, role: 'operator', shift: 'DAY' });

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Seed failed:", error);
    return false;
  }
}

const defaultTimeWindow: TimeWindowSettings = {
  dayStart: '08:00',
  dayEnd: '10:00',
  nightStart: '20:00',
  nightEnd: '22:00'
};

export function fetchTimeWindowSettings(): TimeWindowSettings {
  return getLocalStorage('time_window_settings', defaultTimeWindow);
}

export function saveTimeWindowSettings(settings: TimeWindowSettings): void {
  setLocalStorage('time_window_settings', settings);
}
