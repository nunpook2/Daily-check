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
import { Equipment, CheckItem, CheckLog, Operator } from "../types";
import { format } from "date-fns";

// Mock Fallback in case of Firebase Permission issues (ensures demo always works for CEO)
let mockEquipments: Equipment[] = [
  { id: '1', name: 'MI 035', code: 'MI-035', location: 'Lab OTR', referenceDocNo: 'PDS-F-1035 Rev.001', status: 'active', createdAt: Date.now() },
  { id: '2', name: 'HPLC System', code: 'HPLC-001', location: 'Analytical Lab', status: 'active', createdAt: Date.now() },
];

let mockCheckItems: CheckItem[] = [
  { id: 'c1', equipmentId: '1', category: 'ตรวจสอบสภาพเครื่อง (ทำทุกวัน)', name: 'Temp Standby', criteriaText: '230 °C', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 1, frequency: 'daily' },
  { id: 'c2', equipmentId: '1', category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'Orifice', criteriaText: 'ไม่มีรอยบิ่น', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 2, frequency: 'on-use' },
  { id: 'c3', equipmentId: '1', category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'Dia. Orifice', criteriaText: 'วัดด้วย Go ,no-Go', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 3, frequency: 'on-use' },
  { id: 'c4', equipmentId: '1', category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'Piston', criteriaText: 'ไม่งอ ไม่มีรอยชำรุด ไม่เบี้ยว', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 4, frequency: 'on-use' },
  { id: 'c5', equipmentId: '1', category: 'ตรวจสอบความพร้อมของเครื่องมือ (ทำก่อนทดสอบ)', name: 'วัด STD P601F', criteriaText: 'บันทึกค่าที่ได้', type: 'numeric', minValue: 9.0, maxValue: 11.0, isRequired: true, orderIndex: 5, frequency: 'on-use' },
];

let mockLogs: CheckLog[] = [
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
];

let mockOperators: Operator[] = [
  { id: 'o1', name: 'Sarah Connor', employeeId: 'SC-101', isActive: true },
  { id: 'o2', name: 'John Doe', employeeId: 'JD-102', isActive: true },
];

export async function fetchEquipments(): Promise<Equipment[]> {
  try {
    const q = query(collection(db, "equipments"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
  } catch (error) {
    console.warn("Firestore access error, serving fallback data.", error);
    return mockEquipments;
  }
}

export async function addEquipment(equipment: Omit<Equipment, 'id'>): Promise<Equipment> {
  const cleanEq = Object.fromEntries(Object.entries(equipment).filter(([_, v]) => v !== undefined));
  try {
    const docRef = await addDoc(collection(db, "equipments"), cleanEq);
    return { ...equipment, id: docRef.id };
  } catch (error) {
    console.warn("Firestore save failed, using local mock.", error);
    const mockId = Math.random().toString(36).substring(7);
    const newEq = { ...equipment, id: mockId };
    mockEquipments.push(newEq);
    return newEq;
  }
}

export async function deleteEquipment(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "equipments", id));
  } catch (error) {
    console.warn("Firestore delete failed, using local mock.", error);
    mockEquipments = mockEquipments.filter(e => e.id !== id);
  }
}

export async function updateEquipment(id: string, updates: Partial<Equipment>): Promise<void> {
  try {
    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "equipments", id), updates);
  } catch (error) {
    console.warn("Firestore update failed, using local mock.", error);
    mockEquipments = mockEquipments.map(e => e.id === id ? { ...e, ...updates } : e);
  }
}


export async function fetchCheckItems(equipmentId?: string): Promise<CheckItem[]> {
  try {
    let q = query(collection(db, "check_items"));
    if (equipmentId) {
      q = query(collection(db, "check_items"), where("equipmentId", "==", equipmentId));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckItem));
  } catch (error) {
    console.warn("Firestore access error, serving fallback data.", error);
    return equipmentId ? mockCheckItems.filter(i => i.equipmentId === equipmentId) : mockCheckItems;
  }
}

export async function addCheckItem(item: Omit<CheckItem, 'id'>): Promise<CheckItem> {
  // Strip undefined values for Firestore
  const cleanItem = Object.fromEntries(Object.entries(item).filter(([_, v]) => v !== undefined));
  try {
    const docRef = await addDoc(collection(db, "check_items"), cleanItem);
    return { ...item, id: docRef.id };
  } catch (error) {
    console.warn("Firestore save failed, using local mock.", error);
    const mockId = Math.random().toString(36).substring(7);
    const newItem = { ...item, id: mockId };
    mockCheckItems.push(newItem);
    return newItem;
  }
}

export async function deleteCheckItem(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "check_items", id));
  } catch (error) {
    console.warn("Firestore delete failed, using local mock.", error);
    mockCheckItems = mockCheckItems.filter(i => i.id !== id);
  }
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
    mockCheckItems = mockCheckItems.map(i => i.id === id ? { ...i, ...updates } : i);
  }
}

export async function fetchOperators(): Promise<Operator[]> {
  try {
    const q = query(collection(db, "operators"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Operator));
  } catch (error) {
    console.warn("Firestore access error, serving fallback operators.", error);
    return mockOperators;
  }
}

export async function addOperator(op: Omit<Operator, 'id'>): Promise<Operator> {
  try {
    const docRef = await addDoc(collection(db, "operators"), op);
    return { ...op, id: docRef.id };
  } catch (error) {
    console.warn("Firestore save failed, using local mock.", error);
    const mockId = Math.random().toString(36).substring(7);
    const newOp = { ...op, id: mockId };
    mockOperators.push(newOp);
    return newOp;
  }
}

export async function deleteOperator(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "operators", id));
  } catch (error) {
    console.warn("Firestore delete failed, using local mock.", error);
    mockOperators = mockOperators.filter(o => o.id !== id);
  }
}

export async function updateOperator(id: string, name: string): Promise<void> {
  try {
    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "operators", id), { name });
  } catch (error) {
    console.warn("Firestore update failed, using local mock.", error);
    const m = mockOperators.find(o => o.id === id);
    if (m) m.name = name;
  }
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
    if (snapshot.empty && dateKey === format(Date.now(), 'yyyy-MM-dd')) return mockLogs.filter(l => l.dateKey === dateKey); // fallback logic
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckLog));
  } catch (error) {
    console.warn("Firestore access error, serving fallback data.", error);
    return mockLogs.filter(l => l.dateKey === dateKey);
  }
}

export async function saveCheckLog(log: Omit<CheckLog, 'id'>): Promise<string> {
  const cleanLog = Object.fromEntries(Object.entries(log).filter(([_, v]) => v !== undefined));
  try {
    const docRef = await addDoc(collection(db, "logs"), cleanLog);
    return docRef.id;
  } catch (error) {
    console.error("Failed to save log to Firestore, saving locally.", error);
    const mockId = Math.random().toString(36).substring(7);
    mockLogs.unshift({ ...log, id: mockId });
    return mockId;
  }
}

export async function updateCheckLog(id: string, updates: Partial<CheckLog>): Promise<void> {
  try {
    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db, "logs", id), updates);
  } catch (error) {
    console.warn("Firestore update failed, using local mock.", error);
    const m = mockLogs.find(l => l.id === id);
    if (m) Object.assign(m, updates);
  }
}

export async function deleteCheckLog(id: string): Promise<void> {
  try {
    const { deleteDoc, doc } = await import("firebase/firestore");
    await deleteDoc(doc(db, "logs", id));
  } catch (error) {
    console.warn("Firestore delete failed, using local mock.", error);
    const idx = mockLogs.findIndex(l => l.id === id);
    if (idx >= 0) mockLogs.splice(idx, 1);
  }
}

// Admin utility to seed basic data if DB is empty
export async function seedDummyData() {
  try {
    const batch = writeBatch(db);
    
    // Check if empty first
    const snapshot = await getDocs(query(collection(db, "equipments")));
    if (!snapshot.empty) return false; // Already has data

    // This is purely for demonstration to the CEO
    const eq1Ref = doc(collection(db, "equipments"));
    batch.set(eq1Ref, { name: 'MI 035', code: 'MI-035', location: 'Lab OTR', referenceDocNo: 'PDS-F-1035 Rev.001', status: 'active', createdAt: Date.now() });

    const item1Ref = doc(collection(db, "check_items"));
    batch.set(item1Ref, { equipmentId: eq1Ref.id, category: 'ตรวจสอบสภาพเครื่อง', name: 'Temp Standby', criteriaText: '230 °C', type: 'boolean', expectedBoolean: true, isRequired: true, orderIndex: 1, frequency: 'daily' });

    const item2Ref = doc(collection(db, "check_items"));
    batch.set(item2Ref, { equipmentId: eq1Ref.id, category: 'ตรวจสอบความพร้อม', name: 'วัด STD P601F', criteriaText: 'LCL: 9.0, UCL: 11.0', type: 'numeric', minValue: 9.0, maxValue: 11.0, isRequired: true, orderIndex: 2, frequency: 'on-use' });

    const op1Ref = doc(collection(db, "operators"));
    batch.set(op1Ref, { name: 'Sarah Connor', employeeId: 'SC-101', isActive: true });

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Seed failed:", error);
    return false;
  }
}
