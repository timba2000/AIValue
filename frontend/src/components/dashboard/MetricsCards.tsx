import { TrendingUp, AlertTriangle, Target, Users, Link2 } from "lucide-react";

interface MetricsCardsProps {
  totalPainPoints: number;
  totalUseCases: number;
  painPointsWithLinks: number;
  totalHoursPerMonth: number;
  totalFTE: number;
  totalProcessLinks: number;
}

export function MetricsCards({
  totalPainPoints,
  totalUseCases,
  painPointsWithLinks,
  totalHoursPerMonth,
  totalFTE,
  totalProcessLinks
}: MetricsCardsProps) {
  const coveragePercentage = totalPainPoints > 0 
    ? Math.round((painPointsWithLinks / totalPainPoints) * 100) 
    : 0;

  const metrics = [
    {
      label: "Total Pain Points",
      value: totalPainPoints,
      icon: AlertTriangle,
      gradient: "from-orange-500 to-amber-500",
      iconBg: "bg-gradient-to-br from-orange-500/10 to-amber-500/10",
      iconColor: "text-orange-500"
    },
    {
      label: "Total Solutions",
      value: totalUseCases,
      icon: Target,
      gradient: "from-blue-500 to-cyan-500",
      iconBg: "bg-gradient-to-br from-blue-500/10 to-cyan-500/10",
      iconColor: "text-blue-500"
    },
    {
      label: "Process Links",
      value: totalProcessLinks,
      subtitle: "processes affected",
      icon: Link2,
      gradient: "from-cyan-500 to-teal-500",
      iconBg: "bg-gradient-to-br from-cyan-500/10 to-teal-500/10",
      iconColor: "text-cyan-500"
    },
    {
      label: "Coverage",
      value: `${coveragePercentage}%`,
      subtitle: `${painPointsWithLinks} of ${totalPainPoints} pain points`,
      icon: TrendingUp,
      gradient: "from-green-500 to-emerald-500",
      iconBg: "bg-gradient-to-br from-green-500/10 to-emerald-500/10",
      iconColor: "text-green-500"
    },
    {
      label: "Total Hours/Month",
      value: totalHoursPerMonth.toLocaleString(),
      subtitle: "potential hours saved",
      icon: TrendingUp,
      gradient: "from-purple-500 to-violet-500",
      iconBg: "bg-gradient-to-br from-purple-500/10 to-violet-500/10",
      iconColor: "text-purple-500"
    },
    {
      label: "FTE Capacity Created",
      value: (totalHoursPerMonth / 35).toFixed(1),
      subtitle: "based on 35 hrs/week",
      icon: Users,
      gradient: "from-indigo-500 to-purple-500",
      iconBg: "bg-gradient-to-br from-indigo-500/10 to-purple-500/10",
      iconColor: "text-indigo-500"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {metrics.map((metric, index) => (
        <div 
          key={index} 
          className="group bg-card rounded-2xl border border-border p-6 card-hover slide-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
              <p className="text-2xl font-bold text-foreground mt-2 animate-count">{metric.value}</p>
              {metric.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{metric.subtitle}</p>
              )}
            </div>
            <div className={`${metric.iconBg} p-3 rounded-xl transition-transform duration-300 group-hover:scale-110`}>
              <metric.icon className={`h-6 w-6 ${metric.iconColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
