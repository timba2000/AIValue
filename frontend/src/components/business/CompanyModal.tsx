import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Company, CompanyPayload } from "@/types/business";

interface CompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CompanyPayload) => Promise<void>;
  initialCompany?: Company | null;
}

export function CompanyModal({ open, onOpenChange, onSubmit, initialCompany }: CompanyModalProps) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [anzsic, setAnzsic] = useState("");
  const [errors, setErrors] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialCompany) {
      setName(initialCompany.name ?? "");
      setIndustry(initialCompany.industry ?? "");
      setAnzsic(initialCompany.anzsic ?? "");
    } else {
      setName("");
      setIndustry("");
      setAnzsic("");
    }
    setErrors(null);
  }, [initialCompany, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrors("Company name is required");
      return;
    }

    setErrors(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: trimmedName,
        industry: industry.trim() || undefined,
        anzsic: anzsic.trim() || undefined
      });
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save company";
      setErrors(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialCompany ? "Edit Company" : "Add Company"}</DialogTitle>
          <DialogDescription>Capture the high-level details for a company.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Acme Manufacturing"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              placeholder="Industrial Machinery"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="anzsic">ANZSIC</Label>
            <Input
              id="anzsic"
              value={anzsic}
              onChange={(event) => setAnzsic(event.target.value)}
              placeholder="C2421"
            />
          </div>
          {errors ? <p className="text-sm text-destructive">{errors}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : initialCompany ? "Save changes" : "Add company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
