
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Play, Square, Trash2, Code, MousePointer2, 
  History, CheckCircle2, Copy, ArrowLeft, Loader2, Download, 
  Pause, HardDrive, RefreshCw, ChevronRight, Clock, Image as ImageIcon,
  X, ExternalLink, FileJson, FileText, Edit3, GripVertical, AlertTriangle
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";

declare const chrome: any;

/**
 * Action Popup Component
 * Es la interfaz que se abre al hacer clic en el icono de la extensión.
 */

const App = () => {
  const [view, setView] = useState<'recorder' | 'history' | 'ai' | 'detail' | 'storage'>('recorder');
  const [status, setStatus] = useState({ isRecording: false, isPaused: false, sessionId: null, startTime: null, stale: false });
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [screenshots, setScreenshots] = useState({});
  const [aiOutput, setAiOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);
  const [tabInfo, setTabInfo] = useState({ isValid: false, url: '' });
  const [editingTitleId, setEditingTitleId] = useState(null);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    refreshData();
    checkCurrentTab();
    
    // Listener para cambios de estado globales (cuando el background actualiza algo)
    const handleStorageChange = (changes: any) => {
      if (changes.webjourney_status) {
        setStatus(changes.webjourney_status.newValue);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    const timer = setInterval(() => {
      refreshStatus();
      checkCurrentTab();
    }, 2000);

    return () => {
      clearInterval(timer);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const checkCurrentTab = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url?.startsWith('http')) {
        setTabInfo({ isValid: true, url: tab.url });
      } else {
        setTabInfo({ isValid: false, url: tab?.url || '' });
      }
    } catch (e) {
      setTabInfo({ isValid: false, url: '' });
    }
  };

  const refreshStatus = () => {
    chrome.storage.local.get(['webjourney_status'], (res) => {
      if (res.webjourney_status) setStatus(res.webjourney_status);
    });
  };

  const refreshData = () => {
    chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, setSessions);
    chrome.runtime.sendMessage({ type: 'GET_STORAGE_INFO' }, setStorageInfo);
  };

  const startRecording = async () => {
    if (!tabInfo.isValid) return;
    chrome.runtime.sendMessage({ 
      type: 'START_RECORDING', 
      payload: { 
        name: `Journey: ${new URL(tabInfo.url).hostname}`, 
        url: tabInfo.url 
      } 
    }, (res) => {
      if (res && res.success) setView('recorder');
    });
  };

  const resumeRecording = (session: any) => {
    chrome.storage.local.set({ 
      webjourney_status: { 
        isRecording: true, 
        isPaused: false, 
        sessionId: session.id, 
        startTime: Date.now() 
      } 
    }, () => {
      setView('recorder');
      refreshStatus();
    });
  };

  const togglePause = () => {
    const type = status.isPaused ? 'RESUME_RECORDING' : 'PAUSE_RECORDING';
    chrome.runtime.sendMessage({ type }, refreshStatus);
  };

  const stopRecording = () => {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (res) => {
      refreshData();
      if (res && res.session) {
        setSelectedSession(res.session);
        setView('detail');
      }
    });
  };

  const openDetail = (session: any) => {
    setSelectedSession(session);
    setView('detail');
    loadSessionImages(session);
  };

  const loadSessionImages = (session: any) => {
    session.actions.forEach((act: any) => {
      const imgId = act.elementId || act.screenshotId;
      if (imgId && !screenshots[imgId]) {
        chrome.runtime.sendMessage({ type: 'GET_SCREENSHOT', payload: imgId }, (data: string) => {
          if (data) setScreenshots(prev => ({ ...prev, [imgId]: data }));
        });
      }
    });
  };

  const deleteAction = (actionId: string) => {
    if (!selectedSession) return;
    chrome.runtime.sendMessage({ 
      type: 'DELETE_ACTION', 
      sessionId: selectedSession.id, 
      actionId 
    }, () => {
      const updated = { ...selectedSession, actions: selectedSession.actions.filter((a: any) => a.id !== actionId) };
      setSelectedSession(updated);
      refreshData();
    });
  };

  const updateTitle = (id: string, newTitle: string) => {
    chrome.runtime.sendMessage({ type: 'UPDATE_TITLE', sessionId: id, title: newTitle }, refreshData);
    setEditingTitleId(null);
  };

  const onDragStart = (e: any, index: number) => { dragItem.current = index; };
  const onDragEnter = (e: any, index: number) => { dragOverItem.current = index; };
  const onDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null || !selectedSession) return;

    const copyListItems = [...selectedSession.actions];
    const dragItemContent = copyListItems[dragItem.current];
    copyListItems.splice(dragItem.current, 1);
    copyListItems.splice(dragOverItem.current, 0, dragItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    const updated = { ...selectedSession, actions: copyListItems };
    setSelectedSession(updated);
    chrome.runtime.sendMessage({ type: 'REORDER_ACTIONS', sessionId: selectedSession.id, actions: copyListItems });
  };

  const exportPDF = async () => {
    if (!selectedSession) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(selectedSession.title || "User Journey Report", 10, 20);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Origin: ${selectedSession.url}`, 10, 28);
    doc.text(`Captured: ${new Date(selectedSession.createdDate).toLocaleString()}`, 10, 33);
    
    let y = 45;
    for (let i = 0; i < selectedSession.actions.length; i++) {
      const act = selectedSession.actions[i];
      if (y > 240) { doc.addPage(); y = 20; }
      
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(`${i + 1}. [${act.type.toUpperCase()}] ${act.data.text || act.data.tagName || 'Action'}`, 10, y);
      y += 6;
      
      const imgId = act.elementId || act.screenshotId;
      if (imgId && screenshots[imgId]) {
        try {
          // Intentar insertar screenshot con escala
          doc.addImage(screenshots[imgId], 'JPEG', 15, y, 60, 35);
          y += 40;
        } catch(e) { y += 5; }
      } else {
        y += 5;
      }
    }
    doc.save(`journey-${selectedSession.id}.pdf`);
  };

  const exportJson = () => {
    if (!selectedSession) return;
    const blob = new Blob([JSON.stringify(selectedSession, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journey-${selectedSession.id}.json`;
    a.click();
  };

  const generateAI = async (type: 'test' | 'docs', session: any) => {
    setIsGenerating(true); 
    setView('ai'); 
    setAiOutput("Analizando el flujo con Gemini...");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const model = type === 'test' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
      const prompt = `Actúa como ingeniero de QA senior. Analiza este journey de usuario: ${JSON.stringify(session.actions)}. Genera ${type === 'test' ? 'un script de Playwright con aserciones lógicas' : 'un manual de usuario paso a paso con lenguaje claro'}.`;
      const res = await ai.models.generateContent({ model, contents: prompt });
      setAiOutput(res.text || "La IA no pudo procesar el contenido.");
    } catch (e) { 
      setAiOutput("Error al conectar con el motor de IA. Verifica tu conexión."); 
    } finally { 
      setIsGenerating(false); 
    }
  };

  return (
    <div className="flex flex-col h-[550px] w-[400px] bg-slate-950 text-slate-200 text-sm overflow-hidden border border-white/5 shadow-2xl antialiased">
      {/* Header Estándar */}
      <header className="p-4 glass border-b border-white/10 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <MousePointer2 size={16} className="text-white" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-white uppercase text-[10px] block leading-none">Web Journey</span>
            <span className="text-indigo-400 text-[9px] font-medium tracking-widest uppercase">Recorder Pro</span>
          </div>
        </div>
        <div className="flex gap-1" role="navigation">
          <button title="Grabador" onClick={() => setView('recorder')} className={`p-2 rounded-lg transition-all ${view === 'recorder' ? 'bg-indigo-500 text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`}><Play size={16}/></button>
          <button title="Historial" onClick={() => { setView('history'); refreshData(); }} className={`p-2 rounded-lg transition-all ${view === 'history' ? 'bg-indigo-500 text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`}><History size={16}/></button>
          <button title="Memoria" onClick={() => setView('storage')} className={`p-2 rounded-lg transition-all ${view === 'storage' ? 'bg-indigo-500 text-white shadow-lg' : 'hover:bg-white/5 text-slate-400'}`}><HardDrive size={16}/></button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {/* Vista: Recorder */}
        {view === 'recorder' && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent">
            {!status.isRecording ? (
              <div className="space-y-6 max-w-[280px] animate-in fade-in zoom-in duration-300">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto border transition-all duration-500 ${tabInfo.isValid ? 'bg-indigo-600/20 border-indigo-500/50 shadow-xl shadow-indigo-500/10' : 'bg-red-500/10 border-red-500/30'}`}>
                  {tabInfo.isValid ? <Play size={32} className="text-indigo-400 ml-1" /> : <AlertTriangle size={32} className="text-red-400" />}
                </div>
                {tabInfo.isValid ? (
                  <>
                    <h2 className="text-xl font-bold text-white tracking-tight">Grabar nueva sesión</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">Listo para capturar en la pestaña activa. Los eventos y screenshots se guardarán localmente.</p>
                    <button onClick={startRecording} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold shadow-xl shadow-indigo-900/40 active:scale-95 transition-all">Empezar ahora</button>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-red-400 tracking-tight">Pestaña no grabable</h2>
                    <p className="text-xs text-slate-500 leading-relaxed">Para iniciar, navega a una página web pública (HTTP/HTTPS). Las páginas del sistema no se pueden grabar.</p>
                    <div className="text-[10px] bg-white/5 p-2 rounded-lg truncate opacity-50 font-mono">{tabInfo.url || 'URL protegida'}</div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="relative w-28 h-28 mx-auto">
                  <div className={`absolute inset-0 blur-3xl rounded-full animate-pulse ${status.isPaused ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}></div>
                  <div className={`relative w-full h-full rounded-full flex items-center justify-center border-4 border-white/10 ${status.isPaused ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-red-500/20 border-red-500/30 animate-pulse'}`}>
                    {status.isPaused ? <Pause size={40} className="text-yellow-500" /> : <Square size={40} className="text-red-500" fill="currentColor"/>}
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className={`text-2xl font-black uppercase tracking-tighter ${status.isPaused ? 'text-yellow-400' : 'text-red-400'}`}>
                    {status.isPaused ? (status.stale ? 'Sesión Inactiva' : 'En Pausa') : 'Grabando'}
                  </h2>
                  <div className="flex items-center justify-center gap-3 text-slate-400 font-mono text-xs">
                    <span className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md"><Clock size={12}/> {status.startTime ? Math.floor((Date.now() - status.startTime)/1000) : 0}s</span>
                    <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                    <span className="text-indigo-400 font-bold">Captura Activa</span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={togglePause} className="bg-slate-800 hover:bg-slate-700 text-white w-14 h-14 rounded-2xl font-bold border border-white/5 flex items-center justify-center shadow-lg transition-all active:scale-90">
                    {status.isPaused ? <Play size={20} className="ml-1"/> : <Pause size={20}/>}
                  </button>
                  <button onClick={stopRecording} className="bg-red-600 hover:bg-red-500 text-white px-10 rounded-2xl font-bold shadow-xl shadow-red-900/30 transition-all active:scale-95 flex items-center gap-2">
                    <Square size={16} fill="white" /> Detener
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vista: History */}
        {view === 'history' && (
          <div className="h-full overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-950/50">
            {sessions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-4 opacity-40">
                <History size={64} strokeWidth={1}/>
                <p className="font-medium">No hay grabaciones guardadas</p>
              </div>
            ) : (
              sessions.map(s => (
                <div key={s.id} className="glass p-4 rounded-2xl border-white/5 hover:border-indigo-500/30 transition-all flex justify-between items-center group relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 transform -translate-x-full group-hover:translate-x-0 transition-transform"></div>
                  <div className="min-w-0 flex-1">
                    {editingTitleId === s.id ? (
                      <input autoFocus onBlur={(e) => updateTitle(s.id, e.target.value)} defaultValue={s.title} className="bg-slate-900 border border-indigo-500 rounded px-2 py-1 w-full outline-none text-white font-bold"/>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4 onClick={() => openDetail(s)} className="font-bold truncate text-slate-200 cursor-pointer hover:text-indigo-400 transition-colors">{s.title || s.name}</h4>
                        <Edit3 size={12} className="text-slate-600 cursor-pointer hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEditingTitleId(s.id)}/>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 font-mono uppercase tracking-wider">
                        <Clock size={10}/> {new Date(s.startTime || s.createdDate).toLocaleDateString()}
                      </p>
                      <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
                      <p className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 rounded">{s.actions?.length || 0} PASOS</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                     <button onClick={() => resumeRecording(s)} title="Reanudar Grabación" className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Play size={14}/></button>
                     <button onClick={() => { if(confirm('¿Confirmas eliminar esta sesión de forma permanente?')) chrome.runtime.sendMessage({type: 'DELETE_SESSION', payload: s.id}, refreshData)}} className="p-2 text-slate-600 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                     <ChevronRight size={16} className="text-slate-600 cursor-pointer group-hover:text-indigo-400 transition-colors" onClick={() => openDetail(s)}/>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Vista: Detail */}
        {view === 'detail' && selectedSession && (
          <div className="h-full flex flex-col overflow-hidden bg-slate-950">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setView('history')} className="p-2 hover:bg-white/10 rounded-lg text-slate-400"><ArrowLeft size={18}/></button>
                <div className="min-w-0">
                  <h3 className="font-bold truncate text-white tracking-tight">{selectedSession.title}</h3>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={exportPDF} title="Exportar Informe PDF" className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"><FileText size={18}/></button>
                <button onClick={exportJson} title="Exportar Datos JSON" className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors"><FileJson size={18}/></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {selectedSession.actions.map((act: any, i: number) => (
                <div 
                  key={act.id} 
                  draggable
                  onDragStart={(e) => onDragStart(e, i)}
                  onDragEnter={(e) => onDragEnter(e, i)}
                  onDragEnd={onDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex gap-3 group/item cursor-grab active:cursor-grabbing animate-in slide-in-from-left duration-200"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-5 h-5 rounded bg-slate-900 text-slate-600 flex items-center justify-center border border-white/5">
                      <GripVertical size={10}/>
                    </div>
                    <span className="text-[10px] font-bold text-slate-700">{i+1}</span>
                  </div>
                  <div className="flex-1 min-w-0 relative bg-white/5 p-3 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all shadow-sm">
                    <button onClick={() => deleteAction(act.id)} className="absolute -right-1 -top-1 p-1 bg-red-600 text-white rounded-md shadow-lg opacity-0 group-hover/item:opacity-100 transition-opacity z-10"><Trash2 size={10}/></button>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[9px] font-bold uppercase py-0.5 px-2 rounded-full border ${act.type === 'LaunchUrl' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                        {act.type}
                      </span>
                      {act.timestamp && <span className="text-[8px] text-slate-600 font-mono">{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
                    </div>
                    <p className="text-slate-200 text-xs font-semibold truncate leading-tight">{act.data.text || act.data.tagName || 'Sin descripción'}</p>
                    <p className="text-[9px] text-slate-500 mt-1 truncate font-mono opacity-60">{act.data.selector || 'window'}</p>
                    {(act.elementId || act.screenshotId) && screenshots[act.elementId || act.screenshotId] && (
                      <div className="mt-3 rounded-lg border border-white/10 overflow-hidden shadow-2xl bg-black">
                        <img src={screenshots[act.elementId || act.screenshotId]} className="w-full h-auto max-h-40 object-contain" loading="lazy" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* AI Call-to-actions */}
            <div className="p-4 glass border-t border-white/10 grid grid-cols-2 gap-3 bg-slate-900/80">
              <button onClick={() => generateAI('test', selectedSession)} className="bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-white transition-all shadow-lg active:scale-95"><Code size={16}/> QA Script</button>
              <button onClick={() => generateAI('docs', selectedSession)} className="bg-slate-800 hover:bg-slate-700 py-3 rounded-xl font-bold border border-white/5 flex items-center justify-center gap-2 text-white transition-all shadow-lg active:scale-95"><CheckCircle2 size={16}/> Manual</button>
            </div>
          </div>
        )}

        {/* Vista: AI Result */}
        {view === 'ai' && (
          <div className="h-full flex flex-col p-4 bg-slate-950 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setView('detail')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-medium"><ArrowLeft size={16}/> Atrás</button>
              <button onClick={() => { navigator.clipboard.writeText(aiOutput); alert('Copiado al portapapeles'); }} className="text-xs bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex items-center gap-2 font-bold"><Copy size={12}/> COPIAR</button>
            </div>
            <div className="flex-1 bg-black/40 rounded-2xl p-5 font-mono text-[11px] overflow-y-auto border border-white/5 custom-scrollbar leading-relaxed">
              {isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 opacity-70">
                  <div className="relative">
                    <Loader2 size={40} className="animate-spin text-indigo-500" />
                    <div className="absolute inset-0 blur-xl bg-indigo-500/20 rounded-full animate-pulse"></div>
                  </div>
                  <p className="animate-pulse font-sans text-indigo-400 font-bold uppercase tracking-widest text-[10px]">Gemini procesando eventos...</p>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-slate-300 selection:bg-indigo-500/30">{aiOutput}</div>
              )}
            </div>
          </div>
        )}

        {/* Vista: Storage */}
        {view === 'storage' && (
          <div className="h-full p-8 flex flex-col items-center justify-center text-center space-y-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent">
            <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl"><HardDrive size={32} className="text-indigo-500" /></div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Gestión de Datos Locales</h2>
              <p className="text-xs text-slate-500 px-4">Toda la información se almacena de forma privada en tu navegador usando IndexedDB y Storage API.</p>
            </div>
            <div className="w-full glass p-6 rounded-2xl space-y-4 border-white/5 shadow-inner">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Total Sesiones:</span>
                <span className="font-mono font-bold text-indigo-400">{sessions.length}</span>
              </div>
              <div className="h-px bg-white/5 w-full"></div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Uso de Memoria:</span>
                <span className="font-mono font-bold text-indigo-400">{storageInfo?.totalSizeMB || 0} MB</span>
              </div>
            </div>
            <div className="flex flex-col w-full gap-3">
              <button onClick={refreshData} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl font-bold border border-white/5 transition-all active:scale-95"><RefreshCw size={16} /> Sincronizar</button>
              <button onClick={() => { if(confirm("ADVERTENCIA: ¿Estás seguro de que deseas eliminar todas las sesiones y capturas de pantalla? Esta acción no se puede deshacer.")) chrome.runtime.sendMessage({type: 'CLEAR_STORAGE'}, refreshData) }} className="w-full flex items-center justify-center gap-2 bg-red-900/10 text-red-500 py-3 rounded-xl font-bold border border-red-500/20 hover:bg-red-500/20 transition-all">Limpiar Base de Datos</button>
            </div>
          </div>
        )}
      </main>

      <footer className="p-3 px-4 bg-slate-900/80 border-t border-white/5 flex justify-between items-center text-[9px] font-bold tracking-widest text-slate-500 uppercase">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${status.isRecording ? (status.isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse') : 'bg-slate-700'}`}></div>
          <span className={status.isRecording && !status.isPaused ? 'text-red-400' : ''}>
            {status.isRecording ? (status.isPaused ? 'Pausa' : 'En vivo') : 'Motor Listo'}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity cursor-default">
          <CheckCircle2 size={10} className="text-green-500"/> MV3 SECURE
        </div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
