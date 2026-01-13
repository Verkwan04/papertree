import React, { useState, useEffect } from 'react';
import { Network, Upload, Loader2, Sparkles, X, Search, FileText, ExternalLink, History, Clock, Trash2, Lightbulb, GitBranch, Key, Settings, AlertCircle, Save, Bot } from 'lucide-react';
import GraphView from './components/GraphView';
import { GraphData, PaperNode } from './types';
import { generateKnowledgeGraph } from './services/geminiService';

interface HistoryItem {
  id: string;
  query: string;
  timestamp: number;
  data: GraphData;
}

type AiProvider = 'gemini' | 'openai' | 'deepseek';

const App: React.FC = () => {
  // Graph State
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<PaperNode | null>(null);
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Settings / API Key State
  const [showSettings, setShowSettings] = useState(false);
  
  // Provider State
  const [provider, setProvider] = useState<AiProvider>('gemini');
  
  // Separate keys for providers
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  
  // Temp keys for modal inputs
  const [tempGeminiKey, setTempGeminiKey] = useState('');
  const [tempOpenaiKey, setTempOpenaiKey] = useState('');
  const [tempDeepseekKey, setTempDeepseekKey] = useState('');

  // Load history and API Keys on mount
  useEffect(() => {
    const saved = localStorage.getItem('paperTreeHistory');
    if (saved) {
        try {
            setHistory(JSON.parse(saved));
        } catch (e) {
            console.error("Failed to load history");
        }
    }
    
    // Load keys
    const gKey = localStorage.getItem('gemini_api_key');
    if (gKey) { setGeminiKey(gKey); setTempGeminiKey(gKey); }
    
    const oKey = localStorage.getItem('openai_api_key');
    if (oKey) { setOpenaiKey(oKey); setTempOpenaiKey(oKey); }
    
    const dKey = localStorage.getItem('deepseek_api_key');
    if (dKey) { setDeepseekKey(dKey); setTempDeepseekKey(dKey); }

    // Load last provider
    const lastProvider = localStorage.getItem('selected_provider') as AiProvider;
    if (lastProvider) setProvider(lastProvider);
  }, []);

  const saveToHistory = (query: string, data: GraphData) => {
    const newItem: HistoryItem = {
        id: Date.now().toString(),
        query: query,
        timestamp: Date.now(),
        data: data
    };
    const updated = [newItem, ...history].slice(0, 20); // Keep last 20
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
      setShowHistory(false);
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

  const getCurrentKey = () => {
      if (provider === 'gemini') return geminiKey;
      if (provider === 'openai') return openaiKey;
      if (provider === 'deepseek') return deepseekKey;
      return '';
  };

  const handleIngest = async () => {
    if (!input && !file) return;
    
    const activeKey = getCurrentKey();

    // Check for API Key first
    if (!activeKey) {
        setShowSettings(true);
        return;
    }

    setLoading(true);
    setSelectedNode(null);
    try {
      // Pass the provider and the specific key
      const data = await generateKnowledgeGraph(input, file || undefined, activeKey, provider);
      setGraphData(data);
      saveToHistory(file ? `[${provider}] PDF: ${file.name}` : `[${provider}] ${input}`, data);
    } catch (e: any) {
      console.error(e);
      let msg = e.message || "Unknown error";
      // Better error messages for Vercel/Deployment issues
      if (msg.includes("401") || msg.includes("MISSING_API_KEY")) {
          alert(`Authentication Failed for ${provider}. Please check your API Key.`);
          setShowSettings(true);
      } else if (msg.includes("429")) {
          alert(`Rate limit exceeded for ${provider}. Please try again later.`);
      } else if (msg.includes("503") || msg.includes("Overloaded")) {
          alert(`${provider} is currently overloaded. Please try again.`);
      } else {
          alert(`Analysis Failed: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const Sidebar = () => (
    <div className="w-96 h-full border-l border-slate-200 bg-white p-6 overflow-y-auto absolute right-0 top-0 shadow-2xl z-20 flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
           <FileText className="w-5 h-5 text-slate-500" />
           Analysis & Summary
        </h3>
        <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-slate-100 rounded transition-colors">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {selectedNode ? (
        <div className="space-y-6 flex-1">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Title</span>
            <a 
              href={selectedNode.url || "#"} 
              target="_blank" 
              rel="noopener noreferrer"
              className={`font-serif text-xl font-bold leading-tight ${selectedNode.url ? 'text-blue-700 hover:underline' : 'text-slate-900'}`}
            >
              {selectedNode.title}
            </a>
          </div>

          <div className="flex gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Year</span>
              <p className="text-sm font-medium text-slate-700">{selectedNode.year}</p>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Authors</span>
              <p className="text-sm font-medium text-slate-700">{selectedNode.authors.join(', ')}</p>
            </div>
          </div>

          {/* Featured Contribution Section */}
          <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 shadow-sm">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1 mb-2">
               <Lightbulb className="w-4 h-4" /> Core Innovation
            </span>
            <p className="text-sm text-slate-800 leading-relaxed font-semibold">{selectedNode.novelty}</p>
          </div>

          {/* New Evolutionary Context Section */}
          {selectedNode.evolutionSummary && (
             <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                  <GitBranch className="w-4 h-4" /> Context & Conclusion
               </span>
               <p className="text-sm text-slate-600 leading-relaxed italic border-l-2 border-slate-300 pl-3">
                 "{selectedNode.evolutionSummary}"
               </p>
             </div>
          )}

          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Abstract Summary</span>
            <p className="text-sm text-slate-600 leading-relaxed">{selectedNode.summary}</p>
          </div>

          {(selectedNode.dataset || selectedNode.benchmark || selectedNode.methodology) && (
             <div className="space-y-3 pt-2 border-t border-slate-100">
                {selectedNode.methodology && (
                   <div className="text-sm">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Methodology</span>
                      <span className="text-slate-700 bg-slate-100 px-2 py-1 rounded">{selectedNode.methodology}</span>
                   </div>
                )}
                {selectedNode.dataset && (
                   <div className="text-sm">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Dataset</span>
                      <span className="text-slate-700 bg-slate-100 px-2 py-1 rounded">{selectedNode.dataset}</span>
                   </div>
                )}
                {selectedNode.benchmark && (
                   <div className="text-sm">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Benchmark</span>
                      <span className="text-slate-700 bg-slate-100 px-2 py-1 rounded">{selectedNode.benchmark}</span>
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
                 Read Full Paper
                 <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
               </a>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 text-slate-400 flex flex-col items-center">
          <Network className="w-16 h-16 mb-4 opacity-10" />
          <p className="text-sm font-medium">Select a node to view the evolutionary analysis.</p>
        </div>
      )}
    </div>
  );

  const HistoryDrawer = () => (
      <div className={`absolute left-0 top-0 h-full bg-white shadow-2xl z-30 transition-all duration-300 overflow-hidden flex flex-col border-r border-slate-200 ${showHistory ? 'w-80' : 'w-0 opacity-0'}`}>
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <History className="w-4 h-4" /> History
              </h3>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-slate-200 rounded">
                  <X className="w-4 h-4 text-slate-500" />
              </button>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {history.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-sm">No recent searches.</div>
              )}
              {history.map(item => (
                  <div key={item.id} onClick={() => loadHistoryItem(item)} className="p-3 rounded-lg border border-slate-100 hover:border-blue-300 hover:bg-blue-50 cursor-pointer group transition-all relative">
                      <p className="text-sm font-medium text-slate-800 line-clamp-2 pr-6">{item.query}</p>
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400">
                          <Clock className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                      <button 
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                          <Trash2 className="w-3 h-3" />
                      </button>
                  </div>
              ))}
          </div>
      </div>
  );

  const SettingsModal = () => (
     <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${showSettings ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <Settings className="w-5 h-5 text-blue-600" /> API Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
                 <X className="w-5 h-5" />
              </button>
           </div>
           
           <div className="bg-slate-50 rounded-lg p-1 flex mb-6">
              <button 
                onClick={() => setProvider('gemini')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${provider === 'gemini' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Google Gemini
              </button>
              <button 
                onClick={() => setProvider('openai')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${provider === 'openai' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                OpenAI
              </button>
              <button 
                onClick={() => setProvider('deepseek')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${provider === 'deepseek' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                DeepSeek
              </button>
           </div>

           <div className="space-y-4">
              
              {/* GEMINI SETTINGS */}
              {provider === 'gemini' && (
                <div>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3 mb-4">
                        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold mb-1">Recommended</p>
                            Gemini supports <b>PDF Uploads</b> and <b>Google Search</b> for real-time paper discovery.
                        </div>
                    </div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Gemini API Key</label>
                    <div className="relative">
                        <Key className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <input 
                        type="password"
                        value={tempGeminiKey}
                        onChange={(e) => setTempGeminiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800 font-mono text-sm"
                        />
                    </div>
                </div>
              )}

              {/* OPENAI SETTINGS */}
              {provider === 'openai' && (
                <div>
                     <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-3 mb-4">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                            <p className="font-semibold mb-1">Text Only</p>
                            OpenAI mode currently supports topic research. PDF upload is disabled in this mode.
                        </div>
                    </div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">OpenAI API Key</label>
                    <div className="relative">
                        <Key className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <input 
                        type="password"
                        value={tempOpenaiKey}
                        onChange={(e) => setTempOpenaiKey(e.target.value)}
                        placeholder="sk-proj-..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-slate-800 font-mono text-sm"
                        />
                    </div>
                </div>
              )}

              {/* DEEPSEEK SETTINGS */}
              {provider === 'deepseek' && (
                <div>
                     <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex gap-3 mb-4">
                        <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-indigo-800">
                            <p className="font-semibold mb-1">Economic Choice</p>
                             DeepSeek V3 is powerful and cost-effective. Supports text research only.
                        </div>
                    </div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">DeepSeek API Key</label>
                    <div className="relative">
                        <Key className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                        <input 
                        type="password"
                        value={tempDeepseekKey}
                        onChange={(e) => setTempDeepseekKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-800 font-mono text-sm"
                        />
                    </div>
                </div>
              )}

              <div className="pt-2">
                <button 
                    onClick={handleSaveSettings}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-900/10 transition-all flex items-center justify-center gap-2"
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
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors relative"
            title="Search History"
          >
              <History className="w-5 h-5" />
          </button>
          
          <div className="h-6 w-px bg-slate-200 mx-1"></div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <Network className="w-5 h-5 text-white" />
            </div>
            <div>
                <h1 className="font-bold text-xl tracking-tight text-slate-900 hidden md:block">PaperTree</h1>
                <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase hidden md:block">Academic Evolution Map</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
             <button
               onClick={() => setShowSettings(true)}
               className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${getCurrentKey() ? 'text-slate-600 hover:bg-slate-100' : 'text-red-600 bg-red-50 hover:bg-red-100 animate-pulse'}`}
             >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">
                    {provider === 'gemini' && "Gemini"}
                    {provider === 'openai' && "OpenAI"}
                    {provider === 'deepseek' && "DeepSeek"}
                </span>
                <span className={`w-2 h-2 rounded-full ${getCurrentKey() ? 'bg-green-500' : 'bg-red-500'}`}></span>
             </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <div className="flex h-full w-full relative">
          
          <HistoryDrawer />
          <SettingsModal />

          {/* Input Overlay */}
          <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-500 z-10 w-full max-w-3xl px-4 ${graphData.nodes.length > 0 ? 'top-4' : 'top-[30%]'}`}>
            <div className={`bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-2xl p-2 transition-all duration-500`}>
                {graphData.nodes.length === 0 && (
                   <div className="text-center pt-8 pb-6">
                       <h2 className="text-2xl font-bold text-slate-800 mb-3">Map the Evolution of Ideas</h2>
                       <p className="text-slate-500 max-w-md mx-auto">
                           Using <span className="font-bold text-slate-800 capitalize">{provider}</span>. 
                           {provider === 'gemini' ? (
                               <span> Features <span className="text-blue-600 font-medium">Google Search</span> & <span className="text-blue-600 font-medium">PDF Support</span>.</span>
                           ) : (
                               <span> Generates maps based on internal knowledge (Text only).</span>
                           )}
                       </p>
                   </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 p-2">
                  <div className="flex-1 relative group">
                    {provider === 'gemini' ? (
                        <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    ) : (
                        <Bot className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    )}
                    <input 
                      type="text" 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={provider === 'gemini' ? "Enter a topic or paste URLs..." : "Enter a research topic..."}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 placeholder:text-slate-400 transition-all font-medium"
                    />
                  </div>
                  
                  {provider === 'gemini' && (
                    <div className="relative shrink-0">
                        <input 
                        type="file" 
                        id="pdf-upload"
                        accept=".pdf,.txt,.md"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                        <label 
                        htmlFor="pdf-upload"
                        className={`flex items-center gap-2 px-5 py-3 border-none rounded-xl cursor-pointer transition-all font-medium h-full ${file ? 'text-blue-700 bg-blue-50 ring-1 ring-blue-100' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
                        >
                        <Upload className="w-5 h-5" />
                        <span className="hidden sm:inline">{file ? 'File Selected' : 'Upload PDF'}</span>
                        </label>
                    </div>
                  )}

                  <button 
                    onClick={handleIngest}
                    disabled={loading || (!input && !file)}
                    className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl shadow-lg shadow-slate-900/20 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 shrink-0"
                  >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5 text-yellow-300" />}
                    <span>Generate</span>
                  </button>
                </div>
            </div>
          </div>

          {/* Graph Visualization Area */}
          <div className="flex-1 h-full w-full bg-slate-50">
              {graphData.nodes.length > 0 ? (
                <GraphView data={graphData} onNodeSelect={setSelectedNode} />
              ) : (
                !loading && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-[600px] h-[600px] bg-gradient-to-tr from-blue-100/40 to-purple-100/40 rounded-full blur-3xl opacity-50" />
                  </div>
                )
              )}
          </div>

          {/* Sidebar Details */}
          {selectedNode && <Sidebar />}
        </div>
      </main>
    </div>
  );
};

export default App;