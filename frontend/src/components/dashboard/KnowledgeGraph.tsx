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
  isLinked?: boolean;
  hoursPerMonth?: number;
  opportunityScore?: number;
  solutionCount?: number;
  isHighImpact?: boolean;
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
  painPointLinked: { light: "#22c55e", dark: "#4ade80" },
  painPointUnlinked: { light: "#ef4444", dark: "#f87171" },
  useCase: { light: "#ec4899", dark: "#f472b6" },
};

const NODE_LABELS = {
  company: "Company",
  businessUnit: "Business Unit",
  process: "Process",
  painPoint: "Pain Point",
  painPointLinked: "Linked Pain Point",
  painPointUnlinked: "Unlinked Pain Point",
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [impactThreshold, setImpactThreshold] = useState(0);
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
      const linkedPainPointIds = new Set(links.map((l) => l.painPointId));
      
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
        })
        .filter((pp) => {
          const isLinked = linkedPainPointIds.has(pp.id);
          if (statusFilter === 'linked') return isLinked;
          if (statusFilter === 'unlinked') return !isLinked;
          return true;
        })
        .filter((pp) => {
          const hours = pp.totalHoursPerMonth || 0;
          return hours >= impactThreshold;
        });

      const maxHours = Math.max(...filteredPainPoints.map((pp) => pp.totalHoursPerMonth || 0), 1);
      
      filteredPainPoints.forEach((pp, i) => {
        const nodeId = `pp-${pp.id}`;
        const isLinked = linkedPainPointIds.has(pp.id);
        const solutionCount = links.filter((l) => l.painPointId === pp.id).length;
        const hours = pp.totalHoursPerMonth || 0;
        const baseRadius = 12;
        const maxRadius = 28;
        const radiusScale = maxHours > 0 ? (hours / maxHours) : 0;
        const radius = baseRadius + radiusScale * (maxRadius - baseRadius);
        const isHighImpact = hours >= 50 && !isLinked;
        
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
            radius,
            isLinked,
            hoursPerMonth: hours,
            solutionCount,
            isHighImpact,
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
  }, [companies, businessUnits, processes, painPoints, useCases, links, selectedCompanyId, selectedBusinessUnitId, selectedProcessId, showProcesses, showPainPoints, showSolutions, statusFilter, impactThreshold]);

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
        const isSolvedBy = edge.type === 'solvedBy';
        
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = isSolvedBy 
          ? (isDark ? "rgba(34, 197, 94, 0.7)" : "rgba(22, 163, 74, 0.5)")
          : (isDark ? "rgba(148, 163, 184, 0.6)" : "rgba(100, 116, 139, 0.3)");
        ctx.lineWidth = isSolvedBy ? 2 : (isDark ? 1.5 : 1);
        ctx.stroke();
        
        if (isSolvedBy) {
          const angle = Math.atan2(target.y - source.y, target.x - source.x);
          const arrowSize = 8;
          const arrowX = target.x - target.radius * Math.cos(angle);
          const arrowY = target.y - target.radius * Math.sin(angle);
          
          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
            arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
            arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fillStyle = isDark ? "rgba(34, 197, 94, 0.9)" : "rgba(22, 163, 74, 0.7)";
          ctx.fill();
        }
      }
    });

    nodes.forEach((node) => {
      let color: string;
      if (node.type === 'painPoint') {
        color = node.isLinked 
          ? NODE_COLORS.painPointLinked[isDark ? "dark" : "light"]
          : NODE_COLORS.painPointUnlinked[isDark ? "dark" : "light"];
      } else {
        color = NODE_COLORS[node.type][isDark ? "dark" : "light"];
      }
      
      if (node.isHighImpact) {
        ctx.save();
        ctx.shadowColor = isDark ? "#ef4444" : "#dc2626";
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "rgba(239, 68, 68, 0.3)" : "rgba(220, 38, 38, 0.2)";
        ctx.fill();
        ctx.restore();
      }
      
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

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.company[isDark ? "dark" : "light"] }} />
          <span className="text-sm text-muted-foreground">Company</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.businessUnit[isDark ? "dark" : "light"] }} />
          <span className="text-sm text-muted-foreground">Business Unit</span>
        </div>
        
        <button
          onClick={() => setShowProcesses(!showProcesses)}
          className={`flex items-center gap-2 text-sm px-2 py-1 rounded-lg hover:bg-accent cursor-pointer transition-all ${!showProcesses ? "opacity-40" : ""}`}
        >
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.process[isDark ? "dark" : "light"] }} />
          <span className="text-muted-foreground">Process</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${showProcesses ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
            {showProcesses ? "ON" : "OFF"}
          </span>
        </button>
        
        <button
          onClick={() => setShowPainPoints(!showPainPoints)}
          className={`flex items-center gap-2 text-sm px-2 py-1 rounded-lg hover:bg-accent cursor-pointer transition-all ${!showPainPoints ? "opacity-40" : ""}`}
        >
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.painPointLinked[isDark ? "dark" : "light"] }} />
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.painPointUnlinked[isDark ? "dark" : "light"] }} />
          </div>
          <span className="text-muted-foreground">Pain Points</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${showPainPoints ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
            {showPainPoints ? "ON" : "OFF"}
          </span>
        </button>
        
        <button
          onClick={() => setShowSolutions(!showSolutions)}
          className={`flex items-center gap-2 text-sm px-2 py-1 rounded-lg hover:bg-accent cursor-pointer transition-all ${!showSolutions ? "opacity-40" : ""}`}
        >
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.useCase[isDark ? "dark" : "light"] }} />
          <span className="text-muted-foreground">Solutions</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${showSolutions ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
            {showSolutions ? "ON" : "OFF"}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Pain Point Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'linked' | 'unlinked')}
            className="text-sm px-2 py-1 rounded-lg bg-accent text-foreground border border-border"
          >
            <option value="all">All</option>
            <option value="linked">Linked (with solutions)</option>
            <option value="unlinked">Unlinked (no solutions)</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Min Hours/Month:</span>
          <input
            type="number"
            value={impactThreshold}
            onChange={(e) => setImpactThreshold(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-20 text-sm px-2 py-1 rounded-lg bg-accent text-foreground border border-border"
            min="0"
            step="10"
          />
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.painPointLinked[isDark ? "dark" : "light"] }} />
            <span className="text-xs text-muted-foreground">= Linked</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.painPointUnlinked[isDark ? "dark" : "light"] }} />
            <span className="text-xs text-muted-foreground">= Unlinked</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full border-2 border-red-500 animate-pulse" style={{ backgroundColor: NODE_COLORS.painPointUnlinked[isDark ? "dark" : "light"] }} />
            <span className="text-xs text-muted-foreground">= High Impact</span>
          </div>
        </div>
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
              left: Math.min(tooltip.x + 15, (containerRef.current?.clientWidth || 500) - 220),
              top: Math.min(tooltip.y + 15, (containerRef.current?.clientHeight || 500) - 120),
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: tooltip.node.type === 'painPoint'
                    ? (tooltip.node.isLinked 
                        ? NODE_COLORS.painPointLinked[isDark ? "dark" : "light"]
                        : NODE_COLORS.painPointUnlinked[isDark ? "dark" : "light"])
                    : NODE_COLORS[tooltip.node.type][isDark ? "dark" : "light"],
                }}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {tooltip.node.type === 'painPoint' 
                  ? (tooltip.node.isLinked ? 'Linked Pain Point' : 'Unlinked Pain Point')
                  : NODE_LABELS[tooltip.node.type]}
              </span>
              {tooltip.node.isHighImpact && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 font-medium">
                  High Impact
                </span>
              )}
            </div>
            <p className="font-medium text-sm">{tooltip.node.label}</p>
            {tooltip.node.type === 'painPoint' && (
              <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Hours/Month:</span>
                  <span className="ml-1 font-medium">{(tooltip.node.hoursPerMonth || 0).toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Solutions:</span>
                  <span className="ml-1 font-medium">{tooltip.node.solutionCount || 0}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`ml-1 font-medium ${tooltip.node.isLinked ? 'text-green-500' : 'text-red-500'}`}>
                    {tooltip.node.isLinked ? 'Linked to Solution' : 'No Solution'}
                  </span>
                </div>
              </div>
            )}
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
                  backgroundColor: selectedNode.type === 'painPoint'
                    ? (selectedNode.isLinked 
                        ? NODE_COLORS.painPointLinked[isDark ? "dark" : "light"]
                        : NODE_COLORS.painPointUnlinked[isDark ? "dark" : "light"])
                    : NODE_COLORS[selectedNode.type][isDark ? "dark" : "light"],
                }}
              />
              <span className="text-sm font-medium text-muted-foreground">
                {selectedNode.type === 'painPoint' 
                  ? (selectedNode.isLinked ? 'Linked Pain Point' : 'Unlinked Pain Point')
                  : NODE_LABELS[selectedNode.type]}
              </span>
              {selectedNode.isHighImpact && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 font-medium">
                  High Impact - Needs Solution
                </span>
              )}
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="font-semibold text-foreground">{selectedNode.label}</p>
          {selectedNode.type === 'painPoint' && (
            <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Hours/Month:</span>
                <span className="ml-1 font-medium">{(selectedNode.hoursPerMonth || 0).toFixed(1)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Linked Solutions:</span>
                <span className="ml-1 font-medium">{selectedNode.solutionCount || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className={`ml-1 font-medium ${selectedNode.isLinked ? 'text-green-500' : 'text-red-500'}`}>
                  {selectedNode.isLinked ? 'Has Solution' : 'No Solution'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
