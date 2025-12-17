import { useEffect, useRef, useState, useMemo } from "react";
import { useThemeStore } from "../../stores/themeStore";

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

export function PrioritizationMatrix({ painPoints }: PrioritizationMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
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

    ctx.font = "bold 14px sans-serif";
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
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Effort to Solve (1=Low, 10=High)", width / 2, height - 20);

    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Benefit of Remediating (1=Low, 10=High)", 0, 0);
    ctx.restore();

    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.6)" : "#6b7280";
    ctx.font = "11px sans-serif";
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
      const radius = Math.max(8, Math.min(30, (group.maxHoursPerMonth / maxHours) * 30));
      const isStacked = group.points.length > 1;

      if (group.hasAnyLinks) {
        ctx.fillStyle = isDark ? "rgba(139, 92, 246, 0.6)" : "rgba(124, 58, 237, 0.6)";
        ctx.strokeStyle = isDark ? "rgba(139, 92, 246, 1)" : "rgba(124, 58, 237, 1)";
      } else {
        ctx.fillStyle = isDark ? "rgba(251, 146, 60, 0.6)" : "rgba(249, 115, 22, 0.6)";
        ctx.strokeStyle = isDark ? "rgba(251, 146, 60, 1)" : "rgba(249, 115, 22, 1)";
      }
      
      ctx.lineWidth = isStacked ? 3 : 2;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      if (isStacked) {
        ctx.shadowColor = isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.shadowBlur = 0;

        const badgeRadius = 10;
        const badgeX = x + radius * 0.7;
        const badgeY = y - radius * 0.7;

        ctx.fillStyle = isDark ? "#dc2626" : "#ef4444";
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = isDark ? "#1f2937" : "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(group.points.length), badgeX, badgeY);
      }
    });

    const legendY = padding + 20;
    ctx.fillStyle = isDark ? "rgba(139, 92, 246, 0.6)" : "rgba(124, 58, 237, 0.6)";
    ctx.strokeStyle = isDark ? "rgba(139, 92, 246, 1)" : "rgba(124, 58, 237, 1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width - 150, legendY, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.8)" : "#374151";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Has Linked Solutions", width - 135, legendY + 4);

    ctx.fillStyle = isDark ? "rgba(251, 146, 60, 0.6)" : "rgba(249, 115, 22, 0.6)";
    ctx.strokeStyle = isDark ? "rgba(251, 146, 60, 1)" : "rgba(249, 115, 22, 1)";
    ctx.beginPath();
    ctx.arc(width - 150, legendY + 25, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.8)" : "#374151";
    ctx.fillText("No Linked Solutions", width - 135, legendY + 29);

    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(width - 150, legendY + 50, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3", width - 150, legendY + 50);

    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.8)" : "#374151";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Stacked Points", width - 135, legendY + 54);

  }, [painPoints, groupedPoints, isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || painPoints.length === 0) return;

    const handleMouseMove = (e: MouseEvent) => {
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
        const radius = Math.max(8, Math.min(30, (group.maxHoursPerMonth / maxHours) * 30));

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
    };

    const handleMouseLeave = () => {
      setTooltip(null);
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [painPoints, groupedPoints]);

  return (
    <div className="bg-card rounded-2xl border border-border p-6 slide-up">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Prioritization Matrix
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Benefit vs. Effort - Bubble size represents total hours per month
      </p>
      {painPoints.length === 0 ? (
        <div className="flex items-center justify-center h-96 text-muted-foreground">
          No pain points to visualize
        </div>
      ) : (
        <div ref={containerRef} className="relative w-full" style={{ height: "500px" }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-pointer rounded-xl"
            style={{ width: "100%", height: "100%" }}
          />
          {tooltip && (
            <div
              className="fixed z-50 bg-popover text-popover-foreground px-4 py-3 rounded-xl shadow-2xl border border-border max-w-sm pointer-events-none"
              style={{
                left: tooltip.x + 15,
                top: tooltip.y + 15,
              }}
            >
              {tooltip.group.points.length > 1 && (
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {tooltip.group.points.length} stacked
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Same position: Benefit {tooltip.group.magnitude}/10, Effort {tooltip.group.effortSolving}/10
                  </span>
                </div>
              )}
              <div className={tooltip.group.points.length > 1 ? "space-y-3 max-h-64 overflow-y-auto" : ""}>
                {tooltip.group.points.map((point, idx) => (
                  <div key={point.id} className={tooltip.group.points.length > 1 ? "pb-3 border-b border-border last:border-0 last:pb-0" : ""}>
                    <div className="font-semibold mb-2 text-sm flex items-start gap-2">
                      {tooltip.group.points.length > 1 && (
                        <span className="text-xs text-muted-foreground shrink-0">#{idx + 1}</span>
                      )}
                      <span>{point.statement}</span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>Benefit: {point.magnitude}/10</div>
                      <div>Effort: {point.effortSolving}/10</div>
                      <div>Hours/Month: {Math.round(point.totalHoursPerMonth)}</div>
                      {point.linkedUseCases.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <div className="font-semibold mb-1 text-foreground">Linked Solutions:</div>
                          {point.linkedUseCases.map((useCase, ucIdx) => (
                            <div key={ucIdx} className="text-primary">• {useCase}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
