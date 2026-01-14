import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Download, Info, ChevronUp, ChevronDown } from 'lucide-react';
import { GraphData, PaperNode, PaperLink, RelationType } from '../types';

interface GraphViewProps {
  data: GraphData;
  onNodeSelect: (node: PaperNode) => void;
  searchQuery: string;
  language: 'en' | 'zh';
  translations: any;
}

const GraphView: React.FC<GraphViewProps> = ({ data, onNodeSelect, searchQuery, language, translations }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoverNode, setHoverNode] = useState<{ x: number, y: number, node: PaperNode } | null>(null);
  const [showLegend, setShowLegend] = useState(true);

  // Check for mobile to auto-collapse legend
  useEffect(() => {
     if (window.innerWidth < 768) {
         setShowLegend(false);
     }
  }, []);

  // Use ResizeObserver for robust dimension tracking
  useEffect(() => {
    if (!wrapperRef.current) return;
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
         setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    resizeObserver.observe(wrapperRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!data.nodes.length || !svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    // Deep copy
    const nodes = data.nodes.map(d => ({ ...d }));
    // Links need IDs for textPaths
    const links = data.links.map((d, i) => ({ ...d, id: `link-${i}` }));

    // Identify Core Node
    let coreNodeId: string | null = null;
    if (searchQuery) {
        // Try exact match then fuzzy
        const lowerQ = searchQuery.toLowerCase();
        const exact = nodes.find(n => n.title.toLowerCase().includes(lowerQ));
        if (exact) coreNodeId = exact.id;
        else {
             if (searchQuery.includes(".pdf")) coreNodeId = nodes[0].id;
        }
    }

    // Determine Node Colors based on relationship to Core
    const getNodeColor = (d: PaperNode) => {
        if (coreNodeId && d.id === coreNodeId) return "#facc15"; // Gold for Core

        if (coreNodeId) {
            // Find link connecting this node to core
            const linkToCore = links.find(l => 
                (l.source === coreNodeId && l.target === d.id) || 
                (l.target === coreNodeId && l.source === d.id)
            );

            if (linkToCore) {
                if (linkToCore.type === RelationType.CONFLICT) return "#94a3b8"; 
                if (linkToCore.type === RelationType.INHERITANCE || linkToCore.type === RelationType.INSPIRATION) return "#f472b6"; 
            }
        }
        
        return "#e2e8f0"; 
    };
    
    const categories = Array.from(new Set(nodes.map(d => d.category || 'Other')));
    const categoryScale = d3.scaleOrdinal(d3.schemeSet3).domain(categories);


    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = dimensions.width;
    const height = dimensions.height;
    const padding = { top: 60, right: 100, bottom: 80, left: 100 };
    
    // Time Scale
    const years = nodes.map(d => d.year);
    const minYear = d3.min(years) || 2020;
    const maxYear = d3.max(years) || 2024;
    const timeScale = d3.scaleLinear().domain([minYear - 0.5, maxYear + 0.5]).range([padding.left, width - padding.right]);

    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]).on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Time Axis
    const axisGroup = g.append("g").attr("transform", `translate(0, ${height - 50})`).attr("class", "time-axis");
    const axis = d3.axisBottom(timeScale).tickFormat(d3.format("d")).ticks(Math.min(maxYear - minYear + 1, 10));
    axisGroup.call(axis).select(".domain").attr("stroke", "#cbd5e1");
    axisGroup.selectAll("text").attr("fill", "#64748b").attr("font-weight", "bold").attr("font-size", "12px");
    axisGroup.selectAll("line").attr("stroke", "#cbd5e1").attr("stroke-dasharray", "2,2");

    // Grid Lines for Years
    const yearTicks = timeScale.ticks(Math.min(maxYear - minYear + 1, 10));
    g.append("g").selectAll("line").data(yearTicks).enter().append("line")
      .attr("x1", d => timeScale(d)).attr("x2", d => timeScale(d)).attr("y1", padding.top).attr("y2", height - 50)
      .attr("stroke", "#f1f5f9").attr("stroke-width", 1).attr("stroke-dasharray", "4,4");

    // Force Sim
    const simulation = d3.forceSimulation<PaperNode>(nodes)
      .force("link", d3.forceLink<PaperNode, PaperLink>(links).id(d => d.id).distance(180)) 
      .force("charge", d3.forceManyBody().strength(-500))
      .force("collide", d3.forceCollide().radius(50))
      .force("x", d3.forceX(d => {
         const yearX = timeScale(d.year);
         return isNaN(yearX) ? width / 2 : yearX;
      }).strength(1.2))
      .force("y", d3.forceY(height / 2).strength(0.08));

    // Arrows
    const defs = svg.append("defs");
    [RelationType.INHERITANCE, RelationType.CONFLICT, RelationType.INSPIRATION, RelationType.CITATION].forEach(type => {
      let color = "#94a3b8"; 
      if (type === RelationType.INHERITANCE) color = "#3b82f6";
      if (type === RelationType.CONFLICT) color = "#ef4444";
      if (type === RelationType.INSPIRATION) color = "#10b981";
      defs.append("marker").attr("id", `arrow-${type}`).attr("viewBox", "0 -5 10 10")
        .attr("refX", 32).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
        .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", color);
    });

    // Link Group
    const linkGroup = g.append("g");

    // Link Paths
    const linkPath = linkGroup.selectAll("path").data(links).enter().append("path")
      .attr("id", d => d.id) 
      .attr("fill", "none").attr("stroke-width", 2)
      .attr("stroke", d => {
        if (d.type === RelationType.INHERITANCE) return "#3b82f6";
        if (d.type === RelationType.CONFLICT) return "#ef4444";
        if (d.type === RelationType.INSPIRATION) return "#10b981";
        return "#cbd5e1";
      })
      .attr("stroke-dasharray", d => d.type === RelationType.INSPIRATION ? "5,5" : "0")
      .attr("marker-end", d => `url(#arrow-${d.type})`)
      .attr("opacity", 0.6);

    // Link Labels
    const linkText = linkGroup.selectAll("text").data(links).enter().append("text")
      .attr("dy", -5)
      .append("textPath")
      .attr("href", d => `#${d.id}`)
      .attr("startOffset", "50%")
      .style("text-anchor", "middle")
      .style("font-size", "10px")
      .style("font-weight", "700")
      .style("fill", "#1e293b") 
      .style("fill-opacity", 1)
      .style("paint-order", "stroke")
      .style("stroke", "#ffffff") 
      .style("stroke-width", "4px")
      .style("stroke-linecap", "round")
      .style("stroke-linejoin", "round")
      .text(d => d.description || d.type);

    // Nodes
    const node = g.append("g").selectAll("g").data(nodes).enter().append("g")
      .call(d3.drag<SVGGElement, PaperNode>().on("start", dragstarted).on("drag", dragged).on("end", dragended));

    // Node Interaction
    node.on("mouseover", (event, d) => {
         setHoverNode({ x: event.pageX, y: event.pageY, node: d });
         d3.select(event.currentTarget).select("circle").attr("stroke", "#3b82f6").attr("stroke-width", 4);
      })
      .on("mouseout", (event) => {
         setHoverNode(null);
         d3.select(event.currentTarget).select("circle").attr("stroke", "#fff").attr("stroke-width", 3);
      })
      .on("click", (e, d) => { e.stopPropagation(); onNodeSelect(d); });

    node.append("circle")
      .attr("r", 24)
      .attr("fill", d => {
          if (coreNodeId) return getNodeColor(d);
          return categoryScale(d.category || 'Other') as string;
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 3)
      .attr("class", "cursor-pointer drop-shadow-md transition-all");

    node.append("text")
        .text(d => d.year.toString().slice(-2))
        .attr("dy", 4)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("fill", "#1e293b")
        .attr("font-weight", "bold")
        .attr("pointer-events", "none");

    node.append("text")
      .text(d => d.title.length > 20 ? d.title.substring(0, 20) + '...' : d.title)
      .attr("dy", 38)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", "#334155")
      .style("text-shadow", "0 1px 2px white");

    node.append("rect")
      .attr("x", -24).attr("y", -38).attr("width", 48).attr("height", 14).attr("rx", 7)
      .attr("fill", "#f1f5f9").attr("opacity", 0.85);
    
    node.append("text")
      .text(d => d.category ? d.category.substring(0, 8) : '')
      .attr("y", -28)
      .attr("text-anchor", "middle")
      .attr("font-size", "8px")
      .attr("fill", "#475569")
      .attr("font-weight", "bold");

    simulation.on("tick", () => {
        linkPath.attr("d", d => {
            const s = d.source as PaperNode;
            const t = d.target as PaperNode;
            if (!s.x || !s.y || !t.x || !t.y) return "";
            const dx = t.x - s.x, dy = t.y - s.y;
            const dr = Math.sqrt(dx * dx + dy * dy) * 1.5; 
            return `M${s.x},${s.y}A${dr},${dr} 0 0,1 ${t.x},${t.y}`;
        });
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: PaperNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }
    function dragged(event: any, d: PaperNode) { d.fx = event.x; d.fy = event.y; }
    function dragended(event: any, d: PaperNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }
    
    return () => simulation.stop();
  }, [data, dimensions, onNodeSelect, searchQuery]);

  const handleExport = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgRef.current);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext("2d");
    
    const img = new Image();
    const svgBlob = new Blob([svgStr], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
        if(ctx) {
            ctx.fillStyle = "#f8fafc"; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            const pngUrl = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = pngUrl;
            a.download = "papertree-graph.png";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };
    img.src = url;
  };

  return (
    <div ref={wrapperRef} className="w-full h-full bg-slate-50 relative overflow-hidden rounded-xl border border-slate-200 shadow-inner group touch-none">
      
      {/* Collapsible Legend */}
      <div className={`absolute top-4 left-4 z-10 bg-white/90 backdrop-blur rounded-lg text-xs shadow-sm border border-slate-200 transition-all duration-300 pointer-events-auto ${showLegend ? 'p-3' : 'p-2'}`}>
        <div className="flex items-center justify-between gap-4 mb-2 cursor-pointer" onClick={() => setShowLegend(!showLegend)}>
             {showLegend && <h4 className="font-bold text-slate-700">{translations.legend}</h4>}
             {!showLegend && <Info className="w-4 h-4 text-slate-500" />}
             <button className="text-slate-400 hover:text-slate-600">
                 {showLegend ? <ChevronUp className="w-3 h-3" /> : null}
             </button>
        </div>
        
        {showLegend && (
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Inheritance (Blue)</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> Conflict (Red)</div>
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Inspiration (Green)</div>
                {searchQuery && (
                    <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-400 border border-white shadow-sm"></span> Core Topic</div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-pink-300 border border-white shadow-sm"></span> Support/Proof</div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-400 border border-white shadow-sm"></span> Contrary</div>
                    </div>
                )}
            </div>
        )}
      </div>
      
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Export Button */}
      <button 
        onClick={handleExport}
        className="absolute bottom-16 right-4 z-20 bg-white hover:bg-slate-100 text-slate-600 p-2 rounded-full shadow-lg border border-slate-200 transition-all active:scale-95"
        title={translations.export}
      >
        <Download className="w-5 h-5" />
      </button>

      {/* Hover Tooltip - Only show if not on touch device (approx) or if explicity requested. For now, keep as hover but minimal styling */}
      {hoverNode && (
          <div 
            className="hidden md:block absolute z-50 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-slate-200 w-72 pointer-events-none transform -translate-x-1/2 -translate-y-[120%]"
            style={{ left: hoverNode.x - (wrapperRef.current?.getBoundingClientRect().left || 0), top: hoverNode.y - (wrapperRef.current?.getBoundingClientRect().top || 0) }}
          >
             <div className="flex items-start justify-between mb-2">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-full">{hoverNode.node.year}</span>
                 {hoverNode.node.category && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{hoverNode.node.category}</span>}
             </div>
             <h3 className="font-bold text-slate-900 leading-tight mb-2">{hoverNode.node.title}</h3>
             <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed">{hoverNode.node.summary}</p>
          </div>
      )}
    </div>
  );
};

export default GraphView;