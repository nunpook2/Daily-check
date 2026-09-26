import React, { useState, useEffect, useRef, useMemo } from 'react';
import { fetchEquipments, fetchCheckItems, fetchLogs, saveCheckLog, fetchOperators } from '../lib/db';
import { Equipment, CheckItem, CheckResponse, Operator } from '../types';
import { format } from 'date-fns';
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
  FileSpreadsheet
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import jsQR from "jsqr";

export default function PerformCheck({ onSaved, initialEqCode, selectedDept = 'all' }: { onSaved?: () => void, initialEqCode?: string, selectedDept?: string }) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [todaysLogs, setTodaysLogs] = useState<Set<string>>(new Set());
  const [selectedEq, setSelectedEq] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Scanner state
  const [scanCode, setScanCode] = useState('');
  const [scanError, setScanError] = useState('');
  const [showCamera, setShowCamera] = useState(false);

  // Video and Canvas refs for native jsQR scanner
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [items, setItems] = useState<CheckItem[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [operatorId, setOperatorId] = useState('');
  const [shift, setShift] = useState<'DAY' | 'NIGHT' | 'OTHER' | 'NA'>('DAY');
  const [checkType, setCheckType] = useState<string>('all');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (checkType === 'all') return true;
      if (checkType === 'daily' && (!item.frequency || item.frequency === 'daily')) return true;
      return item.frequency === checkType;
    });
  }, [items, checkType]);

  useEffect(() => {
    loadEq();
  }, [selectedDept]);

  const loadEq = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    let [eqData, logsData, opData] = await Promise.all([
      fetchEquipments(),
      fetchLogs(today),
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

    const nonRetiredEq = eqData.filter(e => e.status !== 'retired');
    setEquipments(nonRetiredEq);
    setTodaysLogs(new Set(logsData.map(l => l.equipmentId)));
    setOperators(opData.filter(o => o.isActive));
    setLoading(false);

    if (initialEqCode) {
       const eqToSelect = nonRetiredEq.find(e => e.id === initialEqCode || e.code.toLowerCase() === initialEqCode.toLowerCase());
       if (eqToSelect) {
         if (eqToSelect.status === 'maintenance') {
           setScanError(`⛔ "${eqToSelect.name}" กำลังปิดปรับปรุง ไม่สามารถตรวจเช็กได้ในขณะนี้`);
           return;
         }
         const itms = await fetchCheckItems(eqToSelect.id);
         setItems(itms);
         // Reset form
         setResponses({});
         setOperatorId('');
         setShift('DAY');
         setNotes('');
         setSelectedEq(eqToSelect);
       }
    }
  };

  // Setup the webcam stream and tick function
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 640 } } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.play();
          setScanError('');
          requestAnimationFrame(tick);
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setScanError("ไม่สามารถเข้าถึงกล้องได้ กรุณาให้สิทธิ์เข้าถึงกล้อง หรืออัปโหลดไฟล์ภาพ QR Code แทน");
        setShowCamera(false);
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            if (code) {
              handleCodeDetected(code.data);
              return;
            }
          }
        }
      }
      if (stream) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (showCamera) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };

    function stopCamera() {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      cancelAnimationFrame(animationFrameId);
    }
  }, [showCamera, equipments]);

  const handleCodeDetected = (detectedVal: string) => {
    let extractedCode = detectedVal;
    try {
      if (detectedVal.startsWith('http://') || detectedVal.startsWith('https://')) {
        const url = new URL(detectedVal);
        const searchParams = new URLSearchParams(url.search);
        extractedCode = searchParams.get('eqCode') || searchParams.get('id') || searchParams.get('code') || searchParams.get('eq') || searchParams.get('equipmentId') || detectedVal;
      }
    } catch (e) {
      // Ignore URL parse error
    }

    const eq = equipments.find(e => 
      e.id === extractedCode || 
      e.code.toLowerCase() === extractedCode.toLowerCase() ||
      e.id.toLowerCase() === extractedCode.toLowerCase()
    );

    if (eq) {
      setShowCamera(false);
      handleSelect(eq);
    } else {
      setScanError(`ไม่พบรหัสเครื่องจักร "${extractedCode}" ในระบบฐานข้อมูลหลัก`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            handleCodeDetected(code.data);
          } else {
            setScanError("ไม่พบรหัส QR Code ที่ถูกต้องในรูปภาพนี้ กรุณาถ่ายภาพให้ชัดเจนยิ่งขึ้น");
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScanError('');
    if (!scanCode.trim()) return;

    const eq = equipments.find(e => 
      e.code.toLowerCase() === scanCode.trim().toLowerCase() ||
      e.id === scanCode.trim()
    );

    if (eq) {
      handleSelect(eq);
      setScanCode('');
    } else {
      setScanError(`รหัสเครื่องมือไม่ถูกต้อง: "${scanCode}"`);
    }
  };

  const handleSelect = async (eq: Equipment) => {
    if (eq.status === 'maintenance') {
      setScanError(`⛔ "${eq.name}" อยู่ในสถานะ [ปิดปรับปรุงซ่อมแซม] ชั่วคราว (สาเหตุ: ${eq.maintenanceReason || 'ชำรุดเสียหาย'}) ถูกบล็อกการสแกนจนกว่าทีมช่างจะซ่อมเสร็จ`);
      return;
    }
    const itms = await fetchCheckItems(eq.id);
    setItems(itms);
    setSelectedEq(eq);
    setResponses({});
    setOperatorId('');
    setShift('DAY');
    setNotes('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEq || !operatorId) return;

    // Validate that all required items are answered
    const unansweredItem = filteredItems.find(item => item.isRequired && (responses[item.id!] === undefined || responses[item.id!] === ''));
    if (unansweredItem) {
      alert(`⚠️ กรุณาทำรายการตรวจหรือระบุค่าสำหรับข้อ: "${unansweredItem.name}" ก่อนส่งบันทึก`);
      return;
    }

    setSaving(true);
    let allNormal = true;
    const finalResponses: CheckResponse[] = filteredItems.map(item => {
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

    const op = operators.find(o => o.employeeId === operatorId);
    const opName = op ? op.name : operatorId;

    await saveCheckLog({
      equipmentId: selectedEq.id,
      timestamp: Date.now(),
      dateKey: format(new Date(), 'yyyy-MM-dd'),
      shift: shift,
      checkCycle: checkType,
      operatorId: operatorId,
      operatorName: opName,
      status: logStatus,
      notes: computedNotes,
      actionTaken: notes,
      responses: finalResponses
    });

    setSaving(false);
    setSelectedEq(null);
    await loadEq();
    if (onSaved) onSaved();
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
          /* SCANNING HUB STATE */
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
             <div className="text-center">
               <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-full mb-2">
                 <Smartphone className="w-3.5 h-3.5" />
                 ระบบสแกนผ่านมือถือรุ่นอัจฉริยะ (Smart Terminal)
               </span>
               <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">หน้าลงบันทึกของผู้ตรวจเช็ก</h2>
               <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-sm mx-auto font-medium">
                 สแกนแท็ก QR Code หน้าเครื่องจักร เพื่อเริ่มต้นบันทึกและส่งรายงานผลการตรวจสอบ
               </p>
             </div>
            
             {/* Scan Interface Box */}
             <div className="bg-white border border-slate-200/80 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col items-center p-6 sm:p-10 relative group">
               <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
               
               <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl flex items-center justify-center mb-5 shadow-inner border border-indigo-100/50">
                  <ScanLine className="w-8 h-8 text-indigo-600 animate-pulse" />
               </div>
               
               {showCamera ? (
                 <div className="w-full aspect-square max-w-[280px] bg-slate-950 rounded-[2rem] overflow-hidden shadow-2xl mb-6 relative border-4 border-slate-100 ring-1 ring-slate-200/50">
                    <video ref={videoRef} className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Glowing Scan Bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-bounce shadow-[0_0_15px_rgba(79,70,229,0.8)]"></div>
                    
                    {/* QR corner reticles */}
                    <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg"></div>
                    <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg"></div>
                    <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg"></div>
                    <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-lg"></div>

                    <button 
                      type="button"
                      onClick={() => setShowCamera(false)} 
                      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-1.5 bg-rose-600 text-white font-bold rounded-xl shadow-lg text-[10px] hover:bg-rose-500 cursor-pointer"
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
                 <div className="mt-4 text-xs text-rose-700 font-bold bg-rose-50 border border-rose-100 px-4 py-3 rounded-xl flex items-center gap-2 w-full shadow-inner">
                   <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                   <span>{scanError}</span>
                 </div>
               )}
             </div>

             <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-300/60 flex gap-3 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-extrabold text-amber-800 uppercase tracking-wide">มาตรการป้องกันทุจริตในสถานประกอบการ</h3>
                  <p className="text-amber-700 leading-relaxed font-medium">
                    ผู้ตรวจต้องสแกนคิวอาร์โค้ดทางกายภาพเพื่อแสดงว่ามาตรวจจริง หากคอมพิวเตอร์ของคุณไม่มีกล้อง สามารถใช้แบบฟอร์มคีย์รหัส หรืออัปโหลดรูปภาพใบตรวจสอบเพื่อเป็นหลักฐาน
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
                     <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-100 text-[9px] font-bold uppercase tracking-wider border border-indigo-400/20">แบบตรวจสอบ</span>
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-white text-[9px] font-mono font-bold tracking-widest border border-white/10">{selectedEq.code}</span>
                     </div>
                     <h2 className="text-xl sm:text-2xl font-black text-white leading-tight truncate">{selectedEq.name}</h2>
                     <p className="text-indigo-300 text-[10px] sm:text-xs font-semibold truncate mt-0.5">สถานที่: {(selectedEq.location || 'คลังทดสอบ').replace('น้อง', 'ห้อง')}</p>
                  </div>
                </div>
             </div>

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
                        onChange={e => setOperatorId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-sm sm:text-base font-black text-slate-900 cursor-pointer appearance-none outline-none"
                      >
                        <option value="" className="text-slate-900 font-bold">-- แตะเพื่อเลือกรายชื่อ --</option>
                        {operators.map(op => <option key={op.id} value={op.employeeId} className="text-slate-900 font-bold">{op.name} ({op.employeeId})</option>)}
                        <option value="sc-101" className="text-slate-900 font-bold">Sarah Connor (SC-101)</option>
                        <option value="guest" className="text-slate-900 font-bold">ผู้ตรวจสำรอง / บุคคลอื่น (Guest)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-800 font-extrabold text-sm">▼</div>
                    </div>
                  </div>

                  {/* Shift Selection Styled as Large Touchable Segmented Control Cards */}
                  <div>
                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">กะการทำงาน (Shift Selection) *</label>
                    <div className="grid grid-cols-3 gap-2">
                      <ShiftButton active={shift === 'DAY'} onClick={() => setShift('DAY')} icon={<Sun className="w-5 h-5 text-amber-600" />} label="กะกลางวัน" />
                      <ShiftButton active={shift === 'NIGHT'} onClick={() => setShift('NIGHT')} icon={<Moon className="w-5 h-5 text-indigo-600" />} label="กะกลางคืน" />
                      <ShiftButton active={shift === 'OTHER'} onClick={() => setShift('OTHER')} icon={<Cog className="w-5 h-5 text-slate-700" />} label="กะพิเศษ" />
                    </div>
                  </div>

                  {/* Cycle check selection */}
                  <div>
                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">วัตถุประสงค์ในการตรวจเช็ก *</label>
                    <div className="relative">
                      <select 
                        required 
                        value={checkType}
                        onChange={e => setCheckType(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-sm sm:text-base font-black text-slate-900 cursor-pointer appearance-none outline-none"
                      >
                        <option value="all" className="text-slate-900 font-bold">ตรวจสอบพารามิเตอร์ปกติทั้งหมด</option>
                        <option value="daily" className="text-slate-900 font-bold">ตรวจสอบประจำวันเท่านั้น (Daily Only)</option>
                        <option value="on-use" className="text-slate-900 font-bold">ตรวจสอบเมื่อใช้งานเครื่อง (On Use Only)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-800 font-extrabold text-sm">▼</div>
                    </div>
                  </div>
                </div>

                {/* ZONE 2: รายการตรวจสอบพารามิเตอร์ (Validation Checklist Zone) */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-indigo-700 tracking-wider uppercase flex items-center gap-1.5 px-1">
                    <FileSpreadsheet className="w-4 h-4" />
                    โซนที่ 2: รายการคำถามตรวจสอบคุณภาพ
                  </h3>

                  {filteredItems.length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center bg-white shadow-xs">
                       <p className="text-slate-500 text-xs font-bold">ไม่มีรายการคำถามที่ตรงกับรอบการตรวจนี้</p>
                    </div>
                  ) : (
                    Array.from(new Set(filteredItems.map(i => i.category || 'General Checklist'))).map((category, catIdx) => (
                       <div key={category} className="space-y-3.5">
                         {/* Category Header */}
                         <div className="flex items-center gap-2 px-1 pt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">{category}</span>
                            <div className="h-px bg-slate-200/80 flex-1"></div>
                         </div>
                         
                         {filteredItems.filter(item => (item.category || 'General Checklist') === category).map((item, idx) => {
                           const hasValue = responses[item.id] !== undefined && responses[item.id] !== '';
                           const isNormal = hasValue ? evalIsNormal(item, responses[item.id]) : true;

                           return (
                             <div key={item.id} className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
                               {/* Colored side indicator for state */}
                               <div className={cn(
                                 "absolute left-0 top-0 bottom-0 w-1",
                                 hasValue 
                                   ? isNormal ? "bg-emerald-500" : "bg-rose-500"
                                   : "bg-slate-200"
                               )}></div>
                               
                               {/* Parameter header */}
                               <div className="pl-1 space-y-1.5 mb-4">
                                 <label className="block text-sm sm:text-base font-black text-slate-900 leading-snug">
                                   <span className="text-indigo-600 font-mono text-[10px] border border-indigo-100 bg-indigo-50/50 px-2 py-0.5 rounded-md mr-1.5">{catIdx + 1}.{idx + 1}</span>
                                   {item.name}
                                   {item.isRequired && <span className="text-rose-500 font-bold ml-1">*</span>}
                                 </label>
                                 
                                 {item.criteriaText && (
                                   <div className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                                     <span className="opacity-70 text-[9px] uppercase tracking-wider">เกณฑ์มาตรฐาน:</span>
                                     <span className="text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{item.criteriaText}</span>
                                   </div>
                                 )}
                               </div>

                               {/* TACTILE INPUT AREA FOR MOBILE */}
                               <div className="pl-1">
                                 {item.type === 'boolean' ? (
                                   /* Dual giant tactile buttons for mobile */
                                   <div className="grid grid-cols-2 gap-3.5">
                                      <button
                                        type="button"
                                        onClick={() => setResponses({...responses, [item.id]: 'true'})}
                                        className={cn(
                                          "py-3.5 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs font-bold text-xs sm:text-sm active:scale-95",
                                          responses[item.id] === 'true' 
                                            ? "bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/10" 
                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                        )}
                                      >
                                        <Check className="w-4 h-4 shrink-0" />
                                        <span>ปกติ (Pass)</span>
                                      </button>
                                      
                                      <button
                                        type="button"
                                        onClick={() => setResponses({...responses, [item.id]: 'false'})}
                                        className={cn(
                                          "py-3.5 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs font-bold text-xs sm:text-sm active:scale-95",
                                          responses[item.id] === 'false' 
                                            ? "bg-rose-500 border-rose-600 text-white shadow-rose-500/10" 
                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                        )}
                                      >
                                        <X className="w-4 h-4 shrink-0" />
                                        <span>ชำรุด (Fail)</span>
                                      </button>
                                   </div>
                                 ) : (
                                   /* Sleek digital telemetry input layout with adjustment buttons */
                                   <div className="space-y-2.5">
                                      <div className="flex items-center gap-2">
                                         {/* Subtract button */}
                                         <button
                                           type="button"
                                           onClick={() => handleAdjustValue(item.id!, false, item.minValue, item.maxValue)}
                                           className="w-12 h-12 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-xl flex items-center justify-center font-bold text-xl cursor-pointer active:scale-95 transition-transform"
                                         >
                                           <Minus className="w-4 h-4" />
                                         </button>

                                         {/* Value display / numerical input */}
                                         <div className="relative flex-1">
                                            <input 
                                              type="number" 
                                              step="any"
                                              required={item.isRequired}
                                              value={responses[item.id] || ''}
                                              onChange={e => setResponses({...responses, [item.id]: e.target.value})}
                                              placeholder="ระบุตัวเลข..."
                                              className="w-full text-center px-4 py-3 bg-slate-50 border-2 border-slate-200 focus:bg-white rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-lg font-black text-slate-800 shadow-xs"
                                            />
                                            {item.unit && (
                                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs uppercase">{item.unit}</span>
                                            )}
                                         </div>

                                         {/* Add button */}
                                         <button
                                           type="button"
                                           onClick={() => handleAdjustValue(item.id!, true, item.minValue, item.maxValue)}
                                           className="w-12 h-12 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-xl flex items-center justify-center font-bold text-xl cursor-pointer active:scale-95 transition-transform"
                                         >
                                           <Plus className="w-4 h-4" />
                                         </button>
                                      </div>

                                      {/* Target Spec Guidelines banner */}
                                      {item.minValue !== undefined && item.maxValue !== undefined && (
                                        <div className="flex justify-between items-center text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                          <span className="text-slate-400 font-bold uppercase tracking-wide">ขอบเขตค่าปกติ:</span>
                                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{item.minValue} ถึง {item.maxValue} {item.unit || ''}</span>
                                        </div>
                                      )}

                                      {/* Instant Visual validation feedback */}
                                      {hasValue && (
                                         !isNormal ? (
                                             <div className="text-[11px] text-rose-700 font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                                                <span>ค่าที่บันทึก <b>"หลุดช่วงมาตรฐาน"</b> กรุณาลงหมายเหตุก่อนส่ง</span>
                                             </div>
                                         ) : (
                                             <div className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
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
                    ))
                   )}
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
                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={saving}
                    className={cn(
                      "w-full py-4.5 rounded-2xl font-bold tracking-wide text-white transition-all flex items-center justify-center gap-2 text-sm cursor-pointer shadow-lg",
                      saving 
                        ? "bg-slate-400 cursor-not-allowed" 
                        : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10 active:scale-[0.99]"
                    )}
                  >
                    {saving ? (
                      "กำลังส่งข้อมูลบันทึก..."
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        ยืนยันและบันทึกผลตรวจสอบเครื่องจักร
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
