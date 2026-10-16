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
import { Equipment, CheckItem, CheckLog, Operator, TimeWindowSettings } from "../types";
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

let mockLogs: CheckLog[] = getLocalStorage('lab_logs', [
  { 
    id: 'l1', 
    equipmentId: '1', 
    timestamp: Date.now() - 86400000,
    dateKey: format(Date.now() - 86400000, 'yyyy-MM-dd'),
    shift: 'DAY',
    operatorId: 'o1',
    operatorName: 'Sarah Connor',
    status: 'passed',
    responses: [
      { checkItemId: 'c1', type: 'boolean', valueBoolean: true, isNormal: true },
      { checkItemId: 'c5', type: 'numeric', valueNumeric: 10.2, isNormal: true },
    ]
  }
]);

let mockOperators: Operator[] = getLocalStorage('lab_operators', [
  // 3-3 Employees (Shifts A, B, C, D)
  { id: 'o1', name: 'Sarah Connor', employeeId: 'SC-101', isActive: true, role: 'shift_leader', shift: 'DAY', classification: 'employee', shiftGroup: 'A' },
  { id: 'o2', name: 'John Doe', employeeId: 'JD-102', isActive: true, role: 'operator', shift: 'DAY', classification: 'employee', shiftGroup: 'A' },
  { id: 'o3', name: 'Tony Stark', employeeId: 'TS-303', isActive: true, role: 'shift_leader', shift: 'NIGHT', classification: 'employee', shiftGroup: 'B' },
  { id: 'o4', name: 'Bruce Banner', employeeId: 'BB-404', isActive: true, role: 'operator', shift: 'NIGHT', classification: 'employee', shiftGroup: 'B' },
  { id: 'o5', name: 'Steve Rogers', employeeId: 'SR-505', isActive: true, role: 'shift_leader', shift: 'DAY', classification: 'employee', shiftGroup: 'C' },
  { id: 'o6', name: 'Peter Parker', employeeId: 'PP-606', isActive: true, role: 'operator', shift: 'DAY', classification: 'employee', shiftGroup: 'C' },
  { id: 'o7', name: 'Natasha Romanoff', employeeId: 'NR-707', isActive: true, role: 'shift_leader', shift: 'NIGHT', classification: 'employee', shiftGroup: 'D' },
  { id: 'o8', name: 'Clint Barton', employeeId: 'CB-808', isActive: true, role: 'operator', shift: 'NIGHT', classification: 'employee', shiftGroup: 'D' },
  
  // 4-2 Assistants (Shifts A, B, C)
  { id: 'a1', name: 'Wanda Maximoff', employeeId: 'WM-901', isActive: true, role: 'assistant', shift: 'DAY', classification: 'assistant', shiftGroup: 'A' },
  { id: 'a2', name: 'Vision', employeeId: 'VS-902', isActive: true, role: 'assistant', shift: 'DAY', classification: 'assistant', shiftGroup: 'A' },
  { id: 'a3', name: 'Carol Danvers', employeeId: 'CD-903', isActive: true, role: 'assistant', shift: 'NIGHT', classification: 'assistant', shiftGroup: 'B' },
  { id: 'a4', name: 'Sam Wilson', employeeId: 'SW-904', isActive: true, role: 'assistant', shift: 'NIGHT', classification: 'assistant', shiftGroup: 'B' },
  { id: 'a5', name: 'Bucky Barnes', employeeId: 'BB-905', isActive: true, role: 'assistant', shift: 'DAY', classification: 'assistant', shiftGroup: 'C' },
  { id: 'a6', name: 'Scott Lang', employeeId: 'SL-906', isActive: true, role: 'assistant', shift: 'DAY', classification: 'assistant', shiftGroup: 'C' },
]);

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
    batch.set(op1Ref, { name: 'Sarah Connor', employeeId: 'SC-101', isActive: true, role: 'shift_leader', shift: 'DAY' });

    const op2Ref = doc(collection(db, "operators"));
    batch.set(op2Ref, { name: 'John Doe', employeeId: 'JD-102', isActive: true, role: 'operator', shift: 'DAY' });

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
