import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Company } from "@/types/business";

interface CompanyListProps {
  companies: Company[];
  selectedCompanyId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
  loading?: boolean;
  canEdit?: boolean;
}

export function CompanyList({
  companies,
  selectedCompanyId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  loading = false,
  canEdit = true
}: CompanyListProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Companies</CardTitle>
        {canEdit && (
          <Button size="sm" onClick={onAdd}>
            Add Company
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p className="text-sm text-muted-foreground">Loading companies...</p> : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>ANZSIC</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((company) => {
              const isSelected = company.id === selectedCompanyId;
              return (
                <TableRow
                  key={company.id}
                  className={isSelected ? "bg-muted" : "cursor-pointer"}
                  onClick={() => onSelect(company.id)}
                >
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.industry || "–"}</TableCell>
                  <TableCell>{company.anzsic || "–"}</TableCell>
                  <TableCell className="flex items-center justify-end gap-2">
                    {canEdit && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(company);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDelete(company);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  No companies have been added yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
