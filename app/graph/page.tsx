"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ensureGuestSession } from "@/lib/guest-session-client";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as React.ComponentType<Record<string, unknown>>;
type GraphNode = { id: string; label: string; type: string; x?: number; y?: number };
type GraphLink = { source: string | GraphNode; target: string | GraphNode; label: string };
type GraphData = { nodes: GraphNode[]; links: GraphLink[] };
const palette: Record<string, string> = { User: "#67e8f9", Person: "#c4b5fd", Project: "#fbbf24", Team: "#fb7185", Skill: "#34d399", Memory: "#a78bfa", MemoryTest: "#f0abfc" };

export default function GraphPage() {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<{ zoomToFit?: (duration: number, padding?: number) => void } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const loadGraphData = useCallback(async () => {
    try {
      await ensureGuestSession();
      setLoading(true); setError(null);
      const response = await fetch("/api/graph", { cache: "no-store" });
      if (!response.ok) throw new Error(`Graph API returned status ${response.status}`);
      const json = await response.json();
      const nodes: GraphNode[] = Array.isArray(json.nodes) ? json.nodes : [];
      const nodeIds = new Set(nodes.map((node) => String(node.id)));
      const links: GraphLink[] = Array.isArray(json.links) ? json.links.filter((link: GraphLink) => nodeIds.has(String(link.source)) && nodeIds.has(String(link.target))).map((link: GraphLink) => ({ ...link, source: String(link.source), target: String(link.target) })) : [];
      setData({ nodes, links }); setSelectedNode(null);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load graph data"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { function updateDimensions() { if (!containerRef.current) return; setDimensions({ width: containerRef.current.clientWidth || 800, height: containerRef.current.clientHeight || 600 }); } updateDimensions(); window.addEventListener("resize", updateDimensions); return () => window.removeEventListener("resize", updateDimensions); }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void loadGraphData(); }, 0); return () => window.clearTimeout(timer); }, [loadGraphData]);
  useEffect(() => { if (!loading && data.nodes.length) { const timer = window.setTimeout(() => graphRef.current?.zoomToFit?.(700, 140), 700); return () => window.clearTimeout(timer); } }, [loading, data]);
  const nodeColor = (node: GraphNode) => palette[node.type] || "#f59e0b";

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-[#090d18] text-slate-100">
      <header className="z-10 border-b border-white/10 bg-[#0e1425]/95 px-4 py-4 backdrop-blur md:px-7"><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><Link href="/" className="back-button" aria-label="Back to memory chat">←</Link><div className="min-w-0"><p className="eyebrow">Synapse / Agent memory</p><h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-white md:text-2xl">Synapse graph</h1><p className="mt-1 hidden text-xs text-slate-500 sm:block">Explore how your stored facts connect</p></div></div><div className="flex shrink-0 items-center gap-2 md:gap-4"><div className="hidden text-right text-xs text-slate-500 sm:block"><span className="text-slate-300">{data.nodes.length}</span> nodes <span className="mx-1 text-slate-700">·</span> <span className="text-slate-300">{data.links.length}</span> links</div><button type="button" className="secondary-button" onClick={() => void loadGraphData()} disabled={loading}><span aria-hidden="true">↻</span> <span className="hidden sm:inline">Refresh</span></button></div></div></header>
      <section ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_center,#17223a_0%,#090d18_68%)]" aria-label="Memory graph visualization">
        <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[calc(100%-2rem)] rounded-xl border border-white/10 bg-[#0e1425]/80 px-3 py-2 text-xs text-slate-400 backdrop-blur md:left-6 md:top-6"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-cyan-300" aria-hidden="true" />Drag nodes to explore · click for details</div>
        {loading && <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#090d18]/75 backdrop-blur-sm" role="status"><div className="rounded-2xl border border-white/10 bg-[#111a2d] px-6 py-5 text-center shadow-2xl"><div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-violet-300/30 border-t-violet-300" aria-hidden="true" /><p className="text-sm font-medium text-slate-200">Loading your memory graph</p><p className="mt-1 text-xs text-slate-500">Connecting to FalkorDB…</p></div></div>}
        {error && !loading && <div className="absolute inset-0 z-20 flex items-center justify-center px-5"><div className="max-w-md rounded-2xl border border-rose-400/20 bg-[#241622]/95 px-6 py-6 text-center shadow-2xl"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-400/10 text-rose-300" aria-hidden="true">!</div><h2 className="mt-4 font-semibold text-rose-100">Couldn’t load the graph</h2><p className="mt-2 text-sm leading-6 text-rose-200/70">{error}</p><button type="button" className="primary-button mt-5" onClick={() => void loadGraphData()}>Try again <span aria-hidden="true">↻</span></button></div></div>}
        {!loading && !error && data.nodes.length === 0 && <div className="absolute inset-0 z-10 flex items-center justify-center px-5"><div className="max-w-sm text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/10 text-2xl text-violet-200" aria-hidden="true">◌</div><h2 className="mt-5 font-semibold text-white">Your graph is ready for its first memory</h2><p className="mt-2 text-sm leading-6 text-slate-400">Head back to chat and tell the agent something useful to remember.</p><Link href="/" className="primary-button mt-5 inline-flex">Add a memory <span aria-hidden="true">→</span></Link></div></div>}
        <ForceGraph2D ref={graphRef} width={dimensions.width} height={dimensions.height} graphData={data} nodeId="id" nodeLabel={(node: GraphNode) => `${node.type}: ${node.label}`} nodeColor={nodeColor} nodeRelSize={4.5} nodeCanvasObjectMode={() => "after"} nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => { if (globalScale < 1.8) return; const label = node.label.length > 26 ? `${node.label.slice(0, 23)}...` : node.label; const fontSize = Math.max(2.5, Math.min(8, 10 / globalScale)); ctx.font = `${fontSize}px Sans-Serif`; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = "rgba(226,232,240,0.9)"; ctx.fillText(label, node.x || 0, (node.y || 0) + 9 / globalScale); }} linkColor={() => "rgba(125, 211, 252, 0.7)"} linkWidth={() => 1.5} linkDirectionalArrowLength={4} linkDirectionalArrowRelPos={1} linkDirectionalArrowColor={() => "#c4b5fd"} linkCurvature={0.08} onNodeClick={(node: GraphNode) => setSelectedNode(node)} cooldownTicks={100} enableNodeDrag d3AlphaDecay={0.025} d3VelocityDecay={0.3} />
        <div className="absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap gap-2 rounded-xl border border-white/10 bg-[#0e1425]/80 px-3 py-2 backdrop-blur md:bottom-6 md:left-6">{Object.entries(palette).slice(0, 6).map(([type, color]) => <span key={type} className="flex items-center gap-1.5 text-[10px] text-slate-400"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{type}</span>)}</div>
        {selectedNode && <aside className="absolute bottom-4 right-4 z-20 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-white/10 bg-[#111a2d]/95 p-5 shadow-2xl backdrop-blur md:bottom-6 md:right-6" aria-label="Selected node details"><button className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-white/10 hover:text-white" onClick={() => setSelectedNode(null)} aria-label="Close node details">×</button><div className="flex items-center gap-2 pr-8"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: nodeColor(selectedNode) }} /><p className="eyebrow">{selectedNode.type}</p></div><p className="mt-3 break-words text-base font-medium leading-6 text-white">{selectedNode.label}</p><div className="mt-4 border-t border-white/10 pt-3"><p className="text-[10px] uppercase tracking-wider text-slate-600">Node ID</p><p className="mt-1 break-all font-mono text-xs text-slate-400">{selectedNode.id}</p></div></aside>}
      </section>
    </main>
  );
}
