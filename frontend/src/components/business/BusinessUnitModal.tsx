import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BusinessUnit, BusinessUnitPayload } from "@/types/business";

interface BusinessUnitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: BusinessUnitPayload) => Promise<void>;
  initialUnit?: BusinessUnit | null;
  companyId: string;
}

export function BusinessUnitModal({ open, onOpenChange, onSubmit, initialUnit, companyId }: BusinessUnitModalProps) {
  const [name, setName] = useState("");
  const [fte, setFte] = useState("0");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialUnit) {
      setName(initialUnit.name ?? "");
      setFte(initialUnit.fte?.toString() ?? "0");
      setDescription(initialUnit.description ?? "");
    } else {
      setName("");
      setFte("0");
      setDescription("");
    }
    setError(null);
  }, [initialUnit, open]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialUnit ? "Edit Business Unit" : "Add Business Unit"}</DialogTitle>
          <DialogDescription>Track teams or divisions and their FTE footprint.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bu-name">Business Unit Name</Label>
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
