import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BusinessUnitWithChildren, Company } from "@/types/business";

interface BusinessUnitListProps {
  company: Company | null;
  businessUnits: BusinessUnitWithChildren[];
  onAdd: (parentId?: string | null) => void;
  onEdit: (unit: BusinessUnitWithChildren) => void;
  onDelete: (unit: BusinessUnitWithChildren) => void;
  loading?: boolean;
}

interface TreeRowProps {
  unit: BusinessUnitWithChildren;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  onAdd: (parentId: string) => void;
  onEdit: (unit: BusinessUnitWithChildren) => void;
  onDelete: (unit: BusinessUnitWithChildren) => void;
}

const MAX_DEPTH = 3;

function TreeRow({ unit, expanded, onToggle, onAdd, onEdit, onDelete }: TreeRowProps) {
  const hasChildren = unit.children && unit.children.length > 0;
  const isExpanded = expanded[unit.id] ?? false;
  const canAddChild = unit.depth < MAX_DEPTH;
  const indentPx = (unit.depth - 1) * 24;

  return (
    <>
      <div
        className="group flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-lg transition-colors"
        style={{ paddingLeft: `${12 + indentPx}px` }}
      >
        <button
          type="button"
          onClick={() => onToggle(unit.id)}
          className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate" title={unit.name}>{unit.name}</span>
            {unit.depth === 1 && (
              <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">Level 1</span>
            )}
            {unit.depth === 2 && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">Level 2</span>
            )}
            {unit.depth === 3 && (
              <span className="text-xs px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded">Level 3</span>
            )}
          </div>
          {unit.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5" title={unit.description}>{unit.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span className="tabular-nums">{unit.fte}</span>
          <span className="text-xs">FTE</span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canAddChild && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAdd(unit.id)}
              className="h-7 w-7 p-0"
              title="Add child unit"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(unit)}
            className="h-7 w-7 p-0"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(unit)}
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {unit.children.map((child) => (
            <TreeRow
              key={child.id}
              unit={child}
              expanded={expanded}
              onToggle={onToggle}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function BusinessUnitList({
  company,
  businessUnits,
  onAdd,
  onEdit,
  onDelete,
  loading = false
}: BusinessUnitListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    const addIds = (units: BusinessUnitWithChildren[]) => {
      for (const unit of units) {
        allExpanded[unit.id] = true;
        if (unit.children) addIds(unit.children);
      }
    };
    addIds(businessUnits);
    setExpanded(allExpanded);
  };

  const collapseAll = () => {
    setExpanded({});
  };

  const hasAnyUnits = businessUnits.length > 0;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <p className="text-sm text-muted-foreground">Business Units for</p>
          <CardTitle>{company ? company.name : "Select a company"}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {hasAnyUnits && (
            <>
              <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs">
                Expand All
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs">
                Collapse
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => onAdd(null)} disabled={!company}>
            <Plus className="h-4 w-4 mr-1" />
            Add Unit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading business units...</p>
        ) : hasAnyUnits ? (
          <div className="space-y-0.5">
            {businessUnits.map((unit) => (
              <TreeRow
                key={unit.id}
                unit={unit}
                expanded={expanded}
                onToggle={toggleExpanded}
                onAdd={(parentId) => onAdd(parentId)}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {company ? "No business units yet. Add your first unit to get started." : "Select a company to view business units."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
