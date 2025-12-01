import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import type { BusinessUnit, BusinessUnitPayload, BusinessUnitWithChildren } from "@/types/business";

interface BusinessUnitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: BusinessUnitPayload) => Promise<void>;
  initialUnit?: BusinessUnit | null;
  companyId: string;
  parentId?: string | null;
  availableParents: BusinessUnitWithChildren[];
}

function flattenForSelect(
  units: BusinessUnitWithChildren[],
  excludeId?: string
): Array<{ id: string; name: string; depth: number }> {
  const result: Array<{ id: string; name: string; depth: number }> = [];
  
  const flatten = (items: BusinessUnitWithChildren[]) => {
    for (const unit of items) {
      if (unit.id !== excludeId && unit.depth < 3) {
        result.push({ id: unit.id, name: unit.name, depth: unit.depth });
      }
      if (unit.children && unit.children.length > 0) {
        flatten(unit.children);
      }
    }
  };
  
  flatten(units);
  return result;
}

export function BusinessUnitModal({ 
  open, 
  onOpenChange, 
  onSubmit, 
  initialUnit, 
  companyId,
  parentId: initialParentId,
  availableParents 
}: BusinessUnitModalProps) {
  const [name, setName] = useState("");
  const [fte, setFte] = useState("0");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectableParents = flattenForSelect(availableParents, initialUnit?.id);

  useEffect(() => {
    if (initialUnit) {
      setName(initialUnit.name ?? "");
      setFte(initialUnit.fte?.toString() ?? "0");
      setDescription(initialUnit.description ?? "");
      setParentId(initialUnit.parentId ?? "");
    } else {
      setName("");
      setFte("0");
      setDescription("");
      setParentId(initialParentId ?? "");
    }
    setError(null);
  }, [initialUnit, initialParentId, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const parsedFte = Number(fte);

    if (!trimmedName) {
      setError("Business unit name is required");
      return;
    }
    if (!Number.isFinite(parsedFte) || parsedFte < 0) {
      setError("FTE must be a non-negative number");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        companyId,
        parentId: parentId || null,
        name: trimmedName,
        fte: Math.floor(parsedFte),
        description: description.trim() || undefined
      });
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save business unit";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const getIndent = (depth: number) => "\u2003".repeat(depth - 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialUnit ? "Edit Business Unit" : "Add Business Unit"}</DialogTitle>
          <DialogDescription>Track teams or divisions and their FTE footprint.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bu-parent">Parent Unit</Label>
            <Select
              id="bu-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None (top-level)</option>
              {selectableParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {getIndent(parent.depth)}{parent.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              Select a parent to nest this unit. Maximum 3 levels deep.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bu-name">Business Unit Name <span className="text-red-500">*</span></Label>
            <Input
              id="bu-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Customer Service"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fte">FTE</Label>
            <Input
              id="fte"
              type="number"
              min={0}
              value={fte}
              onChange={(event) => setFte(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context for this unit"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : initialUnit ? "Save changes" : "Add business unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
