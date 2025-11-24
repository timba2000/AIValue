import { useEffect, useRef } from "react";

interface PainPoint {
  id: string;
  statement: string;
  magnitude: number;
  effortSolving: number;
  totalHoursPerMonth: number;
  hasLinks: boolean;
}

interface PrioritizationMatrixProps {
  painPoints: PainPoint[];
}

export function PrioritizationMatrix({ painPoints }: PrioritizationMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    ctx.fillText("Impact of Pain Point (1=Low, 10=High)", 0, 0);
    ctx.restore();

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
    ctx.fillText("Has Linked Use Cases", width - 135, legendY + 4);

    ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
    ctx.strokeStyle = "rgba(239, 68, 68, 1)";
    ctx.beginPath();
    ctx.arc(width - 150, legendY + 25, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#374151";
    ctx.fillText("No Linked Use Cases", width - 135, legendY + 29);

  }, [painPoints]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Prioritization Matrix
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Impact vs. Effort - Bubble size represents total hours per month
      </p>
      {painPoints.length === 0 ? (
        <div className="flex items-center justify-center h-96 text-gray-500">
          No pain points to visualize
        </div>
      ) : (
        <div className="relative w-full" style={{ height: "500px" }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
