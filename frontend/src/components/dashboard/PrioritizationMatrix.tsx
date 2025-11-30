import { useEffect, useRef, useState } from "react";

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

interface TooltipData {
  point: PainPoint;
  x: number;
  y: number;
}

export function PrioritizationMatrix({ painPoints }: PrioritizationMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

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

    ctx.fillStyle = "#f9fafb";
    ctx.fillRect(0, 0, width, height);

    const midX = padding + chartWidth / 2;
    const midY = padding + chartHeight / 2;

    ctx.fillStyle = "rgba(34, 197, 94, 0.12)";
    ctx.fillRect(padding, padding, chartWidth / 2, chartHeight / 2);

    ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
    ctx.fillRect(midX, padding, chartWidth / 2, chartHeight / 2);

    ctx.fillStyle = "rgba(251, 191, 36, 0.12)";
    ctx.fillRect(padding, midY, chartWidth / 2, chartHeight / 2);

    ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
    ctx.fillRect(midX, midY, chartWidth / 2, chartHeight / 2);

    ctx.strokeStyle = "#e5e7eb";
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

    ctx.strokeStyle = "#6b7280";
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

    ctx.fillStyle = "rgba(22, 163, 74, 0.9)";
    ctx.fillText("Do Now", padding + chartWidth / 4, padding + 25);

    ctx.fillStyle = "rgba(37, 99, 235, 0.9)";
    ctx.fillText("Do Next", midX + chartWidth / 4, padding + 25);

    ctx.fillStyle = "rgba(180, 130, 0, 0.9)";
    ctx.fillText("Do if you have Time", padding + chartWidth / 4, midY + 25);

    ctx.fillStyle = "rgba(220, 38, 38, 0.9)";
    ctx.fillText("Don't do", midX + chartWidth / 4, midY + 25);

    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, padding, chartWidth, chartHeight);

    ctx.fillStyle = "#6b7280";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Effort to Solve (1=Low, 10=High)", width / 2, height - 20);

    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Benefit of Remediating (1=Low, 10=High)", 0, 0);
    ctx.restore();

    ctx.fillStyle = "#6b7280";
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

    painPoints.forEach((point) => {
      const x = padding + (point.effortSolving / 10) * chartWidth;
      const y = height - padding - (point.magnitude / 10) * chartHeight;
      const radius = Math.max(5, Math.min(30, (point.totalHoursPerMonth / maxHours) * 30));

      ctx.fillStyle = point.hasLinks ? "rgba(59, 130, 246, 0.6)" : "rgba(239, 68, 68, 0.6)";
      ctx.strokeStyle = point.hasLinks ? "rgba(59, 130, 246, 1)" : "rgba(239, 68, 68, 1)";
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });

    const legendY = padding + 20;
    ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
    ctx.strokeStyle = "rgba(59, 130, 246, 1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width - 150, legendY, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#374151";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Has Linked Solutions", width - 135, legendY + 4);

    ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
    ctx.strokeStyle = "rgba(239, 68, 68, 1)";
    ctx.beginPath();
    ctx.arc(width - 150, legendY + 25, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#374151";
    ctx.fillText("No Linked Solutions", width - 135, legendY + 29);

  }, [painPoints]);

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

      let hoveredPoint: TooltipData | null = null;

      for (const point of painPoints) {
        const x = padding + (point.effortSolving / 10) * chartWidth;
        const y = height - padding - (point.magnitude / 10) * chartHeight;
        const radius = Math.max(5, Math.min(30, (point.totalHoursPerMonth / maxHours) * 30));

        const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);

        if (distance <= radius) {
          hoveredPoint = {
            point,
            x: e.clientX,
            y: e.clientY
          };
          break;
        }
      }

      setTooltip(hoveredPoint);
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
  }, [painPoints]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Prioritization Matrix
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Benefit vs. Effort - Bubble size represents total hours per month
      </p>
      {painPoints.length === 0 ? (
        <div className="flex items-center justify-center h-96 text-gray-500">
          No pain points to visualize
        </div>
      ) : (
        <div ref={containerRef} className="relative w-full" style={{ height: "500px" }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-pointer"
            style={{ width: "100%", height: "100%" }}
          />
          {tooltip && (
            <div
              className="fixed z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm pointer-events-none"
              style={{
                left: tooltip.x + 15,
                top: tooltip.y + 15,
              }}
            >
              <div className="font-semibold mb-2 text-sm">{tooltip.point.statement}</div>
              <div className="space-y-1 text-xs">
                <div>Benefit: {tooltip.point.magnitude}/10</div>
                <div>Effort: {tooltip.point.effortSolving}/10</div>
                <div>Hours/Month: {Math.round(tooltip.point.totalHoursPerMonth)}</div>
                {tooltip.point.linkedUseCases.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <div className="font-semibold mb-1">Linked Solutions:</div>
                    {tooltip.point.linkedUseCases.map((useCase, idx) => (
                      <div key={idx} className="text-blue-300">• {useCase}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
