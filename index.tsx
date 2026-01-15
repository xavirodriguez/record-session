
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
  const [currentTime, setCurrentTime] = useState(Date.now());

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Sincronización proactiva y basada en eventos (Refactor 2)
  useEffect(() => {
    refreshStatus();
    refreshData();
    checkCurrentTab();
    
    const handleStorageChange = (changes: any) => {
      if (changes.webjourney_status) {
        setStatus(changes.webjourney_status.newValue);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Timer local solo para la UI de grabación, sin peticiones al storage
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
      payload: { name: `Journey: ${new URL(tabInfo.url).hostname}`, url: tabInfo.url } 
    }, (res) => {
      if (res?.success) setView('recorder');
    });
  };

  const togglePause = () => {
    const type = status.isPaused ? 'RESUME_RECORDING' : 'PAUSE_RECORDING';
    chrome.runtime.sendMessage({ type });
  };

  const stopRecording = () => {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (res) => {
      refreshData();
      if (res?.session) {
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
    let y = 45;
    for (let i = 0; i < selectedSession.actions.length; i++) {
      const act = selectedSession.actions[i];
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.text(`${i + 1}. [${act.type.toUpperCase()}] ${act.data.text || act.data.tagName || 'Action'}`, 10, y);
      y += 10;
      const imgId = act.elementId || act.screenshotId;
      if (imgId && screenshots[imgId]) {
        try { doc.addImage(screenshots[imgId], 'JPEG', 15, y, 60, 35); y += 40; } catch(e) { y += 5; }
      } else y += 5;
    }
    doc.save(`journey-${selectedSession.id}.pdf`);
  };

  // Added missing exportJson function
  const exportJson = () => {
    if (!selectedSession) return;
    const jsonString = JSON.stringify(selectedSession, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `journey-${selectedSession.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateAI = async (type: 'test' | 'docs', session: any) => {
    setIsGenerating(true); setView('ai'); setAiOutput("Generando contenido...");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const model = type === 'test' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
      const prompt = `Analiza este journey de usuario: ${JSON.stringify(session.actions)}. Genera ${type === 'test' ? 'un script de Playwright' : 'un manual paso a paso'}.`;
      const res = await ai.models.generateContent({ model, contents: prompt });
      setAiOutput(res.text || "Error en IA");
    } catch (e) { setAiOutput("Fallo de conexión"); } finally { setIsGenerating(false); }
  };

  return (
    <div className="flex flex-col h-[550px] w-[400px] bg-slate-950 text-slate-200 text-sm overflow-hidden antialiased border border-white/5">
      <header className="p-4 glass border-b border-white/10 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg"><MousePointer2 size={16} className="text-white" /></div>
          <div>
            <span className="font-bold tracking-tight text-white uppercase text-[10px] block leading-none">Web Journey</span>
            <span className="text-indigo-400 text-[9px] font-medium tracking-widest uppercase">Recorder Pro</span>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setView('recorder')} className={`p-2 rounded-lg ${view === 'recorder' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}><Play size={16}/></button>
          <button onClick={() => { setView('history'); refreshData(); }} className={`p-2 rounded-lg ${view === 'history' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}><History size={16}/></button>
          <button onClick={() => setView('storage')} className={`p-2 rounded-lg ${view === 'storage' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}><HardDrive size={16}/></button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {view === 'recorder' && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            {!status.isRecording ? (
              <div className="space-y-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto border ${tabInfo.isValid ? 'bg-indigo-500/20 border-indigo-500/50 shadow-xl' : 'bg-red-500/20 border-red-500/30'}`}>
                  {tabInfo.isValid ? <Play size={32} className="text-indigo-400 ml-1" /> : <AlertTriangle size={32} className="text-red-400" />}
                </div>
                <h2 className="text-xl font-bold text-white">{tabInfo.isValid ? 'Grabar nueva sesión' : 'URL no válida'}</h2>
                <button onClick={startRecording} disabled={!tabInfo.isValid} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white py-3 rounded-xl font-bold transition-all">Empezar ahora</button>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in">
                <div className={`relative w-28 h-28 mx-auto rounded-full flex items-center justify-center border-4 ${status.isPaused ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-red-500/30 bg-red-500/10 animate-pulse'}`}>
                  {status.isPaused ? <Pause size={40} className="text-yellow-500" /> : <Square size={40} className="text-red-500" fill="currentColor"/>}
                </div>
                <div className="space-y-2">
                  <h2 className={`text-2xl font-black uppercase ${status.isPaused ? 'text-yellow-400' : 'text-red-400'}`}>{status.isPaused ? 'Pausa' : 'Grabando'}</h2>
                  <div className="text-slate-400 font-mono text-xs flex justify-center items-center gap-2">
                    <Clock size={12}/> {status.startTime ? Math.floor((currentTime - status.startTime)/1000) : 0}s
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={togglePause} className="bg-slate-800 w-14 h-14 rounded-2xl flex items-center justify-center">{status.isPaused ? <Play size={20} className="ml-1"/> : <Pause size={20}/>}</button>
                  <button onClick={stopRecording} className="bg-red-600 text-white px-10 rounded-2xl font-bold flex items-center gap-2"><Square size={16} fill="white" /> Detener</button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'history' && (
          <div className="h-full overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {sessions.map(s => (
              <div key={s.id} className="glass p-4 rounded-2xl border-white/5 hover:border-indigo-500/30 transition-all flex justify-between items-center group">
                <div className="min-w-0 flex-1">
                  <h4 onClick={() => openDetail(s)} className="font-bold truncate text-slate-200 cursor-pointer hover:text-indigo-400">{s.title || s.name}</h4>
                  <p className="text-[10px] text-indigo-400 font-bold mt-1 uppercase tracking-widest">{s.actions?.length || 0} pasos registrados</p>
                </div>
                <ChevronRight size={16} className="text-slate-600 cursor-pointer group-hover:text-indigo-400" onClick={() => openDetail(s)}/>
              </div>
            ))}
          </div>
        )}

        {view === 'detail' && selectedSession && (
          <div className="h-full flex flex-col overflow-hidden bg-slate-950">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <button onClick={() => setView('history')} className="p-2 text-slate-400"><ArrowLeft size={18}/></button>
              <h3 className="font-bold truncate text-white">{selectedSession.title}</h3>
              <div className="flex gap-1">
                <button onClick={exportPDF} className="p-2 text-red-400"><FileText size={18}/></button>
                <button onClick={exportJson} className="p-2 text-indigo-400"><FileJson size={18}/></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {selectedSession.actions.map((act: any, i: number) => (
                <div key={act.id} draggable onDragStart={() => dragItem.current = i} onDragEnter={() => dragOverItem.current = i} onDragEnd={onDragEnd} onDragOver={(e) => e.preventDefault()} className="flex gap-3 group/item cursor-grab active:cursor-grabbing">
                  <span className="text-[10px] font-bold text-slate-700 mt-3">{i+1}</span>
                  <div className="flex-1 min-w-0 bg-white/5 p-3 rounded-xl border border-white/5 relative">
                    <button onClick={() => deleteAction(act.id)} className="absolute -right-1 -top-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover/item:opacity-100 transition-opacity"><Trash2 size={10}/></button>
                    <span className="text-[9px] font-bold uppercase py-0.5 px-2 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{act.type}</span>
                    <p className="text-slate-200 text-xs font-semibold mt-1 truncate">{act.data.text || act.data.tagName}</p>
                    {(act.elementId || act.screenshotId) && screenshots[act.elementId || act.screenshotId] && (
                      <div className="mt-2 rounded-lg border border-white/10 overflow-hidden"><img src={screenshots[act.elementId || act.screenshotId]} className="w-full h-auto max-h-32 object-contain" /></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 glass border-t border-white/10 grid grid-cols-2 gap-3">
              <button onClick={() => generateAI('test', selectedSession)} className="bg-indigo-600 py-3 rounded-xl font-bold text-white flex justify-center items-center gap-2"><Code size={16}/> QA Script</button>
              <button onClick={() => generateAI('docs', selectedSession)} className="bg-slate-800 py-3 rounded-xl font-bold text-white flex justify-center items-center gap-2"><CheckCircle2 size={16}/> Manual</button>
            </div>
          </div>
        )}

        {view === 'ai' && (
          <div className="h-full flex flex-col p-4">
            <button onClick={() => setView('detail')} className="flex items-center gap-2 text-slate-400 mb-4"><ArrowLeft size={16}/> Atrás</button>
            <div className="flex-1 bg-black/40 rounded-2xl p-5 font-mono text-[11px] overflow-y-auto custom-scrollbar">
              {isGenerating ? <div className="h-full flex flex-col items-center justify-center gap-4 opacity-50"><Loader2 size={32} className="animate-spin text-indigo-500" /><p className="animate-pulse">Analizando con Gemini...</p></div> : <div className="whitespace-pre-wrap text-slate-300">{aiOutput}</div>}
            </div>
          </div>
        )}
      </main>

      <footer className="p-3 px-4 bg-slate-900/80 border-t border-white/5 flex justify-between items-center text-[9px] font-bold tracking-widest text-slate-500 uppercase">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${status.isRecording ? (status.isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse') : 'bg-slate-700'}`}></div>
          {status.isRecording ? (status.isPaused ? 'Pausa' : 'Vivo') : 'Motor Listo'}
        </div>
        <div>v1.2.1 Pro</div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
