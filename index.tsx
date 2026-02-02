

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
    },
    onMessage: {
      addListener: (listener: (message: any) => void) => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
          chrome.runtime.onMessage.addListener(listener);
        }
      },
      removeListener: (listener: (message: any) => void) => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
          chrome.runtime.onMessage.removeListener(listener);
        }
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

// This is a pure function, so it's defined outside the component
// to prevent being redeclared on every render.
const getActionIcon = (type: string) => {
  switch(type) {
    case 'click': return <MousePointer2 className="icon-size-12" absoluteStrokeWidth={true} />;
    case 'input': return <Edit3 className="icon-size-12" absoluteStrokeWidth={true} />;
    case 'network': return <Globe className="icon-size-12 text-indigo-400" absoluteStrokeWidth={true} />;
    default: return <Zap className="icon-size-12" absoluteStrokeWidth={true} />;
  }
};

const App = () => {
  const [view, setView] = useState<'recorder' | 'history' | 'detail'>('recorder');
  const [status, setStatus] = useState({ isRecording: false, isPaused: false, sessionId: null, startTime: null });
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [selectedActions, setSelectedActions] = useState<any[]>([]);
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const [tabInfo, setTabInfo] = useState({ isValid: false, url: '' });
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showNotification = useCallback((message, type = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const fetchStatus = useCallback(() => {
    safeChrome.runtime.sendMessage({ type: 'GET_STATUS' }, (status) => {
      if (status) setStatus(status);
    });
  }, []);

  const refreshData = useCallback(() => {
    safeChrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, (data) => setSessions(data || []));
  }, []);

  useEffect(() => {
    fetchStatus();
    refreshData();
    
    const checkTab = async () => {
      const tabs: any = await safeChrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      setTabInfo({ isValid: !!(tab && tab.url?.startsWith('http')), url: tab?.url || '' });
    };
    checkTab();

    const listener = (message: any) => {
      if (message.type === 'STATUS_UPDATED') {
        fetchStatus();
        refreshData();
      } else if (message.type === 'SCREENSHOT_FAILED') {
        showNotification(message.payload.message, 'error');
      }
    };
    safeChrome.runtime.onMessage.addListener(listener);
    return () => safeChrome.runtime.onMessage.removeListener(listener);
  }, [fetchStatus, refreshData, showNotification]);

  useEffect(() => {
    // Devuelve una función de limpieza que se ejecutará al desmontar.
    return () => {
      // Revocar todos los object URLs para prevenir fugas de memoria.
      // Usamos el callback de `setObjectUrls` para acceder al estado más reciente
      // sin necesidad de añadir dependencias al hook.
      setObjectUrls(currentUrls => {
        Object.values(currentUrls).forEach(URL.revokeObjectURL);
        return {}; // Limpiar el estado al desmontar.
      });
    };
  }, []); // El array vacío asegura que esto solo se ejecute al montar/desmontar.

  const startRecording = useCallback(() => {
    if (!tabInfo.isValid) return;
    safeChrome.runtime.sendMessage({ 
      type: 'START_RECORDING', 
      payload: { name: `Session: ${new URL(tabInfo.url).hostname}`, url: tabInfo.url } 
    }, (res) => {
      if (res?.success) setView('recorder');
    });
  }, [tabInfo]);

  const openDetail = useCallback(async (session: any) => {
    setSelectedSession(session);
    setView('detail');
    setIsLoadingActions(true);

    // Clear the view immediately while new data is fetched.
    setSelectedActions([]);
    setObjectUrls(prevUrls => {
      Object.values(prevUrls).forEach(URL.revokeObjectURL);
      return {};
    });

    safeChrome.runtime.sendMessage({ type: 'GET_SESSION_ACTIONS', payload: session.id }, (actions: any[]) => {
      if (!actions) {
        setIsLoadingActions(false);
        return;
      }
      setSelectedActions(actions);

      const screenshotIds = actions
        .map((act: any) => act.elementId || act.screenshotId)
        .filter(Boolean);

      if (screenshotIds.length > 0) {
        safeChrome.runtime.sendMessage({ type: 'GET_SCREENSHOTS_BATCH', payload: screenshotIds }, (dataUriMap: Record<string, string>) => {
          if (!dataUriMap) {
            setIsLoadingActions(false);
            return;
          }

          const promises = Object.entries(dataUriMap).map(async ([id, dataUri]) => {
            if (dataUri && dataUri.startsWith('data:image/')) {
              try {
                const res = await fetch(dataUri);
                const blob = await res.blob();
                return { id, url: URL.createObjectURL(blob) };
              } catch (err) {
                console.error("Error creating object URL:", err);
                return null;
              }
            }
            return null;
          });

          Promise.all(promises).then(results => {
            const validResults = results.filter(Boolean) as { id: string, url: string }[];
            setObjectUrls(prevUrls => {
              // Atomic update: revoke all previous URLs and set the new ones.
              Object.values(prevUrls).forEach(URL.revokeObjectURL);

              const newUrls = {}; // Start with a clean slate.
              validResults.forEach(({ id, url }) => {
                newUrls[id] = url;
              });
              return newUrls;
            });
            setIsLoadingActions(false);
          });
        });
      } else {
        setIsLoadingActions(false);
      }
    });
  }, []);

  const stopRecording = useCallback(() => {
    safeChrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (res) => {
      refreshData();
      if (res?.session) openDetail(res.session);
    });
  }, [refreshData, openDetail]);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-200 text-sm overflow-hidden antialiased font-sans">

      {notification && (
        <div className={`p-3 text-xs text-center animate-in fade-in slide-in-from-top-2 z-50 ${
          notification.type === 'error'
            ? 'bg-red-500/20 border-b border-red-500/30 text-red-300'
            : 'bg-green-500/20 border-b border-green-500/30 text-green-300'
        }`}>
          {notification.message}
        </div>
      )}

      <header className="p-4 glass border-b border-white/10 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg"><Activity className="icon-size-16 text-white" absoluteStrokeWidth={true} /></div>
          <div>
            <span className="font-bold tracking-tight text-white uppercase text-[10px] block leading-none">Journey Pro</span>
            <span className="text-indigo-400 text-[9px] font-black tracking-widest uppercase">Fragmented Auditor</span>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setView('recorder')} className={`p-2 rounded-lg ${view === 'recorder' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`} aria-label="Recorder"><Play className="icon-size-16" absoluteStrokeWidth={true} /></button>
          <button onClick={() => { setView('history'); refreshData(); }} className={`p-2 rounded-lg ${view === 'history' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`} aria-label="History"><History className="icon-size-16" absoluteStrokeWidth={true} /></button>
          <button onClick={() => safeChrome.runtime.openOptionsPage()} className="p-2 text-slate-400 hover:bg-white/5" aria-label="Settings"><Settings className="icon-size-16" absoluteStrokeWidth={true} /></button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden bg-slate-950/50">
        {view === 'recorder' && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in zoom-in-95">
            {!status.isRecording ? (
              <>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto bg-indigo-500/10 border border-indigo-500/20 shadow-2xl shadow-indigo-500/10 relative">
                   <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping opacity-20"></div>
                   <Play className="icon-size-32 text-indigo-400 ml-1" absoluteStrokeWidth={true} />
                </div>
                <div><h2 className="text-xl font-black text-white uppercase">Grabador de Sesión</h2><p className="text-xs text-slate-500 mt-2">Arquitectura O(M) de alto rendimiento.</p></div>
                <div className="relative w-full group">
                  <button onClick={startRecording} disabled={!tabInfo.isValid} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">INICIAR CAPTURA</button>
                  {!tabInfo.isValid && (
                    <div className="absolute bottom-full mb-2 w-max max-w-xs px-3 py-1.5 bg-slate-800 text-slate-200 text-xs rounded-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none -translate-x-1/2 left-1/2 shadow-lg">
                      La grabación no está disponible en esta página (ej. páginas chrome:// o pestañas nuevas).
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-8 animate-pulse">
                <div className="w-28 h-28 mx-auto rounded-full flex items-center justify-center border-4 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]"><Square className="icon-size-40 text-red-500" fill="currentColor" absoluteStrokeWidth={true} /></div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-red-500 uppercase tracking-[0.2em]">Grabando</h2>
                  <p className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-1 uppercase tracking-widest"><Globe className="icon-size-10 text-indigo-400" absoluteStrokeWidth={true} /> Fragmentación Activa</p>
                </div>
                <button onClick={stopRecording} className="bg-red-600 text-white px-10 py-4 rounded-2xl font-black flex items-center gap-2 active:scale-95 transition-all"><Square className="icon-size-16" fill="white" absoluteStrokeWidth={true} /> FINALIZAR</button>
              </div>
            )}
          </div>
        )}

        {view === 'history' && (
          <div className="h-full overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <h2 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2"><Database className="icon-size-10" absoluteStrokeWidth={true} /> Sesiones (Índice de Metadatos)</h2>
            {sessions.length === 0 && <div className="py-20 text-center opacity-20 italic text-xs text-white">No hay sesiones</div>}
            {sessions.map((s: any) => (
              <div key={s.id} onClick={() => openDetail(s)} className="glass p-4 rounded-2xl border-white/5 hover:border-indigo-500/30 transition-all flex justify-between items-center cursor-pointer group">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold truncate text-slate-200 group-hover:text-indigo-400 transition-colors">{s.title}</h4>
                  <div className="flex gap-2 mt-1 items-center">
                    <span className="text-[9px] text-slate-600 font-bold uppercase">{new Date(s.createdDate).toLocaleDateString()}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                    <span className="text-[9px] text-indigo-400 font-black uppercase flex items-center gap-1"><Zap className="icon-size-8" absoluteStrokeWidth={true} /> {s.actionCount} Eventos</span>
                  </div>
                </div>
                <ChevronRight className="icon-size-16 text-slate-700 group-hover:translate-x-1 group-hover:text-indigo-400" absoluteStrokeWidth={true} />
              </div>
            ))}
          </div>
        )}

        {view === 'detail' && selectedSession && (
          <div className="h-full flex flex-col overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-white/10 flex items-center justify-between glass">
              <button onClick={() => { setView('history'); setConfirmingDelete(null); }} className="p-2 text-slate-500 hover:text-white" aria-label="Back to history"><ArrowLeft className="icon-size-18" absoluteStrokeWidth={true} /></button>
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
                {confirmingDelete === selectedSession.id ? <AlertTriangle className="icon-size-16" absoluteStrokeWidth={true} /> : <Trash2 className="icon-size-16" absoluteStrokeWidth={true} />}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {isLoadingActions ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 opacity-50">
                  <Activity className="icon-size-24 animate-spin text-indigo-500" absoluteStrokeWidth={true} />
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
                          {(act.elementId || act.screenshotId) && objectUrls[act.elementId || act.screenshotId] && (
                            <div className="mt-2 rounded-lg border border-white/5 overflow-hidden bg-black shadow-xl">
                              <img
                                src={objectUrls[act.elementId || act.screenshotId]}
                                className="w-full max-h-32 object-contain"
                                alt={`Screenshot of a ${act.type} action on a ${act.data.tagName} element with text "${act.data.text}"`}
                              />
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
          <Zap className="icon-size-8 text-indigo-500" absoluteStrokeWidth={true} />
          <span>STORAGE v2 SHARDED</span>
        </div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
