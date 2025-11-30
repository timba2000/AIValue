interface LinkedPainPointData {
  painPointId: string;
  painPointStatement: string | null;
  useCaseName: string | null;
  totalHoursPerMonth: number | null;
  fteCount: number | null;
  percentageSolved: number | null;
}

interface LinkedPainPointsTableProps {
  data: LinkedPainPointData[];
  isLoading?: boolean;
}

export function LinkedPainPointsTable({ data, isLoading }: LinkedPainPointsTableProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 slide-up">
        <h2 className="text-lg font-semibold text-foreground mb-4">Linked Pain Points & Solutions</h2>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 slide-up">
        <h2 className="text-lg font-semibold text-foreground mb-4">Linked Pain Points & Solutions</h2>
        <p className="text-muted-foreground text-center py-8">No linked pain points and solutions found</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6 slide-up">
      <h2 className="text-lg font-semibold text-foreground mb-4">Linked Pain Points & Solutions</h2>
      
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pain Point
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Solution
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Hours/Month
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                FTE
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                % Addressed
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Potential Hours Saved
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((row, index) => {
              const addressedPercentage = row.percentageSolved !== null ? Number(row.percentageSolved) : 0;
              const potentialHoursSaved = row.totalHoursPerMonth && addressedPercentage > 0
                ? Math.round(Number(row.totalHoursPerMonth) * (addressedPercentage / 100))
                : 0;

              return (
                <tr 
                  key={`${row.painPointId}-${index}`} 
                  className="hover:bg-accent/50 transition-colors duration-150"
                >
                  <td className="px-4 py-4 text-sm text-foreground max-w-xs">
                    <div className="truncate" title={row.painPointStatement || ''}>
                      {row.painPointStatement || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-foreground">
                    {row.useCaseName || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-foreground text-right">
                    {row.totalHoursPerMonth ? Number(row.totalHoursPerMonth).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-foreground text-right">
                    {row.fteCount ? Number(row.fteCount).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-right">
                    {row.percentageSolved !== null ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium gradient-bg text-white">
                        {row.percentageSolved}%
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-right">
                    {potentialHoursSaved > 0 ? (
                      <span className="font-semibold text-green-500">{potentialHoursSaved.toLocaleString()}</span>
                    ) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-4">
        {data.map((row, index) => {
          const addressedPercentage = row.percentageSolved !== null ? Number(row.percentageSolved) : 0;
          const potentialHoursSaved = row.totalHoursPerMonth && addressedPercentage > 0
            ? Math.round(Number(row.totalHoursPerMonth) * (addressedPercentage / 100))
            : 0;

          return (
            <div
              key={`${row.painPointId}-${index}`}
              className="bg-accent/30 rounded-xl p-4 space-y-3"
            >
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">Pain Point</div>
                <div className="text-sm text-foreground mt-1">{row.painPointStatement || '-'}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">Solution</div>
                <div className="text-sm text-foreground mt-1">{row.useCaseName || '-'}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase">Hours/Month</div>
                  <div className="text-sm text-foreground mt-1">
                    {row.totalHoursPerMonth ? Number(row.totalHoursPerMonth).toLocaleString() : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase">FTE</div>
                  <div className="text-sm text-foreground mt-1">
                    {row.fteCount ? Number(row.fteCount).toLocaleString() : '-'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase">% Addressed</div>
                  <div className="mt-1">
                    {row.percentageSolved !== null ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium gradient-bg text-white">
                        {row.percentageSolved}%
                      </span>
                    ) : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase">Potential Saved</div>
                  <div className="text-sm font-semibold text-green-500 mt-1">
                    {potentialHoursSaved > 0 ? potentialHoursSaved.toLocaleString() : '-'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
