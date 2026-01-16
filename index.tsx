
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Play, Square, Trash2, Code, MousePointer2, 
  History, CheckCircle2, Copy, ArrowLeft, Loader2, Download, 
  Pause, HardDrive, RefreshCw, ChevronRight, Clock, Image as ImageIcon,
  X, ExternalLink, FileJson, FileText, Edit3, GripVertical, AlertTriangle, Settings,
  Globe, Zap, Activity
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";

declare const chrome: any;

const App = () => {
  const [view, setView] = useState<'recorder' | 'history' | 'ai' | 'detail' | 'storage'>('recorder');
  const [status, setStatus] = useState({ isRecording: false, isPaused: false, sessionId: null, startTime: null, stale: false });
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [screenshots, setScreenshots] = useState({});
  const [aiOutput, setAiOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ count: 0, totalSizeMB: "0.00" });
  const [tabInfo, setTabInfo] = useState({ isValid: false, url: '' });
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    refreshStatus();
    refreshData();
    checkCurrentTab();
    
    const handleStorageChange = (changes: any) => {
      if (changes.webjourney_status) setStatus(changes.webjourney_status.newValue);
      if (changes.webjourney_recording_sessions) refreshData();
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    let timer: any;
    if (status.isRecording && !status.isPaused) {
      timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    }
    return () => clearInterval(timer);
  }, [status.isRecording, status.isPaused]);

  const checkCurrentTab = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isValid = tab && tab.url?.startsWith('http');
      setTabInfo({ isValid: !!isValid, url: tab?.url || '' });
    } catch (e) { setTabInfo({ isValid: false, url: '' }); }
  };

  const refreshStatus = () => {
    chrome.storage.local.get(['webjourney_status'], (res) => {
      if (res.webjourney_status) setStatus(res.webjourney_status);
    });
  };

  const refreshData = () => {
    chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, (data) => setSessions(data || []));
    chrome.runtime.sendMessage({ type: 'GET_STORAGE_INFO' }, (data) => setStorageInfo(data || { count: 0, totalSizeMB: "0.00" }));
  };

  const startRecording = async () => {
    if (!tabInfo.isValid) return;
    chrome.runtime.sendMessage({ 
      type: 'START_RECORDING', 
      payload: { name: `Journey: ${new URL(tabInfo.url).hostname}`, url: tabInfo.url } 
    }, (res) => {
      if (res?.success) setView('recorder');
    });
  };

  const togglePause = () => {
    chrome.runtime.sendMessage({ type: status.isPaused ? 'RESUME_RECORDING' : 'PAUSE_RECORDING' });
  };

  const stopRecording = () => {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (res) => {
      refreshData();
      if (res?.session) openDetail(res.session);
    });
  };

  const deleteSession = (id: string) => {
    if (confirm("¿Eliminar esta sesión?")) {
      chrome.runtime.sendMessage({ type: 'DELETE_SESSION', payload: id }, refreshData);
    }
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

  const clearStorage = () => {
    if (confirm("¿Borrar todas las imágenes? El historial de texto y llamadas API se mantendrá.")) {
      chrome.runtime.sendMessage({ type: 'CLEAR_STORAGE' }, refreshData);
    }
  };

  const generateAI = async (type: 'test' | 'docs', session: any) => {
    setIsGenerating(true); setView('ai'); setAiOutput("La IA está analizando los pasos y las llamadas de red...");
    try {
      const configRes = await chrome.storage.local.get(['webjourney_config']);
      const apiKey = configRes.webjourney_config?.apiKey || process.env.API_KEY;

      if (!apiKey) {
        setAiOutput("Error: Configura tu API Key en Opciones.");
        setIsGenerating(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Analiza este recorrido de usuario que incluye interacciones del DOM y llamadas a APIs:
      ${JSON.stringify(session.actions, null, 2)}
      
      Objetivo: Generar ${type === 'test' ? 'un script de Playwright que incluya la validación de las llamadas de red' : 'una documentación técnica paso a paso detallando qué APIs se llamaron en cada acción'}.
      Responde en formato Markdown profesional.`;
      
      const res = await ai.models.generateContent({ 
        model: 'gemini-3-pro-preview', 
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 2000 } }
      });
      setAiOutput(res.text || "No se pudo generar el contenido.");
    } catch (e) { 
      setAiOutput("Error de conexión con Gemini. Revisa tu API Key."); 
    } finally { 
      setIsGenerating(false); 
    }
  };

  const exportPDF = async () => {
    if (!selectedSession) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(selectedSession.title || "Reporte de Journey", 10, 20);
    let y = 30;
    selectedSession.actions.forEach((act, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(8);
      const label = act.type === 'network' ? `[NET] ${act.data.method} ${act.data.url.substring(0, 50)}...` : `[${act.type.toUpperCase()}] ${act.data.text || act.data.tagName}`;
      doc.text(`${i+1}. ${label}`, 10, y);
      y += 6;
    });
    doc.save(`journey-${selectedSession.id}.pdf`);
  };

  const getActionIcon = (type: string) => {
    switch(type) {
      case 'click': return <MousePointer2 size={12} />;
      case 'input': return <Edit3 size={12} />;
      case 'network': return <Globe size={12} className="text-indigo-400" />;
      default: return <Activity size={12} />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-200 text-sm overflow-hidden antialiased">
      <header className="p-4 glass border-b border-white/10 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg"><Activity size={16} className="text-white" /></div>
          <div>
            <span className="font-bold tracking-tight text-white uppercase text-[10px] block leading-none">Journey Pro</span>
            <span className="text-indigo-400 text-[9px] font-medium tracking-widest uppercase">Network + UI</span>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setView('recorder')} className={`p-2 rounded-lg transition-colors ${view === 'recorder' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5'}`}><Play size={16}/></button>
          <button onClick={() => { setView('history'); refreshData(); }} className={`p-2 rounded-lg transition-colors ${view === 'history' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5'}`}><History size={16}/></button>
          <button onClick={() => setView('storage')} className={`p-2 rounded-lg transition-colors ${view === 'storage' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5'}`}><HardDrive size={16}/></button>
          <button onClick={() => chrome.runtime.openOptionsPage()} className="p-2 text-slate-400 hover:bg-white/5"><Settings size={16}/></button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {view === 'recorder' && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
            {!status.isRecording ? (
              <div className="space-y-6 max-w-xs">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-indigo-500/10 border border-indigo-500/30">
                  <Play size={32} className="text-indigo-400 ml-1" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-white">Captura Total</h2>
                  <p className="text-xs text-slate-500">Registraremos tus clicks, entradas y todas las llamadas a APIs automáticamente.</p>
                </div>
                <button onClick={startRecording} disabled={!tabInfo.isValid} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold shadow-lg">Empezar Grabación</button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className={`w-28 h-28 mx-auto rounded-full flex items-center justify-center border-4 ${status.isPaused ? 'border-yellow-500/30' : 'border-red-500/30 animate-pulse'}`}>
                  {status.isPaused ? <Pause size={40} className="text-yellow-500" /> : <Square size={40} className="text-red-500" fill="currentColor"/>}
                </div>
                <div className="space-y-2">
                  <h2 className={`text-2xl font-black ${status.isPaused ? 'text-yellow-400' : 'text-red-400'}`}>{status.isPaused ? 'EN PAUSA' : 'GRABANDO...'}</h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Escuchando UI y Network Traffic</p>
                </div>
                <div className="flex gap-4 justify-center">
                  <button onClick={togglePause} className="bg-slate-800 w-14 h-14 rounded-2xl flex items-center justify-center">{status.isPaused ? <Play size={20}/> : <Pause size={20}/>}</button>
                  <button onClick={stopRecording} className="bg-red-600 text-white px-8 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-red-600/20"><Square size={16} fill="white"/> Detener</button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'history' && (
          <div className="h-full overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Journeys Guardados</h2>
            {sessions.map(s => (
              <div key={s.id} onClick={() => openDetail(s)} className="glass p-4 rounded-2xl border-white/5 hover:border-indigo-500/30 transition-all flex justify-between items-center cursor-pointer">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold truncate text-slate-200">{s.title || s.name}</h4>
                  <p className="text-[10px] text-slate-500 mt-1">{new Date(s.createdDate).toLocaleString()} • {s.actions?.length || 0} eventos</p>
                </div>
                <ChevronRight size={16} className="text-slate-600"/>
              </div>
            ))}
          </div>
        )}

        {view === 'detail' && selectedSession && (
          <div className="h-full flex flex-col overflow-hidden bg-slate-950">
            <div className="p-4 border-b border-white/10 flex items-center justify-between glass">
              <button onClick={() => setView('history')} className="p-2 text-slate-400 hover:text-white"><ArrowLeft size={18}/></button>
              <h3 className="font-bold truncate text-white text-xs">{selectedSession.title}</h3>
              <div className="flex gap-2">
                <button onClick={() => deleteSession(selectedSession.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
                <button onClick={exportPDF} className="text-indigo-400"><FileText size={18}/></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {selectedSession.actions.map((act: any, i: number) => (
                <div key={act.id} className={`p-3 rounded-xl border flex gap-3 ${act.type === 'network' ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-white/5 border-white/5'}`}>
                  <div className="mt-0.5">{getActionIcon(act.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-bold uppercase text-slate-500 tracking-tighter">{act.type}</span>
                      <span className="text-[8px] font-mono text-slate-600">{new Date(act.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                    </div>
                    {act.type === 'network' ? (
                      <div className="space-y-1">
                        <p className="text-[11px] font-mono text-indigo-300 break-all"><span className="font-bold text-indigo-400">{act.data.method}</span> {act.data.url}</p>
                        <p className="text-[9px] text-slate-500">Status: <span className={act.data.status < 400 ? 'text-green-500' : 'text-red-500'}>{act.data.status}</span> • {act.data.apiType}</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-slate-200 text-xs font-semibold">{act.data.text || act.data.tagName}</p>
                        <p className="text-[9px] text-slate-500 truncate">{act.data.selector}</p>
                        {(act.elementId || act.screenshotId) && screenshots[act.elementId || act.screenshotId] && (
                          <div className="mt-2 rounded-lg border border-white/10 overflow-hidden"><img src={screenshots[act.elementId || act.screenshotId]} className="w-full h-auto max-h-32 object-contain bg-black" /></div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 glass border-t border-white/10 grid grid-cols-2 gap-3">
              <button onClick={() => generateAI('test', selectedSession)} className="bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold text-white flex justify-center items-center gap-2"><Code size={16}/> QA con Red</button>
              <button onClick={() => generateAI('docs', selectedSession)} className="bg-slate-800 hover:bg-slate-700 py-3 rounded-xl font-bold text-white flex justify-center items-center gap-2"><FileText size={16}/> Manual Técnico</button>
            </div>
          </div>
        )}

        {view === 'ai' && (
          <div className="h-full flex flex-col p-4">
            <button onClick={() => setView('detail')} className="flex items-center gap-2 text-slate-400 mb-4"><ArrowLeft size={16}/> Volver</button>
            <div className="flex-1 bg-black/40 rounded-2xl p-5 font-mono text-[11px] overflow-y-auto custom-scrollbar border border-white/5 relative">
               {!isGenerating && <button onClick={() => { navigator.clipboard.writeText(aiOutput); alert("Copiado!"); }} className="absolute top-4 right-4 p-2 bg-indigo-600 text-white rounded-lg"><Copy size={14}/></button>}
              {isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 opacity-50">
                  <Loader2 size={32} className="animate-spin text-indigo-500" />
                  <p className="text-xs uppercase tracking-widest">Analizando UI + Tráfico API...</p>
                </div>
              ) : <div className="whitespace-pre-wrap text-slate-300 leading-relaxed">{aiOutput}</div>}
            </div>
          </div>
        )}

        {view === 'storage' && (
          <div className="h-full p-6 space-y-6">
            <h2 className="text-xl font-bold text-white">Almacenamiento</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Imágenes</span>
                <p className="text-2xl font-black text-indigo-400">{storageInfo.count}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Tamaño</span>
                <p className="text-2xl font-black text-indigo-400">{storageInfo.totalSizeMB} MB</p>
              </div>
            </div>
            <button onClick={clearStorage} className="w-full bg-red-900/20 text-red-400 border border-red-500/30 py-4 rounded-xl font-bold">Vaciar Caché de Imágenes</button>
          </div>
        )}
      </main>

      <footer className="p-3 px-4 bg-slate-900 border-t border-white/5 flex justify-between items-center text-[9px] font-bold tracking-widest text-slate-500 uppercase">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${status.isRecording ? (status.isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse') : 'bg-slate-700'}`}></div>
          {status.isRecording ? 'Captura Activa (UI + API)' : 'Sistema en Espera'}
        </div>
        <div>v1.4.0 PRO</div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
