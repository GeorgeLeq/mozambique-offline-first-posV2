import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CreateShopSimulation from './CreateShopSimulation';
import { ThemeToggle } from './ThemeToggle';
import { motion, AnimatePresence } from 'motion/react';
import { AmbientBackground } from './AmbientBackground';
import DiagnosticConsole from './DiagnosticConsole';
import { Copy, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { getHardwareFingerprint } from '../subscription/cryptoLicense';

export default function DeviceActivation() {
  const [shopCode, setShopCode] = useState('SHOP-CMSNTG');
  const [masterPin, setMasterPin] = useState('1234');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingShop, setIsCreatingShop] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{code: string; pin: string} | null>(null);

  // Internet and Diagnostics states
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDiagOpen, setIsDiagOpen] = useState(false);
  const [badgeClicks, setBadgeClicks] = useState(0);

  // Backup downloading state variables
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [totalRecords, setTotalRecords] = useState(0);

  const { activateDevice, activateByMasterPin, skipDeviceSetup } = useAuth();

  // Network listener & keydown listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Internet restored!');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Terminal offline. No network access!');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Global shortcut Ctrl+Shift+D or Ctrl+F12 for diagnostics
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') || e.key === 'F12') {
        e.preventDefault();
        setIsDiagOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleShortcut);
    };
  }, []);

  // Handle secret clicks on the connection indicator
  const handleBadgeClick = () => {
    const nextClicks = badgeClicks + 1;
    setBadgeClicks(nextClicks);
    if (nextClicks >= 5) {
      setIsDiagOpen(true);
      setBadgeClicks(0);
      toast.success('Diagnostic mode enabled!');
    } else if (nextClicks > 1) {
      toast(`Click ${5 - nextClicks} more times to open diagnostics`, { icon: '⚙️' });
    }
  };

  const handleQuickDemoPin = async (pin: string) => {
    setMasterPin(pin);
    setError('');
    setIsLoading(true);
    setProgressPercent(0);
    setProgressMessage('Connecting to Supabase cloud with Master PIN...');
    setTotalRecords(0);

    const success = await activateByMasterPin(pin, (percent, msg, count) => {
      setProgressPercent(percent);
      setProgressMessage(msg);
      setTotalRecords(count);
    });

    if (!success) {
      setError('Invalid Master PIN or no connection.');
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setProgressPercent(0);
    setProgressMessage('Validating with Supabase cloud...');
    setTotalRecords(0);
    
    let success = false;
    if (shopCode.trim()) {
      success = await activateDevice(shopCode.trim(), masterPin.trim(), (percent, msg, count) => {
        setProgressPercent(percent);
        setProgressMessage(msg);
        setTotalRecords(count);
      });
    } else if (masterPin.trim()) {
      success = await activateByMasterPin(masterPin.trim(), (percent, msg, count) => {
        setProgressPercent(percent);
        setProgressMessage(msg);
        setTotalRecords(count);
      });
    }

    if (!success) {
      setError('Store code or Master PIN is invalid. Please try again.');
      setIsLoading(false);
    }
  };

  const handleShopCreated = (newShopCode: string, newMasterPin: string) => {
    setShopCode(newShopCode);
    setMasterPin(newMasterPin);
    setCreatedCredentials({ code: newShopCode, pin: newMasterPin });
    setIsCreatingShop(false);
    setError('');
  };

  const handleSkipSetup = async () => {
    const success = await skipDeviceSetup();
    if (!success) {
      setError('Unable to recover the terminal. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 select-none transition-colors duration-500 overflow-hidden relative">
      {/* Top Indicators */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
        <button
          onClick={handleBadgeClick}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer shadow-sm ${
            isOnline 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
          title="Clique 5 vezes para abrir a consola"
        >
          {isOnline ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wifi size={11} />
              <span>Internet OK</span>
            </>
          ) : (
            <>
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <WifiOff size={11} />
              <span>Offline</span>
            </>
          )}
        </button>
      </div>

      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <AmbientBackground />

      <AnimatePresence mode="wait">
        {isCreatingShop ? (
          <motion.div
            key="create-shop"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md relative z-10"
          >
            <CreateShopSimulation 
              onBack={() => setIsCreatingShop(false)} 
              onShopCreated={handleShopCreated} 
            />
          </motion.div>
        ) : (
          <motion.div
            key="activate-device"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.5 }}
            className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-3xl p-10 rounded-[3rem] shadow-[0_8px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-white/60 dark:border-white/10 max-w-md w-full relative z-10"
          >
            {isLoading ? (
              <div className="space-y-6 py-4">
                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                    {/* Rotating outer spinner ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-zinc-800"></div>
                    <motion.div 
                      className="absolute inset-0 rounded-full border-4 border-t-indigo-600 dark:border-t-indigo-400"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                    />
                    <span className="text-xl font-black font-mono text-slate-800 dark:text-zinc-100">
                      {progressPercent}%
                    </span>
                  </div>
                  <h3 className="text-lg font-black tracking-tight text-slate-800 dark:text-zinc-100">Restoring Backup</h3>
                  <p className="text-slate-500 dark:text-zinc-400 text-xs mt-2 font-medium max-w-[280px] mx-auto min-h-[40px] flex items-center justify-center leading-relaxed">
                    {progressMessage}
                  </p>
                </div>

                {/* Modern visual progress bar track */}
                <div className="w-full bg-slate-100 dark:bg-zinc-800/80 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/40 dark:border-white/5 shadow-inner">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-zinc-500 border-t border-slate-100 dark:border-zinc-800/60 pt-4 font-mono uppercase tracking-wider">
                  <span>Local SQLite Isolation</span>
                  <span>{totalRecords} Records</span>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-zinc-100">Set Up Terminal</h1>
                  <p className="text-slate-500 dark:text-zinc-500 mt-2 font-medium">Enter the store code to activate this device.</p>
                </div>

                {/* Simulated Shop Credentials Copy Card */}
                {createdCredentials && (
                  <div className="bg-indigo-950/20 border border-indigo-900 rounded-2xl p-4 mb-6 text-left relative z-10 shadow-sm">
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-3 flex items-center justify-between">
                      <span>Loja Simulações Ativa</span>
                      <span className="text-[8px] font-bold text-zinc-500">BACKOFFICE</span>
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-black/60 px-3 py-2 rounded-xl border border-zinc-900">
                        <div>
                          <span className="text-[8px] font-bold text-zinc-500 block uppercase tracking-wider">Store Code</span>
                          <span className="text-sm font-black font-mono tracking-wider text-white">{createdCredentials.code}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(createdCredentials.code);
                            toast.success('Code copied!');
                          }}
                          className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-indigo-400 rounded-lg cursor-pointer transition-colors"
                          title="Copiar Código"
                        >
                          <Copy size={13} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between bg-black/60 px-3 py-2 rounded-xl border border-zinc-900">
                        <div>
                          <span className="text-[8px] font-bold text-zinc-500 block uppercase tracking-wider">Admin Master PIN</span>
                          <span className="text-sm font-black font-mono tracking-wider text-emerald-400">{createdCredentials.pin}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(createdCredentials.pin);
                            toast.success('Master PIN copied!');
                          }}
                          className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 rounded-lg cursor-pointer transition-colors"
                          title="Copiar PIN"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className={`p-4 rounded-xl mb-6 text-sm text-center font-medium ${error.includes('Loja criada') ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20'}`}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-zinc-400 mb-2">Admin Master PIN *</label>
                    <input
                      type="password"
                      value={masterPin}
                      onChange={(e) => setMasterPin(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-900 dark:text-zinc-100 outline-none transition-all shadow-sm font-mono text-center text-lg tracking-[0.3em]"
                      placeholder="••••••"
                      maxLength={6}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 flex items-center justify-between">
                      <span>Store Code (Optional if using Master PIN)</span>
                    </label>
                    <input
                      type="text"
                      value={shopCode}
                      onChange={(e) => setShopCode(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 outline-none transition-all text-xs"
                      placeholder="Example: SHOP-A7X92B"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-500 text-white font-semibold py-4 rounded-2xl transition-all shadow-xl dark:shadow-[0_10px_30px_-10px_rgba(99,102,241,0.5)] shadow-indigo-600/20 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-center text-sm uppercase tracking-wider"
                  >
                    Activate POS Device
                  </button>

                  <div className="mt-8 text-center border-t border-slate-100 dark:border-white/5 pt-6 space-y-3">
                    <button
                      type="button"
                      onClick={handleSkipSetup}
                      className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer"
                    >
                      Skip setup and enter POS
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCreatingShop(true)}
                      className="text-sm text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors cursor-pointer"
                    >
                      Don’t have a store yet? Create a new one (Simulator)
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <DiagnosticConsole isOpen={isDiagOpen} onClose={() => setIsDiagOpen(false)} />
    </div>
  );
}
