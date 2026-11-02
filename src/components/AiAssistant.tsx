import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  FileText, 
  Users, 
  AlertTriangle, 
  ArrowRightLeft, 
  Copy, 
  Check, 
  Printer, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Bookmark, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  Award, 
  ChevronRight,
  TrendingUp,
  Sliders,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Cpu
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { 
  Equipment, 
  CheckLog, 
  Operator, 
  TimeWindowSettings, 
  ShiftNote, 
  calculate33ShiftGroups,
  AiChatMessage 
} from '../types';
import { 
  fetchEquipments, 
  fetchLogsRange, 
  fetchOperators, 
  fetchTimeWindowSettingsAsync, 
  fetchShiftNotes, 
  saveShiftNote, 
  deleteShiftNote 
} from '../lib/db';
import { askApexAi } from '../lib/ai';
import { cn } from '../lib/utils';

export default function AiAssistant() {
  const [activeTab, setActiveTab] = useState<'reports' | 'chat' | 'memory'>('reports');
  
  // Data states
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [timeWindows, setTimeWindows] = useState<TimeWindowSettings>({
    dayStart: '08:00',
    dayEnd: '10:00',
    nightStart: '20:00',
    nightEnd: '22:00'
  });
  const [shiftNotes, setShiftNotes] = useState<ShiftNote[]>([]);
  const [logs, setLogs] = useState<CheckLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filters for AI analysis
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [dateRangeMode, setDateRangeMode] = useState<'today' | 'yesterday' | '7days' | 'custom'>('today');
  const [selectedShift, setSelectedShift] = useState<'ALL' | 'DAY' | 'NIGHT'>('ALL');
  const [selectedShiftGroup, setSelectedShiftGroup] = useState<'ALL' | 'A' | 'B' | 'C' | 'D'>('ALL');

  // AI Chat & Report state
  const [chatMessages, setChatMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 **สวัสดีครับ ผมคือ Apex AI ผู้ช่วยวิเคราะห์คุณภาพและประเมินผลการปฏิบัติงาน**\n\nผมพร้อมช่วยคุณวิเคราะห์ข้อมูลทุกด้าน:\n- 📊 **ควบคุมคุณภาพ & ค่าผิดปกติ (OOC)**: ตรวจจับแนวโน้มความเสี่ยงของเครื่องจักร\n- 👥 **ประเมินความรับผิดชอบทีมงานประจำกะ**: ดูความตรงต่อเวลา ความครอบคลุม และการดูแลงานของหัวหน้ากะและลูกทีม\n- 🔄 **สรุปรายงานส่งมอบงานระหว่างกะ**: ติดตามงานค้างและบันทึกหน้างาน\n\nคุณสามารถเลือกสร้าง **รายงานด่วน 1 คลิก** จากแท็บด้านบน หรือพิมพ์คำถามที่ต้องการทราบได้ทันทีครับ!`,
      timestamp: Date.now()
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [currentReport, setCurrentReport] = useState<string | null>(null);
  const [currentReportTitle, setCurrentReportTitle] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Note creation modal state
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<'directive' | 'quality_alert' | 'handover' | 'evaluation'>('directive');
  const [newNotePriority, setNewNotePriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('high');
  const [newNoteAuthor, setNewNoteAuthor] = useState('ผู้จัดการฝ่ายคุณภาพ (Manager)');

  // Load operational data
  useEffect(() => {
    async function loadAll() {
      setLoadingData(true);
      try {
        const [eqList, opList, twSettings, notes] = await Promise.all([
          fetchEquipments(),
          fetchOperators(),
          fetchTimeWindowSettingsAsync(),
          fetchShiftNotes()
        ]);
        setEquipments(eqList);
        setOperators(opList);
        setTimeWindows(twSettings);
        setShiftNotes(notes);

        // Fetch logs for the past 14 days to provide rich context to AI
        const endDate = format(new Date(), 'yyyy-MM-dd');
        const startDate = format(subDays(new Date(), 14), 'yyyy-MM-dd');
        const fetchedLogs = await fetchLogsRange(startDate, endDate);
        setLogs(fetchedLogs);
      } catch (err) {
        console.error("Error loading operational data for AI:", err);
      } finally {
        setLoadingData(false);
      }
    }
    loadAll();
  }, []);

  // Quick Date Range selector
  const handleDateModeChange = (mode: 'today' | 'yesterday' | '7days' | 'custom') => {
    setDateRangeMode(mode);
    const today = new Date();
    if (mode === 'today') {
      setSelectedDate(format(today, 'yyyy-MM-dd'));
    } else if (mode === 'yesterday') {
      setSelectedDate(format(subDays(today, 1), 'yyyy-MM-dd'));
    } else if (mode === '7days') {
      setSelectedDate(format(today, 'yyyy-MM-dd'));
    }
  };

  // Filter logs relevant to current scope
  const filteredLogs = useMemo(() => {
    if (dateRangeMode === '7days') {
      const minDate = format(subDays(new Date(selectedDate), 7), 'yyyy-MM-dd');
      return logs.filter(l => l.dateKey >= minDate && l.dateKey <= selectedDate);
    }
    return logs.filter(l => l.dateKey === selectedDate);
  }, [logs, selectedDate, dateRangeMode]);

  // Compute 3-3 Shift info for selected date
  const shiftInfo = useMemo(() => {
    return calculate33ShiftGroups(selectedDate);
  }, [selectedDate]);

  // Helper to compile context payload for AI
  const buildContextPayload = () => {
    return {
      selectedDate,
      selectedShift,
      shiftInfo: {
        cycleDay: shiftInfo.cycleDay,
        dayGroup: shiftInfo.dayGroup,
        nightGroup: shiftInfo.nightGroup
      },
      timeWindows,
      equipments: equipments.map(e => ({
        id: e.id,
        name: e.name,
        code: e.code,
        status: e.status,
        applicableShift: e.applicableShift,
        location: e.location
      })),
      operators: operators.filter(o => o.isActive).map(o => ({
        name: o.name,
        role: o.role,
        shiftGroup: o.shiftGroup,
        classification: o.classification
      })),
      shiftNotes: shiftNotes.slice(0, 10), // pass top 10 remembered directives
      recentLogs: filteredLogs.map(l => ({
        equipmentName: l.equipmentName || l.equipmentId,
        dateKey: l.dateKey,
        shift: l.shift,
        operatorName: l.operatorName,
        status: l.status,
        isLate: l.isLate,
        notes: l.notes,
        actionTaken: l.actionTaken,
        outOfControlCount: l.responses?.filter(r => !r.isNormal).length || 0,
        abnormalDetails: l.responses?.filter(r => !r.isNormal).map(r => ({
          itemName: r.itemName,
          value: r.valueNumeric ?? r.valueText ?? (r.valueBoolean ? 'Pass' : 'Fail')
        }))
      }))
    };
  };

  // 1-Click Report Generator
  const handleGenerateReport = async (
    type: 'quality_summary' | 'shift_eval' | 'handover' | 'risk_analysis',
    title: string
  ) => {
    setAiLoading(true);
    setCurrentReportTitle(title);
    setCurrentReport(null);

    let prompt = '';
    if (type === 'quality_summary') {
      prompt = `กรุณาสรุปรายงานการควบคุมคุณภาพ (Quality Control & Compliance Summary) ประจำวันที่ ${selectedDate} 
เกณฑ์รอบเวลาตรวจ: กะเช้า (${timeWindows.dayStart}-${timeWindows.dayEnd}), กะดึก (${timeWindows.nightStart}-${timeWindows.nightEnd})
ให้ระบุ:
1. ภาพรวมการตรวจเช็ก: จำนวนเครื่องที่ตรวจครบ, ค้างตรวจ, และตรวจช้า (Late)
2. วิเคราะห์ค่าพารามิเตอร์ที่ผิดปกติ (OOC) ที่ตรวจพบ และผลกระทบต่อคุณภาพ
3. รายการเครื่องจักรที่มีปัญหาหรือต้องจับตาเป็นพิเศษ
4. ข้อเสนอแนะเชิงป้องกัน (Preventive Actions) สำหรับผู้บริหาร`;
    } else if (type === 'shift_eval') {
      prompt = `กรุณาวิเคราะห์และประเมินผลงาน ความเรียบร้อย และความรับผิดชอบของทีมงานประจำกะ (Shift Performance & Responsibility Evaluation) สำหรับวันที่ ${selectedDate}
ข้อมูลกะ 3-3 วันนี้: กะเช้า (Day Group ${shiftInfo.dayGroup}), กะดึก (Night Group ${shiftInfo.nightGroup})
ให้ประเมินอย่างละเอียด:
1. ประเมินผลงานของหัวหน้ากะ (Shift Leader) และทีมงานผู้ปฏิบัติหน้าที่
2. ประเมินวินัยเรื่องเวลา (ตรวจตรงตาม Time Window หรือไม่ มีการปล่อยตรวจ Late หรือไม่)
3. ประเมินความละเอียดรอบคอบ (การบันทึกค่าจริง, การลงบันทึกสาเหตุเมื่อพบปัญหา)
4. ตัดเกรดและคะแนนความรับผิดชอบ (A = ดีเยี่ยม, B = ได้มาตรฐาน, C = ต้องปรับปรุง) พร้อมจุดเด่นและสิ่งที่ควรพัฒนาเป็นรายบุคคลหรือรายกะ`;
    } else if (type === 'handover') {
      prompt = `กรุณาสร้างรายงานสรุปส่งมอบงานระหว่างกะ (Shift Handover Brief) วันที่ ${selectedDate} เพื่อส่งต่อระหว่างกะเช้า (Day Group ${shiftInfo.dayGroup}) และกะดึก (Night Group ${shiftInfo.nightGroup})
ให้ระบุ:
1. สรุปงานที่ตรวจเสร็จสมบูรณ์เรียบร้อย
2. รายการเครื่องจักรหรือจุดที่ยังค้างตรวจหรือตรวจไม่ผ่าน
3. ข้อสั่งการและประเด็นเฝ้าระวังพิเศษที่กะต่อไปต้องรับช่วงต่อ
4. Checklist สำคัญ 3 ข้อสำหรับหัวหน้ากะถัดไป`;
    } else if (type === 'risk_analysis') {
      prompt = `กรุณาวิเคราะห์จุดเสี่ยงของเครื่องจักรและแนวโน้มความเสื่อมสภาพ (Equipment Health & Risk Assessment) จากข้อมูลบันทึกทั้งหมด
ให้ระบุ:
1. อันดับเครื่องจักรที่มีปัญหาผิดปกติ (OOC) หรือค้างตรวจบ่อยที่สุด
2. วิเคราะห์หาสาเหตุรากเหง้า (Root Cause Hypothesis)
3. เครื่องที่มีคำสั่งเฝ้าระวังพิเศษ (เช่น Gas Night, MI-035) มีแนวโน้มดีขึ้นหรือยัง
4. แผนการซ่อมบำรุงเชิงป้องกัน (PM Recommendation) ที่แนะนำ`;
    }

    try {
      const res = await askApexAi({
        prompt,
        reportType: type,
        contextData: buildContextPayload()
      });

      if (res.error) {
        setCurrentReport(`⚠️ เกิดข้อผิดพลาด: ${res.error}`);
      } else {
        setCurrentReport(res.reply || 'ไม่มีข้อมูลตอบกลับจากระบบ');
      }
    } catch (err: any) {
      setCurrentReport(`⚠️ ระบบเกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Free-form Chat Query
  const handleSendChat = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || aiLoading) return;

    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setAiLoading(true);

    try {
      const res = await askApexAi({
        prompt: textToSend,
        reportType: 'custom',
        contextData: buildContextPayload()
      });

      const aiMsg: AiChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.reply || (res.error ? `⚠️ เกิดข้อผิดพลาด: ${res.error}` : 'ไม่พบข้อมูล'),
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: AiChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`,
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setAiLoading(false);
    }
  };

  // Copy report to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save new directive note
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;

    const note: ShiftNote = {
      id: `note-${Date.now()}`,
      title: newNoteTitle,
      content: newNoteContent,
      category: newNoteCategory,
      priority: newNotePriority,
      authorName: newNoteAuthor,
      createdAt: Date.now(),
      dateKey: format(new Date(), 'yyyy-MM-dd')
    };

    await saveShiftNote(note);
    setShiftNotes(prev => [note, ...prev]);
    setShowAddNoteModal(false);
    setNewNoteTitle('');
    setNewNoteContent('');
  };

  const handleDeleteNote = async (id: string) => {
    if (confirm('คุณต้องการลบข้อสั่งการ/บันทึกนี้ใช่หรือไม่?')) {
      await deleteShiftNote(id);
      setShiftNotes(prev => prev.filter(n => n.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Control Deck */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-900/40">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>APEX INTELLIGENCE · GEMINI 3.8 FLASH ENGINE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              AI ผู้ช่วยวิเคราะห์คุณภาพ & ประเมินผลงานทีมกะ
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-medium">
              ศูนย์รวมปัญญาประดิษฐ์ช่วยตรวจทานความเรียบร้อย สรุปงานประจำกะ บันทึกจดจำคำสั่งการ 
              และประเมินผลความรับผิดชอบของหัวหน้ากะและทีมงานอย่างเป็นรูปธรรม
            </p>
          </div>

          {/* Real-time Status Card */}
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-4 shrink-0 shadow-inner">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider">AI พร้อมใช้งาน</span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                กะ 3-3 วันนี้: เช้า <span className="text-amber-300 font-bold">Group {shiftInfo.dayGroup}</span> · ดึก <span className="text-indigo-300 font-bold">Group {shiftInfo.nightGroup}</span>
              </p>
              <p className="text-[10px] text-slate-400">
                ข้อมูลพร้อมวิเคราะห์: {logs.length} บันทึก · {shiftNotes.length} ข้อสั่งการ
              </p>
            </div>
          </div>
        </div>

        {/* Global Filter Toolbar */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-400 font-bold flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            ขอบเขตข้อมูลที่ AI นำไปประมวลผล:
          </span>

          {/* Quick Date Pills */}
          <div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/10">
            <button
              onClick={() => handleDateModeChange('today')}
              className={cn(
                "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                dateRangeMode === 'today' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-300 hover:text-white"
              )}
            >
              วันนี้
            </button>
            <button
              onClick={() => handleDateModeChange('yesterday')}
              className={cn(
                "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                dateRangeMode === 'yesterday' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-300 hover:text-white"
              )}
            >
              เมื่อวาน
            </button>
            <button
              onClick={() => handleDateModeChange('7days')}
              className={cn(
                "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                dateRangeMode === '7days' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-300 hover:text-white"
              )}
            >
              7 วันล่าสุด
            </button>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-3 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-300" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setDateRangeMode('custom');
              }}
              className="bg-transparent text-white focus:outline-none cursor-pointer font-mono text-xs"
            />
          </div>

          {/* Shift Filter */}
          <div className="flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-xl px-3 py-1">
            <Clock className="w-3.5 h-3.5 text-slate-300" />
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value as any)}
              className="bg-transparent text-white focus:outline-none cursor-pointer text-xs font-semibold"
            >
              <option value="ALL" className="text-slate-900">ทุกช่วงกะ (เช้า + ดึก)</option>
              <option value="DAY" className="text-slate-900">กะเช้า (DAY)</option>
              <option value="NIGHT" className="text-slate-900">กะดึก (NIGHT)</option>
            </select>
          </div>

          <div className="ml-auto text-[11px] text-slate-400 font-mono">
            พบ {filteredLogs.length} รายการตรวจในช่วงที่เลือก
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('reports')}
          className={cn(
            "pb-3.5 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0",
            activeTab === 'reports'
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <FileText className="w-4 h-4" />
          <span>สร้างรายงานอัจฉริยะ (AI Executive Reports)</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            "pb-3.5 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0",
            activeTab === 'chat'
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <Bot className="w-4 h-4" />
          <span>สอบถาม & สนทนาอิสระ (Interactive Q&A)</span>
        </button>

        <button
          onClick={() => setActiveTab('memory')}
          className={cn(
            "pb-3.5 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0",
            activeTab === 'memory'
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <Bookmark className="w-4 h-4" />
          <span>คลังความจำ & ข้อสั่งการ ({shiftNotes.length})</span>
        </button>
      </div>

      {/* TAB 1: EXECUTIVE REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          
          {/* 4 Report Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Report 1: Quality Summary */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                    สรุปภาพรวมคุณภาพ (QC)
                  </h3>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    สรุป % การตรวจครบถ้วน, ค่าพารามิเตอร์ผิดปกติ (OOC) และเครื่องที่ต้องเฝ้าระวัง
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleGenerateReport('quality_summary', 'รายงานสรุปการตรวจและควบคุมคุณภาพ (Quality Control Summary)')}
                disabled={aiLoading}
                className="mt-4 w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>สร้างรายงานคุณภาพ</span>
              </button>
            </div>

            {/* Report 2: Shift Performance Evaluation */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors">
                    ประเมินผลงานทีมงานประจำกะ
                  </h3>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    เจาะลึกความรับผิดชอบ วินัยเรื่องเวลา และความละเอียดของหัวหน้ากะและลูกทีม
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleGenerateReport('shift_eval', 'รายงานประเมินความรับผิดชอบและผลงานทีมงานประจำกะ (Shift Performance Evaluation)')}
                disabled={aiLoading}
                className="mt-4 w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Award className="w-3.5 h-3.5" />
                <span>ประเมินผลงานทีมกะ</span>
              </button>
            </div>

            {/* Report 3: Handover Brief */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                    สรุปส่งมอบงานระหว่างกะ
                  </h3>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    สรุปงานที่เสร็จ, รายการค้างตรวจ, และส่งต่อจุดสำคัญให้กะถัดไปรับช่วงต่อ
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleGenerateReport('handover', 'รายงานสรุปส่งมอบงานระหว่างกะ (Shift Handover Brief)')}
                disabled={aiLoading}
                className="mt-4 w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>สรุปส่งมอบงานกะ</span>
              </button>
            </div>

            {/* Report 4: Equipment Risk Alert */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-rose-600 transition-colors">
                    วิเคราะห์จุดเสี่ยงเครื่องจักร
                  </h3>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    จัดอันดับเครื่องที่มีปัญหาบ่อย (Gas Night, MI-035 ฯลฯ) พร้อมข้อเสนอแนะ PM
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleGenerateReport('risk_analysis', 'รายงานวิเคราะห์ความเสี่ยงเครื่องจักรและแนวโน้มความเสื่อมสภาพ (Equipment Risk Analysis)')}
                disabled={aiLoading}
                className="mt-4 w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>วิเคราะห์จุดเสี่ยง</span>
              </button>
            </div>

          </div>

          {/* Report Viewer / Loading State */}
          {aiLoading && (
            <div className="bg-white rounded-3xl p-12 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Sparkles className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-ping"></div>
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-base">กำลังประมวลผลรายงานด้วย Gemini 3.8 Flash...</h4>
                <p className="text-slate-500 text-xs max-w-md">
                  AI กำลังวิเคราะห์ข้อมูลการตรวจเช็ก พารามิเตอร์ผิดปกติ เกณฑ์รอบเวลา และประเมินวินัยทีมงานประจำกะ
                </p>
              </div>
            </div>
          )}

          {currentReport && !aiLoading && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-lg overflow-hidden animate-in fade-in duration-300">
              
              {/* Report Header Bar */}
              <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm tracking-tight">{currentReportTitle}</h3>
                    <p className="text-[10px] text-slate-400 font-mono">
                      ข้อมูลประจำวันที่: {selectedDate} · ประมวลผลเมื่อ: {new Date().toLocaleTimeString('th-TH')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(currentReport)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>พิมพ์รายงาน</span>
                  </button>
                </div>
              </div>

              {/* Report Body with formatting */}
              <div className="p-6 sm:p-8 space-y-4 text-slate-800 leading-relaxed text-sm bg-slate-50/30">
                <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
                  {currentReport}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* TAB 2: INTERACTIVE CHAT */}
      {activeTab === 'chat' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md flex flex-col h-[700px] overflow-hidden">
          
          {/* Chat Quick Chips */}
          <div className="p-3 bg-slate-50 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
            <span className="text-[11px] font-bold text-slate-400 shrink-0">คำถามยอดนิยม:</span>
            <button
              onClick={() => handleSendChat(`สรุปผลงานของหัวหน้ากะและลูกทีมในวันที่ ${selectedDate} ให้หน่อย`)}
              className="px-3 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-full font-bold text-slate-600 transition-all shrink-0 cursor-pointer text-[11px]"
            >
              📊 สรุปผลงานกะวันนี้
            </button>
            <button
              onClick={() => handleSendChat('เครื่อง Gas Night ตรวจผ่านครบมั้ย มีปัญหาอะไรบันทึกไว้บ้าง')}
              className="px-3 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-full font-bold text-slate-600 transition-all shrink-0 cursor-pointer text-[11px]"
            >
              ⚠️ เช็กเครื่อง Gas Night
            </button>
            <button
              onClick={() => handleSendChat('มีเครื่องไหนตรวจช้า (Late) หรือค้างตรวจบ้าง ใครเป็นผู้รับผิดชอบ')}
              className="px-3 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-full font-bold text-slate-600 transition-all shrink-0 cursor-pointer text-[11px]"
            >
              ⏱️ ตรวจสอบการตรวจ Late/ค้าง
            </button>
            <button
              onClick={() => handleSendChat('ช่วยสรุปภาพรวมเพื่อพิมพ์ส่งในกลุ่ม LINE ของผู้จัดการ')}
              className="px-3 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-full font-bold text-slate-600 transition-all shrink-0 cursor-pointer text-[11px]"
            >
              📱 ข้อความสรุปส่ง LINE
            </button>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-sm",
                    msg.role === 'user' ? "bg-slate-900" : "bg-gradient-to-tr from-indigo-600 to-indigo-700"
                  )}
                >
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={cn(
                    "p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs",
                    msg.role === 'user'
                      ? "bg-indigo-600 text-white rounded-tr-none font-medium"
                      : "bg-slate-100/80 text-slate-800 rounded-tl-none border border-slate-200/60"
                  )}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <div
                    className={cn(
                      "text-[9px] mt-2 font-mono",
                      msg.role === 'user' ? "text-indigo-200" : "text-slate-400"
                    )}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString('th-TH')}
                  </div>
                </div>
              </div>
            ))}

            {aiLoading && (
              <div className="flex gap-3 mr-auto max-w-[80%]">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <div className="p-4 rounded-2xl rounded-tl-none bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]"></span>
                  <span className="font-bold text-slate-500 ml-1">AI กำลังวิเคราะห์และพิมพ์คำตอบ...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="พิมพ์คำถาม เช่น 'ประเมินผลงานของหัวหน้ากะ Wit', 'สรุปเครื่องที่ตรวจช้า'..."
                className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs sm:text-sm font-medium"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || aiLoading}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
              >
                <span>ส่ง</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

        </div>
      )}

      {/* TAB 3: SHIFT MEMORY & DIRECTIVES */}
      {activeTab === 'memory' && (
        <div className="space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-indigo-600" />
                <span>คลังข้อสั่งการและสิ่งที่ให้ AI จดจำ (Supervisor Directives & Memory)</span>
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                บันทึกคำสั่งการจากผู้บริหาร, กฎเกณฑ์พิเศษ, หรือข้อตกลงหน้างาน — ข้อมูลเหล่านี้จะถูกส่งให้ AI นำไปประกอบการประเมินผลงานและสร้างรายงานเสมอ
              </p>
            </div>

            <button
              onClick={() => setShowAddNoteModal(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มข้อสั่งการใหม่</span>
            </button>
          </div>

          {/* Notes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shiftNotes.map((note) => (
              <div 
                key={note.id} 
                className={cn(
                  "bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between transition-all hover:shadow-md",
                  note.priority === 'urgent' ? "border-rose-300 bg-rose-50/20" :
                  note.priority === 'high' ? "border-amber-300 bg-amber-50/20" : "border-slate-200"
                )}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider",
                      note.category === 'directive' ? "bg-indigo-100 text-indigo-700" :
                      note.category === 'quality_alert' ? "bg-amber-100 text-amber-700" :
                      note.category === 'handover' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                    )}>
                      {note.category === 'directive' ? 'คำสั่งการผู้บริหาร' :
                       note.category === 'quality_alert' ? 'แจ้งเตือนคุณภาพ' :
                       note.category === 'handover' ? 'บันทึกส่งมอบงาน' : 'ประเมินพิเศษ'}
                    </span>

                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                      title="ลบบันทึกนี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h4 className="font-extrabold text-slate-900 text-sm leading-snug">{note.title}</h4>
                  <p className="text-slate-600 text-xs leading-relaxed">{note.content}</p>

                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {note.tags.map(t => (
                        <span key={t} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>ผู้บันทึก: {note.authorName}</span>
                  <span>{new Date(note.createdAt).toLocaleDateString('th-TH')}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* Add Directive Modal */}
      {showAddNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-base">เพิ่มข้อสั่งการ / สิ่งที่ให้ AI จดจำ</h3>
              <button 
                onClick={() => setShowAddNoteModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">หัวข้อข้อสั่งการ / ประเด็นหลัก</label>
                <input
                  type="text"
                  required
                  value={newNoteTitle}
                  onChange={e => setNewNoteTitle(e.target.value)}
                  placeholder="เช่น มาตรการเฝ้าระวังเครื่อง Gas Night ช่วงกะดึก"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">หมวดหมู่</label>
                <select
                  value={newNoteCategory}
                  onChange={e => setNewNoteCategory(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="directive">คำสั่งการผู้บริหาร (Directive)</option>
                  <option value="quality_alert">แจ้งเตือนคุณภาพ (Quality Alert)</option>
                  <option value="handover">ข้อตกลงส่งมอบงานระหว่างกะ (Handover)</option>
                  <option value="evaluation">เกณฑ์ประเมินทีมงานพิเศษ (Evaluation Note)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">ความสำคัญ / ความเร่งด่วน</label>
                <select
                  value={newNotePriority}
                  onChange={e => setNewNotePriority(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="urgent">🔴 ด่วนที่สุด (Urgent)</option>
                  <option value="high">🟡 สำคัญสูง (High)</option>
                  <option value="normal">🔵 ปกติ (Normal)</option>
                  <option value="low">⚪ ทั่วไป (Low)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">รายละเอียดข้อสั่งการ / ข้อกำหนดที่ต้องการให้ AI วิเคราะห์</label>
                <textarea
                  required
                  rows={4}
                  value={newNoteContent}
                  onChange={e => setNewNoteContent(e.target.value)}
                  placeholder="ระบุรายละเอียด เช่น กำหนดให้หัวหน้ากะต้องตรวจเช็กเครื่องก่อนเวลา 21:00 น. หากช้ากว่านี้ให้ถือว่าผิดวินัยรอบเวลา..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">ตำแหน่ง / ผู้สั่งการ</label>
                <input
                  type="text"
                  value={newNoteAuthor}
                  onChange={e => setNewNoteAuthor(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddNoteModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-sm"
                >
                  บันทึกให้ AI จดจำ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
