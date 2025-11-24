import { TrendingUp, AlertTriangle, Target, Users } from "lucide-react";

interface MetricsCardsProps {
  totalPainPoints: number;
  totalUseCases: number;
  painPointsWithLinks: number;
  totalHoursPerMonth: number;
  totalFTE: number;
}

export function MetricsCards({
  totalPainPoints,
  totalUseCases,
  painPointsWithLinks,
  totalHoursPerMonth,
  totalFTE
}: MetricsCardsProps) {
  const coveragePercentage = totalPainPoints > 0 
    ? Math.round((painPointsWithLinks / totalPainPoints) * 100) 
    : 0;

  const metrics = [
    {
      label: "Total Pain Points",
      value: totalPainPoints,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      label: "Total Use Cases",
      value: totalUseCases,
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      label: "Coverage",
      value: `${coveragePercentage}%`,
      subtitle: `${painPointsWithLinks} of ${totalPainPoints} pain points`,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      label: "Total Hours/Month",
      value: totalHoursPerMonth.toLocaleString(),
      subtitle: "potential hours saved",
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      label: "Total FTE Impacted",
      value: totalFTE,
      subtitle: "full-time equivalents",
      icon: Users,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {metrics.map((metric, index) => (
        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{metric.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{metric.value}</p>
              {metric.subtitle && (
                <p className="text-xs text-gray-500 mt-1">{metric.subtitle}</p>
              )}
            </div>
            <div className={`${metric.bgColor} p-3 rounded-lg`}>
              <metric.icon className={`h-6 w-6 ${metric.color}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
