import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  Download, 
  X, 
  Calendar, 
  CheckCircle2, 
  Layers, 
  FlaskConical, 
  Clock, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { generateAndDownloadExcel, ExcelExportOptions } from '../lib/excelExport';
import { cn } from '../lib/utils';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
}

export default function ExcelExportModal({ isOpen, onClose, defaultDate }: ExcelExportModalProps) {
  const currentYm = defaultDate ? defaultDate.substring(0, 7) : format(new Date(), 'yyyy-MM');
  const [mode, setMode] = useState<'month' | 'range' | 'today'>('month');
  const [selectedYm, setSelectedYm] = useState<string>(currentYm);
  const [startDate, setStartDate] = useState<string>(`${currentYm}-01`);
  const [endDate, setEndDate] = useState<string>(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'routine_only' | 'std_only'>('all');
  const [exporting, setExporting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ total: number; fileName: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setExporting(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      const options: ExcelExportOptions = {
        mode,
        yearMonth: selectedYm,
        startDate,
        endDate,
        phaseFilter
      };

      const result = await generateAndDownloadExcel(options);
      setSuccessInfo({ total: result.totalLogs, fileName: result.fileName });
    } catch (err: any) {
      console.error("Export to Excel failed:", err);
      setErrorMessage(err?.message || "เกิดข้อผิดพลาดในการสร้างไฟล์ Excel กรุณาลองใหม่อีกครั้ง");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-100 max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white flex justify-between items-center relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center gap-3.5 relative z-10">
              <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                <FileSpreadsheet className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black tracking-tight">ส่งออกข้อมูลเป็น Excel (.xlsx)</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400/30 text-emerald-100 text-[10px] font-mono font-bold border border-emerald-300/30">
                    4 Worksheets
                  </span>
                </div>
                <p className="text-xs text-teal-100/90 font-medium mt-0.5">
                  จัดสรรแยกตามวัน เดือน และแยกบันทึกทดสอบค่า STD อย่างเป็นระเบียบ
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors relative z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {/* Step 1: Time Segmentation Selector */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>1. เลือกรูปแบบช่วงเวลา (Time Period)</span>
              </label>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMode('month')}
                  className={cn(
                    "p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between",
                    mode === 'month'
                      ? "border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                  )}
                >
                  <span className="text-xs font-black">📅 แยกตามเดือน (Month)</span>
                  <span className="text-[10px] text-slate-500 font-medium mt-1">สรุปทั้งเดือนตามปฏิทิน</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('range')}
                  className={cn(
                    "p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between",
                    mode === 'range'
                      ? "border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                  )}
                >
                  <span className="text-xs font-black">🗓️ ระบุช่วงวันที่ (Range)</span>
                  <span className="text-[10px] text-slate-500 font-medium mt-1">กำหนดวันเริ่มต้น-สิ้นสุด</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('today')}
                  className={cn(
                    "p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between",
                    mode === 'today'
                      ? "border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                  )}
                >
                  <span className="text-xs font-black">⚡ เฉพาะวันนี้ (Today)</span>
                  <span className="text-[10px] text-slate-500 font-medium mt-1">ข้อมูลล่าสุดประจำวัน</span>
                </button>
              </div>

              {/* Dynamic inputs based on mode */}
              {mode === 'month' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-slate-700 block">เลือกเดือนที่ต้องการ Export:</span>
                    <span className="text-[11px] text-slate-400">ระบบจะสร้างชีตสรุปรายวันในเดือนนั้นครบทั้ง 30/31 วัน</span>
                  </div>
                  <input
                    type="month"
                    value={selectedYm}
                    onChange={(e) => setSelectedYm(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 shadow-2xs cursor-pointer"
                  />
                </div>
              )}

              {mode === 'range' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">จากวันที่ (Start Date):</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">ถึงวันที่ (End Date):</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 shadow-2xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Content Filter */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-emerald-600" />
                <span>2. ตัวกรองประเภทบันทึกการตรวจ (Inspection Phase Filter)</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPhaseFilter('all')}
                  className={cn(
                    "p-3 rounded-2xl border-2 text-left transition-all cursor-pointer",
                    phaseFilter === 'all'
                      ? "border-indigo-600 bg-indigo-50/40 text-indigo-950 font-black"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                  )}
                >
                  <p className="text-xs">📑 รวมทุกประเภท</p>
                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">ตรวจประจำกะ + ทดสอบ STD + Standby</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPhaseFilter('routine_only')}
                  className={cn(
                    "p-3 rounded-2xl border-2 text-left transition-all cursor-pointer",
                    phaseFilter === 'routine_only'
                      ? "border-indigo-600 bg-indigo-50/40 text-indigo-950 font-black"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                  )}
                >
                  <p className="text-xs">📋 เฉพาะตรวจประจำกะ</p>
                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">ตรวจความพร้อมเบื้องต้นเช้า/ดึก</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPhaseFilter('std_only')}
                  className={cn(
                    "p-3 rounded-2xl border-2 text-left transition-all cursor-pointer",
                    phaseFilter === 'std_only'
                      ? "border-indigo-600 bg-indigo-50/40 text-indigo-950 font-black"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                  )}
                >
                  <p className="text-xs">🧪 เฉพาะทดสอบค่า STD</p>
                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">การรันสอบเทียบก่อนเริ่มงานจริง</p>
                </button>
              </div>
            </div>

            {/* Step 3: Worksheets Structure Preview */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                โครงสร้างไฟล์ Excel (.xlsx) ที่จะถูกสร้างขึ้นอัตโนมัติ:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-start gap-2 shadow-2xs">
                  <span className="font-mono text-emerald-600 font-bold">Sheet 1</span>
                  <div>
                    <p className="font-bold text-slate-800">สรุปภาพรวมรายเดือน</p>
                    <p className="text-[10px] text-slate-400">สถิติยอดตรวจแต่ละวัน, เครื่องค้าง/Standby, % Compliance</p>
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-start gap-2 shadow-2xs">
                  <span className="font-mono text-indigo-600 font-bold">Sheet 2</span>
                  <div>
                    <p className="font-bold text-slate-800">ประวัติการตรวจรายวัน</p>
                    <p className="text-[10px] text-slate-400">บันทึกตรวจครบถ้วน เรียงตามวัน/เวลา/กะ/เครื่อง</p>
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-start gap-2 shadow-2xs">
                  <span className="font-mono text-purple-600 font-bold">Sheet 3</span>
                  <div>
                    <p className="font-bold text-slate-800">บันทึกทดสอบค่า_STD</p>
                    <p className="text-[10px] text-slate-400">รวมเฉพาะพารามิเตอร์ STD Spec เทียบค่าที่วัดได้จริง</p>
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-start gap-2 shadow-2xs">
                  <span className="font-mono text-slate-600 font-bold">Sheet 4</span>
                  <div>
                    <p className="font-bold text-slate-800">ทะเบียนเครื่องมือ</p>
                    <p className="text-[10px] text-slate-400">รหัส, ชื่อเครื่อง, เอกสาร SOP, ห้องปฏิบัติการ</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Success Message Banner */}
            {successInfo && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 text-xs font-bold"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-black text-sm">🎉 ดาวน์โหลดไฟล์สำเร็จแล้ว!</p>
                  <p className="text-emerald-700 font-medium mt-0.5 truncate">
                    ไฟล์: <strong>{successInfo.fileName}</strong> (ประมวลผลทั้งหมด {successInfo.total} บันทึก)
                  </p>
                </div>
              </motion.div>
            )}

            {/* Error Message Banner */}
            {errorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">
                ❌ {errorMessage}
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
            <span className="text-[11px] text-slate-400 font-medium">
              ไฟล์ที่ได้สามารถเปิดดูและแก้ไขได้ใน Microsoft Excel, Google Sheets, หรือ Numbers
            </span>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer w-full sm:w-auto text-center"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto disabled:opacity-50"
              >
                <Download className={cn("w-4 h-4", exporting && "animate-bounce")} />
                <span>{exporting ? "กำลังประมวลผลและสร้าง Excel..." : "ดาวน์โหลดไฟล์ Excel (.xlsx)"}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
