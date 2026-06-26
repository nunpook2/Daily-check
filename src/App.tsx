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
      <nav className="hidden md:flex w-64 bg-gradient-to-b from-indigo-600 via-indigo-700 to-violet-800 border-r border-indigo-500/30 flex-shrink-0 flex-col pt-8 h-screen sticky top-0 z-10 transition-all relative overflow-hidden shadow-2xl shadow-indigo-900/20">
         {/* Vibrant blurred blobs */}
         <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
         <div className="absolute top-[-10%] right-[-50%] w-96 h-96 bg-fuchsia-500/30 rounded-full blur-[100px] pointer-events-none"></div>
         <div className="absolute bottom-[-10%] left-[-20%] w-64 h-64 bg-blue-400/30 rounded-full blur-[80px] pointer-events-none"></div>

         <div className="px-6 mb-8 flex items-center gap-4 relative z-10">
             <div className="w-12 h-12 rounded-2xl bg-white text-indigo-600 flex justify-center items-center shadow-[0_8px_30px_rgba(255,255,255,0.3)] ring-1 ring-white/50">
                 <Stethoscope className="w-6 h-6" />
             </div>
             <div>
               <h2 className="font-display font-black text-2xl tracking-tight leading-tight text-white drop-shadow-md">LabControl</h2>
               <p className="text-[10px] font-mono font-bold tracking-[0.3em] text-indigo-200 uppercase drop-shadow-sm mt-0.5">System</p>
             </div>
         </div>
         <div className="px-4 flex flex-col gap-2 relative z-10">
             <NavItem 
                active={currentView === 'dashboard'} 
                onClick={() => setCurrentView('dashboard')} 
                icon={<LayoutDashboard className="w-[20px] h-[20px]" />} 
                label="Manager Dashboard" 
             />
             <NavItem 
                active={currentView === 'ooc_logs'} 
                onClick={() => setCurrentView('ooc_logs')} 
                icon={<History className="w-[20px] h-[20px]" />} 
                label="Inspection History" 
             />
             <NavItem 
                active={currentView === 'check'} 
                onClick={() => setCurrentView('check')} 
                icon={<ClipboardCheck className="w-[20px] h-[20px]" />} 
                label="Operator Terminal" 
             />
             <div className="my-5 border-t border-indigo-400/30 mx-2 pt-5 pb-1">
                 <p className="text-[10px] font-black text-indigo-200/80 uppercase tracking-[0.25em] pl-2 drop-shadow-sm">Admin</p>
             </div>
             <NavItem 
                active={currentView === 'settings'} 
                onClick={() => setCurrentView('settings')} 
                icon={<Settings2 className="w-[20px] h-[20px]" />} 
                label="System Settings" 
             />
         </div>
         
         <div className="mt-auto p-5 relative z-10">
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-5 border border-white/20 shadow-xl relative overflow-hidden group hover:bg-white/20 transition-all cursor-default">
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/20 rounded-bl-full translate-x-8 -translate-y-8 group-hover:bg-emerald-400/30 transition-all blur-[10px]"></div>
               <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-[0.2em] mb-2 drop-shadow-sm">Network Status</p>
               <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,1)] animate-pulse border border-white/50"></div>
                  <span className="text-[13px] font-bold text-white tracking-wide drop-shadow-md">All Systems Online</span>
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
      <main className="flex-1 p-3 sm:p-5 md:p-8 lg:p-12 mb-20 md:mb-0 max-h-screen md:overflow-y-auto relative z-10 w-full">
         <div className={currentView === 'settings' ? "w-full pb-10" : "w-full max-w-[1600px] mx-auto pb-10"}>
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
        "flex w-full min-w-max items-center gap-3.5 px-4 py-3 rounded-xl font-bold text-[15px] transition-all duration-300 relative overflow-hidden group text-left outline-none",
        active ? "text-white bg-white/20 shadow-[inset_0_1px_4px_rgba(255,255,255,0.1)] ring-1 ring-white/30" : "text-indigo-200 hover:bg-white/10 hover:text-white"
      )}
    >
      <div className={cn(
        "absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-0 bg-white rounded-r-full transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.8)]",
        active ? "h-6 opacity-100" : "opacity-0"
      )}></div>
      <span className={cn("relative z-10 transition-colors duration-300", active ? "text-white drop-shadow-md" : "text-indigo-300 group-hover:text-indigo-100")}>{icon}</span>
      <span className={cn("relative z-10 font-sans tracking-wide transition-colors duration-300", active && "text-white drop-shadow-md")}>{label}</span>
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
