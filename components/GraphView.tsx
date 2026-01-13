import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, PaperNode, PaperLink, RelationType } from '../types';

interface GraphViewProps {
  data: GraphData;
  onNodeSelect: (node: PaperNode) => void;
}

const GraphView: React.FC<GraphViewProps> = ({ data, onNodeSelect }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Use ResizeObserver for more robust dimension tracking
  useEffect(() => {
    if (!wrapperRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
         setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
         });
      }
    });

    resizeObserver.observe(wrapperRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    // CRITICAL: Check dimensions and data availability
    if (!data.nodes.length || !svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    // CRITICAL FIX: Deep copy data to prevent D3 from mutating React props/state
    // This solves the "white screen" or crash issue in Strict Mode where D3 tries to
    // process already-linked objects as raw data in the second render pass.
    const nodes = data.nodes.map(d => ({ ...d }));
    const links = data.links.map(d => ({ ...d }));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const width = dimensions.width;
    const height = dimensions.height;
    const padding = { top: 40, right: 60, bottom: 60, left: 60 };
    
    // 1. Setup Time Scale
    const years = nodes.map(d => d.year);
    const currentYear = new Date().getFullYear();
    const minYear = d3.min(years) || currentYear;
    const maxYear = d3.max(years) || currentYear;
    
    const timeScale = d3.scaleLinear()
      .domain([minYear - 0.5, maxYear + 0.5]) 
      .range([padding.left, width - padding.right]);

    // Zoom behavior
    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    // 2. Draw Time Axis
    const axisGroup = g.append("g")
        .attr("transform", `translate(0, ${height - 40})`)
        .attr("class", "time-axis");
    
    const axis = d3.axisBottom(timeScale)
        .tickFormat(d3.format("d")) 
        .ticks(Math.min(maxYear - minYear + 1, 10));

    axisGroup.call(axis)
        .select(".domain").attr("stroke", "#cbd5e1");
    
    axisGroup.selectAll("text")
        .attr("fill", "#64748b")
        .attr("font-weight", "bold");

    axisGroup.selectAll("line")
        .attr("stroke", "#cbd5e1");

    // 3. Forces
    const simulation = d3.forceSimulation<PaperNode>(nodes)
      .force("link", d3.forceLink<PaperNode, PaperLink>(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("collide", d3.forceCollide().radius(35))
      .force("x", d3.forceX(d => {
         const yearX = timeScale(d.year);
         // Safety check for NaN
         return isNaN(yearX) ? width / 2 : yearX;
      }).strength(1.2)) 
      .force("y", d3.forceY(height / 2).strength(0.08)); 

    // Arrow marker definitions
    const defs = svg.append("defs");
    const types = [RelationType.INHERITANCE, RelationType.CONFLICT, RelationType.INSPIRATION, RelationType.CITATION];
    
    types.forEach(type => {
      let color = "#94a3b8"; 
      if (type === RelationType.INHERITANCE) color = "#3b82f6";
      if (type === RelationType.CONFLICT) color = "#ef4444";
      if (type === RelationType.INSPIRATION) color = "#10b981";
      
      defs.append("marker")
        .attr("id", `arrow-${type}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 28) 
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
    });

    // Links
    const link = g.append("g")
      .selectAll("path")
      .data(links)
      .enter().append("path")
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("stroke", d => {
        if (d.type === RelationType.INHERITANCE) return "#3b82f6";
        if (d.type === RelationType.CONFLICT) return "#ef4444";
        if (d.type === RelationType.INSPIRATION) return "#10b981";
        return "#94a3b8";
      })
      .attr("stroke-dasharray", d => d.type === RelationType.INSPIRATION ? "5,5" : "0")
      .attr("marker-end", d => `url(#arrow-${d.type})`);

    // Nodes
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .call(d3.drag<SVGGElement, PaperNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node Circle
    node.append("circle")
      .attr("r", 18)
      .attr("fill", "#f8fafc")
      .attr("stroke", "#334155")
      .attr("stroke-width", 2)
      .attr("class", "cursor-pointer transition-colors hover:stroke-blue-500 shadow-sm")
      .on("click", (e, d) => {
        e.stopPropagation();
        onNodeSelect(d);
      });

    // Year Badge
    node.append("circle")
        .attr("r", 8)
        .attr("cx", 12)
        .attr("cy", -12)
        .attr("fill", "#e2e8f0")
        .attr("stroke", "#94a3b8")
        .attr("stroke-width", 1);

    node.append("text")
        .text(d => d.year.toString().slice(-2)) 
        .attr("x", 12)
        .attr("y", -12)
        .attr("dy", 3)
        .attr("text-anchor", "middle")
        .attr("font-size", "9px")
        .attr("fill", "#475569")
        .attr("font-weight", "bold")
        .attr("pointer-events", "none");

    // Node Title Label
    node.append("text")
      .text(d => d.title.length > 20 ? d.title.substring(0, 20) + '...' : d.title)
      .attr("dy", 32)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", "#1e293b")
      .style("text-shadow", "0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff");

    simulation.on("tick", () => {
        link.attr("d", d => {
            // Check if source/target are objects (they should be after simulation starts)
            const source = d.source as PaperNode;
            const target = d.target as PaperNode;
            
            if (!source.x || !source.y || !target.x || !target.y) return "";

            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dr = Math.sqrt(dx * dx + dy * dy) * 2; 
            
            return `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`;
        });

        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: PaperNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: PaperNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: PaperNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    // Cleanup simulation on unmount
    return () => simulation.stop();

  }, [data, dimensions, onNodeSelect]);

  return (
    <div ref={wrapperRef} className="w-full h-full bg-slate-50 relative overflow-hidden rounded-xl border border-slate-200 shadow-inner">
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur p-3 rounded-lg text-xs shadow-sm border border-slate-200 flex flex-col gap-2">
        <h4 className="font-bold text-slate-700">Evolution Map</h4>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Inheritance (Improves)</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Conflict (Contradicts)</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 opacity-80"></span> Inspiration (Derived)</div>
        <div className="mt-1 pt-1 border-t border-slate-100 text-slate-400 text-[10px]">
             X-Axis: Publication Timeline
        </div>
      </div>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};

export default GraphView;
