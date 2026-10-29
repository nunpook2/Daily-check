import React, { useState, useEffect, useRef, useMemo } from 'react';
import { fetchEquipments, fetchCheckItems, fetchLogs, saveCheckLog, fetchOperators, fetchTimeWindowSettings, fetchTimeWindowSettingsAsync, updateEquipment } from '../lib/db';
import { Equipment, CheckItem, CheckResponse, CheckLog, Operator, TimeWindowSettings, getEquipmentShiftScope, getCheckItemShiftScope, calculate33ShiftGroups } from '../types';
import { format, differenceInCalendarDays } from 'date-fns';
import { getEquipmentsStatusForDate } from './Dashboard';
import { 
  ChevronRight, 
  ArrowLeft, 
  CheckCircle, 
  ScanLine, 
  Search, 
  AlertTriangle, 
  Camera, 
  Upload, 
  AlertCircle,
  User,
  Sun,
  Moon,
  Cog,
  Plus,
  Minus,
  MessageSquare,
  Sparkles,
  Smartphone,
  Check,
  X,
  Wrench,
  FileSpreadsheet,
  ListChecks,
  Clock,
  Zap,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
  Filter,
  SwitchCamera
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import jsQR from "jsqr";

export default function PerformCheck({ onSaved, initialEqCode, selectedDept = 'all' }: { onSaved?: () => void, initialEqCode?: string, selectedDept?: string }) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [todayLogs, setTodayLogs] = useState<CheckLog[]>([]);
  const [todaysLogs, setTodaysLogs] = useState<Set<string>>(new Set());
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Mobile Hub View & Filters
  const [hubTab, setHubTab] = useState<'checklist' | 'scan'>('checklist');
  const [checklistFilter, setChecklistFilter] = useState<'pending' | 'completed' | 'exempt' | 'all'>('pending');
  const [searchFilter, setSearchFilter] = useState('');
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Scanner state
  const [scanCode, setScanCode] = useState('');
  const [scanError, setScanError] = useState('');
  const [maintenanceEqToUnlock, setMaintenanceEqToUnlock] = useState<Equipment | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isScanningActive, setIsScanningActive] = useState(false);

  // Video and Canvas refs for native jsQR scanner
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [items, setItems] = useState<CheckItem[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [operatorId, setOperatorId] = useState('');
  const [shift, setShift] = useState<'DAY' | 'NIGHT'>(() => {
    const hr = new Date().getHours();
    return (hr >= 8 && hr < 20) ? 'DAY' : 'NIGHT';
  });
  const [checkType, setCheckType] = useState<string>('all');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [standbyMode, setStandbyMode] = useState<'active' | 'testing' | 'unused'>('active');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const categoryOrder = useMemo(() => {
    return Array.from(new Set(items.map(i => i.category || 'General Checklist')));
  }, [items]);

  const filteredItems = useMemo(() => {
    const shouldSkipOnUse = standbyMode === 'testing' || standbyMode === 'unused';
    return items.filter(item => {
      if (shouldSkipOnUse && item.frequency === 'on-use') return false;
      
      // Filter out items designated exclusively for the other shift
      const itemScope = getCheckItemShiftScope(item);
      if (shift === 'DAY' && itemScope === 'NIGHT') return false;
      if (shift === 'NIGHT' && itemScope === 'DAY') return false;

      if (checkType === 'all') return true;
      if (checkType === 'daily' && (!item.frequency || item.frequency === 'daily')) return true;
      return item.frequency === checkType;
    });
  }, [items, checkType, standbyMode, shift]);

  const hasOnUseItems = useMemo(() => {
    return items.some(item => item.frequency === 'on-use');
  }, [items]);

  const shiftEquipmentsStatus = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const { requiredEqs, exemptEqs } = getEquipmentsStatusForDate(todayStr, shift, equipments, todayLogs);
    const shiftLogs = todayLogs.filter(l => l.shift === shift);

    const checkedList: { eq: Equipment; log: CheckLog }[] = [];
    const pendingList: Equipment[] = [];

    requiredEqs.forEach(eq => {
      const log = shiftLogs.find(l => 
        l.equipmentId === eq.id || 
        l.equipmentId === eq.code || 
        (l.equipmentCode && l.equipmentCode === eq.code)
      );
      if (log) {
        checkedList.push({ eq, log });
      } else {
        pendingList.push(eq);
      }
    });

    return {
      requiredEqs,
      exemptEqs,
      checkedList,
      pendingList,
      progressPercent: requiredEqs.length > 0 ? Math.round((checkedList.length / requiredEqs.length) * 100) : 0
    };
  }, [equipments, todayLogs, shift]);

  useEffect(() => {
    loadEq();
  }, [selectedDept]);

  const loadEq = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    let [eqData, logsData, opData] = await Promise.all([
      fetchEquipments(),
      fetchLogs(today),
      fetchOperators(),
      fetchTimeWindowSettingsAsync()
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

    const nonRetiredEq = eqData.filter(e => e.status !== 'retired');
    setEquipments(nonRetiredEq);
    setTodayLogs(logsData);
    setTodaysLogs(new Set(logsData.map(l => l.equipmentId)));
    setOperators(opData.filter(o => o.isActive));
    setLoading(false);

    if (initialEqCode) {
       const eqToSelect = nonRetiredEq.find(e => e.id === initialEqCode || e.code.toLowerCase() === initialEqCode.toLowerCase());
       if (eqToSelect) {
         if (eqToSelect.status === 'maintenance') {
           setMaintenanceEqToUnlock(eqToSelect);
           setScanError(`⛔ "${eqToSelect.name}" อยู่ในสถานะ [ปิดปรับปรุงซ่อมแซม] ชั่วคราว (สาเหตุ: ${eqToSelect.maintenanceReason || 'ชำรุดเสียหาย'})`);
           return;
         }
         handleSelect(eqToSelect);
       }
    }
  };

  // Robust Equipment Matching Engine (Supports URLs, Doc IDs, Codes, Names with/without spaces and dashes)
  const findMatchingEquipment = (rawText: string): Equipment | undefined => {
    if (!rawText || !rawText.trim()) return undefined;
    
    let target = rawText.trim();
    try {
      if (target.startsWith('http://') || target.startsWith('https://')) {
        const url = new URL(target);
        const param = url.searchParams.get('eqCode') || 
                      url.searchParams.get('id') || 
                      url.searchParams.get('code') || 
                      url.searchParams.get('eq') || 
                      url.searchParams.get('equipmentId') ||
                      url.searchParams.get('machine');
        if (param) {
          target = param.trim();
        } else {
          const parts = url.pathname.split('/').filter(Boolean);
          if (parts.length > 0) {
            target = parts[parts.length - 1].trim();
          }
        }
      }
    } catch (e) {
      // Ignore URL parse error
    }

    const clean = (s: string) => (s || '').toLowerCase().replace(/[\s\-_.:/]/g, '');
    const targetClean = clean(target);

    // 1. Match by Firestore Document ID
    let matched = equipments.find(e => e.id === target || clean(e.id) === targetClean);
    if (matched) return matched;

    // 2. Match by Equipment Code (e.g. PDS-1004, MI-035)
    matched = equipments.find(e => clean(e.code) === targetClean);
    if (matched) return matched;

    // 3. Match by Equipment Name (e.g. MI-035, FTIR, TGA, IV, Gas Day, Gas Night)
    matched = equipments.find(e => clean(e.name) === targetClean);
    if (matched) return matched;

    // 4. Match by Reference Document Number
    matched = equipments.find(e => e.referenceDocNo && clean(e.referenceDocNo) === targetClean);
    if (matched) return matched;

    // 5. Flexible Substring containment for names and codes >= 3 chars
    matched = equipments.find(e => {
      const cCode = clean(e.code);
      const cName = clean(e.name);
      return (
        (targetClean.length >= 3 && (cCode.includes(targetClean) || cName.includes(targetClean))) ||
        (cCode.length >= 3 && targetClean.includes(cCode)) ||
        (cName.length >= 3 && targetClean.includes(cName))
      );
    });

    return matched;
  };

  // High Performance Webcam Stream & Scanner Loop (BarcodeDetector + jsQR Fallback)
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;
    let isCancelled = false;

    if (!showCamera) {
      setIsScanningActive(false);
      return;
    }

    const startCamera = async () => {
      try {
        setScanError('');
        setIsScanningActive(true);

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (isCancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;

        await video.play().catch(err => {
          console.warn("Video play error:", err);
        });

        // Initialize Native Hardware BarcodeDetector if supported by browser
        let barcodeDetector: any = null;
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'data_matrix'] });
          } catch (e) {
            console.warn("BarcodeDetector init:", e);
          }
        }

        const scanCanvas = document.createElement('canvas');
        const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

        const scanLoop = async () => {
          if (isCancelled || !videoRef.current) return;

          const v = videoRef.current;
          if (v && v.videoWidth > 0 && v.videoHeight > 0 && v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            let detectedText: string | null = null;

            // 1. Try Hardware BarcodeDetector first (lightning fast 5ms on modern mobile)
            if (barcodeDetector) {
              try {
                const barcodes = await barcodeDetector.detect(v);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  detectedText = barcodes[0].rawValue;
                }
              } catch (e) {
                // fall through to jsQR
              }
            }

            // 2. Fallback to jsQR with dual-mode inversion
            if (!detectedText && scanCtx) {
              const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
              const sw = Math.floor(v.videoWidth * scale);
              const sh = Math.floor(v.videoHeight * scale);

              if (scanCanvas.width !== sw || scanCanvas.height !== sh) {
                scanCanvas.width = sw;
                scanCanvas.height = sh;
              }

              scanCtx.drawImage(v, 0, 0, sw, sh);
              const imageData = scanCtx.getImageData(0, 0, sw, sh);
              const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth",
              });
              if (qrCode && qrCode.data) {
                detectedText = qrCode.data;
              }
            }

            if (detectedText) {
              handleCodeDetected(detectedText);
              return; // Halt loop once successfully scanned
            }
          }

          if (!isCancelled) {
            animationFrameId = requestAnimationFrame(scanLoop);
          }
        };

        requestAnimationFrame(scanLoop);
      } catch (err: any) {
        console.error("Camera access error:", err);
        setScanError(
          err.name === 'NotAllowedError' 
            ? "กรุณากด 'อนุญาต (Allow)' ให้เบราว์เซอร์เข้าถึงกล้องถ่ายรูป หรือใช้การอัปโหลดภาพถ่าย QR แทน"
            : "ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์การใช้งานกล้อง หรือใช้การอัปโหลดภาพ / พิมพ์รหัสเครื่อง"
        );
        setShowCamera(false);
        setIsScanningActive(false);
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrameId);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      setIsScanningActive(false);
    };
  }, [showCamera, cameraFacing, equipments]);

  const handleCodeDetected = (detectedVal: string) => {
    if (!detectedVal) return;
    const eq = findMatchingEquipment(detectedVal);

    if (eq) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(100); } catch (e) {}
      }
      setShowCamera(false);
      handleSelect(eq);
    } else {
      setScanError(`ไม่พบรหัสเครื่องจักร "${detectedVal}" ในระบบ กรุณาตรวจสอบรหัสหรือแตะเลือกจากรายการด้านล่าง`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        // 1. Try Native BarcodeDetector first on image element
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'data_matrix'] });
            const barcodes = await detector.detect(img);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleCodeDetected(barcodes[0].rawValue);
              return;
            }
          } catch (e) {
            // fallback to jsQR
          }
        }

        // 2. Downscale to max 1000px to ensure jsQR runs in 20ms without memory bloat
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const maxDim = 1000;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth"
          });
          if (code && code.data) {
            handleCodeDetected(code.data);
          } else {
            setScanError("ไม่พบรหัส QR Code ในรูปภาพนี้ กรุณาถ่ายภาพให้ใกล้และชัดเจนยิ่งขึ้น หรือแตะเลือกเครื่องจากรายการด้านล่าง");
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input to allow re-uploading same file
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScanError('');
    if (!scanCode.trim()) return;

    const eq = findMatchingEquipment(scanCode.trim());

    if (eq) {
      handleSelect(eq);
      setScanCode('');
    } else {
      setScanError(`รหัสเครื่องมือไม่ถูกต้อง: "${scanCode}" กรุณาตรวจสอบหรือแตะเลือกจากรายการเครื่องประจำกะ`);
    }
  };

  const handleSelect = async (eq: Equipment) => {
    if (eq.status === 'maintenance') {
      setMaintenanceEqToUnlock(eq);
      setScanError(`⛔ "${eq.name}" อยู่ในสถานะ [ปิดปรับปรุงซ่อมแซม] ชั่วคราว (สาเหตุ: ${eq.maintenanceReason || 'ชำรุดเสียหาย'}) ถูกบล็อกการสแกนจนกว่าทีมช่างจะซ่อมเสร็จ`);
      return;
    }
    setMaintenanceEqToUnlock(null);
    setScanError('');
    try {
      const itms = await fetchCheckItems(eq.id);
      setItems(itms);
      setSelectedEq(eq);
      setResponses({});
      setOperatorId('');
      const eqScope = getEquipmentShiftScope(eq);
      if (eqScope === 'NIGHT') {
        setShift('NIGHT');
      } else if (eqScope === 'DAY') {
        setShift('DAY');
      } else {
        const curHour = new Date().getHours();
        setShift((curHour >= 8 && curHour < 20) ? 'DAY' : 'NIGHT');
      }
      setNotes('');
      setStandbyMode('active');
    } catch (err) {
      console.warn("fetchCheckItems failed", err);
    }
  };

  const handleUnlockRepairedEq = async (eq: Equipment) => {
    const confirmUnlock = window.confirm(`คุณต้องการยืนยันว่าเครื่อง "${eq.name}" ได้รับการซ่อมแซมเสร็จสิ้นแล้ว และต้องการปลดล็อกกลับสู่สถานะ [พร้อมใช้งาน (Active)] เพื่อเริ่มสแกนตรวจทันทีหรือไม่?`);
    if (!confirmUnlock) return;
    
    try {
      setLoading(true);
      const now = Date.now();
      const pastStart = eq.maintenanceAt || (now - 7 * 86400000);
      const existingHistory = eq.maintenanceHistory || [];
      const newHistoryEntry = {
        startedAt: pastStart,
        endedAt: now,
        reason: eq.maintenanceReason || 'ซ่อมแซมเสร็จสิ้น',
        notes: eq.maintenanceNotes || '',
        by: 'ผู้ตรวจหน้างาน'
      };

      const updates: Partial<Equipment> = {
        status: 'active',
        maintenanceReason: '',
        maintenanceNotes: '',
        maintenanceAt: undefined,
        maintenanceBy: undefined,
        unlockedAt: now,
        lastRepairedAt: now,
        maintenanceHistory: [...existingHistory, newHistoryEntry]
      };

      await updateEquipment(eq.id, updates);
      setMaintenanceEqToUnlock(null);
      setScanError('');
      setLastSavedMessage(`✅ ปลดล็อกเครื่อง "${eq.name}" สำเร็จ! เครื่องกลับสู่สถานะพร้อมใช้งานแล้ว`);
      await loadEq();
      const unlockedEq: Equipment = { 
        ...eq, 
        ...updates
      };
      await handleSelect(unlockedEq);
    } catch (e) {
      setFormError("❌ ไม่สามารถปลดล็อกเครื่องได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  const evalIsNormal = (item: CheckItem, value: any): boolean => {
    if (value === undefined || value === null || value === '') return false;
    if (item.type === 'boolean') {
      const boolVal = String(value) === 'true';
      return boolVal === item.expectedBoolean;
    } else if (item.type === 'numeric') {
      const num = Number(value);
      if (isNaN(num)) return false;
      if (typeof item.minValue === 'number' && num < item.minValue) return false;
      if (typeof item.maxValue === 'number' && num > item.maxValue) return false;
      return true;
    }
    return false;
  };

  const handleSetStandbyFromCheck = async () => {
    if (!selectedEq) return;
    if (!operatorId) {
      setFormError("⚠️ กรุณาเลือกชื่อพนักงานผู้รับผิดชอบตรวจเช็กในโซนที่ 1 ก่อน");
      return;
    }

    const confirmSet = window.confirm(`คุณต้องการบันทึกว่าเครื่อง "${selectedEq.name}" (${selectedEq.code}) ในกะ ${shift === 'DAY' ? 'กลางวัน' : 'กลางคืน'} เป็น "ไม่ได้ใช้งาน / เครื่องติดทดสอบ" ใช่หรือไม่?\n\n(ระบบจะบันทึกสถานะให้ทันที เพื่อยืนยันว่าคุณเดินมาตรวจสอบแล้ว และจะไม่ขึ้นค้างตรวจในกะนี้)`);
    if (!confirmSet) return;

    setSaving(true);
    setFormError(null);

    const op = operators.find(o => o.employeeId === operatorId);
    const opName = op ? op.name : operatorId;

    // Create default passing responses for check items applicable to this shift
    const eqItems = items.filter(item => {
      const itemScope = getCheckItemShiftScope(item);
      if (shift === 'DAY' && itemScope === 'NIGHT') return false;
      if (shift === 'NIGHT' && itemScope === 'DAY') return false;
      return true;
    });
    const finalResponses = eqItems.map(item => ({
      checkItemId: item.id!,
      type: item.type,
      itemName: item.name,
      valueBoolean: item.type === 'boolean' ? true : undefined,
      valueNumeric: item.type === 'numeric' ? (item.minValue ?? 0) : undefined,
      isNormal: true
    }));

    try {
      await saveCheckLog({
        equipmentId: selectedEq.id,
        equipmentCode: selectedEq.code,
        equipmentName: selectedEq.name,
        timestamp: Date.now(),
        dateKey: format(new Date(), 'yyyy-MM-dd'),
        shift: shift,
        checkCycle: 'all',
        operatorId: operatorId,
        operatorName: opName,
        status: 'passed',
        notes: 'ไม่ได้ใช้งาน / เครื่องติดทดสอบ (Standby / Testing) - บันทึกจากหน้างาน',
        actionTaken: 'พนักงานเดินมาตรวจสอบหน้าเครื่องแล้วพบว่าไม่ได้ใช้งานหรือติดทำการทดสอบ',
        responses: finalResponses,
        skipOnUse: true,
        isLate: false
      });

      setLastSavedMessage(`🎉 บันทึกสถานะ "ไม่ได้ใช้งาน / เครื่องติดทดสอบ" ของ "${selectedEq.name}" เรียบร้อยแล้ว`);
      setSelectedEq(null);
      setResponses({});
      setNotes('');
      setFormError(null);
      setStandbyMode('active');
      if (onSaved) onSaved();
      loadEq().catch(console.error);
    } catch (err) {
      console.error("Error setting standby log:", err);
      setFormError("❌ ไม่สามารถบันทึกสถานะได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEq || !operatorId) {
      setFormError("⚠️ กรุณาเลือกพนักงานผู้รับผิดชอบตรวจเช็กในโซนที่ 1 ก่อน");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const op = operators.find(o => o.employeeId === operatorId);
      const opName = op ? op.name : operatorId;

      // Validate that all required items are answered
      const unansweredItem = filteredItems.find(item => item.isRequired && (responses[item.id!] === undefined || responses[item.id!] === ''));
      if (unansweredItem) {
        setFormError(`⚠️ กรุณาทำรายการตรวจหรือระบุค่าสำหรับข้อ: "${unansweredItem.name}" ก่อนส่งบันทึก`);
        setSaving(false);
        return;
      }
      let allNormal = true;
      const applicableItems = items.filter(item => {
        const itemScope = getCheckItemShiftScope(item);
        if (shift === 'DAY' && itemScope === 'NIGHT') return false;
        if (shift === 'NIGHT' && itemScope === 'DAY') return false;
        return true;
      });
      const finalResponses: CheckResponse[] = applicableItems.map(item => {
         const shouldSkipOnUse = standbyMode === 'testing' || standbyMode === 'unused';
         const isFilteredOut = shouldSkipOnUse && item.frequency === 'on-use';
         if (isFilteredOut) {
            return {
               checkItemId: item.id!,
               type: item.type,
               itemName: item.name,
               isNormal: true,
               valueBoolean: item.type === 'boolean' ? true : undefined,
               valueNumeric: item.type === 'numeric' ? (item.minValue ?? 0) : undefined,
            };
         }

         const val = responses[item.id!];
         const normal = evalIsNormal(item, val);
         if (!normal) allNormal = false;
         
         const resp: any = {
           checkItemId: item.id,
           type: item.type,
           itemName: item.name,
           isNormal: normal
         };
         if (item.type === 'boolean') {
             resp.valueBoolean = val === 'true' || val === true;
         } else if (item.type === 'numeric') {
             resp.valueNumeric = Number(val);
         }
         return resp;
      });

      const logStatus = allNormal ? 'passed' : 'needs_attention';
      const computedNotes = notes ? notes : (allNormal ? 'ทุกรายการปกติ' : 'พบรายการตกเกณฑ์หรือหลุดค่าควบคุมมาตรฐาน');

      const standbyNotePrefix = standbyMode === 'testing'
         ? 'เครื่องติดคิวทดสอบอยู่ (Testing)'
         : standbyMode === 'unused'
           ? 'ไม่มีการใช้งานเครื่อง (Unused)'
           : '';

      const finalNotes = standbyNotePrefix
         ? `${standbyNotePrefix}${notes ? ` - ${notes}` : ''}`
         : computedNotes;

      const checkIfLate = (shiftVal: string, timestamp: number) => {
        const tw = fetchTimeWindowSettings();
        const date = new Date(timestamp);
        const hrs = date.getHours();
        const mins = date.getMinutes();
        const timeValue = hrs * 60 + mins;

        if (shiftVal === 'DAY') {
          const [sh, sm] = tw.dayStart.split(':').map(Number);
          const [eh, em] = tw.dayEnd.split(':').map(Number);
          const startVal = sh * 60 + sm;
          const endVal = eh * 60 + em;
          return timeValue < startVal || timeValue > endVal;
        } else if (shiftVal === 'NIGHT') {
          const [sh, sm] = tw.nightStart.split(':').map(Number);
          const [eh, em] = tw.nightEnd.split(':').map(Number);
          const startVal = sh * 60 + sm;
          const endVal = eh * 60 + em;
          
          if (startVal <= endVal) {
            return timeValue < startVal || timeValue > endVal;
          } else {
            return timeValue < startVal && timeValue > endVal;
          }
        }
        return false;
      };

      const isCheckLate = checkIfLate(shift, Date.now());

      await saveCheckLog({
        equipmentId: selectedEq.id,
        equipmentCode: selectedEq.code,
        equipmentName: selectedEq.name,
        timestamp: Date.now(),
        dateKey: format(new Date(), 'yyyy-MM-dd'),
        shift: shift,
        checkCycle: checkType,
        operatorId: operatorId,
        operatorName: opName,
        status: logStatus,
        notes: finalNotes,
        actionTaken: notes || standbyNotePrefix,
        responses: finalResponses,
        skipOnUse: standbyMode !== 'active',
        isLate: isCheckLate
      });

      setLastSavedMessage(`🎉 บันทึกผลการตรวจสอบเครื่อง "${selectedEq.name}" (${selectedEq.code}) เรียบร้อยแล้ว!`);
      setSelectedEq(null);
      setResponses({});
      setNotes('');
      setFormError(null);
      setStandbyMode('active');
      if (onSaved) onSaved();
      loadEq().catch(console.error);
    } catch (error) {
      console.error("Error saving log:", error);
      setFormError("❌ ไม่สามารถบันทึกรายงานได้สำเร็จ กรุณาตรวจสอบข้อมูลการบันทึกของคุณและลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustValue = (itemId: string, increment: boolean, minValue?: number, maxValue?: number) => {
    const currentVal = responses[itemId] !== undefined && responses[itemId] !== '' ? Number(responses[itemId]) : (minValue || 0);
    const step = 0.1;
    const newVal = increment ? currentVal + step : currentVal - step;
    
    // Format to 1 decimal place to prevent floating point issues
    const rounded = Math.round(newVal * 10) / 10;
    setResponses({
      ...responses,
      [itemId]: rounded.toString()
    });
  };

  if (loading && equipments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400">
        <RefreshCcw className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-semibold tracking-wider uppercase">กำลังตรวจสอบอุปกรณ์เชื่อมต่อ...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
       <AnimatePresence mode="wait">
        {!selectedEq ? (
          /* MOBILE INSPECTION HUB & SCANNER */
          <motion.div 
            key="hub"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-4 sm:space-y-5"
          >
             {/* In-App Toast / Success Message */}
             {lastSavedMessage && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-between gap-3 text-xs sm:text-sm font-black"
               >
                 <div className="flex items-center gap-2.5">
                   <CheckCircle className="w-5 h-5 shrink-0 text-emerald-200" />
                   <span>{lastSavedMessage}</span>
                 </div>
                 <button 
                   type="button" 
                   onClick={() => setLastSavedMessage(null)}
                   className="p-1 hover:bg-emerald-700 rounded-lg text-emerald-100 transition-colors cursor-pointer"
                 >
                   <X className="w-4 h-4" />
                 </button>
               </motion.div>
             )}

             {/* In-App Error Banner */}
             {formError && (
               <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center justify-between gap-2">
                 <span>{formError}</span>
                 <button type="button" onClick={() => setFormError(null)} className="text-rose-500 hover:text-rose-700">
                   <X className="w-4 h-4" />
                 </button>
               </div>
             )}

             {/* Interactive Shift Overview Widget */}
             <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-4 sm:p-5 space-y-4 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none"></div>

               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                 <div>
                   <div className="flex items-center gap-2">
                     <span className={cn(
                       "px-2.5 py-1 rounded-full text-[11px] font-black flex items-center gap-1.5 shadow-2xs",
                       shift === 'DAY' ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-indigo-50 text-indigo-800 border border-indigo-200"
                     )}>
                       {shift === 'DAY' ? <Sun className="w-3.5 h-3.5 text-amber-600" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
                       {shift === 'DAY' ? 'กะกลางวัน (08:00 - 20:00)' : 'กะกลางคืน (20:00 - 08:00)'}
                     </span>
                     <span className="text-[11px] font-mono font-bold text-slate-400">
                       {format(new Date(), 'dd/MM/yyyy')}
                     </span>
                   </div>
                   <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1 tracking-tight">
                     สถานะการตรวจเช็กประจำกะ
                   </h2>
                 </div>

                 {/* Quick Shift Switcher */}
                 <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto border border-slate-200/60">
                   <button
                     type="button"
                     onClick={() => setShift('DAY')}
                     className={cn(
                       "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                       shift === 'DAY' ? "bg-white text-amber-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                     )}
                   >
                     <Sun className="w-3.5 h-3.5 text-amber-500" />
                     <span>กะเช้า</span>
                   </button>
                   <button
                     type="button"
                     onClick={() => setShift('NIGHT')}
                     className={cn(
                       "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                       shift === 'NIGHT' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                     )}
                   >
                     <Moon className="w-3.5 h-3.5 text-indigo-500" />
                     <span>กะดึก</span>
                   </button>
                 </div>
               </div>

               {/* Progress bar */}
               <div className="relative z-10">
                 <div className="flex justify-between text-xs font-black text-slate-700 mb-1.5">
                   <span className="flex items-center gap-1.5">
                     <span>ความคืบหน้ารวม</span>
                     {shiftEquipmentsStatus.pendingList.length === 0 && shiftEquipmentsStatus.requiredEqs.length > 0 && (
                       <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                         <Sparkles className="w-3 h-3 text-emerald-500" /> ตรวจครบ 100% แล้ว!
                       </span>
                     )}
                   </span>
                   <span className="font-mono text-indigo-600 font-black">
                     {shiftEquipmentsStatus.checkedList.length} / {shiftEquipmentsStatus.requiredEqs.length} เครื่อง ({shiftEquipmentsStatus.progressPercent}%)
                   </span>
                 </div>
                 <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                   <div 
                     className={cn(
                       "h-full rounded-full transition-all duration-500",
                       shiftEquipmentsStatus.pendingList.length === 0 
                         ? "bg-emerald-500" 
                         : "bg-gradient-to-r from-indigo-500 to-indigo-600"
                     )}
                     style={{ width: `${Math.min(100, shiftEquipmentsStatus.progressPercent)}%` }}
                   />
                 </div>
               </div>

               {/* Three Interactive Metric Filter Cards */}
               <div className="grid grid-cols-3 gap-2 pt-1 relative z-10">
                 <button
                   type="button"
                   onClick={() => { setHubTab('checklist'); setChecklistFilter('pending'); }}
                   className={cn(
                     "p-2.5 sm:p-3 rounded-2xl border text-left transition-all cursor-pointer",
                     checklistFilter === 'pending' && hubTab === 'checklist' 
                       ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400/20 shadow-xs" 
                       : "bg-slate-50 border-slate-200 hover:bg-rose-50/50 hover:border-rose-200"
                   )}
                 >
                   <div className="flex items-center gap-1.5 text-rose-600 font-black text-[10px] uppercase">
                     <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                     ค้างตรวจ
                   </div>
                   <p className="text-lg sm:text-xl font-black text-slate-900 mt-1 font-mono">
                     {shiftEquipmentsStatus.pendingList.length}
                   </p>
                   <p className="text-[10px] text-slate-500 truncate font-semibold">ต้องรีบดำเนินการ</p>
                 </button>

                 <button
                   type="button"
                   onClick={() => { setHubTab('checklist'); setChecklistFilter('completed'); }}
                   className={cn(
                     "p-2.5 sm:p-3 rounded-2xl border text-left transition-all cursor-pointer",
                     checklistFilter === 'completed' && hubTab === 'checklist' 
                       ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs" 
                       : "bg-slate-50 border-slate-200 hover:bg-emerald-50/50 hover:border-emerald-200"
                   )}
                 >
                   <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[10px] uppercase">
                     <CheckCircle className="w-3 h-3 text-emerald-500" />
                     ตรวจแล้ว
                   </div>
                   <p className="text-lg sm:text-xl font-black text-slate-900 mt-1 font-mono">
                     {shiftEquipmentsStatus.checkedList.length}
                   </p>
                   <p className="text-[10px] text-slate-500 truncate font-semibold">ผ่านการบันทึก</p>
                 </button>

                 <button
                   type="button"
                   onClick={() => { setHubTab('checklist'); setChecklistFilter('exempt'); }}
                   className={cn(
                     "p-2.5 sm:p-3 rounded-2xl border text-left transition-all cursor-pointer",
                     checklistFilter === 'exempt' && hubTab === 'checklist' 
                       ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/20 shadow-xs" 
                       : "bg-slate-50 border-slate-200 hover:bg-amber-50/50 hover:border-amber-200"
                   )}
                 >
                   <div className="flex items-center gap-1.5 text-amber-600 font-black text-[10px] uppercase">
                     <Wrench className="w-3 h-3 text-amber-500" />
                     ปิดซ่อม
                   </div>
                   <p className="text-lg sm:text-xl font-black text-slate-900 mt-1 font-mono">
                     {shiftEquipmentsStatus.exemptEqs.length}
                   </p>
                   <p className="text-[10px] text-slate-500 truncate font-semibold">ยกเว้นตรวจ</p>
                 </button>
               </div>
             </div>

             {/* Mode Switcher Segmented Bar */}
             <div className="grid grid-cols-2 gap-2 bg-slate-200/80 p-1.5 rounded-2xl shadow-inner">
               <button
                 type="button"
                 onClick={() => setHubTab('checklist')}
                 className={cn(
                   "py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer",
                   hubTab === 'checklist' 
                     ? "bg-white text-indigo-700 shadow-sm" 
                     : "text-slate-600 hover:text-slate-900"
                 )}
               >
                 <ListChecks className="w-4 h-4 text-indigo-600" />
                 <span>รายการเครื่องประจำกะ</span>
                 {shiftEquipmentsStatus.pendingList.length > 0 && (
                   <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-mono font-bold">
                     {shiftEquipmentsStatus.pendingList.length}
                   </span>
                 )}
               </button>

               <button
                 type="button"
                 onClick={() => { setHubTab('scan'); setShowCamera(false); setScanError(''); }}
                 className={cn(
                   "py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer",
                   hubTab === 'scan' 
                     ? "bg-white text-indigo-700 shadow-sm" 
                     : "text-slate-600 hover:text-slate-900"
                 )}
               >
                 <Camera className="w-4 h-4 text-indigo-600" />
                 <span>สแกน QR โค้ด</span>
               </button>
             </div>

             {/* TAB 1: CHECKLIST VIEW (What floor operators asked for!) */}
             {hubTab === 'checklist' && (
               <div className="space-y-4">
                 {/* Sub-filter tabs & Search Bar */}
                 <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm space-y-3">
                   {/* Search Input */}
                   <div className="relative">
                     <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                     <input 
                       type="text"
                       value={searchFilter}
                       onChange={e => setSearchFilter(e.target.value)}
                       placeholder="ค้นหาชื่อเครื่อง, รหัส (เช่น MI-035, TGA)..."
                       className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white"
                     />
                     {searchFilter && (
                       <button 
                         type="button" 
                         onClick={() => setSearchFilter('')}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                       >
                         <X className="w-3.5 h-3.5" />
                       </button>
                     )}
                   </div>

                   {/* Sub-filters Pills */}
                   <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                     <button
                       type="button"
                       onClick={() => setChecklistFilter('pending')}
                       className={cn(
                         "px-3 py-1.5 rounded-xl font-black whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 text-xs",
                         checklistFilter === 'pending'
                           ? "bg-rose-600 text-white shadow-xs"
                           : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                       )}
                     >
                       <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                       <span>ค้างตรวจ ({shiftEquipmentsStatus.pendingList.length})</span>
                     </button>

                     <button
                       type="button"
                       onClick={() => setChecklistFilter('completed')}
                       className={cn(
                         "px-3 py-1.5 rounded-xl font-black whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 text-xs",
                         checklistFilter === 'completed'
                           ? "bg-emerald-600 text-white shadow-xs"
                           : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                       )}
                     >
                       <Check className="w-3.5 h-3.5" />
                       <span>ตรวจเสร็จแล้ว ({shiftEquipmentsStatus.checkedList.length})</span>
                     </button>

                     {shiftEquipmentsStatus.exemptEqs.length > 0 && (
                       <button
                         type="button"
                         onClick={() => setChecklistFilter('exempt')}
                         className={cn(
                           "px-3 py-1.5 rounded-xl font-black whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 text-xs",
                           checklistFilter === 'exempt'
                             ? "bg-amber-600 text-white shadow-xs"
                             : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                         )}
                       >
                         <Wrench className="w-3.5 h-3.5" />
                         <span>ปิดซ่อม ({shiftEquipmentsStatus.exemptEqs.length})</span>
                       </button>
                     )}

                     <button
                       type="button"
                       onClick={() => setChecklistFilter('all')}
                       className={cn(
                         "px-3 py-1.5 rounded-xl font-black whitespace-nowrap transition-all cursor-pointer text-xs",
                         checklistFilter === 'all'
                           ? "bg-slate-900 text-white shadow-xs"
                           : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                       )}
                     >
                       <span>ทั้งหมด ({shiftEquipmentsStatus.requiredEqs.length})</span>
                     </button>
                   </div>
                 </div>

                 {/* Machine Cards List */}
                 <div className="space-y-3">
                   {/* PENDING LIST */}
                   {(checklistFilter === 'pending' || checklistFilter === 'all') && (
                     <>
                       {checklistFilter === 'all' && (
                         <div className="flex items-center gap-2 pt-2">
                           <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                           <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                             รายการที่ยังค้างตรวจ ({shiftEquipmentsStatus.pendingList.length} เครื่อง)
                           </h4>
                         </div>
                       )}

                       {shiftEquipmentsStatus.pendingList.length === 0 ? (
                         checklistFilter === 'pending' && (
                           <div className="bg-white rounded-3xl border border-emerald-200 p-8 text-center space-y-3 shadow-sm">
                             <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-100 shadow-inner">
                               <Sparkles className="w-8 h-8 text-emerald-600 animate-bounce" />
                             </div>
                             <h4 className="text-base font-black text-slate-900">ตรวจครบถ้วนทุกเครื่องในกะนี้แล้ว!</h4>
                             <p className="text-xs text-slate-500 max-w-sm mx-auto">
                               เครื่องจักรทุกเครื่องที่ต้องตรวจใน{shift === 'DAY' ? 'กะเช้า' : 'กะดึก'}ได้รับการบันทึกครบถ้วน 100% สอดคล้องตามเกณฑ์มาตรฐาน
                             </p>
                             <button
                               type="button"
                               onClick={() => setChecklistFilter('completed')}
                               className="px-4 py-2 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-200"
                             >
                               ดูรายการเครื่องที่ตรวจเสร็จแล้ว ({shiftEquipmentsStatus.checkedList.length})
                             </button>
                           </div>
                         )
                       ) : (
                         shiftEquipmentsStatus.pendingList
                           .filter(eq => {
                             if (!searchFilter) return true;
                             const q = searchFilter.toLowerCase();
                             return eq.name.toLowerCase().includes(q) || eq.code.toLowerCase().includes(q) || (eq.location || '').toLowerCase().includes(q);
                           })
                           .map(eq => (
                             <div 
                               key={eq.id}
                               className="bg-white rounded-2xl border border-rose-200/80 p-4 shadow-sm hover:shadow-md transition-all space-y-3 group"
                             >
                               <div className="flex items-start justify-between gap-3">
                                 <div className="min-w-0">
                                   <div className="flex items-center gap-2 mb-1 flex-wrap">
                                     <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-mono font-black border border-rose-200">
                                       {eq.code}
                                     </span>
                                     <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-bold">
                                       🔴 ยังไม่ตรวจ
                                     </span>
                                     {getEquipmentShiftScope(eq) === 'DAY' && (
                                       <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                         กะเช้าเท่านั้น
                                       </span>
                                     )}
                                     {getEquipmentShiftScope(eq) === 'NIGHT' && (
                                       <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                         กะดึกเท่านั้น
                                       </span>
                                     )}
                                   </div>
                                   <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                                     {eq.name}
                                   </h3>
                                   <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                     <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                     <span>{(eq.location || 'คลังทดสอบ').replace('น้อง', 'ห้อง')}</span>
                                   </p>
                                 </div>
                               </div>

                               {/* Action Buttons */}
                               <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                                 <button
                                   type="button"
                                   onClick={() => handleSelect(eq)}
                                   className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                 >
                                   <Zap className="w-4 h-4 fill-white" />
                                   <span>⚡ ตรวจเครื่องนี้</span>
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => {
                                     setScanCode(eq.code);
                                     setHubTab('scan');
                                     setShowCamera(true);
                                     setScanError('');
                                   }}
                                   className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                   title="สแกน QR หน้าเครื่อง"
                                 >
                                   <Camera className="w-4 h-4 text-slate-600" />
                                   <span>สแกน QR</span>
                                 </button>
                                </div>
                             </div>
                           ))
                       )}
                     </>
                   )}

                   {/* COMPLETED LIST */}
                   {(checklistFilter === 'completed' || checklistFilter === 'all') && (
                     <>
                       {checklistFilter === 'all' && shiftEquipmentsStatus.checkedList.length > 0 && (
                         <div className="flex items-center gap-2 pt-4">
                           <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                           <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                             รายการที่ตรวจเสร็จแล้ว ({shiftEquipmentsStatus.checkedList.length} เครื่อง)
                           </h4>
                         </div>
                       )}

                       {checklistFilter === 'completed' && shiftEquipmentsStatus.checkedList.length === 0 && (
                         <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-2 text-slate-400">
                           <Clock className="w-10 h-10 mx-auto text-slate-300" />
                           <p className="text-xs font-bold">ยังไม่มีเครื่องที่ตรวจเสร็จในกะนี้</p>
                           <button
                             type="button"
                             onClick={() => setChecklistFilter('pending')}
                             className="text-indigo-600 text-xs font-bold hover:underline"
                           >
                             ไปที่รายการค้างตรวจ ({shiftEquipmentsStatus.pendingList.length})
                           </button>
                         </div>
                       )}

                       {shiftEquipmentsStatus.checkedList
                         .filter(({ eq }) => {
                           if (!searchFilter) return true;
                           const q = searchFilter.toLowerCase();
                           return eq.name.toLowerCase().includes(q) || eq.code.toLowerCase().includes(q) || (eq.location || '').toLowerCase().includes(q);
                         })
                         .map(({ eq, log }) => (
                           <div 
                             key={log.id || eq.id}
                             className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-2xs space-y-2.5"
                           >
                             <div className="flex items-start justify-between gap-3">
                               <div className="min-w-0">
                                 <div className="flex items-center gap-2 mb-1 flex-wrap">
                                   <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-mono font-black border border-emerald-200">
                                     {eq.code}
                                   </span>
                                   <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-bold flex items-center gap-1">
                                     <Check className="w-3 h-3 text-emerald-600" /> ตรวจเสร็จแล้ว
                                   </span>
                                   <span className="text-[10px] font-mono font-bold text-slate-400">
                                     ⏰ {format(new Date(log.timestamp), 'HH:mm')} น.
                                   </span>
                                 </div>
                                 <h3 className="text-sm font-black text-slate-900 truncate">
                                   {eq.name}
                                 </h3>
                                 <p className="text-[11px] text-slate-500 font-medium">
                                   ผู้ตรวจ: <span className="font-bold text-slate-700">{log.operatorName}</span> · {log.notes || 'ทุกรายการปกติ'}
                                 </p>
                               </div>

                               <button
                                 type="button"
                                 onClick={() => handleSelect(eq)}
                                 className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[11px] rounded-xl border border-slate-200 transition-colors shrink-0 cursor-pointer"
                               >
                                 ตรวจซ้ำ / แก้ไข
                               </button>
                             </div>
                           </div>
                         ))}
                     </>
                   )}

                   {/* EXEMPT LIST */}
                   {(checklistFilter === 'exempt' || checklistFilter === 'all') && shiftEquipmentsStatus.exemptEqs.length > 0 && (
                     <>
                       {checklistFilter === 'all' && (
                         <div className="flex items-center gap-2 pt-4">
                           <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                           <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                             เครื่องยกเว้น / อยู่ระหว่างปิดซ่อม ({shiftEquipmentsStatus.exemptEqs.length} เครื่อง)
                           </h4>
                         </div>
                       )}

                       {shiftEquipmentsStatus.exemptEqs.map(eq => (
                         <div 
                           key={eq.id}
                           className="bg-amber-50/50 rounded-2xl border border-amber-200 p-4 shadow-2xs space-y-2"
                         >
                           <div className="flex items-start justify-between gap-3">
                             <div className="min-w-0">
                               <div className="flex items-center gap-2 mb-1">
                                 <span className="px-2 py-0.5 rounded-md bg-white text-amber-800 text-[10px] font-mono font-black border border-amber-300">
                                   {eq.code}
                                 </span>
                                 <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-bold">
                                   🛠️ ปิดปรับปรุงซ่อมแซม
                                 </span>
                               </div>
                               <h3 className="text-sm font-black text-slate-900">{eq.name}</h3>
                               <p className="text-[11px] text-amber-900 font-medium">
                                 สาเหตุ: {eq.maintenanceReason || 'อยู่ระหว่างปิดซ่อมแซม (ระบบยกเว้นให้อัตโนมัติ)'}
                               </p>
                             </div>

                             <button
                               type="button"
                               onClick={() => handleUnlockRepairedEq(eq)}
                               className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl shadow-xs transition-all shrink-0 cursor-pointer flex items-center gap-1"
                             >
                               <Wrench className="w-3.5 h-3.5" />
                               <span>ปลดล็อกซ่อมเสร็จ</span>
                             </button>
                           </div>
                         </div>
                       ))}
                     </>
                   )}
                 </div>
               </div>
             )}

             {/* TAB 2: QR SCANNER VIEW */}
             {hubTab === 'scan' && (
               <div className="bg-white border border-slate-200/80 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col items-center p-6 sm:p-10 relative group">
                 <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                 
                 <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl flex items-center justify-center mb-5 shadow-inner border border-indigo-100/50">
                    <ScanLine className="w-8 h-8 text-indigo-600 animate-pulse" />
                 </div>
                 
                 {showCamera ? (
                   <div className="w-full aspect-square max-w-[280px] bg-slate-950 rounded-[2rem] overflow-hidden shadow-2xl mb-6 relative border-4 border-slate-100 ring-1 ring-slate-200/50">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover" 
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      
                      {/* Switch Camera Button */}
                      <button
                        type="button"
                        onClick={() => setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment')}
                        className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-full transition-all cursor-pointer z-20 shadow-md active:scale-95 flex items-center justify-center"
                        title="สลับกล้องหน้า/หลัง"
                      >
                        <SwitchCamera className="w-4 h-4" />
                      </button>

                      {/* Scanning Live Badge */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full flex items-center gap-1.5 z-20 shadow-md">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        <span className="text-[10px] text-white font-bold">กำลังสแกนสด...</span>
                      </div>

                      {/* Glowing Scan Bar */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-bounce shadow-[0_0_15px_rgba(79,70,229,0.8)] pointer-events-none"></div>
                      
                      {/* QR corner reticles */}
                      <div className="absolute top-8 left-8 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg pointer-events-none"></div>
                      <div className="absolute top-8 right-8 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg pointer-events-none"></div>
                      <div className="absolute bottom-12 left-8 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg pointer-events-none"></div>
                      <div className="absolute bottom-12 right-8 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-lg pointer-events-none"></div>

                      <button 
                        type="button"
                        onClick={() => setShowCamera(false)} 
                        className="absolute bottom-3 left-1/2 transform -translate-x-1/2 px-4 py-1.5 bg-rose-600 text-white font-bold rounded-xl shadow-lg text-[10px] hover:bg-rose-500 cursor-pointer z-20 active:scale-95"
                      >
                        ปิดกล้องสแกน
                      </button>
                   </div>
                 ) : (
                   <div className="w-full max-w-[280px] space-y-3 mb-6">
                      <button 
                        type="button"
                        onClick={() => { setShowCamera(true); setScanError(''); }}
                        className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2.5 cursor-pointer relative overflow-hidden active:scale-95"
                      >
                        <Camera className="w-5 h-5 shrink-0" />
                        <span className="text-sm tracking-wide">สแกนรหัสผ่านกล้องถ่ายรูป</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 px-6 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200/80 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-slate-500" />
                        <span>อัปโหลดภาพถ่ายคิวอาร์ (QR)</span>
                      </button>
                      <input 
                        ref={fileInputRef} 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        onChange={handleFileUpload} 
                        className="hidden" 
                      />
                   </div>
                 )}

                 {/* Manual entry override */}
                 <form onSubmit={handleManualSubmit} className="w-full pt-4 border-t border-slate-100 flex gap-2">
                   <input 
                     type="text"
                     value={scanCode}
                     onChange={e => setScanCode(e.target.value)}
                     placeholder="กรอกรหัสเครื่องจักรด้วยตัวเอง (เช่น MI-035)"
                     className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-semibold placeholder:text-slate-400"
                   />
                   <button 
                     type="submit"
                     className="px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                   >
                     ตรวจสอบรหัส
                   </button>
                 </form>

                 {scanError && (
                   <div className="mt-4 p-4 text-xs bg-rose-50 border border-rose-200 rounded-2xl space-y-3 w-full shadow-xs">
                     <div className="flex items-start gap-2.5 text-rose-800 font-bold leading-relaxed">
                       <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                       <span>{scanError}</span>
                     </div>
                     {maintenanceEqToUnlock && (
                       <div className="pt-2.5 border-t border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white/70 p-3 rounded-xl border border-rose-100">
                         <div>
                           <p className="text-[11px] text-rose-900 font-black">เครื่องได้รับการซ่อมแซมเสร็จสิ้นแล้ว?</p>
                           <p className="text-[10px] text-slate-500">สามารถกดปลดล็อกเพื่อเริ่มบันทึกตรวจเช็กได้ทันที</p>
                         </div>
                         <button
                           type="button"
                           onClick={() => handleUnlockRepairedEq(maintenanceEqToUnlock)}
                           className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
                         >
                           <Wrench className="w-3.5 h-3.5" />
                           <span>ปลดล็อกเครื่องซ่อมเสร็จ</span>
                         </button>
                       </div>
                     )}
                   </div>
                 )}

                 {/* Quick Pending Machines Mini-list while on Scanner */}
                 {shiftEquipmentsStatus.pendingList.length > 0 && (
                   <div className="w-full mt-6 pt-5 border-t border-slate-100">
                     <div className="flex items-center justify-between mb-3">
                       <p className="text-[11px] font-black text-rose-600 flex items-center gap-1.5">
                         <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                         เครื่องที่ยังค้างตรวจ ({shiftEquipmentsStatus.pendingList.length} เครื่อง)
                       </p>
                       <button
                         type="button"
                         onClick={() => { setHubTab('checklist'); setChecklistFilter('pending'); }}
                         className="text-[10px] font-bold text-indigo-600 hover:underline"
                       >
                         ดูทั้งหมด →
                       </button>
                     </div>
                     <div className="flex gap-2 overflow-x-auto pb-2">
                       {shiftEquipmentsStatus.pendingList.map(eq => (
                         <button
                           key={eq.id}
                           type="button"
                           onClick={() => handleSelect(eq)}
                           className="p-2.5 bg-slate-50 hover:bg-rose-50 rounded-xl border border-slate-200 hover:border-rose-300 text-left shrink-0 w-36 transition-all cursor-pointer group"
                         >
                           <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-white border border-slate-200 text-slate-700">
                             {eq.code}
                           </span>
                           <p className="text-xs font-black text-slate-800 mt-1 truncate group-hover:text-rose-600">
                             {eq.name}
                           </p>
                           <p className="text-[9px] text-slate-400 truncate">
                             {(eq.location || '').replace('น้อง', 'ห้อง')}
                           </p>
                         </button>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
             )}

             {/* Anti-fraud Advisory */}
             <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-300/60 flex gap-3 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-extrabold text-amber-800 uppercase tracking-wide">มาตรการป้องกันทุจริตในสถานประกอบการ</h3>
                  <p className="text-amber-700 leading-relaxed font-medium">
                    ผู้ตรวจต้องสแกนคิวอาร์โค้ดทางกายภาพหรือตรวจสอบหน้าเครื่องจริงตามรายการ สามารถสแกนกล้อง หรือแตะเลือกเครื่องจากรายการประจำกะด้านบนเพื่อบันทึกผลได้ทันที
                  </p>
                </div>
             </div>
          </motion.div>
        ) : (
          /* FORM SUBMISSION STATE FOR MOBILE - Organized in Clear Tactile Zones */
          <motion.div 
             key="form"
             initial={{ opacity: 0, y: 15 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -15 }}
             className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200/60"
          >
             {/* Header Title Bar */}
             <div className="bg-slate-900 p-6 relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                
                <div className="flex items-center gap-4 relative z-10">
                  <button 
                   type="button"
                   onClick={() => setSelectedEq(null)}
                   className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-all backdrop-blur-md border border-white/10 cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                     <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-100 text-[9px] font-bold uppercase tracking-wider border border-indigo-400/20">แบบตรวจสอบ</span>
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-white text-[9px] font-mono font-bold tracking-widest border border-white/10">{selectedEq.code}</span>
                        {getEquipmentShiftScope(selectedEq) === 'DAY' && (
                           <span className="px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-200 text-[9px] font-bold border border-amber-400/20">
                             ☀️ ตรวจเฉพาะกะเช้า
                           </span>
                        )}
                        {getEquipmentShiftScope(selectedEq) === 'NIGHT' && (
                           <span className="px-2 py-0.5 rounded-md bg-indigo-500/40 text-indigo-200 text-[9px] font-bold border border-indigo-300/30">
                             🌙 ตรวจเฉพาะกะดึก
                           </span>
                        )}
                     </div>
                     <h2 className="text-xl sm:text-2xl font-black text-white leading-tight truncate">{selectedEq.name}</h2>
                     <p className="text-indigo-300 text-[10px] sm:text-xs font-semibold truncate mt-0.5">สถานที่: {(selectedEq.location || 'คลังทดสอบ').replace('น้อง', 'ห้อง')}</p>
                  </div>
                </div>
             </div>

             {/* Shift Mismatch Advisory Banner */}
             {shift === 'DAY' && getEquipmentShiftScope(selectedEq) === 'NIGHT' && (
                <div className="mx-6 mt-4 p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-2.5 text-indigo-900 text-xs font-bold">
                   <span className="text-base shrink-0">🌙</span>
                   <span>หมายเหตุ: เครื่องนี้เป็นรายการตรวจเฉพาะ [กะดึก] หากไม่มีการตรวจในกะเช้า จะไม่นำไปคิดเป็นรายการค้างตรวจของกะเช้า</span>
                </div>
             )}
             {shift === 'NIGHT' && getEquipmentShiftScope(selectedEq) === 'DAY' && (
                <div className="mx-6 mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-amber-900 text-xs font-bold">
                   <span className="text-base shrink-0">☀️</span>
                   <span>หมายเหตุ: เครื่องนี้เป็นรายการตรวจเฉพาะ [กะเช้า] หากไม่มีการตรวจในกะดึก จะไม่นำไปคิดเป็นรายการค้างตรวจของกะดึก</span>
                </div>
             )}

             <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 bg-slate-50/50">
                {/* ZONE 1: ผู้สแกนตรวจและกะการบันทึก (Inspector Info Card) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                  <h3 className="text-xs font-extrabold text-indigo-700 tracking-wider uppercase flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    โซนที่ 1: ข้อมูลผู้บันทึกตรวจหน้างาน
                  </h3>
                  
                  {/* Operator ID Dropdown styled beautifully */}
                  <div>
                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">ชื่อพนักงานผู้รับผิดชอบตรวจเช็ก *</label>
                    <div className="relative">
                      <select 
                        required 
                        value={operatorId}
                        onChange={e => {
                          const val = e.target.value;
                          setOperatorId(val);
                          const op = operators.find(o => o.employeeId === val);
                          if (op) {
                            const today = new Date();
                            const anchorDate = new Date('2026-01-01T00:00:00');
                            const diffDays = differenceInCalendarDays(today, anchorDate);
                            const opClass = op.classification || 'employee';
                            const opGroup = op.shiftGroup || 'A';
                            
                            if (opClass === 'assistant') {
                              const cycleDay = ((diffDays % 18) + 18) % 18 + 1;
                              let dayGroup = 'C';
                              let nightGroup = 'A';
                              
                              if (cycleDay >= 1 && cycleDay <= 2) { dayGroup = 'C'; nightGroup = 'A'; }
                              else if (cycleDay >= 3 && cycleDay <= 4) { dayGroup = 'B'; nightGroup = 'A'; }
                              else if (cycleDay >= 5 && cycleDay <= 6) { dayGroup = 'B'; nightGroup = 'C'; }
                              else if (cycleDay >= 7 && cycleDay <= 8) { dayGroup = 'A'; nightGroup = 'C'; }
                              else if (cycleDay >= 9 && cycleDay <= 10) { dayGroup = 'A'; nightGroup = 'B'; }
                              else if (cycleDay >= 11 && cycleDay <= 12) { dayGroup = 'C'; nightGroup = 'B'; }
                              else if (cycleDay >= 13 && cycleDay <= 14) { dayGroup = 'C'; nightGroup = 'A'; }
                              else if (cycleDay >= 15 && cycleDay <= 16) { dayGroup = 'B'; nightGroup = 'A'; }
                              else if (cycleDay >= 17 && cycleDay <= 18) { dayGroup = 'B'; nightGroup = 'C'; }
                              
                              if (opGroup === dayGroup) {
                                setShift('DAY');
                              } else if (opGroup === nightGroup) {
                                setShift('NIGHT');
                              } else {
                                setShift('DAY');
                              }
                            } else {
                              const { dayGroup, nightGroup } = calculate33ShiftGroups(new Date());
                              if (opGroup === dayGroup) {
                                setShift('DAY');
                              } else if (opGroup === nightGroup) {
                                setShift('NIGHT');
                              } else {
                                setShift('DAY');
                              }
                            }
                          }
                        }}
                        className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-sm sm:text-base font-black text-slate-900 cursor-pointer appearance-none outline-none"
                      >
                        <option value="" className="text-slate-900 font-bold">-- แตะเพื่อเลือกรายชื่อ --</option>
                        {operators.map(op => <option key={op.id} value={op.employeeId} className="text-slate-900 font-bold">{op.name} ({op.employeeId})</option>)}
                        <option value="guest" className="text-slate-900 font-bold">ผู้ตรวจสำรอง / บุคคลอื่น (Guest)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-800 font-extrabold text-sm">▼</div>
                    </div>
                  </div>

                  {/* Shift Selection Styled as Large Touchable Segmented Control Cards */}
                  <div>
                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">กะการทำงาน (Shift Selection) *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <ShiftButton active={shift === 'DAY'} onClick={() => setShift('DAY')} icon={<Sun className="w-5 h-5 text-amber-600" />} label="กะกลางวัน" />
                      <ShiftButton active={shift === 'NIGHT'} onClick={() => setShift('NIGHT')} icon={<Moon className="w-5 h-5 text-indigo-600" />} label="กะกลางคืน" />
                    </div>
                  </div>

                  {/* Standby / Bypass Selection buttons */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">สถานะการใช้งานเครื่องในกะนี้ (Machine Status) *</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setStandbyMode(prev => prev === 'testing' ? 'active' : 'testing')}
                        className={cn(
                          "p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm",
                          standbyMode === 'testing' 
                            ? "bg-amber-500 border-amber-600 text-white shadow-amber-500/10" 
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        )}
                      >
                        <span className="text-xl">🧪</span>
                        <span className="text-xs font-black leading-snug">เครื่องติดคิวทดสอบอยู่</span>
                        <span className="text-[10px] opacity-85 leading-none font-bold">Testing Queue</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStandbyMode(prev => prev === 'unused' ? 'active' : 'unused')}
                        className={cn(
                          "p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm",
                          standbyMode === 'unused' 
                            ? "bg-indigo-600 border-indigo-700 text-white shadow-indigo-500/10" 
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        )}
                      >
                        <span className="text-xl">💤</span>
                        <span className="text-xs font-black leading-snug">ไม่มีการใช้งานเครื่อง</span>
                        <span className="text-[10px] opacity-85 leading-none font-bold">No Machine Usage</span>
                      </button>
                    </div>
                  </div>
                </div>



                {/* ZONE 2: รายการตรวจสอบพารามิเตอร์ (Validation Checklist Zone) */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-indigo-700 tracking-wider uppercase flex items-center gap-1.5 px-1">
                    <FileSpreadsheet className="w-4 h-4" />
                    โซนที่ 2: รายการคำถามตรวจสอบคุณภาพ
                  </h3>

                  {standbyMode !== 'active' && (
                     <div className={cn(
                        "p-5 border rounded-3xl flex items-start gap-3.5 text-xs shadow-xs transition-all duration-300 relative overflow-hidden",
                        standbyMode === 'testing'
                          ? "bg-amber-50/70 border-amber-300/80 text-amber-950"
                          : "bg-indigo-50/40 border-indigo-300/80 text-indigo-950"
                     )}>
                        <div className={cn(
                           "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-inner border",
                           standbyMode === 'testing'
                             ? "bg-amber-100 border-amber-200/50 text-amber-600"
                             : "bg-indigo-100 border-indigo-200/50 text-indigo-600"
                        )}>
                           {standbyMode === 'testing' ? '🧪' : '💤'}
                        </div>
                        <div className="space-y-1">
                           <h4 className="text-sm font-black flex items-center gap-1.5">
                              🔔 ระบบเปิดโหมดข้ามส่วนตรวจ On-Use อัตโนมัติ
                           </h4>
                           <p className="font-bold opacity-85 leading-relaxed">
                              เนื่องจากเครื่องจักรอยู่ในสถานะ <span className="underline font-black">{standbyMode === 'testing' ? 'เครื่องติดคิวทดสอบอยู่ (Testing)' : 'ไม่มีการใช้งานเครื่อง (Unused)'}</span> ระบบจึงทำการซ่อนพารามิเตอร์ตรวจก่อนผลิต (On-Use) ให้โดยอัตโนมัติ <b>แต่พนักงานยังคงต้องทำการเดินตรวจสอบหัวข้อประจำวัน (Daily) ที่เหลือตามปกติครับ</b>
                           </p>
                        </div>
                     </div>
                  )}

                  {filteredItems.length === 0 ? (
                     <div className="p-8 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center bg-white shadow-xs">
                        <p className="text-slate-500 text-xs font-bold">ไม่มีรายการคำถามที่ตรงกับรอบการตรวจนี้</p>
                     </div>
                  ) : (
                    Array.from(new Set(filteredItems.map(i => i.category || 'General Checklist'))).map((category) => {
                       const originalCatIdx = categoryOrder.indexOf(category);
                       const catIdx = originalCatIdx !== -1 ? originalCatIdx : 0;
                       return (
                       <div key={category} className="space-y-4">
                         {/* Category Header */}
                         <div className="flex items-center gap-2.5 px-1 pt-2">
                            <span className={cn(
                               "px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider leading-none shadow-xs border text-white",
                               catIdx % 4 === 0 ? "bg-indigo-600 border-indigo-700" :
                               catIdx % 4 === 1 ? "bg-teal-600 border-teal-700" :
                               catIdx % 4 === 2 ? "bg-violet-600 border-violet-700" :
                               "bg-amber-600 border-amber-700"
                            )}>
                               หมวดหมู่ที่ {catIdx + 1}: {category}
                            </span>
                            <div className="h-0.5 bg-slate-200/80 flex-1 rounded-full"></div>
                         </div>
                         
                         {filteredItems.filter(item => (item.category || 'General Checklist') === category).map((item, idx) => {
                           const hasValue = responses[item.id] !== undefined && responses[item.id] !== '';
                           const isNormal = hasValue ? evalIsNormal(item, responses[item.id]) : true;
                           const isActive = activeItemId === item.id;

                           return (
                             <div 
                               key={item.id}
                               onClick={() => setActiveItemId(item.id)}
                               className={cn(
                                 "p-5 rounded-[2rem] transition-all duration-300 relative overflow-hidden border-2 shadow-sm hover:shadow-md cursor-pointer",
                                 isActive
                                   ? "bg-indigo-50/40 border-indigo-500 ring-4 ring-indigo-500/15 scale-[1.01] shadow-indigo-100"
                                   : hasValue 
                                     ? isNormal 
                                       ? "bg-emerald-50/30 border-emerald-500 text-emerald-950" 
                                       : "bg-rose-50/30 border-rose-500 text-rose-950"
                                     : "bg-white border-slate-200/80 hover:border-indigo-200 text-slate-800"
                               )}
                             >
                               {/* Header bar of the card */}
                               <div className="flex justify-between items-center mb-3.5 relative z-10 pl-2">
                                 <span className={cn(
                                   "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border leading-none shadow-xs transition-colors duration-200",
                                   isActive
                                     ? "bg-indigo-600 border-indigo-700 text-white"
                                     : hasValue
                                       ? isNormal
                                         ? "bg-emerald-600 border-emerald-700 text-white"
                                         : "bg-rose-600 border-rose-700 text-white"
                                       : "bg-slate-100 border-slate-200 text-slate-500"
                                 )}>
                                   {isActive 
                                     ? "👉 กำลังป้อนข้อมูลตรวจข้อนี้" 
                                     : hasValue 
                                       ? isNormal 
                                         ? "✅ ปกติ / ผ่านเกณฑ์" 
                                         : "🚨 ผิดปกติ / ตกเกณฑ์มาตรฐาน"
                                       : "⏳ รอคีย์บันทึกผลตรวจ"}
                                 </span>
                                 
                                 {/* Small number badge */}
                                 <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100/50 border border-slate-200/40 px-2 py-0.5 rounded-md">
                                   ข้อ {catIdx + 1}.{idx + 1}
                                 </span>
                                </div>

                               {/* Colored left edge indicator */}
                               <div className={cn(
                                 "absolute left-0 top-0 bottom-0 w-2 transition-colors duration-300",
                                 isActive
                                   ? "bg-indigo-500"
                                   : hasValue 
                                     ? isNormal ? "bg-emerald-500" : "bg-rose-500"
                                     : "bg-slate-300"
                                )}></div>
                               
                               {/* Parameter details */}
                               <div className="pl-2 space-y-1.5 mb-4 relative z-10">
                                 <label className="block text-base font-black text-slate-900 leading-tight">
                                   {item.name}
                                   {item.isRequired && <span className="text-rose-500 font-bold ml-1">*</span>}
                                 </label>
                                 
                                 {item.criteriaText && (
                                   <div className="text-xs text-slate-600 font-bold flex items-center gap-1.5 mt-1">
                                     <span className="opacity-70 text-[9px] uppercase tracking-wider text-slate-500">มาตรฐานเกณฑ์ตรวจ:</span>
                                     <span className="text-slate-800 bg-slate-100/80 px-2.5 py-0.5 rounded-lg border border-slate-200/60 font-extrabold">{item.criteriaText}</span>
                                   </div>
                                 )}
                               </div>

                               {/* TACTILE INPUT AREA FOR MOBILE */}
                               <div className="pl-2 relative z-10">
                                 {item.type === 'boolean' ? (
                                   /* Giant tactile buttons */
                                   <div className="grid grid-cols-2 gap-3.5">
                                     <button
                                       type="button"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setResponses({...responses, [item.id]: 'true'});
                                         setActiveItemId(item.id);
                                       }}
                                       className={cn(
                                         "py-4 px-4 rounded-2xl border-2 flex flex-col sm:flex-row items-center justify-center gap-2 transition-all cursor-pointer shadow-xs font-black text-sm active:scale-95",
                                         responses[item.id] === 'true' 
                                           ? "bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/20" 
                                           : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                       )}
                                     >
                                       <Check className="w-5 h-5 shrink-0" />
                                       <span>ปกติ (Pass)</span>
                                     </button>
                                     
                                     <button
                                       type="button"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setResponses({...responses, [item.id]: 'false'});
                                         setActiveItemId(item.id);
                                       }}
                                       className={cn(
                                         "py-4 px-4 rounded-2xl border-2 flex flex-col sm:flex-row items-center justify-center gap-2 transition-all cursor-pointer shadow-xs font-black text-sm active:scale-95",
                                         responses[item.id] === 'false' 
                                           ? "bg-rose-500 border-rose-600 text-white shadow-rose-500/20" 
                                           : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                       )}
                                     >
                                       <X className="w-5 h-5 shrink-0" />
                                       <span>ชำรุด (Fail)</span>
                                     </button>
                                   </div>
                                 ) : (
                                   /* Sleek tactile telemetry input with slider adjust buttons */
                                   <div className="space-y-3">
                                     <div className="flex items-center gap-2">
                                       <button
                                         type="button"
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           handleAdjustValue(item.id!, false, item.minValue, item.maxValue);
                                           setActiveItemId(item.id!);
                                         }}
                                         className="w-14 h-14 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-2xl flex items-center justify-center font-bold text-xl cursor-pointer active:scale-95 transition-transform"
                                       >
                                         <Minus className="w-5 h-5" />
                                       </button>

                                       <div className="relative flex-1">
                                         <input 
                                           type="number" 
                                           step="any"
                                           required={item.isRequired}
                                           value={responses[item.id] || ''}
                                           onFocus={() => setActiveItemId(item.id)}
                                           onClick={(e) => e.stopPropagation()}
                                           onChange={e => {
                                             setResponses({...responses, [item.id]: e.target.value});
                                             setActiveItemId(item.id);
                                           }}
                                           placeholder="คีย์ระบุตัวเลข..."
                                           className="w-full text-center px-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:bg-white rounded-2xl focus:outline-none focus:border-indigo-500 font-mono text-xl font-black text-slate-800 shadow-xs"
                                         />
                                         {item.unit && (
                                           <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-xs uppercase">{item.unit}</span>
                                         )}
                                       </div>

                                       <button
                                         type="button"
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           handleAdjustValue(item.id!, true, item.minValue, item.maxValue);
                                           setActiveItemId(item.id!);
                                         }}
                                         className="w-14 h-14 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-2xl flex items-center justify-center font-bold text-xl cursor-pointer active:scale-95 transition-transform"
                                        >
                                         <Plus className="w-5 h-5" />
                                       </button>
                                     </div>

                                     {/* Target spec limits */}
                                     {item.minValue !== undefined && item.maxValue !== undefined && (
                                       <div className="flex justify-between items-center text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                         <span className="text-slate-400 font-bold uppercase tracking-wide">ช่วงปกติ (LCL - UCL):</span>
                                         <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">{item.minValue} ถึง {item.maxValue} {item.unit || ''}</span>
                                       </div>
                                     )}

                                     {/* Instant Visual validation feedback */}
                                     {hasValue && (
                                       !isNormal ? (
                                         <div className="text-[11px] text-rose-700 font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                           <AlertTriangle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
                                           <span>ค่าที่บันทึก <b>"หลุดนอกช่วงมาตรฐานควบคุม"</b> กรุณากรอกหมายเหตุก่อนส่ง</span>
                                         </div>
                                       ) : (
                                         <div className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                           <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                                           <span>ค่าปกติ อยู่ในเกณฑ์มาตรฐาน</span>
                                         </div>
                                       )
                                     )}
                                   </div>
                                 )}
                               </div>
                             </div>
                           );
                         })}
                       </div>
                    );
                    }))
                   }
                </div>

                {/* ZONE 3: หมายเหตุเพิ่มเติมและส่งบันทึก (Observations & Validation Submit) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                  <h3 className="text-xs font-extrabold text-indigo-700 tracking-wider uppercase flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" />
                    โซนที่ 3: บันทึกข้อมูลข้อสังเกตเพิ่มเติม
                  </h3>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">รายละเอียดความชำรุด หรือมาตรการประคองงานเบื้องต้น</label>
                    <textarea 
                      rows={3}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="ระบุพฤติกรรมผิดปกติ หรือบันทึกข้อสอบเทียบ หรือชิ้นส่วนที่ควรดูแลเป็นพิเศษ (เว้นว่างได้หากปกติ)..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-xs sm:text-sm shadow-inner transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Submit Action Button */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSaving(false);
                      setSelectedEq(null);
                      setResponses({});
                      setNotes('');
                      setStandbyMode('active');
                    }}
                    className="py-4 px-5 rounded-2xl font-bold tracking-wide text-slate-700 bg-white hover:bg-slate-100 border-2 border-slate-200 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer shadow-sm active:scale-[0.99]"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    ยกเลิก / เปลี่ยนเครื่อง
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving}
                    className={cn(
                      "flex-1 py-4.5 rounded-2xl font-bold tracking-wide text-white transition-all flex items-center justify-center gap-2 text-sm cursor-pointer shadow-lg",
                      saving 
                        ? "bg-slate-400 cursor-not-allowed" 
                        : standbyMode === 'testing'
                          ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/10 active:scale-[0.99]"
                          : standbyMode === 'unused'
                            ? "bg-slate-700 hover:bg-slate-800 shadow-slate-700/10 active:scale-[0.99]"
                            : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10 active:scale-[0.99]"
                    )}
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                        กำลังส่งข้อมูลบันทึก...
                      </span>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        {standbyMode === 'testing'
                          ? "บันทึกสถานะเครื่อง: ติดคิวทดสอบอยู่ (Testing)"
                          : standbyMode === 'unused'
                            ? "บันทึกสถานะเครื่อง: ไม่มีการใช้งานเครื่อง (Unused)"
                            : "ยืนยันและบันทึกผลตรวจสอบเครื่องจักร"}
                      </>
                    )}
                  </button>
                </div>
             </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShiftButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "py-3.5 px-2 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-xs",
        active 
          ? "bg-slate-900 border-slate-950 text-white shadow-slate-900/10" 
          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
      )}
    >
      {icon}
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}

function RefreshCcw(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
