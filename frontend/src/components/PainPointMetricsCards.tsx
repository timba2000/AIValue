import { AlertTriangle, Link2, Unlink, Layers, Layers2, Layers3 } from "lucide-react";

interface PainPointMetricsCardsProps {
  totalPainPoints: number;
  linkedCount: number;
  unlinkedCount: number;
  l1Count: number;
  l2Count: number;
  l3Count: number;
}

export function PainPointMetricsCards({
  totalPainPoints,
  linkedCount,
  unlinkedCount,
  l1Count,
  l2Count,
  l3Count
}: PainPointMetricsCardsProps) {
  const row1Metrics = [
    {
      label: "Total Pain Points",
      value: totalPainPoints,
      subtitle: "across all business units",
      icon: AlertTriangle,
      iconBg: "bg-gradient-to-br from-orange-500/10 to-amber-500/10",
      iconColor: "text-orange-500"
    },
    {
      label: "Total Linked",
      value: linkedCount,
      subtitle: "pain points with solutions",
      icon: Link2,
      iconBg: "bg-gradient-to-br from-green-500/10 to-emerald-500/10",
      iconColor: "text-green-500"
    },
    {
      label: "Total Unlinked",
      value: unlinkedCount,
      subtitle: "pain points without solutions",
      icon: Unlink,
      iconBg: "bg-gradient-to-br from-red-500/10 to-rose-500/10",
      iconColor: "text-red-500"
    }
  ];

  const row2Metrics = [
    {
      label: "Category L1",
      value: l1Count,
      subtitle: "level 1 categorized",
      icon: Layers,
      iconBg: "bg-gradient-to-br from-blue-500/10 to-cyan-500/10",
      iconColor: "text-blue-500"
    },
    {
      label: "Category L2",
      value: l2Count,
      subtitle: "level 2 categorized",
      icon: Layers2,
      iconBg: "bg-gradient-to-br from-violet-500/10 to-purple-500/10",
      iconColor: "text-violet-500"
    },
    {
      label: "Category L3",
      value: l3Count,
      subtitle: "level 3 categorized",
      icon: Layers3,
      iconBg: "bg-gradient-to-br from-indigo-500/10 to-blue-500/10",
      iconColor: "text-indigo-500"
    }
  ];

  const renderCard = (metric: typeof row1Metrics[0], index: number) => (
    <div 
      key={index} 
      className="group bg-card rounded-2xl border border-border p-4 sm:p-5 card-hover slide-up"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate" title={metric.label}>{metric.label}</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground mt-1.5 animate-count">{metric.value}</p>
          {metric.subtitle && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate" title={metric.subtitle}>{metric.subtitle}</p>
          )}
        </div>
        <div className={`${metric.iconBg} p-2 sm:p-2.5 rounded-xl shrink-0 transition-transform duration-300 group-hover:scale-110`}>
          <metric.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${metric.iconColor}`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {row1Metrics.map(renderCard)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {row2Metrics.map(renderCard)}
      </div>
    </div>
  );
}
