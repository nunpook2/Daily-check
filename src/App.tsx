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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-shrink-0 flex-col pt-8 h-screen sticky top-0 z-10 transition-all">
         <div className="px-6 mb-8 flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex justify-center items-center">
                 <Stethoscope className="w-5 h-5" />
             </div>
             <div>
               <h2 className="font-bold tracking-tight leading-tight">LabControl</h2>
               <p className="text-[10px] font-mono font-medium tracking-widest text-slate-400 uppercase">System</p>
             </div>
         </div>
         <div className="px-3 flex flex-col gap-2">
             <NavItem 
                active={currentView === 'dashboard'} 
                onClick={() => setCurrentView('dashboard')} 
                icon={<LayoutDashboard className="w-4 h-4" />} 
                label="Manager Dashboard" 
             />
             <NavItem 
                active={currentView === 'ooc_logs'} 
                onClick={() => setCurrentView('ooc_logs')} 
                icon={<History className="w-4 h-4" />} 
                label="Inspection History" 
             />
             <NavItem 
                active={currentView === 'check'} 
                onClick={() => setCurrentView('check')} 
                icon={<ClipboardCheck className="w-4 h-4" />} 
                label="Operator Terminal" 
             />
             <div className="my-2 border-t border-slate-100 px-4 pt-4 pb-1">
                 <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Admin</p>
             </div>
             <NavItem 
                active={currentView === 'settings'} 
                onClick={() => setCurrentView('settings')} 
                icon={<Settings2 className="w-4 h-4" />} 
                label="System Settings" 
             />
         </div>
         
         <div className="mt-auto p-6">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
               <p className="text-xs font-semibold text-slate-800 mb-1">Status</p>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Systems Online</span>
               </div>
            </div>
         </div>
      </nav>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
             <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex justify-center items-center">
                 <Stethoscope className="w-4 h-4" />
             </div>
             <h2 className="font-bold tracking-tight">LabControl</h2>
         </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 p-4 md:p-10 lg:p-12 mb-20 md:mb-0 max-h-screen md:overflow-y-auto">
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
        "flex w-full min-w-max items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all relative overflow-hidden group text-left",
        active ? "text-indigo-700 bg-indigo-50/80 font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <span className={cn("relative z-10", active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")}>{icon}</span>
      <span className="relative z-10">{label}</span>
    </button>
  )
}

function MobileNavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
        active ? "text-indigo-600" : "text-slate-400"
      )}
    >
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
      {active && <div className="absolute top-0 w-8 h-0.5 bg-indigo-600 rounded-b-full"></div>}
    </button>
  )
}

export default App;
