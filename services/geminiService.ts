import { GoogleGenAI } from "@google/genai";
import { GraphData } from "../types";

// Helper to encode file to base64
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
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
    1. Analyze the user's input (a research topic).
    2. Find 3-5 HIGHLY RELEVANT related papers based on your knowledge.
    3. Look for specific relationships to build a CHRONOLOGICAL EVOLUTION MAP:
       - Ancestors (Papers that influenced this work).
       - Successors (Papers that cite or improve this work).
       - Conflicts (Papers with contradictory results).
    
    CRITICAL RULE FOR LINKS:
    - The 'source' MUST be the OLDER paper.
    - The 'target' MUST be the NEWER paper.
    - The 'description' MUST be VERY SHORT (2-5 words max) for visualization labels.

    OUTPUT SCHEMA (JSON ONLY):
    {
      "nodes": [ 
        { 
          "id": "ShortRefString", 
          "title": "Full Paper Title", 
          "year": 2024, 
          "authors": ["Author A", "Author B"], 
          "url": "https://arxiv.org/abs/...", 
          "novelty": "One sentence on the core innovation/contribution.", 
          "summary": "A concise summary of the abstract.", 
          "evolutionSummary": "A 3-4 sentence narrative explaining this paper's role in the timeline. What problem from the past did it solve? What conclusion did it reach that affected future papers?",
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
          "description": "Very short label (2-5 words) describing the evolution" 
        } 
      ]
    }
`;

/**
 * Handle OpenAI / DeepSeek Requests via Standard Fetch
 */
const generateWithOpenAICompatible = async (
    input: string, 
    apiKey: string, 
    baseUrl: string, 
    model: string
): Promise<GraphData> => {
    
    const messages = [
        { role: "system", content: SYSTEM_PROMPT_CORE + "\n\n IMPORTANT: Return ONLY valid JSON. No Markdown formatting." },
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
            temperature: 0.1, // Low temp for JSON stability
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
     let cleanText = text;
     // Clean Markdown blocks
    if (cleanText.includes("```json")) {
        cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "");
    } else if (cleanText.includes("```")) {
        cleanText = cleanText.replace(/```/g, "");
    }
    cleanText = cleanText.trim();

    const data = JSON.parse(cleanText) as GraphData;
    
    if (!data.nodes || !Array.isArray(data.nodes)) data.nodes = [];
    if (!data.links || !Array.isArray(data.links)) data.links = [];

    data.nodes.forEach(node => {
        node.id = String(node.id);
        node.year = parseInt(String(node.year)) || new Date().getFullYear();
    });

    const nodeIds = new Set(data.nodes.map(n => n.id));
    data.links = data.links.filter(link => {
        const sourceValid = nodeIds.has(String(link.source));
        const targetValid = nodeIds.has(String(link.target));
        return sourceValid && targetValid;
    });

    return data;
};

/**
 * Main Reasoning Engine
 */
export const generateKnowledgeGraph = async (
    input: string, 
    file?: File, 
    apiKey?: string, 
    provider: 'gemini' | 'openai' | 'deepseek' = 'gemini'
): Promise<GraphData> => {

  if (!apiKey) throw new Error("MISSING_API_KEY");

  // 1. OpenAI Handler
  if (provider === 'openai') {
      return generateWithOpenAICompatible(input, apiKey, "https://api.openai.com/v1", "gpt-4o");
  }

  // 2. DeepSeek Handler
  if (provider === 'deepseek') {
      return generateWithOpenAICompatible(input, apiKey, "https://api.deepseek.com", "deepseek-chat");
  }

  // 3. Gemini Handler (Default)
  const ai = new GoogleGenAI({ apiKey: apiKey });
  const parts: any[] = [];
  
  if (file) {
    const filePart = await fileToGenerativePart(file);
    parts.push(filePart);
    parts.push({ text: "Analyze this paper. Find its official URL via Google Search. Then find related papers (predecessors and successors) to show how this research evolved." });
  }
  
  if (input) {
    parts.push({ text: input });
    if (!file) {
       parts.push({ text: "Use Google Search to find papers related to this topic/URL and build an evolutionary timeline map." });
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: parts },
      config: {
        systemInstruction: SYSTEM_PROMPT_CORE + "\n\n CONSTRAINTS: You MUST try to populate the 'url' field for every node using Google Search results.",
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }] 
      }
    });

    const text = response.text || "{}";
    return parseAndSanitize(text);
  } catch (e: any) {
    console.error("Gemini API Error", e);
    // Enhance error message for end users
    let msg = e.message || "Unknown error";
    if (msg.includes("403")) msg += " (Permission Denied - Check API Key or Model Access)";
    if (msg.includes("429")) msg += " (Quota Exceeded)";
    throw new Error(`Gemini Error: ${msg}`);
  }
};