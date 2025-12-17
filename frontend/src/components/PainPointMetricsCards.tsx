import { AlertTriangle, Filter, Building2, Clock, Users, Link2, TrendingUp } from "lucide-react";

interface PainPointMetricsCardsProps {
  totalPainPoints: number;
  filteredPainPoints: number;
  level2BusinessUnitsAssessed: number;
  totalHoursPerMonth: number;
  linkedPercentage: number;
  avgBenefitScore: number;
}

export function PainPointMetricsCards({
  totalPainPoints,
  filteredPainPoints,
  level2BusinessUnitsAssessed,
  totalHoursPerMonth,
  linkedPercentage,
  avgBenefitScore
}: PainPointMetricsCardsProps) {
  const fteCapacityCreated = totalHoursPerMonth / 35;

  const metrics = [
    {
      label: "Total Pain Points",
      value: totalPainPoints,
      subtitle: "across all business units",
      icon: AlertTriangle,
      iconBg: "bg-gradient-to-br from-orange-500/10 to-amber-500/10",
      iconColor: "text-orange-500"
    },
    {
      label: "Selected Pain Points",
      value: filteredPainPoints,
      subtitle: "matching current filters",
      icon: Filter,
      iconBg: "bg-gradient-to-br from-blue-500/10 to-cyan-500/10",
      iconColor: "text-blue-500"
    },
    {
      label: "L2 Business Units",
      value: level2BusinessUnitsAssessed,
      subtitle: "assessed at Level 2",
      icon: Building2,
      iconBg: "bg-gradient-to-br from-violet-500/10 to-purple-500/10",
      iconColor: "text-violet-500"
    },
    {
      label: "Total Hours/Month",
      value: Math.round(totalHoursPerMonth).toLocaleString(),
      subtitle: "potential savings",
      icon: Clock,
      iconBg: "bg-gradient-to-br from-emerald-500/10 to-teal-500/10",
      iconColor: "text-emerald-500"
    },
    {
      label: "FTE Capacity Created",
      value: fteCapacityCreated.toFixed(1),
      subtitle: "based on 35 hrs/week",
      icon: Users,
      iconBg: "bg-gradient-to-br from-indigo-500/10 to-blue-500/10",
      iconColor: "text-indigo-500"
    },
    {
      label: "Linked to Solutions",
      value: `${linkedPercentage}%`,
      subtitle: "pain points addressed",
      icon: Link2,
      iconBg: "bg-gradient-to-br from-green-500/10 to-emerald-500/10",
      iconColor: "text-green-500"
    },
    {
      label: "Avg Benefit Score",
      value: avgBenefitScore.toFixed(1),
      subtitle: "out of 10",
      icon: TrendingUp,
      iconBg: "bg-gradient-to-br from-rose-500/10 to-pink-500/10",
      iconColor: "text-rose-500"
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
      {metrics.map((metric, index) => (
        <div 
          key={index} 
          className="group bg-card rounded-2xl border border-border p-4 sm:p-5 card-hover slide-up"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{metric.label}</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-1.5 animate-count">{metric.value}</p>
              {metric.subtitle && (
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{metric.subtitle}</p>
              )}
            </div>
            <div className={`${metric.iconBg} p-2 sm:p-2.5 rounded-xl shrink-0 transition-transform duration-300 group-hover:scale-110`}>
              <metric.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${metric.iconColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
