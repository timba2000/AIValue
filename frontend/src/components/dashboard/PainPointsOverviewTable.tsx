import { useState, useMemo } from "react";
import { Settings, Pencil, Search, X } from "lucide-react";

interface PainPointData {
  id: string;
  statement: string;
  magnitude: number;
  effortSolving: number;
  totalHoursPerMonth: number;
  fteCount: number;
  hasLinks: boolean;
  linkedSolutions: string[];
  totalPercentageSolved: number;
  potentialHoursSaved: number;
}

interface PainPointsOverviewTableProps {
  data: PainPointData[];
  isLoading?: boolean;
  onManageClick: (painPointId: string) => void;
  onEditClick?: (painPointId: string) => void;
}

export function PainPointsOverviewTable({ 
  data, 
  isLoading, 
  onManageClick,
  onEditClick 
}: PainPointsOverviewTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(p => 
      p.statement.toLowerCase().includes(term) ||
      p.linkedSolutions.some(s => s.toLowerCase().includes(term))
    );
  }, [data, searchTerm]);
  
  const linkedCount = filteredData.filter(p => p.hasLinks).length;
  const unlinkedCount = filteredData.filter(p => !p.hasLinks).length;

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 slide-up">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Pain Points Overview</h2>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 slide-up">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Pain Points Overview</h2>
        </div>
        <p className="text-muted-foreground text-center py-8">No pain points found</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6 slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Pain Points Overview</h2>
          <span className="text-sm text-muted-foreground">
            ({linkedCount} linked, {unlinkedCount} unlinked)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search pain points..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 py-2 w-full sm:w-64 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="hidden sm:flex gap-2 text-xs">
            <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded-lg font-medium">Linked</span>
            <span className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded-lg font-medium">Unlinked</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Manage solution links for each pain point. Click "Manage" to add, edit, or remove linked solutions.
      </p>

      {filteredData.length === 0 && searchTerm && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No pain points match "{searchTerm}"</p>
          <button 
            onClick={() => setSearchTerm("")}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      <div className={`hidden lg:block overflow-x-auto ${filteredData.length === 0 && searchTerm ? 'hidden' : ''}`}>
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pain Point
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Solutions
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Benefit
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Effort
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Hours/Month
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                FTE
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                % Addressed
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Hours Saved
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredData.map((row) => (
              <tr 
                key={row.id} 
                className={`transition-colors duration-150 ${
                  row.hasLinks 
                    ? 'bg-green-500/5 hover:bg-green-500/10' 
                    : 'bg-amber-500/5 hover:bg-amber-500/10'
                }`}
              >
                <td className="px-4 py-4 text-sm text-foreground max-w-xs">
                  <div className="relative group">
                    <div className="truncate font-medium cursor-help">
                      {row.statement}
                    </div>
                    <div className="absolute left-0 top-full mt-2 z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
                      <div className="bg-popover text-popover-foreground border border-border rounded-xl p-3 shadow-lg max-w-md text-sm whitespace-normal">
                        {row.statement}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-foreground max-w-xs">
                  {row.hasLinks ? (
                    <div>
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-500 rounded-full">
                        {row.linkedSolutions.length} solution{row.linkedSolutions.length !== 1 ? 's' : ''}
                      </span>
                      <div className="text-xs text-muted-foreground mt-1 truncate" title={row.linkedSolutions.join(', ')}>
                        {row.linkedSolutions.join(', ')}
                      </div>
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-500 rounded-full">
                      No solutions
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-foreground text-center">
                  <span className="text-xs">{row.magnitude}/10</span>
                </td>
                <td className="px-4 py-4 text-sm text-foreground text-center">
                  <span className="text-xs">{row.effortSolving}/10</span>
                </td>
                <td className="px-4 py-4 text-sm text-foreground text-right">
                  {row.totalHoursPerMonth > 0 ? Math.round(row.totalHoursPerMonth).toLocaleString() : '-'}
                </td>
                <td className="px-4 py-4 text-sm text-foreground text-right">
                  {row.fteCount > 0 ? row.fteCount.toLocaleString() : '-'}
                </td>
                <td className="px-4 py-4 text-sm text-right">
                  {row.totalPercentageSolved > 0 ? (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      row.totalPercentageSolved >= 100 
                        ? 'bg-green-500 text-white' 
                        : 'gradient-bg text-white'
                    }`}>
                      {Math.min(row.totalPercentageSolved, 100)}%
                    </span>
                  ) : '-'}
                </td>
                <td className="px-4 py-4 text-sm text-right">
                  {row.potentialHoursSaved > 0 ? (
                    <span className="font-semibold text-green-500">{row.potentialHoursSaved.toLocaleString()}</span>
                  ) : '-'}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {onEditClick && (
                      <button
                        onClick={() => onEditClick(row.id)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all duration-200"
                        title="Edit pain point"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onManageClick(row.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                        row.hasLinks
                          ? 'text-green-500 bg-green-500/10 hover:bg-green-500/20'
                          : 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
                      }`}
                    >
                      {row.hasLinks ? 'Manage' : 'Link'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`lg:hidden space-y-3 ${filteredData.length === 0 && searchTerm ? 'hidden' : ''}`}>
        {filteredData.map((row) => (
          <div 
            key={row.id}
            className={`p-4 border rounded-xl transition-all duration-200 ${
              row.hasLinks 
                ? 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10' 
                : 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{row.statement}</p>
                  {row.hasLinks ? (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-500 rounded-full">
                      {row.linkedSolutions.length} solution{row.linkedSolutions.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-500 rounded-full">
                      No solutions
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                  <span>Benefit: {row.magnitude}/10</span>
                  <span>Effort: {row.effortSolving}/10</span>
                  <span>Hours/Month: {Math.round(row.totalHoursPerMonth)}</span>
                  {row.fteCount > 0 && <span>FTE: {row.fteCount}</span>}
                </div>

                {row.hasLinks && row.linkedSolutions.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Solutions: {row.linkedSolutions.join(', ')}
                  </div>
                )}

                <div className="flex gap-4 mt-2">
                  {row.totalPercentageSolved > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Addressed:</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.totalPercentageSolved >= 100 
                          ? 'bg-green-500 text-white' 
                          : 'gradient-bg text-white'
                      }`}>
                        {Math.min(row.totalPercentageSolved, 100)}%
                      </span>
                    </div>
                  )}
                  {row.potentialHoursSaved > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Hours Saved:</span>
                      <span className="text-xs font-semibold text-green-500">{row.potentialHoursSaved.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {onEditClick && (
                  <button
                    onClick={() => onEditClick(row.id)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all duration-200"
                    title="Edit pain point"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => onManageClick(row.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                    row.hasLinks
                      ? 'text-green-500 bg-green-500/10 hover:bg-green-500/20'
                      : 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
                  }`}
                >
                  {row.hasLinks ? 'Manage' : 'Link'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
