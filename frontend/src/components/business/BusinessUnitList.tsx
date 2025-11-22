import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BusinessUnit, Company } from "@/types/business";

interface BusinessUnitListProps {
  company: Company | null;
  businessUnits: BusinessUnit[];
  onAdd: () => void;
  onEdit: (unit: BusinessUnit) => void;
  onDelete: (unit: BusinessUnit) => void;
  loading?: boolean;
}

export function BusinessUnitList({
  company,
  businessUnits,
  onAdd,
  onEdit,
  onDelete,
  loading = false
}: BusinessUnitListProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <p className="text-sm text-muted-foreground">Business Units for</p>
          <CardTitle>{company ? company.name : "Select a company"}</CardTitle>
        </div>
        <Button size="sm" onClick={onAdd} disabled={!company}>
          Add Business Unit
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-muted-foreground">Loading business units...</p> : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>FTE</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {businessUnits.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell className="font-medium">{unit.name}</TableCell>
                <TableCell>{unit.fte}</TableCell>
                <TableCell className="max-w-sm text-sm text-muted-foreground">{unit.description || "–"}</TableCell>
                <TableCell className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(unit)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(unit)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {businessUnits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  {company ? "No business units yet for this company." : "Select a company to view business units."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
