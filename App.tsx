import React, { useState, useEffect } from 'react';
import { Network, Upload, Loader2, Sparkles, X, Search, FileText, ExternalLink, History, Clock, Trash2, Lightbulb, GitBranch, Key, Settings, AlertCircle, Save, Bot, Zap, BrainCircuit, Scale, ChevronDown, ChevronUp, Languages } from 'lucide-react';
import GraphView from './components/GraphView';
import { GraphData, PaperNode } from './types';
import { generateKnowledgeGraph } from './services/geminiService';

interface HistoryItem {
  id: string;
  query: string;
  timestamp: number;
  data: GraphData;
  mode: 'fast' | 'deep';
  language: 'en' | 'zh';
}

type AiProvider = 'gemini' | 'openai' | 'deepseek';
type AnalysisMode = 'fast' | 'deep';

const translations = {
  en: {
    appTitle: "PaperTree",
    history: "History",
    settings: "Settings",
    newAnalysis: "New Analysis",
    fastScan: "FAST SCAN",
    deepSearch: "DEEP SEARCH",
    searchPlaceholder: "Enter topic (e.g., 'Transformer Architecture') or paste URLs...",
    mapButton: "Map",
    deepSearchButton: "Deep Search",
    analyzing: "Analyzing...",
    legend: "Legend",
    export: "Export Graph",
    readPaper: "Read Full Paper",
    coreInnovation: "Core Innovation",
    placeInEvolution: "Place in Evolution",
    difference: "Difference vs Context",
    year: "Year",
    authors: "Authors",
    methodology: "Methodology",
    selectToView: "Select a node to view details.",
    evolutionMap: "Research Evolution Map",
    subtitle: "Visualize citation trees, conflicts, and inspirations."
  },
  zh: {
    appTitle: "研谱 (PaperTree)",
    history: "历史记录",
    settings: "设置",
    newAnalysis: "新的一轮",
    fastScan: "快速扫描",
    deepSearch: "深度搜索",
    searchPlaceholder: "输入课题 (如 'Transformer 架构') 或粘贴链接...",
    mapButton: "生成图谱",
    deepSearchButton: "深度研读",
    analyzing: "分析中...",
    legend: "图例",
    export: "导出图片",
    readPaper: "阅读全文",
    coreInnovation: "核心创新",
    placeInEvolution: "演进定位",
    difference: "差异与对比",
    year: "年份",
    authors: "作者",
    methodology: "方法论",
    selectToView: "点击节点查看详细解读",
    evolutionMap: "学术演进图谱",
    subtitle: "可视化引用脉络、学术冲突与灵感来源"
  }
};

const App: React.FC = () => {
  // Graph State
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<PaperNode | null>(null);
  const [mode, setMode] = useState<AnalysisMode>('fast');
  const [isSearchExpanded, setIsSearchExpanded] = useState(true);
  const [language, setLanguage] = useState<'en' | 'zh'>('zh');
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Settings / API Key State
  const [showSettings, setShowSettings] = useState(false);
  
  // Provider State
  const [provider, setProvider] = useState<AiProvider>('gemini');
  
  // Keys
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  
  const [tempGeminiKey, setTempGeminiKey] = useState('');
  const [tempOpenaiKey, setTempOpenaiKey] = useState('');
  const [tempDeepseekKey, setTempDeepseekKey] = useState('');

  const t = translations[language];

  // Cache System
  const getCacheKey = (p: AiProvider, m: AnalysisMode, i: string, f: string | undefined, l: string) => `cache_${p}_${m}_${l}_${i}_${f || 'nofile'}`;

  // Load history and API Keys
  useEffect(() => {
    const saved = localStorage.getItem('paperTreeHistory');
    if (saved) {
        try {
            setHistory(JSON.parse(saved));
        } catch (e) {
            console.error("Failed to load history");
        }
    }
    
    const gKey = localStorage.getItem('gemini_api_key');
    if (gKey) { setGeminiKey(gKey); setTempGeminiKey(gKey); }
    
    const oKey = localStorage.getItem('openai_api_key');
    if (oKey) { setOpenaiKey(oKey); setTempOpenaiKey(oKey); }
    
    const dKey = localStorage.getItem('deepseek_api_key');
    if (dKey) { setDeepseekKey(dKey); setTempDeepseekKey(dKey); }

    const lastProvider = localStorage.getItem('selected_provider') as AiProvider;
    if (lastProvider) setProvider(lastProvider);
    
    const savedLang = localStorage.getItem('language') as 'en' | 'zh';
    if (savedLang) setLanguage(savedLang);
  }, []);

  const saveToHistory = (query: string, data: GraphData, usedMode: AnalysisMode, lang: 'en'|'zh') => {
    const newItem: HistoryItem = {
        id: Date.now().toString(),
        query: query,
        timestamp: Date.now(),
        data: data,
        mode: usedMode,
        language: lang
    };
    const updated = [newItem, ...history].slice(0, 20); 
    setHistory(updated);
    localStorage.setItem('paperTreeHistory', JSON.stringify(updated));
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = history.filter(h => h.id !== id);
      setHistory(updated);
      localStorage.setItem('paperTreeHistory', JSON.stringify(updated));
  };

  const loadHistoryItem = (item: HistoryItem) => {
      setGraphData(item.data);
      setSelectedNode(null);
      setMode(item.mode);
      setLanguage(item.language || 'zh');
      setShowHistory(false);
      setIsSearchExpanded(false); // Auto collapse on load
  };

  const handleSaveSettings = () => {
      localStorage.setItem('gemini_api_key', tempGeminiKey);
      setGeminiKey(tempGeminiKey);

      localStorage.setItem('openai_api_key', tempOpenaiKey);
      setOpenaiKey(tempOpenaiKey);

      localStorage.setItem('deepseek_api_key', tempDeepseekKey);
      setDeepseekKey(tempDeepseekKey);

      localStorage.setItem('selected_provider', provider);
      
      setShowSettings(false);
  };

  const toggleLanguage = () => {
      const newLang = language === 'en' ? 'zh' : 'en';
      setLanguage(newLang);
      localStorage.setItem('language', newLang);
  };

  const getCurrentKey = () => {
      if (provider === 'gemini') return geminiKey;
      if (provider === 'openai') return openaiKey;
      if (provider === 'deepseek') return deepseekKey;
      return '';
  };

  const handleIngest = async () => {
    if (!input && !file) return;
    
    const activeKey = getCurrentKey();
    if (!activeKey) {
        setShowSettings(true);
        return;
    }

    // Check Cache
    const cacheKey = getCacheKey(provider, mode, input, file?.name, language);
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            setGraphData(parsed);
            setSelectedNode(null);
            setIsSearchExpanded(false); // Auto collapse
            console.log("Loaded from cache:", cacheKey);
            return;
        } catch(e) {
            localStorage.removeItem(cacheKey);
        }
    }

    setLoading(true);
    setSelectedNode(null);
    try {
      const data = await generateKnowledgeGraph(input, file || undefined, activeKey, provider, mode, language);
      setGraphData(data);
      
      const queryLabel = file ? `[${provider.toUpperCase()}] PDF: ${file.name}` : `[${provider.toUpperCase()}] ${input}`;
      saveToHistory(queryLabel, data, mode, language);

      // Save to Cache
      localStorage.setItem(cacheKey, JSON.stringify(data));
      setIsSearchExpanded(false); // Auto collapse

    } catch (e: any) {
      console.error(e);
      let msg = e.message || "Unknown error";
      if (msg.includes("401") || msg.includes("MISSING_API_KEY")) {
          alert(`Authentication Failed for ${provider}. Please check your API Key.`);
          setShowSettings(true);
      } else if (msg.includes("429")) {
          alert(`Rate limit exceeded for ${provider}. Please try again later.`);
      } else {
          alert(`Analysis Failed: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Improved Mobile Sidebar (Bottom Sheet style on mobile, Sidebar on desktop)
  const Sidebar = () => (
    <div className="fixed md:absolute inset-x-0 bottom-0 md:top-0 md:left-auto md:right-0 md:w-96 h-[85vh] md:h-full bg-white md:border-l border-t md:border-t-0 border-slate-200 p-6 overflow-y-auto shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] md:shadow-2xl z-40 rounded-t-3xl md:rounded-none flex flex-col transition-transform duration-300 transform translate-y-0">
      <div className="flex justify-between items-start mb-6 shrink-0">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
           <FileText className="w-5 h-5 text-slate-500" />
           {language === 'en' ? 'Details' : '详细信息'}
        </h3>
        <button onClick={() => setSelectedNode(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors bg-slate-50">
          <ChevronDown className="w-5 h-5 text-slate-500 md:hidden" />
          <X className="w-5 h-5 text-slate-500 hidden md:block" />
        </button>
      </div>

      {selectedNode ? (
        <div className="space-y-6 flex-1 pb-10 md:pb-0">
          <div>
            {selectedNode.category && (
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-100 text-blue-700 mb-2">
                    {selectedNode.category}
                </span>
            )}
            <a 
              href={selectedNode.url || "#"} 
              target="_blank" 
              rel="noopener noreferrer"
              className={`font-serif text-xl font-bold leading-tight block ${selectedNode.url ? 'text-blue-700 hover:underline' : 'text-slate-900'}`}
            >
              {selectedNode.title}
            </a>
          </div>

          <div className="flex gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">{t.year}</span>
              <p className="text-sm font-medium text-slate-700">{selectedNode.year}</p>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">{t.authors}</span>
              <p className="text-sm font-medium text-slate-700">{selectedNode.authors.join(', ')}</p>
            </div>
          </div>

           {selectedNode.comparison && (
             <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm">
               <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1 mb-2">
                  <Scale className="w-4 h-4" /> {t.difference}
               </span>
               <p className="text-sm text-slate-800 leading-relaxed font-medium">
                 {selectedNode.comparison}
               </p>
             </div>
          )}

          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1 mb-2">
               <Lightbulb className="w-3 h-3" /> {t.coreInnovation}
            </span>
            <p className="text-sm text-indigo-900 leading-relaxed font-medium">{selectedNode.novelty}</p>
          </div>

          {selectedNode.evolutionSummary && (
             <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                  <GitBranch className="w-4 h-4" /> {t.placeInEvolution}
               </span>
               <p className="text-sm text-slate-600 leading-relaxed italic border-l-2 border-slate-300 pl-3">
                 "{selectedNode.evolutionSummary}"
               </p>
             </div>
          )}

          {(selectedNode.dataset || selectedNode.benchmark || selectedNode.methodology) && (
             <div className="space-y-3 pt-2 border-t border-slate-100">
                {selectedNode.methodology && (
                   <div className="text-sm">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">{t.methodology}</span>
                      <span className="text-slate-700 bg-slate-100 px-2 py-1 rounded">{selectedNode.methodology}</span>
                   </div>
                )}
             </div>
          )}

          {selectedNode.url && (
            <div className="pt-4 mt-auto">
               <a 
                 href={selectedNode.url} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-all shadow-sm group"
               >
                 {t.readPaper}
                 <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
               </a>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 text-slate-400 flex flex-col items-center">
          <Network className="w-16 h-16 mb-4 opacity-10" />
          <p className="text-sm font-medium">{t.selectToView}</p>
        </div>
      )}
    </div>
  );

  const SettingsModal = () => (
     <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${showSettings ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <Settings className="w-5 h-5 text-blue-600" /> {t.settings}
              </h3>
              <button onClick={() => setShowSettings(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
                 <X className="w-5 h-5" />
              </button>
           </div>
           
           <div className="bg-slate-50 rounded-lg p-1 flex mb-6">
              {(['gemini', 'openai', 'deepseek'] as AiProvider[]).map(p => (
                 <button 
                   key={p}
                   onClick={() => setProvider(p)}
                   className={`flex-1 py-2 text-sm font-medium rounded-md transition-all capitalize ${provider === p ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   {p}
                 </button>
              ))}
           </div>

           <div className="space-y-4">
              {provider === 'gemini' && (
                <div>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3 mb-4">
                        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold mb-1">Recommended</p>
                            Supports PDF Analysis & Google Search.
                        </div>
                    </div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Gemini API Key</label>
                    <input 
                      type="password"
                      value={tempGeminiKey}
                      onChange={(e) => setTempGeminiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-mono text-sm"
                    />
                </div>
              )}
              {provider === 'openai' && (
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">OpenAI API Key</label>
                    <input 
                      type="password"
                      value={tempOpenaiKey}
                      onChange={(e) => setTempOpenaiKey(e.target.value)}
                      placeholder="sk-proj-..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-slate-800 font-mono text-sm"
                    />
                </div>
              )}
              {provider === 'deepseek' && (
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">DeepSeek API Key</label>
                    <input 
                      type="password"
                      value={tempDeepseekKey}
                      onChange={(e) => setTempDeepseekKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-mono text-sm"
                    />
                </div>
              )}

              <div className="pt-2">
                <button 
                    onClick={handleSaveSettings}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                    <Save className="w-4 h-4" /> Save Configuration
                </button>
              </div>
           </div>
        </div>
     </div>
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 md:px-8 justify-between shrink-0 z-30 shadow-sm relative">
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={() => setShowHistory(!showHistory)} 
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          >
              <History className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <Network className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900 hidden md:block">{t.appTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
             <button
                onClick={toggleLanguage}
                className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
             >
                 <Languages className="w-4 h-4" />
                 <span className="hidden md:inline">{language === 'en' ? 'EN' : '中'}</span>
             </button>

             <button
               onClick={() => setShowSettings(true)}
               className={`flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg text-sm font-medium transition-colors ${getCurrentKey() ? 'text-slate-600 hover:bg-slate-100' : 'text-red-600 bg-red-50'}`}
             >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline capitalize">{provider}</span>
             </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <div className="flex h-full w-full relative">
          
          {/* History Panel - Full width on mobile, Sidebar on desktop */}
          <div className={`absolute left-0 top-0 h-full bg-white shadow-2xl z-50 transition-all duration-300 overflow-hidden flex flex-col border-r border-slate-200 ${showHistory ? 'w-full md:w-80' : 'w-0'}`}>
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><History className="w-4 h-4" /> {t.history}</h3>
                  <button onClick={() => setShowHistory(false)}><X className="w-4 h-4 text-slate-500" /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                  {history.map(item => (
                      <div key={item.id} onClick={() => loadHistoryItem(item)} className="p-3 rounded-lg border border-slate-100 hover:border-blue-300 hover:bg-blue-50 cursor-pointer group relative">
                          <p className="text-sm font-medium text-slate-800 line-clamp-2 pr-6">{item.query}</p>
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                              <span className={`px-1 rounded ${item.mode === 'deep' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>{item.mode}</span>
                              <span className="bg-slate-200 text-slate-600 px-1 rounded uppercase">{item.language || 'zh'}</span>
                              <Clock className="w-3 h-3" />
                              {new Date(item.timestamp).toLocaleDateString()}
                          </div>
                          <button onClick={(e) => deleteHistoryItem(item.id, e)} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-3 h-3" />
                          </button>
                      </div>
                  ))}
              </div>
          </div>

          <SettingsModal />

          {/* Search Bar / Minimized Toggle - Optimized positioning for mobile */}
          <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-500 z-10 w-full max-w-3xl px-4 ${isSearchExpanded ? 'top-[15%] md:top-[25%] opacity-100 pointer-events-auto' : '-top-40 opacity-0 pointer-events-none'}`}>
            <div className={`bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-2xl p-4 md:p-3 transition-all duration-500`}>
                {graphData.nodes.length === 0 && (
                   <div className="text-center pt-2 pb-4 md:pt-6 md:pb-6">
                       <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">{t.evolutionMap}</h2>
                       <p className="text-slate-500 text-sm">{t.subtitle}</p>
                   </div>
                )}

                {/* Mode Toggles */}
                <div className="flex justify-center mb-3">
                   <div className="bg-slate-100 p-1 rounded-lg flex">
                      <button 
                        onClick={() => setMode('fast')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${mode === 'fast' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                         <Zap className="w-3 h-3" /> {t.fastScan}
                      </button>
                      <button 
                        onClick={() => setMode('deep')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${mode === 'deep' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                         <BrainCircuit className="w-3 h-3" /> {t.deepSearch}
                      </button>
                   </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative group">
                    <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={t.searchPlaceholder}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 font-medium"
                    />
                  </div>
                  
                  {provider === 'gemini' && (
                    <div className="relative shrink-0">
                        <input type="file" id="pdf-upload" accept=".pdf,.txt" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                        <label htmlFor="pdf-upload" className={`flex items-center justify-center gap-2 px-5 py-3 border-none rounded-xl cursor-pointer transition-all font-medium h-full w-full sm:w-auto ${file ? 'text-blue-700 bg-blue-50 ring-1 ring-blue-100' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}>
                            <Upload className="w-5 h-5" />
                            <span className="sm:inline">{file ? 'Selected' : 'PDF'}</span>
                        </label>
                    </div>
                  )}

                  <button 
                    onClick={handleIngest}
                    disabled={loading || (!input && !file)}
                    className={`px-6 py-3 font-medium rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 ${mode === 'deep' ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200' : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200'}`}
                  >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5 text-yellow-300" />}
                    <span>{mode === 'deep' ? t.deepSearchButton : t.mapButton}</span>
                  </button>
                </div>
            </div>
          </div>

          {/* Re-open Search Button */}
          {!isSearchExpanded && graphData.nodes.length > 0 && (
             <button 
               onClick={() => setIsSearchExpanded(true)}
               className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur border border-slate-200 shadow-lg px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all hover:scale-105"
             >
                <Search className="w-4 h-4 text-blue-500" />
                {t.newAnalysis}
             </button>
          )}

          <div className="flex-1 h-full w-full bg-slate-50 touch-none">
              {graphData.nodes.length > 0 ? (
                <GraphView 
                  data={graphData} 
                  onNodeSelect={setSelectedNode} 
                  searchQuery={file ? file.name : input} 
                  language={language}
                  translations={t}
                />
              ) : (
                !loading && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50"><div className="w-[500px] h-[500px] bg-gradient-to-tr from-blue-100 to-indigo-50 rounded-full blur-3xl" /></div>
              )}
          </div>

          {selectedNode && <Sidebar />}
        </div>
      </main>
    </div>
  );
};

export default App;