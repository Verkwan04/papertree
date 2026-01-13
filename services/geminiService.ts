import { GoogleGenAI } from "@google/genai";
import { GraphData } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

/**
 * Main Reasoning Engine for PaperTree.
 * Uses Gemini 3 Flash to analyze input + Google Search to find related papers/links.
 */
export const generateKnowledgeGraph = async (input: string, file?: File): Promise<GraphData> => {
  const parts: any[] = [];
  
  // System Instruction to enforce JSON structure and Search usage
  const systemInstruction = `
    You are "PaperTree", an advanced academic research assistant specialized in mapping the EVOLUTION of ideas.
    
    YOUR GOAL:
    1. Analyze the user's input (a specific paper PDF, a list of URLs, or a research topic).
    2. USE GOOGLE SEARCH to find the input paper (if a PDF is provided) to get its URL, AND find 3-5 HIGHLY RELEVANT related papers.
    3. Look for specific relationships to build a CHRONOLOGICAL EVOLUTION MAP:
       - Ancestors (Papers that influenced this work).
       - Successors (Papers that cite or improve this work).
       - Conflicts (Papers with contradictory results).
    
    CRITICAL RULE FOR LINKS:
    - The 'source' MUST be the OLDER paper.
    - The 'target' MUST be the NEWER paper.
    - The 'description' MUST be VERY SHORT (2-5 words max) for visualization labels (e.g., "Uses Transformer", "Improves Accuracy", "Contradicts Results").

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

    CONSTRAINTS:
    - You MUST return valid JSON.
    - You MUST try to populate the "url" field for every node using Google Search results.
    - Do not invent papers. Only include real papers found via search or provided in context.
  `;

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
    // Use Gemini 3 Flash with Search Grounding
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: parts },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }] 
      }
    });

    let text = response.text || "{}";
    
    // Clean Markdown blocks if present (Robustness Fix)
    if (text.includes("```json")) {
        text = text.replace(/```json/g, "").replace(/```/g, "");
    } else if (text.includes("```")) {
        text = text.replace(/```/g, "");
    }
    
    text = text.trim();

    const data = JSON.parse(text) as GraphData;
    
    // --- CRITICAL SANITIZATION STEP ---
    if (!data.nodes || !Array.isArray(data.nodes)) data.nodes = [];
    if (!data.links || !Array.isArray(data.links)) data.links = [];

    // 1. Ensure IDs are strings and Years are numbers
    data.nodes.forEach(node => {
        node.id = String(node.id);
        node.year = parseInt(String(node.year)) || new Date().getFullYear();
    });

    // 2. Create a Set of valid Node IDs
    const nodeIds = new Set(data.nodes.map(n => n.id));

    // 3. Filter out links that point to non-existent nodes
    data.links = data.links.filter(link => {
        const sourceValid = nodeIds.has(String(link.source));
        const targetValid = nodeIds.has(String(link.target));
        return sourceValid && targetValid;
    });
    
    return data;
  } catch (e) {
    console.error("Gemini API Error or Parse Error", e);
    throw new Error("Analysis failed. Please try again. (Tip: Try a simpler topic or smaller PDF)");
  }
};