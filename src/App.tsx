import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import PerformCheck from './components/PerformCheck';
import Settings from './components/Settings';
import { LayoutDashboard, ClipboardCheck, Stethoscope, Settings2, History } from 'lucide-react';
import { cn } from './lib/utils';
import OocLogs from './components/OocLogs';

type View = 'dashboard' | 'check' | 'settings' | 'ooc_logs';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [initialEqCode, setInitialEqCode] = useState<string | undefined>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eqCode = params.get('eqCode');
    if (eqCode) {
      setInitialEqCode(eqCode);
      setCurrentView('check');
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900 relative">
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100/40 via-transparent to-transparent"></div>
      
      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex w-64 bg-white/60 backdrop-blur-3xl border-r border-slate-200/60 flex-shrink-0 flex-col pt-8 h-screen sticky top-0 z-10 transition-all relative overflow-hidden">
         {/* Vibrant blurred blobs */}
         <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none blur-3xl"></div>
         <div className="absolute top-[40%] right-[-50%] w-64 h-64 bg-violet-500/10 rounded-full blur-[80px] pointer-events-none"></div>

         <div className="px-6 mb-8 flex items-center gap-3 relative z-10">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex justify-center items-center shadow-[0_0_20px_rgba(99,102,241,0.3)] ring-1 ring-white/50">
                 <Stethoscope className="w-5 h-5" />
             </div>
             <div>
               <h2 className="font-display font-bold text-xl tracking-tight leading-tight text-slate-900">LabControl</h2>
               <p className="text-[10px] font-mono font-bold tracking-widest text-indigo-500/80 uppercase">System</p>
             </div>
         </div>
         <div className="px-3 flex flex-col gap-1.5 relative z-10">
             <NavItem 
                active={currentView === 'dashboard'} 
                onClick={() => setCurrentView('dashboard')} 
                icon={<LayoutDashboard className="w-[18px] h-[18px]" />} 
                label="Manager Dashboard" 
             />
             <NavItem 
                active={currentView === 'ooc_logs'} 
                onClick={() => setCurrentView('ooc_logs')} 
                icon={<History className="w-[18px] h-[18px]" />} 
                label="Inspection History" 
             />
             <NavItem 
                active={currentView === 'check'} 
                onClick={() => setCurrentView('check')} 
                icon={<ClipboardCheck className="w-[18px] h-[18px]" />} 
                label="Operator Terminal" 
             />
             <div className="my-4 border-t border-slate-200/60 mx-2 pt-4 pb-1">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-2">Admin</p>
             </div>
             <NavItem 
                active={currentView === 'settings'} 
                onClick={() => setCurrentView('settings')} 
                icon={<Settings2 className="w-[18px] h-[18px]" />} 
                label="System Settings" 
             />
         </div>
         
         <div className="mt-auto p-4 relative z-10">
            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/60 shadow-sm relative overflow-hidden group hover:border-emerald-200/50 transition-all">
               <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-400/10 rounded-bl-full translate-x-8 -translate-y-8 group-hover:bg-emerald-400/20 transition-all blur-[5px]"></div>
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Network Status</p>
               <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-700 tracking-wide">All Systems Online</span>
               </div>
            </div>
         </div>
      </nav>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 py-3 sticky top-0 z-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex justify-center items-center shadow-md">
                 <Stethoscope className="w-4 h-4" />
             </div>
             <h2 className="font-display font-bold tracking-tight text-slate-900">LabControl</h2>
         </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 p-4 md:p-8 lg:p-12 mb-20 md:mb-0 max-h-screen md:overflow-y-auto relative z-10 w-full">
         <div className={currentView === 'settings' ? "w-full pb-10" : "max-w-6xl mx-auto pb-10"}>
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'ooc_logs' && <OocLogs />}
            {currentView === 'check' && (
              <PerformCheck onSaved={() => setCurrentView('dashboard')} initialEqCode={initialEqCode} />
            )}
            {currentView === 'settings' && <Settings />}
         </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 pb-safe">
        <div className="flex justify-around items-center h-16">
          <MobileNavItem 
             active={currentView === 'dashboard'} 
             onClick={() => setCurrentView('dashboard')} 
             icon={<LayoutDashboard className="w-5 h-5" />} 
             label="Dashboard" 
          />
          <MobileNavItem 
             active={currentView === 'ooc_logs'} 
             onClick={() => setCurrentView('ooc_logs')} 
             icon={<History className="w-5 h-5" />} 
             label="History" 
          />
          <MobileNavItem 
             active={currentView === 'check'} 
             onClick={() => setCurrentView('check')} 
             icon={<ClipboardCheck className="w-5 h-5" />} 
             label="Scan" 
          />
          <MobileNavItem 
             active={currentView === 'settings'} 
             onClick={() => setCurrentView('settings')} 
             icon={<Settings2 className="w-5 h-5" />} 
             label="Settings" 
          />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex w-full min-w-max items-center gap-3.5 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-300 relative overflow-hidden group text-left",
        active ? "text-indigo-700 bg-indigo-600/10 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] ring-1 ring-indigo-500/10" : "text-slate-500 hover:bg-slate-100/60 hover:text-slate-900"
      )}
    >
      <div className={cn(
        "absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-0 bg-indigo-600 rounded-r-full transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]",
        active ? "h-6 opacity-100" : "opacity-0"
      )}></div>
      <span className={cn("relative z-10 transition-colors duration-300", active ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-600")}>{icon}</span>
      <span className={cn("relative z-10 font-sans tracking-wide transition-colors duration-300", active && "text-slate-900")}>{label}</span>
    </button>
  )
}

function MobileNavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-colors relative group",
        active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
      )}
    >
      <div className={cn(
         "transition-transform duration-300",
         active && "-translate-y-1"
      )}>{icon}</div>
      <span className={cn("text-[10px] font-semibold transition-all duration-300", active ? "opacity-100 -translate-y-1" : "opacity-0 translate-y-2 absolute")}>{label}</span>
      {active && <div className="absolute top-0 w-10 h-1 bg-indigo-600 rounded-b-full shadow-[0_2px_8px_rgba(79,70,229,0.4)]"></div>}
    </button>
  )
}

export default App;
