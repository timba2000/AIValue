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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Linked Pain Points & Use Cases</h2>
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Linked Pain Points & Use Cases</h2>
        <p className="text-gray-500 text-center py-8">No linked pain points and use cases found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Linked Pain Points & Use Cases</h2>
      
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pain Point
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Use Case
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Hours/Month
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                FTE
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                % Addressed
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Potential Hours Saved
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => {
              const potentialHoursSaved = row.totalHoursPerMonth && row.percentageSolved
                ? Math.round(row.totalHoursPerMonth * (row.percentageSolved / 100))
                : 0;

              return (
                <tr key={`${row.painPointId}-${index}`} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="truncate" title={row.painPointStatement || ''}>
                      {row.painPointStatement || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    {row.useCaseName || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 text-right">
                    {row.totalHoursPerMonth?.toLocaleString() || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 text-right">
                    {row.fteCount?.toLocaleString() || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-right">
                    {row.percentageSolved !== null ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {row.percentageSolved}%
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-right font-medium text-green-600">
                    {potentialHoursSaved > 0 ? potentialHoursSaved.toLocaleString() : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-4">
        {data.map((row, index) => {
          const potentialHoursSaved = row.totalHoursPerMonth && row.percentageSolved
            ? Math.round(row.totalHoursPerMonth * (row.percentageSolved / 100))
            : 0;

          return (
            <div
              key={`${row.painPointId}-${index}`}
              className="bg-gray-50 rounded-lg p-4 space-y-3"
            >
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase">Pain Point</div>
                <div className="text-sm text-gray-900 mt-1">{row.painPointStatement || '-'}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase">Use Case</div>
                <div className="text-sm text-gray-900 mt-1">{row.useCaseName || '-'}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase">Hours/Month</div>
                  <div className="text-sm text-gray-900 mt-1">
                    {row.totalHoursPerMonth?.toLocaleString() || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase">FTE</div>
                  <div className="text-sm text-gray-900 mt-1">
                    {row.fteCount?.toLocaleString() || '-'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase">% Addressed</div>
                  <div className="mt-1">
                    {row.percentageSolved !== null ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {row.percentageSolved}%
                      </span>
                    ) : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase">Potential Saved</div>
                  <div className="text-sm font-medium text-green-600 mt-1">
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
