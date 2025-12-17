import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useThemeStore } from "../../stores/themeStore";
import { X, ExternalLink, ChevronRight } from "lucide-react";

interface PainPoint {
  id: string;
  statement: string;
  magnitude: number;
  effortSolving: number;
  totalHoursPerMonth: number;
  hasLinks: boolean;
  linkedUseCases: string[];
}

interface PrioritizationMatrixProps {
  painPoints: PainPoint[];
  onPainPointClick?: (painPointId: string) => void;
}

interface GroupedPoint {
  key: string;
  magnitude: number;
  effortSolving: number;
  points: PainPoint[];
  maxHoursPerMonth: number;
  hasAnyLinks: boolean;
}

interface TooltipData {
  group: GroupedPoint;
  x: number;
  y: number;
}

interface StackedPopupData {
  group: GroupedPoint;
  x: number;
  y: number;
}

export function PrioritizationMatrix({ painPoints, onPainPointClick }: PrioritizationMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [stackedPopup, setStackedPopup] = useState<StackedPopupData | null>(null);
  const { resolvedTheme } = useThemeStore();
  const isDark = resolvedTheme === 'dark';

  const groupedPoints = useMemo(() => {
    const groups = new Map<string, GroupedPoint>();
    
    painPoints.forEach((point) => {
      const key = `${point.magnitude}-${point.effortSolving}`;
      
      if (groups.has(key)) {
        const existing = groups.get(key)!;
        existing.points.push(point);
        existing.maxHoursPerMonth = Math.max(existing.maxHoursPerMonth, point.totalHoursPerMonth);
        existing.hasAnyLinks = existing.hasAnyLinks || point.hasLinks;
      } else {
        groups.set(key, {
          key,
          magnitude: point.magnitude,
          effortSolving: point.effortSolving,
          points: [point],
          maxHoursPerMonth: point.totalHoursPerMonth,
          hasAnyLinks: point.hasLinks
        });
      }
    });
    
    return Array.from(groups.values());
  }, [painPoints]);

  const drawBubble = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    hasLinks: boolean,
    isStacked: boolean,
    stackCount: number,
    isDarkMode: boolean
  ) => {
    ctx.save();
    
    const gradient = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, 0,
      x, y, radius * 1.2
    );
    
    if (hasLinks) {
      if (isDarkMode) {
        gradient.addColorStop(0, "rgba(167, 139, 250, 0.95)");
        gradient.addColorStop(0.5, "rgba(139, 92, 246, 0.85)");
        gradient.addColorStop(1, "rgba(109, 40, 217, 0.7)");
      } else {
        gradient.addColorStop(0, "rgba(167, 139, 250, 0.95)");
        gradient.addColorStop(0.5, "rgba(139, 92, 246, 0.9)");
        gradient.addColorStop(1, "rgba(124, 58, 237, 0.8)");
      }
    } else {
      if (isDarkMode) {
        gradient.addColorStop(0, "rgba(253, 186, 116, 0.95)");
        gradient.addColorStop(0.5, "rgba(251, 146, 60, 0.85)");
        gradient.addColorStop(1, "rgba(234, 88, 12, 0.7)");
      } else {
        gradient.addColorStop(0, "rgba(253, 186, 116, 0.95)");
        gradient.addColorStop(0.5, "rgba(251, 146, 60, 0.9)");
        gradient.addColorStop(1, "rgba(249, 115, 22, 0.8)");
      }
    }

    if (isStacked) {
      ctx.shadowColor = hasLinks 
        ? (isDarkMode ? "rgba(139, 92, 246, 0.6)" : "rgba(124, 58, 237, 0.5)")
        : (isDarkMode ? "rgba(251, 146, 60, 0.6)" : "rgba(249, 115, 22, 0.5)");
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.shadowBlur = 0;

    const innerGlow = ctx.createRadialGradient(
      x - radius * 0.4, y - radius * 0.4, 0,
      x, y, radius
    );
    innerGlow.addColorStop(0, "rgba(255, 255, 255, 0.4)");
    innerGlow.addColorStop(0.3, "rgba(255, 255, 255, 0.1)");
    innerGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
    
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.85, 0, 2 * Math.PI);
    ctx.fillStyle = innerGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = hasLinks
      ? (isDarkMode ? "rgba(167, 139, 250, 0.9)" : "rgba(124, 58, 237, 0.9)")
      : (isDarkMode ? "rgba(253, 186, 116, 0.9)" : "rgba(249, 115, 22, 0.9)");
    ctx.lineWidth = isStacked ? 3 : 2;
    ctx.stroke();

    if (isStacked) {
      const badgeRadius = Math.max(10, radius * 0.4);
      const badgeX = x + radius * 0.65;
      const badgeY = y - radius * 0.65;

      const badgeGradient = ctx.createRadialGradient(
        badgeX - 2, badgeY - 2, 0,
        badgeX, badgeY, badgeRadius
      );
      badgeGradient.addColorStop(0, "#f87171");
      badgeGradient.addColorStop(1, "#dc2626");
      
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = badgeGradient;
      ctx.fill();

      ctx.strokeStyle = isDarkMode ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(9, badgeRadius * 0.9)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(stackCount), badgeX, badgeY + 0.5);
    }

    ctx.restore();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || painPoints.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 60;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = isDark ? "hsl(222 47% 8%)" : "#f9fafb";
    ctx.fillRect(0, 0, width, height);

    const midX = padding + chartWidth / 2;
    const midY = padding + chartHeight / 2;

    ctx.fillStyle = isDark ? "rgba(34, 197, 94, 0.08)" : "rgba(34, 197, 94, 0.12)";
    ctx.fillRect(padding, padding, chartWidth / 2, chartHeight / 2);

    ctx.fillStyle = isDark ? "rgba(59, 130, 246, 0.08)" : "rgba(59, 130, 246, 0.12)";
    ctx.fillRect(midX, padding, chartWidth / 2, chartHeight / 2);

    ctx.fillStyle = isDark ? "rgba(251, 191, 36, 0.08)" : "rgba(251, 191, 36, 0.12)";
    ctx.fillRect(padding, midY, chartWidth / 2, chartHeight / 2);

    ctx.fillStyle = isDark ? "rgba(239, 68, 68, 0.08)" : "rgba(239, 68, 68, 0.12)";
    ctx.fillRect(midX, midY, chartWidth / 2, chartHeight / 2);

    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.1)" : "#e5e7eb";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 10; i++) {
      const x = padding + (chartWidth / 10) * i;
      const y = padding + (chartHeight / 10) * i;

      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.3)" : "#6b7280";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(midX, padding);
    ctx.lineTo(midX, height - padding);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padding, midY);
    ctx.lineTo(width - padding, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";

    ctx.fillStyle = isDark ? "rgba(74, 222, 128, 0.9)" : "rgba(22, 163, 74, 0.9)";
    ctx.fillText("Do Now", padding + chartWidth / 4, padding + 25);

    ctx.fillStyle = isDark ? "rgba(96, 165, 250, 0.9)" : "rgba(37, 99, 235, 0.9)";
    ctx.fillText("Do Next", midX + chartWidth / 4, padding + 25);

    ctx.fillStyle = isDark ? "rgba(250, 204, 21, 0.9)" : "rgba(180, 130, 0, 0.9)";
    ctx.fillText("Do if you have Time", padding + chartWidth / 4, midY + 25);

    ctx.fillStyle = isDark ? "rgba(248, 113, 113, 0.9)" : "rgba(220, 38, 38, 0.9)";
    ctx.fillText("Don't do", midX + chartWidth / 4, midY + 25);

    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.2)" : "#9ca3af";
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, padding, chartWidth, chartHeight);

    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.6)" : "#6b7280";
    ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Effort to Solve (1=Low, 10=High)", width / 2, height - 20);

    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Benefit of Remediating (1=Low, 10=High)", 0, 0);
    ctx.restore();

    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.6)" : "#6b7280";
    ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 1; i <= 10; i++) {
      const x = padding + (i / 10) * chartWidth - (chartWidth / 20);
      ctx.fillText(String(i), x, height - padding + 5);
    }

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 1; i <= 10; i++) {
      const y = height - padding - (i / 10) * chartHeight + (chartHeight / 20);
      ctx.fillText(String(i), padding - 8, y);
    }

    const maxHours = Math.max(...painPoints.map(p => p.totalHoursPerMonth), 1);

    groupedPoints.forEach((group) => {
      const x = padding + (group.effortSolving / 10) * chartWidth;
      const y = height - padding - (group.magnitude / 10) * chartHeight;
      const radius = Math.max(10, Math.min(35, (group.maxHoursPerMonth / maxHours) * 35));
      const isStacked = group.points.length > 1;

      drawBubble(ctx, x, y, radius, group.hasAnyLinks, isStacked, group.points.length, isDark);
    });

    const legendY = padding + 20;
    drawBubble(ctx, width - 150, legendY, 10, true, false, 0, isDark);
    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.8)" : "#374151";
    ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Has Linked Solutions", width - 135, legendY);

    drawBubble(ctx, width - 150, legendY + 28, 10, false, false, 0, isDark);
    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.8)" : "#374151";
    ctx.fillText("No Linked Solutions", width - 135, legendY + 28);

    drawBubble(ctx, width - 150, legendY + 56, 10, true, true, 3, isDark);
    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.8)" : "#374151";
    ctx.fillText("Stacked (click to view)", width - 135, legendY + 56);

  }, [painPoints, groupedPoints, isDark, drawBubble]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || painPoints.length === 0) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (stackedPopup) return;
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const width = rect.width;
      const height = rect.height;
      const padding = 60;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;
      const maxHours = Math.max(...painPoints.map(p => p.totalHoursPerMonth), 1);

      let hoveredGroup: TooltipData | null = null;

      for (const group of groupedPoints) {
        const x = padding + (group.effortSolving / 10) * chartWidth;
        const y = height - padding - (group.magnitude / 10) * chartHeight;
        const radius = Math.max(10, Math.min(35, (group.maxHoursPerMonth / maxHours) * 35));

        const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);

        if (distance <= radius) {
          hoveredGroup = {
            group,
            x: e.clientX,
            y: e.clientY
          };
          break;
        }
      }

      setTooltip(hoveredGroup);
      canvas.style.cursor = hoveredGroup ? 'pointer' : 'default';
    };

    const handleMouseLeave = () => {
      if (!stackedPopup) {
        setTooltip(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const width = rect.width;
      const height = rect.height;
      const padding = 60;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;
      const maxHours = Math.max(...painPoints.map(p => p.totalHoursPerMonth), 1);

      for (const group of groupedPoints) {
        const x = padding + (group.effortSolving / 10) * chartWidth;
        const y = height - padding - (group.magnitude / 10) * chartHeight;
        const radius = Math.max(10, Math.min(35, (group.maxHoursPerMonth / maxHours) * 35));

        const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);

        if (distance <= radius) {
          if (group.points.length > 1) {
            setStackedPopup({
              group,
              x: e.clientX,
              y: e.clientY
            });
            setTooltip(null);
          } else if (onPainPointClick) {
            onPainPointClick(group.points[0].id);
          }
          break;
        }
      }
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("click", handleClick);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("click", handleClick);
    };
  }, [painPoints, groupedPoints, stackedPopup, onPainPointClick]);

  const handlePainPointSelect = (painPointId: string) => {
    setStackedPopup(null);
    if (onPainPointClick) {
      onPainPointClick(painPointId);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 slide-up">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Prioritization Matrix
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Benefit vs. Effort - Bubble size represents total hours per month. Click stacked bubbles to navigate.
      </p>
      {painPoints.length === 0 ? (
        <div className="flex items-center justify-center h-96 text-muted-foreground">
          No pain points to visualize
        </div>
      ) : (
        <div ref={containerRef} className="relative w-full" style={{ height: "500px" }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full rounded-xl"
            style={{ width: "100%", height: "100%" }}
          />
          
          {tooltip && !stackedPopup && (
            <div
              className="fixed z-50 bg-popover/95 backdrop-blur-sm text-popover-foreground px-4 py-3 rounded-xl shadow-2xl border border-border max-w-sm pointer-events-none"
              style={{
                left: Math.min(tooltip.x + 15, window.innerWidth - 320),
                top: Math.min(tooltip.y + 15, window.innerHeight - 200),
              }}
            >
              {tooltip.group.points.length > 1 ? (
                <div className="flex items-center gap-2">
                  <span className="bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                    {tooltip.group.points.length} stacked
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Click to view all
                  </span>
                </div>
              ) : (
                <>
                  <div className="font-semibold mb-2 text-sm">{tooltip.group.points[0].statement}</div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Benefit:</span>
                      <span className="font-medium text-foreground">{tooltip.group.points[0].magnitude}/10</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Effort:</span>
                      <span className="font-medium text-foreground">{tooltip.group.points[0].effortSolving}/10</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hours/Month:</span>
                      <span className="font-medium text-foreground">{Math.round(tooltip.group.points[0].totalHoursPerMonth)}</span>
                    </div>
                  </div>
                  {tooltip.group.points[0].linkedUseCases.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="font-semibold mb-1 text-xs text-foreground">Linked Solutions:</div>
                      {tooltip.group.points[0].linkedUseCases.slice(0, 3).map((useCase, idx) => (
                        <div key={idx} className="text-xs text-primary truncate">• {useCase}</div>
                      ))}
                      {tooltip.group.points[0].linkedUseCases.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{tooltip.group.points[0].linkedUseCases.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {stackedPopup && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setStackedPopup(null)}
              />
              <div
                className="fixed z-50 bg-popover/95 backdrop-blur-md text-popover-foreground rounded-2xl shadow-2xl border border-border overflow-hidden"
                style={{
                  left: Math.min(Math.max(stackedPopup.x - 160, 16), window.innerWidth - 336),
                  top: Math.min(Math.max(stackedPopup.y - 100, 16), window.innerHeight - 400),
                  width: "320px",
                  maxHeight: "380px"
                }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      {stackedPopup.group.points.length}
                    </span>
                    <span className="text-sm font-medium text-foreground">Stacked Pain Points</span>
                  </div>
                  <button
                    onClick={() => setStackedPopup(null)}
                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border bg-muted/20">
                  Benefit: {stackedPopup.group.magnitude}/10 • Effort: {stackedPopup.group.effortSolving}/10
                </div>

                <div className="overflow-y-auto max-h-[280px] divide-y divide-border">
                  {stackedPopup.group.points.map((point, idx) => (
                    <button
                      key={point.id}
                      onClick={() => handlePainPointSelect(point.id)}
                      className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          point.hasLinks 
                            ? 'bg-violet-500/20 text-violet-500' 
                            : 'bg-orange-500/20 text-orange-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                            {point.statement}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{Math.round(point.totalHoursPerMonth)} hrs/mo</span>
                            {point.hasLinks && (
                              <span className="text-violet-500">{point.linkedUseCases.length} solution{point.linkedUseCases.length !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
