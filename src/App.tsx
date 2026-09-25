import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import PerformCheck from './components/PerformCheck';
import Settings from './components/Settings';
import OocLogs from './components/OocLogs';
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  Settings2, 
  History, 
  ShieldCheck,
  Building2,
  Lock,
  User,
  ChevronRight
} from 'lucide-react';
import { cn } from './lib/utils';

type View = 'dashboard' | 'check' | 'settings' | 'ooc_logs';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [initialEqCode, setInitialEqCode] = useState<string | undefined>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eqCode = params.get('eqCode') || params.get('id') || params.get('equipmentId') || params.get('code') || params.get('eq') || params.get('machine');
    if (eqCode) {
      setInitialEqCode(eqCode);
      setCurrentView('check');
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Premium Light Sidebar Navigation */}
      <nav className="hidden md:flex w-72 bg-white border-r border-slate-200/80 flex-shrink-0 flex-col pt-8 h-screen sticky top-0 z-10 shadow-[4px_0_24px_rgba(15,23,42,0.02)] relative overflow-hidden">
         {/* Subtle organic light gradient glow */}
         <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-50/30 rounded-full blur-3xl pointer-events-none"></div>

         {/* Corporate Top Branding - Clean Slate Deep Tone */}
         <div className="px-6 mb-8 flex items-center gap-3.5 relative z-10">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex justify-center items-center shadow-[0_4px_15px_rgba(79,70,229,0.15)] border border-indigo-400/20 shrink-0">
                 <ShieldCheck className="w-5 h-5 text-white" />
             </div>
             <div className="min-w-0">
               <div className="flex items-center gap-1.5">
                 <h2 className="font-sans font-black text-base tracking-tight leading-none text-slate-900 uppercase">APEX INSPEC</h2>
                 <span className="text-[8px] font-extrabold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-widest scale-90">v3.5</span>
               </div>
               <p className="text-[9px] font-bold tracking-[0.25em] text-slate-400 uppercase mt-1">Multi-Agency Monitor</p>
             </div>
         </div>

         {/* Sidebar Nav Items */}
         <div className="px-3.5 flex flex-col gap-1 relative z-10 flex-1">
             <div className="px-3.5 mb-2.5">
                 <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">การวิเคราะห์ & ข้อมูล</p>
             </div>
             
             <NavItem 
                active={currentView === 'dashboard'} 
                onClick={() => setCurrentView('dashboard')} 
                icon={<LayoutDashboard className="w-[18px] h-[18px]" />} 
                label="แผงควบคุมหลัก" 
                subLabel="Manager Dashboard"
             />
             <NavItem 
                active={currentView === 'ooc_logs'} 
                onClick={() => setCurrentView('ooc_logs')} 
                icon={<History className="w-[18px] h-[18px]" />} 
                label="ประวัติและค่าพารามิเตอร์" 
                subLabel="Inspection History"
             />

             <div className="my-4 border-t border-slate-100 mx-2.5 pt-4">
                 <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1">ปฏิบัติงานหน้างาน</p>
             </div>

             <NavItem 
                active={currentView === 'check'} 
                onClick={() => setCurrentView('check')} 
                icon={<ClipboardCheck className="w-[18px] h-[18px]" />} 
                label="สแกนบันทึกตรวจเช็ก" 
                subLabel="Operator Terminal"
             />

             <div className="my-4 border-t border-slate-100 mx-2.5 pt-4">
                 <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1">ระบบวิศวกรรม</p>
             </div>

             <NavItem 
                active={currentView === 'settings'} 
                onClick={() => setCurrentView('settings')} 
                icon={<Settings2 className="w-[18px] h-[18px]" />} 
                label="ตั้งค่าเกณฑ์เครื่องมือ" 
                subLabel="Control Center"
             />
         </div>
         
         {/* Beautiful Profile / Operator Card & Server Status (Double Deck UI - Light Edition) */}
         <div className="p-4 relative z-10 mt-auto border-t border-slate-100 bg-slate-50/50">
            {/* Operator Widget */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/60 mb-3 shadow-sm">
               <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-600 shrink-0">
                  <User className="w-4 h-4" />
               </div>
               <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-slate-800 truncate">Sarah Connor</p>
                  <p className="text-[9px] text-slate-400 font-bold font-mono">SC-101 · หัวหน้าผู้ตรวจ</p>
               </div>
               <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.3)]"></div>
            </div>

            {/* Network secure health bar */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold px-1">
               <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  ระบบเชื่อมต่อคลาวด์ปกติ
               </span>
               <span className="font-mono text-slate-400">SECURE SSL</span>
            </div>
         </div>
      </nav>

      {/* Mobile Top Header (Light Theme Matching) */}
      <header className="md:hidden bg-white border-b border-slate-200/80 px-4 py-3.5 sticky top-0 z-20 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2.5">
             <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex justify-center items-center">
                 <ShieldCheck className="w-4 h-4 text-white" />
             </div>
             <div>
               <h2 className="font-sans font-black tracking-tight text-slate-900 text-sm uppercase">APEX INSPEC</h2>
               <p className="text-[8px] font-bold tracking-widest text-slate-400 uppercase leading-none">Enterprise</p>
             </div>
        </div>

        <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Online
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 mb-20 md:mb-0 max-h-screen md:overflow-y-auto relative z-10 w-full bg-slate-50">
         <div className={currentView === 'settings' ? "w-full pb-10" : "w-full max-w-7xl mx-auto pb-10"}>
            {currentView === 'dashboard' && <Dashboard selectedDept="all" />}
            {currentView === 'ooc_logs' && <OocLogs selectedDept="all" />}
            {currentView === 'check' && (
              <PerformCheck onSaved={() => setCurrentView('dashboard')} initialEqCode={initialEqCode} selectedDept="all" />
            )}
            {currentView === 'settings' && <Settings />}
         </div>
      </main>

      {/* Mobile Bottom Navigation (Light Theme Matching) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 pb-safe shadow-md">
        <div className="flex justify-around items-center h-16">
          <MobileNavItem 
             active={currentView === 'dashboard'} 
             onClick={() => setCurrentView('dashboard')} 
             icon={<LayoutDashboard className="w-5 h-5" />} 
             label="ภาพรวม" 
          />
          <MobileNavItem 
             active={currentView === 'ooc_logs'} 
             onClick={() => setCurrentView('ooc_logs')} 
             icon={<History className="w-5 h-5" />} 
             label="ประวัติ" 
          />
          <MobileNavItem 
             active={currentView === 'check'} 
             onClick={() => setCurrentView('check')} 
             icon={<ClipboardCheck className="w-5 h-5" />} 
             label="สแกนตรวจ" 
          />
          <MobileNavItem 
             active={currentView === 'settings'} 
             onClick={() => setCurrentView('settings')} 
             icon={<Settings2 className="w-5 h-5" />} 
             label="ตั้งค่า" 
          />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, subLabel }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, subLabel: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex w-full min-w-max items-center gap-3.5 px-4 py-3 rounded-xl font-bold transition-all duration-300 text-left outline-none relative group border border-transparent",
        active 
          ? "text-indigo-600 bg-indigo-50/70 border-indigo-100 shadow-[0_2px_10px_rgba(79,70,229,0.04)]" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {/* Soft vertical stripe for active item */}
      {active && (
         <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-600 rounded-r-full shadow-[0_0_8px_rgba(79,70,229,0.5)]"></div>
      )}

      <span className={cn("transition-colors duration-300 shrink-0 relative z-10", active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")}>{icon}</span>
      <div className="relative z-10 flex flex-col min-w-0">
        <span className={cn("font-sans leading-tight transition-colors duration-300 text-xs sm:text-[13px] font-bold", active ? "text-indigo-600" : "text-slate-700 group-hover:text-slate-950")}>{label}</span>
        <span className={cn("text-[9px] font-bold tracking-wide mt-0.5 opacity-85", active ? "text-indigo-500/80" : "text-slate-400 group-hover:text-slate-500")}>{subLabel}</span>
      </div>
      
      {/* Subtle right arrow on hover when inactive */}
      {!active && (
         <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-slate-400 shrink-0" />
      )}
    </button>
  );
}

function MobileNavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors relative",
        active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
      )}
    >
      <div className={cn(
         "transition-transform duration-200",
         active && "-translate-y-0.5"
      )}>{icon}</div>
      <span className="text-[9px] font-bold tracking-wide leading-none">{label}</span>
      {active && <div className="absolute top-0 w-8 h-0.5 bg-indigo-600 rounded-b-full"></div>}
    </button>
  );
}

export default App;
