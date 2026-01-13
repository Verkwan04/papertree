export enum RelationType {
  INHERITANCE = 'Inheritance', // Blue
  CONFLICT = 'Conflict',       // Red
  INSPIRATION = 'Inspiration', // Dashed/Grey
  CITATION = 'Citation'        // Standard
}

export interface PaperNode {
  id: string;
  title: string;
  year: number;
  authors: string[];
  novelty: string; // "Novelty"
  summary: string;
  url?: string; // Link to the paper
  dataset?: string;
  benchmark?: string;
  methodology?: string;
  // d3 simulation properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface PaperLink {
  source: string | PaperNode; // d3 modifies this to object
  target: string | PaperNode; // d3 modifies this to object
  type: RelationType;
  description: string;
}

export interface GraphData {
  nodes: PaperNode[];
  links: PaperLink[];
}
