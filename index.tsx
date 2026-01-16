
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Play, Square, Trash2, Code, MousePointer2, 
  History, Copy, ArrowLeft, Loader2, 
  Pause, HardDrive, ChevronRight, Activity,
  FileText, Edit3, Settings, Globe, Zap
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";

declare const chrome: any;

const App = () => {
  const [view, setView] = useState<'recorder' | 'history' | 'ai' | 'detail' | 'storage'>('recorder');
  const [status, setStatus] = useState({ isRecording: false, isPaused: false, sessionId: null, startTime: null });
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [screenshots, setScreenshots] = useState<Record<string, string>>({});
  const [aiOutput, setAiOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ count: 0, totalSizeMB: "0.00" });
  const [tabInfo, setTabInfo] = useState({ isValid: false, url: '' });

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

  const stopRecording = () => {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (res) => {
      refreshData();
      if (res?.session) openDetail(res.session);
    });
  };

  const openDetail = (session: any) => {
    setSelectedSession(session);
    setView('detail');
    session.actions.forEach((act: any) => {
      const imgId = act.elementId || act.screenshotId;
      if (imgId && !screenshots[imgId]) {
        chrome.runtime.sendMessage({ type: 'GET_SCREENSHOT', payload: imgId }, (data: string) => {
          if (data) setScreenshots(prev => ({ ...prev, [imgId]: data }));
        });
      }
    });
  };

  const generateAI = async (type: 'test' | 'docs', session: any) => {
    setIsGenerating(true); setView('ai'); setAiOutput("Analizando UI y Tráfico de Red...");
    try {
      const configRes = await chrome.storage.local.get(['webjourney_config']);
      const apiKey = configRes.webjourney_config?.apiKey || process.env.API_KEY;

      if (!apiKey) {
        setAiOutput("Error: Configura tu API Key en Opciones.");
        setIsGenerating(false); return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Actúa como un Senior QA Automation. Analiza esta secuencia que mezcla interacciones de UI y llamadas de Red (API):
      ${JSON.stringify(session.actions, null, 2)}
      
      Genera ${type === 'test' ? 'un script de Playwright profesional que valide tanto los clicks como los status codes de las APIs' : 'una documentación técnica detallada resaltando las dependencias entre la UI y las APIs calls'}.
      Responde en Markdown elegante.`;
      
      const res = await ai.models.generateContent({ 
        model: 'gemini-3-pro-preview', 
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 2000 } }
      });
      setAiOutput(res.text || "Error en generación.");
    } catch (e) { setAiOutput("Error de conexión. Revisa tu API Key."); }
    finally { setIsGenerating(false); }
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
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-200 text-sm overflow-hidden antialiased">
      <header className="p-4 glass border-b border-white/10 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg"><Activity size={16} className="text-white" /></div>
          <div>
            <span className="font-bold tracking-tight text-white uppercase text-[10px] block leading-none">Journey Pro</span>
            <span className="text-indigo-400 text-[9px] font-medium tracking-widest uppercase">Network Tracking</span>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setView('recorder')} className={`p-2 rounded-lg ${view === 'recorder' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5'}`}><Play size={16}/></button>
          <button onClick={() => { setView('history'); refreshData(); }} className={`p-2 rounded-lg ${view === 'history' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5'}`}><History size={16}/></button>
          <button onClick={() => chrome.runtime.openOptionsPage()} className="p-2 text-slate-400 hover:bg-white/5"><Settings size={16}/></button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {view === 'recorder' && (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
            {!status.isRecording ? (
              <>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-indigo-500/10 border border-indigo-500/30"><Play size={32} className="text-indigo-400 ml-1" /></div>
                <div><h2 className="text-xl font-bold text-white">Graba UI + API</h2><p className="text-xs text-slate-500 mt-2">Registraremos cada click y cada llamada Fetch/XHR automáticamente.</p></div>
                <button onClick={startRecording} disabled={!tabInfo.isValid} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold shadow-lg">Iniciar Captura</button>
              </>
            ) : (
              <div className="space-y-8">
                <div className="w-28 h-28 mx-auto rounded-full flex items-center justify-center border-4 border-red-500/30 animate-pulse"><Square size={40} className="text-red-500" fill="currentColor"/></div>
                <h2 className="text-2xl font-black text-red-400 uppercase tracking-widest">Grabando...</h2>
                <button onClick={stopRecording} className="bg-red-600 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-red-600/20"><Square size={16} fill="white"/> Detener Sesión</button>
              </div>
            )}
          </div>
        )}

        {view === 'history' && (
          <div className="h-full overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Historial de Journeys</h2>
            {sessions.map((s: any) => (
              <div key={s.id} onClick={() => openDetail(s)} className="glass p-4 rounded-2xl border-white/5 hover:border-indigo-500/30 transition-all flex justify-between items-center cursor-pointer">
                <div className="min-w-0 flex-1"><h4 className="font-bold truncate text-slate-200">{s.title}</h4><p className="text-[10px] text-slate-500 mt-1">{new Date(s.createdDate).toLocaleDateString()} • {s.actions.length} eventos</p></div>
                <ChevronRight size={16} className="text-slate-600"/>
              </div>
            ))}
          </div>
        )}

        {view === 'detail' && selectedSession && (
          <div className="h-full flex flex-col overflow-hidden bg-slate-950">
            <div className="p-4 border-b border-white/10 flex items-center justify-between glass">
              <button onClick={() => setView('history')} className="p-2 text-slate-400"><ArrowLeft size={18}/></button>
              <h3 className="font-bold text-xs truncate max-w-[150px]">{selectedSession.title}</h3>
              <button onClick={() => { if(confirm("¿Eliminar?")) { chrome.runtime.sendMessage({type:'DELETE_SESSION', payload:selectedSession.id}, refreshData); setView('history'); }}} className="text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {selectedSession.actions.map((act: any) => (
                <div key={act.id} className={`p-3 rounded-xl border flex gap-3 ${act.type === 'network' ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-white/5 border-white/5'}`}>
                  <div className="mt-0.5">{getActionIcon(act.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[8px] font-bold uppercase text-slate-500">{act.type}</span>
                      <span className="text-[8px] font-mono text-slate-600">{new Date(act.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {act.type === 'network' ? (
                      <div className="space-y-1">
                        <p className="text-[10px] font-mono text-indigo-300 break-all"><span className="font-bold text-indigo-400">{act.data.method}</span> {act.data.url}</p>
                        <p className={`text-[9px] font-bold ${act.data.status < 400 ? 'text-green-500' : 'text-red-500'}`}>Status: {act.data.status}</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-slate-200 text-xs font-semibold">{act.data.text || act.data.tagName}</p>
                        {(act.elementId || act.screenshotId) && screenshots[act.elementId || act.screenshotId] && (
                          <div className="mt-2 rounded-lg border border-white/10 overflow-hidden"><img src={screenshots[act.elementId || act.screenshotId]} className="w-full max-h-32 object-contain bg-black" /></div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 glass border-t border-white/10 grid grid-cols-2 gap-3">
              <button onClick={() => generateAI('test', selectedSession)} className="bg-indigo-600 py-3 rounded-xl font-bold text-white text-xs flex justify-center items-center gap-2"><Code size={14}/> Generar Test</button>
              <button onClick={() => generateAI('docs', selectedSession)} className="bg-slate-800 py-3 rounded-xl font-bold text-white text-xs flex justify-center items-center gap-2"><FileText size={14}/> Docs Técnicas</button>
            </div>
          </div>
        )}

        {view === 'ai' && (
          <div className="h-full flex flex-col p-4">
            <button onClick={() => setView('detail')} className="flex items-center gap-2 text-slate-400 mb-4 text-xs"><ArrowLeft size={14}/> Volver</button>
            <div className="flex-1 bg-black/40 rounded-2xl p-5 font-mono text-[10px] overflow-y-auto custom-scrollbar border border-white/5 relative">
              {isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 opacity-50">
                  <Loader2 size={32} className="animate-spin text-indigo-500" />
                  <p className="uppercase tracking-widest text-[9px]">Análisis de UI y Network en progreso...</p>
                </div>
              ) : <div className="whitespace-pre-wrap text-slate-300">{aiOutput}</div>}
            </div>
          </div>
        )}
      </main>

      <footer className="p-3 bg-slate-900 border-t border-white/5 flex justify-between items-center text-[8px] font-bold text-slate-500 uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${status.isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`}></div>
          {status.isRecording ? 'Grabando Full-Stack' : 'Listo'}
        </div>
        <div>v1.5.0 PRO</div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
