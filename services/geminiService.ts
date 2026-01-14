import { GoogleGenAI, Part } from "@google/genai";
import { GraphData } from "../types";

// Helper to encode file to base64
export const fileToGenerativePart = async (file: File): Promise<Part> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const SYSTEM_PROMPT_CORE = `
    You are "PaperTree", an advanced academic research assistant specialized in mapping the EVOLUTION of ideas.
    
    YOUR GOAL:
    1. Analyze the user's input (topic or paper).
    2. Identify 5-10 HIGHLY RELEVANT papers.
       - FILTERING: Ignore trivial "background" citations. Only include papers that provided CORE INSPIRATION, MAJOR CONFLICTS, or SIGNIFICANT ALGORITHMIC IMPROVEMENTS.
       - SEMANTIC ASSOCIATION: If two papers share a methodology but don't cite each other, link them as "Inspiration".
    3. Categorize each paper into a cluster (e.g., "Architecture", "Optimization", "Theory", "Application").

    OUTPUT SCHEMA (JSON ONLY):
    {
      "nodes": [ 
        { 
          "id": "ShortRefString", 
          "title": "Full Paper Title", 
          "year": 2024, 
          "authors": ["Author A", "Author B"], 
          "url": "https://arxiv.org/abs/...", 
          "category": "Cluster Label (e.g. Transformer Variant, RL Algorithm)",
          "novelty": "One sentence on the core innovation.", 
          "summary": "Concise abstract summary.", 
          "evolutionSummary": "Place in history: What problem did it solve? What did it lead to?",
          "comparison": "How does this differ from the previous major paper? (e.g., 'Replaces RNNs with Self-Attention')",
          "dataset": "Dataset used (optional)", 
          "benchmark": "Benchmark used (optional)", 
          "methodology": "Methodology used (optional)" 
        } 
      ],
      "links": [ 
        { 
          "source": "id_of_older_paper", 
          "target": "id_of_newer_paper", 
          "type": "Inheritance" | "Conflict" | "Inspiration" | "Citation", 
          "description": "Very short label (2-5 words)" 
        } 
      ]
    }

    STRICT JSON RULES:
    - All property names MUST be double-quoted. (e.g., "id": "...", NOT id: "...")
    - No trailing commas allowed.
    - Do not output markdown code blocks if possible, just raw JSON.
`;

const generateWithOpenAICompatible = async (
    input: string, 
    apiKey: string, 
    baseUrl: string, 
    model: string,
    mode: 'fast' | 'deep',
    language: 'en' | 'zh'
): Promise<GraphData> => {
    
    const modePrompt = mode === 'deep' 
        ? "Perform a DEEP analysis. detailed comparison, strictly accurate citations." 
        : "Perform a FAST analysis. Focus on high-level connections.";
    
    const langPrompt = language === 'zh'
        ? "OUTPUT IN SIMPLIFIED CHINESE. All fields (summary, novelty, description, etc) must be in Chinese. Title can remain original if English."
        : "OUTPUT IN ENGLISH.";

    const messages = [
        { role: "system", content: SYSTEM_PROMPT_CORE + "\n\n" + modePrompt + "\n" + langPrompt + "\n\n IMPORTANT: Return ONLY valid JSON. No comments, no markdown." },
        { role: "user", content: `Research Topic: ${input}. Build an evolutionary knowledge graph.` }
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.1, 
            max_tokens: 4000
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error ${response.status}: ${errorData?.error?.message || response.statusText}`);
    }

    const json = await response.json();
    const content = json.choices[0]?.message?.content || "{}";
    
    return parseAndSanitize(content);
};

const parseAndSanitize = (text: string): GraphData => {
    let cleanText = text.trim();
    
    // 1. Remove Markdown code blocks
    cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "");

    // 2. Extract content between first { and last } to remove pre/post-amble
    const firstOpen = cleanText.indexOf('{');
    const lastClose = cleanText.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
        cleanText = cleanText.substring(firstOpen, lastClose + 1);
    }

    // 3. Robust Cleanup (Handling common LLM JSON errors)
    // Remove trailing commas before } or ]
    cleanText = cleanText.replace(/,(\s*[}\]])/g, '$1');

    // Fix unquoted property names: { key: -> { "key": 
    // This regex looks for { or , followed by whitespace, then an alphanumeric key, then :
    // It captures the delimiter ($1), the key ($2) and replaces with "$2":
    cleanText = cleanText.replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
    
    // Fix single-quoted property names: { 'key': -> { "key":
    cleanText = cleanText.replace(/([{,]\s*)'([a-zA-Z0-9_]+?)'\s*:/g, '$1"$2":');

    try {
        const data = JSON.parse(cleanText) as GraphData;
        
        if (!data.nodes || !Array.isArray(data.nodes)) data.nodes = [];
        if (!data.links || !Array.isArray(data.links)) data.links = [];

        data.nodes.forEach(node => {
            node.id = String(node.id);
            const y = parseInt(String(node.year));
            node.year = isNaN(y) ? new Date().getFullYear() : y;
            if (!Array.isArray(node.authors)) {
                node.authors = typeof node.authors === 'string' ? [node.authors] : [];
            }
        });

        const nodeIds = new Set(data.nodes.map(n => n.id));
        data.links = data.links.filter(link => {
            const sourceValid = nodeIds.has(String(link.source));
            const targetValid = nodeIds.has(String(link.target));
            return sourceValid && targetValid;
        });

        return data;
    } catch (e) {
        console.error("JSON Parse Failed", e);
        console.log("Failed Text (Cleaned):", cleanText);
        throw new Error("Failed to parse analysis results. The model returned invalid JSON.");
    }
};

export const generateKnowledgeGraph = async (
    input: string, 
    file?: File, 
    apiKey?: string, 
    provider: 'gemini' | 'openai' | 'deepseek' = 'gemini',
    mode: 'fast' | 'deep' = 'fast',
    language: 'en' | 'zh' = 'zh'
): Promise<GraphData> => {

  if (!apiKey && provider !== 'gemini') throw new Error("MISSING_API_KEY");

  // OpenAI / DeepSeek
  if (provider === 'openai') {
      return generateWithOpenAICompatible(input, apiKey || "", "https://api.openai.com/v1", "gpt-4o", mode, language);
  }
  if (provider === 'deepseek') {
      return generateWithOpenAICompatible(input, apiKey || "", "https://api.deepseek.com", "deepseek-chat", mode, language);
  }

  // Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: Part[] = [];
  
  if (file) {
    const filePart = await fileToGenerativePart(file);
    parts.push(filePart);
    parts.push({ text: mode === 'deep' 
        ? "Analyze this paper in DEPTH. Find predecessors, successors, and conflicts. Focus on semantic relationships even without direct citations."
        : "Analyze this paper. Quickly identify key related papers and the general evolutionary tree." 
    });
  }
  
  if (input) {
    parts.push({ text: input });
    if (!file) {
       parts.push({ text: "Use Google Search to find high-quality academic papers and build a robust knowledge graph." });
    }
  }

  // Model Selection
  const modelName = mode === 'deep' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  
  const langInstruction = language === 'zh' 
       ? "OUTPUT MUST BE IN CHINESE (Simplified Chinese). 所有说明、摘要、标题都需要是中文（除了论文原名）。"
       : "OUTPUT MUST BE IN ENGLISH.";

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: parts },
      config: {
        systemInstruction: SYSTEM_PROMPT_CORE + "\n\n CONSTRAINTS: Return ONLY valid JSON. Populate 'url' using Google Search. \n" + langInstruction,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }] 
      }
    });

    const text = response.text || "{}";
    return parseAndSanitize(text);
  } catch (e: any) {
    console.error("Gemini API Error", e);
    let msg = e.message || "Unknown error";
    if (msg.includes("403")) msg += " (Permission Denied)";
    if (msg.includes("429")) msg += " (Quota Exceeded)";
    throw new Error(`Gemini Error: ${msg}`);
  }
};