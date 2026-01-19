
// Fix: Added global declaration for chrome to resolve TS errors
/* global chrome */
declare var chrome: any;

// Main React component for the extension's UI.
import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Play, Square, Trash2, MousePointer2, 
  History, ArrowLeft,
  ChevronRight, Activity,
  Edit3, Settings, Globe, Zap, Database, AlertTriangle
} from 'lucide-react';

const safeChrome = {
  storage: {
    local: {
      get: (keys: string[], cb: (res: any) => void) => {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.get(keys, cb);
        } else {
          const res: any = {};
          keys.forEach(k => {
            const val = localStorage.getItem(k);
            res[k] = val ? JSON.parse(val) : undefined;
          });
          cb(res);
        }
      },
      set: (data: any, cb?: () => void) => {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set(data, cb);
        } else {
          Object.keys(data).forEach(k => localStorage.setItem(k, JSON.stringify(data[k])));
          if (cb) cb();
        }
      }
    }
  },
  runtime: {
    sendMessage: (msg: any, cb?: (res: any) => void) => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(msg, cb);
      } else {
        console.warn("Chrome Runtime no disponible");
        if (cb) cb(null);
      }
    },
    openOptionsPage: () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      }
    }
  },
  tabs: {
    query: (query: any) => {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
          chrome.tabs.query(query, resolve);
        } else {
          resolve([]);
        }
      });
    }
  }
};

const App = () => {
  const [view, setView] = useState<'recorder' | 'history' | 'detail'>('recorder');
  const [status, setStatus] = useState({ isRecording: false, isPaused: false, sessionId: null, startTime: null });
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [selectedActions, setSelectedActions] = useState<any[]>([]);
  const [screenshots, setScreenshots] = useState<Record<string, string>>({});
  const [tabInfo, setTabInfo] = useState({ isValid: false, url: '' });
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  // Clean up object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(screenshots).forEach(url => URL.revokeObjectURL(url));
    };
  }, [screenshots]);

  const refreshStatus = useCallback(() => {
    // 🛡️ REFACTOR: Get status from the service worker as the single source of truth.
    safeChrome.runtime.sendMessage({ type: 'GET_STATUS' }, (currentStatus) => {
      if (currentStatus) setStatus(currentStatus);
    });
  }, []);

  const refreshData = useCallback(() => {
    safeChrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, (data) => setSessions(data || []));
  }, []);

  useEffect(() => {
    refreshStatus();
    refreshData();
    
    const checkTab = async () => {
      const tabs: any = await safeChrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      setTabInfo({ isValid: !!(tab && tab.url?.startsWith('http')), url: tab?.url || '' });
    };
    checkTab();

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      const listener = (message: any) => {
        if (message.type === 'STATUS_UPDATED') {
          refreshStatus();
          refreshData();
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, [refreshStatus, refreshData]);

  const startRecording = () => {
    if (!tabInfo.isValid) return;
    safeChrome.runtime.sendMessage({ 
      type: 'START_RECORDING', 
      payload: { name: `Session: ${new URL(tabInfo.url).hostname}`, url: tabInfo.url } 
    }, (res) => {
      if (res?.success) setView('recorder');
    });
  };

  const stopRecording = () => {
    safeChrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (res) => {
      refreshData();
      if (res?.session) openDetail(res.session);
    });
  };

  const openDetail = async (session: any) => {
    setSelectedSession(session);
    setView('detail');
    setIsLoadingActions(true);
    
    // Carga diferida de acciones del shard
    safeChrome.runtime.sendMessage({ type: 'GET_SESSION_ACTIONS', payload: session.id }, (actions: any[]) => {
      setSelectedActions(actions || []);
      setIsLoadingActions(false);
      
      actions?.forEach((act: any) => {
        const imgId = act.elementId || act.screenshotId;
        if (imgId && !screenshots[imgId]) {
          safeChrome.runtime.sendMessage({ type: 'GET_SCREENSHOT', payload: imgId }, (dataUrl: string) => {
            if (dataUrl && dataUrl.startsWith('data:image/')) {
              // 🛡️ SECURITY FIX: Convert data URI to blob URL to mitigate XSS risks.
              fetch(dataUrl)
                .then(res => res.blob())
                .then(blob => {
                  const objectURL = URL.createObjectURL(blob);
                  setScreenshots(prev => ({ ...prev, [imgId]: objectURL }));
                })
                .catch(err => console.error("Error creating blob URL:", err));
            }
          });
        }
      });
    });
  };

  const getActionIcon = (type: string) => {
    switch(type) {
      case 'click': return <MousePointer2 size={12} />;
      case 'input': return <Edit3 size={12} />;
      case 'network': return <Globe size={12} className="text-indigo-400" />;
      default: return <Zap size={12} />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-200 text-sm overflow-hidden antialiased font-sans">
      <header className="p-4 glass border-b border-white/10 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg"><Activity size={16} className="text-white" /></div>
          <div>
            <span className="font-bold tracking-tight text-white uppercase text-[10px] block leading-none">Journey Pro</span>
            <span className="text-indigo-400 text-[9px] font-black tracking-widest uppercase">Fragmented Auditor</span>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setView('recorder')} className={`p-2 rounded-lg ${view === 'recorder' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`} aria-label="Recorder"><Play size={16}/></button>
          <button onClick={() => { setView('history'); refreshData(); }} className={`p-2 rounded-lg ${view === 'history' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`} aria-label="History"><History size={16}/></button>
          <button onClick={() => safeChrome.runtime.openOptionsPage()} className="p-2 text-slate-400 hover:bg-white/5" aria-label="Settings"><Settings size={16}/></button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden bg-slate-950/50">
        {view === 'recorder' && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in zoom-in-95">
            {!status.isRecording ? (
              <>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto bg-indigo-500/10 border border-indigo-500/20 shadow-2xl shadow-indigo-500/10 relative">
                   <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping opacity-20"></div>
                   <Play size={32} className="text-indigo-400 ml-1" />
                </div>
                <div><h2 className="text-xl font-black text-white uppercase">Grabador de Sesión</h2><p className="text-xs text-slate-500 mt-2">Arquitectura O(M) de alto rendimiento.</p></div>
                <button onClick={startRecording} disabled={!tabInfo.isValid} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black transition-all active:scale-95">INICIAR CAPTURA</button>
              </>
            ) : (
              <div className="space-y-8 animate-pulse">
                <div className="w-28 h-28 mx-auto rounded-full flex items-center justify-center border-4 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]"><Square size={40} className="text-red-500" fill="currentColor"/></div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-red-500 uppercase tracking-[0.2em]">Grabando</h2>
                  <p className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1 uppercase tracking-widest"><Globe size={10} className="text-indigo-400"/> Fragmentación Activa</p>
                </div>
                <button onClick={stopRecording} className="bg-red-600 text-white px-10 py-4 rounded-2xl font-black flex items-center gap-2 active:scale-95 transition-all"><Square size={16} fill="white"/> FINALIZAR</button>
              </div>
            )}
          </div>
        )}

        {view === 'history' && (
          <div className="h-full overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <h2 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2"><Database size={10}/> Sesiones (Índice de Metadatos)</h2>
            {sessions.length === 0 && <div className="py-20 text-center opacity-20 italic text-xs text-white">No hay sesiones</div>}
            {sessions.map((s: any) => (
              <div key={s.id} onClick={() => openDetail(s)} className="glass p-4 rounded-2xl border-white/5 hover:border-indigo-500/30 transition-all flex justify-between items-center cursor-pointer group">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold truncate text-slate-200 group-hover:text-indigo-400 transition-colors">{s.title}</h4>
                  <div className="flex gap-2 mt-1 items-center">
                    <span className="text-[9px] text-slate-600 font-bold uppercase">{new Date(s.createdDate).toLocaleDateString()}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                    <span className="text-[9px] text-indigo-400 font-black uppercase flex items-center gap-1"><Zap size={8}/> {s.actionCount} Eventos</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-700 group-hover:translate-x-1 group-hover:text-indigo-400"/>
              </div>
            ))}
          </div>
        )}

        {view === 'detail' && selectedSession && (
          <div className="h-full flex flex-col overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-white/10 flex items-center justify-between glass">
              <button onClick={() => { setView('history'); setConfirmingDelete(null); }} className="p-2 text-slate-500 hover:text-white" aria-label="Back to history"><ArrowLeft size={18}/></button>
              <h3 className="font-black text-[10px] uppercase tracking-widest truncate max-w-[150px]">{selectedSession.title}</h3>
              <button
                onClick={() => {
                  if (confirmingDelete === selectedSession.id) {
                    safeChrome.runtime.sendMessage({type:'DELETE_SESSION', payload:selectedSession.id}, refreshData);
                    setView('history');
                    setConfirmingDelete(null);
                  } else {
                    setConfirmingDelete(selectedSession.id);
                  }
                }}
                onMouseLeave={() => setConfirmingDelete(null)}
                onBlur={() => setConfirmingDelete(null)}
                className={`p-2 rounded-lg transition-all ${
                  confirmingDelete === selectedSession.id
                    ? 'bg-red-500/20 text-red-400'
                    : 'text-slate-600 hover:text-red-500'
                }`}
                aria-label={confirmingDelete === selectedSession.id ? 'Confirm delete' : 'Delete session'}
              >
                {confirmingDelete === selectedSession.id ? <AlertTriangle size={16}/> : <Trash2 size={16}/>}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {isLoadingActions ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 opacity-50">
                  <Activity size={24} className="animate-spin text-indigo-500"/>
                  <span className="text-[10px] font-black uppercase tracking-widest">Cargando fragmento de acciones...</span>
                </div>
              ) : (
                selectedActions.map((act: any) => (
                  <div key={act.id} className={`p-3 rounded-xl border flex gap-3 transition-all ${act.type === 'network' ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-white/5 border-white/5'}`}>
                    <div className="mt-0.5 shrink-0">{getActionIcon(act.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-[8px] font-black uppercase tracking-tighter ${act.type === 'network' ? 'text-indigo-400' : 'text-slate-500'}`}>{act.type === 'network' ? 'NETWORK SHARD' : act.type}</span>
                        <span className="text-[8px] font-mono text-slate-700">{new Date(act.timestamp).toLocaleTimeString()}</span>
                      </div>
                      {act.type === 'network' ? (
                        <p className="text-[10px] font-mono text-indigo-300 break-all leading-relaxed"><span className="font-black text-indigo-500">{act.data.method}</span> {act.data.url}</p>
                      ) : (
                        <>
                          <p className="text-slate-200 text-xs font-bold leading-tight mb-1">{act.data.text || act.data.tagName}</p>
                          {(act.elementId || act.screenshotId) && screenshots[act.elementId || act.screenshotId] && (
                            <div className="mt-2 rounded-lg border border-white/5 overflow-hidden bg-black shadow-xl">
                              <img src={screenshots[act.elementId || act.screenshotId]} className="w-full max-h-32 object-contain" alt="Step" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="p-3 bg-slate-900 border-t border-white/5 flex justify-between items-center text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${status.isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-800'}`}></div>
          {status.isRecording ? 'Fragmentando Datos en Tiempo Real' : 'Arquitectura Optimizada'}
        </div>
        <div className="flex items-center gap-1">
          <Zap size={8} className="text-indigo-500"/>
          <span>STORAGE v2 SHARDED</span>
        </div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
