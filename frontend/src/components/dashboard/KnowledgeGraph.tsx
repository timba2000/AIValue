import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useThemeStore } from "../../stores/themeStore";
import { useFilterStore } from "../../stores/filterStore";
import { ZoomIn, ZoomOut, Maximize2, X } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

interface GraphNode {
  id: string;
  label: string;
  type: "company" | "businessUnit" | "process" | "painPoint" | "useCase";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface TooltipData {
  node: GraphNode;
  x: number;
  y: number;
}

interface KnowledgeGraphProps {
  onPainPointClick?: (painPointId: string) => void;
  onUseCaseClick?: (useCaseId: string) => void;
}

const NODE_COLORS = {
  company: { light: "#8b5cf6", dark: "#a78bfa" },
  businessUnit: { light: "#3b82f6", dark: "#60a5fa" },
  process: { light: "#10b981", dark: "#34d399" },
  painPoint: { light: "#f59e0b", dark: "#fbbf24" },
  useCase: { light: "#ec4899", dark: "#f472b6" },
};

const NODE_LABELS = {
  company: "Company",
  businessUnit: "Business Unit",
  process: "Process",
  painPoint: "Pain Point",
  useCase: "Solution",
};

export function KnowledgeGraph({ onPainPointClick, onUseCaseClick }: KnowledgeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const simulationActiveRef = useRef(true);
  const velocityThreshold = 0.1;
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showProcesses, setShowProcesses] = useState(false);
  const [showPainPoints, setShowPainPoints] = useState(true);
  const [showSolutions, setShowSolutions] = useState(true);
  const { resolvedTheme } = useThemeStore();
  const isDark = resolvedTheme === "dark";
  const { selectedCompanyId, selectedBusinessUnitId, selectedProcessId } = useFilterStore();

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/companies`);
      return response.data;
    },
  });

  const { data: businessUnits = [] } = useQuery<any[]>({
    queryKey: ["businessUnits", selectedCompanyId],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/business-units`);
      if (selectedCompanyId) {
        return response.data.filter((bu: any) => bu.companyId === selectedCompanyId);
      }
      return response.data;
    },
  });

  const { data: processes = [] } = useQuery<any[]>({
    queryKey: ["allProcesses"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/processes`);
      return response.data;
    },
  });

  const { data: painPoints = [] } = useQuery<any[]>({
    queryKey: ["painPoints"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/pain-points`);
      return response.data;
    },
  });

  const { data: useCases = [] } = useQuery<any[]>({
    queryKey: ["useCases"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/use-cases`);
      return response.data;
    },
  });

  const { data: links = [] } = useQuery<any[]>({
    queryKey: ["allPainPointLinksDetails"],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/pain-point-links/all`);
      return response.data;
    },
  });

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    const filteredCompanies = selectedCompanyId
      ? companies.filter((c) => c.id === selectedCompanyId)
      : companies;

    const relevantBuIds = new Set<string>();
    const relevantProcessIds = new Set<string>();

    filteredCompanies.forEach((company, i) => {
      const nodeId = `company-${company.id}`;
      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        nodes.push({
          id: nodeId,
          label: company.name,
          type: "company",
          x: 200 + i * 300,
          y: 100,
          vx: 0,
          vy: 0,
          radius: 30,
        });
      }
    });

    const filteredBUs = selectedBusinessUnitId
      ? businessUnits.filter((bu) => bu.id === selectedBusinessUnitId)
      : businessUnits.filter((bu) =>
          filteredCompanies.some((c) => c.id === bu.companyId)
        );

    filteredBUs.forEach((bu, i) => {
      const nodeId = `bu-${bu.id}`;
      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        relevantBuIds.add(bu.id);
        nodes.push({
          id: nodeId,
          label: bu.name,
          type: "businessUnit",
          x: 150 + (i % 5) * 150,
          y: 200 + Math.floor(i / 5) * 100,
          vx: 0,
          vy: 0,
          radius: 24,
        });

        const companyNodeId = `company-${bu.companyId}`;
        if (nodeIds.has(companyNodeId)) {
          edges.push({
            source: companyNodeId,
            target: nodeId,
            type: "contains",
          });
        }
      }
    });

    const processLimit = selectedProcessId || selectedBusinessUnitId ? undefined : 100;
    const filteredProcesses = selectedProcessId
      ? processes.filter((p) => p.id === selectedProcessId)
      : processes.filter((p) => relevantBuIds.has(p.businessUnitId)).slice(0, processLimit);

    filteredProcesses.forEach((process) => {
      relevantProcessIds.add(process.id);
    });

    if (showProcesses) {
      filteredProcesses.forEach((process, i) => {
        const nodeId = `process-${process.id}`;
        if (!nodeIds.has(nodeId)) {
          nodeIds.add(nodeId);
          nodes.push({
            id: nodeId,
            label: process.name,
            type: "process",
            x: 100 + (i % 6) * 120,
            y: 350 + Math.floor(i / 6) * 80,
            vx: 0,
            vy: 0,
            radius: 20,
          });

          const buNodeId = `bu-${process.businessUnitId}`;
          if (nodeIds.has(buNodeId)) {
            edges.push({
              source: buNodeId,
              target: nodeId,
              type: "hasProcess",
            });
          }
        }
      });
    }

    if (showPainPoints) {
      const filteredPainPoints = painPoints
        .filter((pp) => {
          if (selectedProcessId) {
            return pp.processIds?.includes(selectedProcessId);
          }
          if (selectedBusinessUnitId) {
            return pp.businessUnitId === selectedBusinessUnitId || 
                   pp.processIds?.some((pid: string) => relevantProcessIds.has(pid));
          }
          return pp.businessUnitId && relevantBuIds.has(pp.businessUnitId) ||
                 pp.processIds?.some((pid: string) => relevantProcessIds.has(pid));
        });

      filteredPainPoints.forEach((pp, i) => {
        const nodeId = `pp-${pp.id}`;
        if (!nodeIds.has(nodeId)) {
          nodeIds.add(nodeId);
          nodes.push({
            id: nodeId,
            label: pp.statement.substring(0, 50) + (pp.statement.length > 50 ? "..." : ""),
            type: "painPoint",
            x: 80 + (i % 8) * 100,
            y: 500 + Math.floor(i / 8) * 70,
            vx: 0,
            vy: 0,
            radius: 16,
          });

          if (showProcesses) {
            pp.processIds?.forEach((processId: string) => {
              const processNodeId = `process-${processId}`;
              if (nodeIds.has(processNodeId)) {
                edges.push({
                  source: processNodeId,
                  target: nodeId,
                  type: "hasPainPoint",
                });
              }
            });
          }

          const hasProcessEdge = showProcesses && pp.processIds?.some((pid: string) => relevantProcessIds.has(pid));
          
          if (!hasProcessEdge) {
            if (pp.businessUnitId) {
              const buNodeId = `bu-${pp.businessUnitId}`;
              if (nodeIds.has(buNodeId)) {
                edges.push({
                  source: buNodeId,
                  target: nodeId,
                  type: "hasPainPoint",
                });
              }
            } else if (pp.processIds?.length > 0) {
              const firstProcessId = pp.processIds.find((pid: string) => relevantProcessIds.has(pid));
              if (firstProcessId) {
                const process = processes.find((p) => p.id === firstProcessId);
                if (process) {
                  const buNodeId = `bu-${process.businessUnitId}`;
                  if (nodeIds.has(buNodeId)) {
                    edges.push({
                      source: buNodeId,
                      target: nodeId,
                      type: "hasPainPoint",
                    });
                  }
                }
              }
            }
          }
        }
      });
    }

    if (showSolutions) {
      const linkedUseCaseIds = new Set(links.map((l) => l.useCaseId));
      const filteredUseCases = useCases.filter((uc) => linkedUseCaseIds.has(uc.id));

      filteredUseCases.forEach((uc, i) => {
        const nodeId = `uc-${uc.id}`;
        if (!nodeIds.has(nodeId)) {
          nodeIds.add(nodeId);
          nodes.push({
            id: nodeId,
            label: uc.name,
            type: "useCase",
            x: 100 + (i % 6) * 130,
            y: 650 + Math.floor(i / 6) * 80,
            vx: 0,
            vy: 0,
            radius: 18,
          });
        }
      });

      if (showPainPoints) {
        links.forEach((link) => {
          const ppNodeId = `pp-${link.painPointId}`;
          const ucNodeId = `uc-${link.useCaseId}`;
          if (nodeIds.has(ppNodeId) && nodeIds.has(ucNodeId)) {
            edges.push({
              source: ppNodeId,
              target: ucNodeId,
              type: "solvedBy",
            });
          }
        });
      }
    }

    return { nodes, edges };
  }, [companies, businessUnits, processes, painPoints, useCases, links, selectedCompanyId, selectedBusinessUnitId, selectedProcessId, showProcesses, showPainPoints, showSolutions]);

  useEffect(() => {
    nodesRef.current = graphData.nodes.map((n) => ({ ...n }));
    edgesRef.current = graphData.edges;
    simulationActiveRef.current = true;
  }, [graphData]);

  const simulate = useCallback((): boolean => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    if (nodes.length === 0) return false;

    const centerX = 400;
    const centerY = 350;
    const repulsion = 2000;
    const attraction = 0.01;
    const damping = 0.85;
    const centerPull = 0.001;

    nodes.forEach((node) => {
      let fx = 0;
      let fy = 0;

      nodes.forEach((other) => {
        if (node.id !== other.id) {
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }
      });

      edges.forEach((edge) => {
        let other: GraphNode | undefined;
        if (edge.source === node.id) {
          other = nodes.find((n) => n.id === edge.target);
        } else if (edge.target === node.id) {
          other = nodes.find((n) => n.id === edge.source);
        }
        if (other) {
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          fx += dx * attraction;
          fy += dy * attraction;
        }
      });

      fx += (centerX - node.x) * centerPull;
      fy += (centerY - node.y) * centerPull;

      node.vx = (node.vx + fx) * damping;
      node.vy = (node.vy + fy) * damping;
    });

    let maxVelocity = 0;
    nodes.forEach((node) => {
      node.x += node.vx;
      node.y += node.vy;
      node.x = Math.max(50, Math.min(750, node.x));
      node.y = Math.max(50, Math.min(650, node.y));
      const velocity = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (velocity > maxVelocity) maxVelocity = velocity;
    });

    return maxVelocity > velocityThreshold;
  }, [velocityThreshold]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    edges.forEach((edge) => {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (source && target) {
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = isDark ? "rgba(148, 163, 184, 0.6)" : "rgba(100, 116, 139, 0.3)";
        ctx.lineWidth = isDark ? 1.5 : 1;
        ctx.stroke();
      }
    });

    nodes.forEach((node) => {
      const color = NODE_COLORS[node.type][isDark ? "dark" : "light"];
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      
      if (selectedNode?.id === node.id) {
        ctx.strokeStyle = isDark ? "#fff" : "#000";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.fillStyle = isDark ? "#1e293b" : "#ffffff";
      ctx.font = `bold ${Math.max(8, node.radius * 0.5)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      const initial = node.label.charAt(0).toUpperCase();
      ctx.fillText(initial, node.x, node.y);
    });

    ctx.restore();
  }, [isDark, zoom, pan, selectedNode]);

  useEffect(() => {
    let running = true;
    const animate = () => {
      if (!running) return;
      
      if (simulationActiveRef.current) {
        const stillMoving = simulate();
        if (!stillMoving) {
          simulationActiveRef.current = false;
        }
      }
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      running = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [simulate, draw]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    const nodes = nodesRef.current;
    let hoveredNode: GraphNode | null = null;

    for (const node of nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < node.radius) {
        hoveredNode = node;
        break;
      }
    }

    if (hoveredNode) {
      setTooltip({
        node: hoveredNode,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      canvas.style.cursor = "pointer";
    } else {
      setTooltip(null);
      canvas.style.cursor = isPanning ? "grabbing" : "grab";
    }
  }, [zoom, pan, isPanning, lastMousePos]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsPanning(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const nodes = nodesRef.current;
    for (const node of nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < node.radius) {
        setSelectedNode(node);
        
        // Handle edit callbacks for pain points and solutions
        if (node.type === "painPoint" && onPainPointClick) {
          const painPointId = node.id.replace("pp-", "");
          onPainPointClick(painPointId);
        } else if (node.type === "useCase" && onUseCaseClick) {
          const useCaseId = node.id.replace("uc-", "");
          onUseCaseClick(useCaseId);
        }
        return;
      }
    }
    setSelectedNode(null);
  }, [zoom, pan, onPainPointClick, onUseCaseClick]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.3, Math.min(3, prev * delta)));
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
  }, []);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 slide-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Knowledge Graph</h2>
          <p className="text-sm text-muted-foreground">
            Interactive visualization of entity relationships
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(3, z * 1.2))}
            className="p-2 rounded-lg bg-accent hover:bg-accent/80 text-foreground transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.3, z * 0.8))}
            className="p-2 rounded-lg bg-accent hover:bg-accent/80 text-foreground transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={resetView}
            className="p-2 rounded-lg bg-accent hover:bg-accent/80 text-foreground transition-colors"
            title="Reset view"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        {Object.entries(NODE_LABELS).map(([type, label]) => {
          const isToggleable = type === "process" || type === "painPoint" || type === "useCase";
          const isActive = type === "process" ? showProcesses : 
                          type === "painPoint" ? showPainPoints : 
                          type === "useCase" ? showSolutions : true;
          const toggleFn = type === "process" ? () => setShowProcesses(!showProcesses) :
                          type === "painPoint" ? () => setShowPainPoints(!showPainPoints) :
                          type === "useCase" ? () => setShowSolutions(!showSolutions) : undefined;
          
          return (
            <button
              key={type}
              onClick={isToggleable ? toggleFn : undefined}
              className={`flex items-center gap-2 text-sm px-2 py-1 rounded-lg transition-all ${
                isToggleable ? "hover:bg-accent cursor-pointer" : "cursor-default"
              } ${!isActive ? "opacity-40" : ""}`}
              disabled={!isToggleable}
            >
              <div
                className={`w-3 h-3 rounded-full transition-opacity ${!isActive ? "opacity-40" : ""}`}
                style={{
                  backgroundColor: NODE_COLORS[type as keyof typeof NODE_COLORS][isDark ? "dark" : "light"],
                }}
              />
              <span className="text-muted-foreground">{label}</span>
              {isToggleable && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {isActive ? "ON" : "OFF"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        ref={containerRef}
        className="relative bg-muted/30 rounded-xl overflow-hidden"
        style={{ height: "500px" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
        />

        {tooltip && (
          <div
            className="absolute z-50 bg-popover/95 backdrop-blur-sm text-popover-foreground px-3 py-2 rounded-xl shadow-lg border border-border max-w-xs pointer-events-none"
            style={{
              left: Math.min(tooltip.x + 15, (containerRef.current?.clientWidth || 500) - 200),
              top: Math.min(tooltip.y + 15, (containerRef.current?.clientHeight || 500) - 100),
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: NODE_COLORS[tooltip.node.type][isDark ? "dark" : "light"],
                }}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {NODE_LABELS[tooltip.node.type]}
              </span>
            </div>
            <p className="font-medium text-sm">{tooltip.node.label}</p>
          </div>
        )}

        {nodesRef.current.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">
              No data to display. Select a company to view the knowledge graph.
            </p>
          </div>
        )}
      </div>

      {selectedNode && (
        <div className="mt-4 p-4 bg-accent/30 rounded-xl border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor: NODE_COLORS[selectedNode.type][isDark ? "dark" : "light"],
                }}
              />
              <span className="text-sm font-medium text-muted-foreground">
                {NODE_LABELS[selectedNode.type]}
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="font-semibold text-foreground">{selectedNode.label}</p>
        </div>
      )}
    </div>
  );
}
