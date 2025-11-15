import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useUseCaseStore } from "@/store/useCases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FormState = {
  title: string;
  problem: string;
  hoursSavedPerOccurrence: string;
  occurrencesPerMonth: string;
  valuePerHour: string;
};

const initialState: FormState = {
  title: "",
  problem: "",
  hoursSavedPerOccurrence: "0",
  occurrencesPerMonth: "0",
  valuePerHour: "0"
};

export function UseCaseForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const addUseCase = useUseCaseStore((state) => state.addUseCase);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const parsedHours = Number(form.hoursSavedPerOccurrence);
  const parsedOccurrences = Number(form.occurrencesPerMonth);
  const parsedValuePerHour = Number(form.valuePerHour);

  const valueScore = useMemo(() => {
    if ([parsedHours, parsedOccurrences, parsedValuePerHour].some((value) => !Number.isFinite(value))) {
      return 0;
    }
    return Math.max(parsedHours, 0) * Math.max(parsedOccurrences, 0) * Math.max(parsedValuePerHour, 0);
  }, [parsedHours, parsedOccurrences, parsedValuePerHour]);

  const formattedValueScore = useMemo(() => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(valueScore);
  }, [valueScore]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors: Record<string, string> = {};

    const title = form.title.trim();
    const problem = form.problem.trim();

    if (!title) {
      validationErrors.title = "Title is required";
    }

    if (!problem) {
      validationErrors.problem = "Problem description is required";
    }

    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      validationErrors.hoursSavedPerOccurrence = "Enter hours saved per occurrence (> 0)";
    }

    if (!Number.isFinite(parsedOccurrences) || parsedOccurrences <= 0) {
      validationErrors.occurrencesPerMonth = "Enter monthly frequency (> 0)";
    }

    if (!Number.isFinite(parsedValuePerHour) || parsedValuePerHour <= 0) {
      validationErrors.valuePerHour = "Enter hourly value (> 0)";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await addUseCase({
        title,
        problem,
        hoursSavedPerOccurrence: parsedHours,
        occurrencesPerMonth: parsedOccurrences,
        valuePerHour: parsedValuePerHour
      });
      setForm({ ...initialState });
    } catch (error) {
      // handled globally via store error state
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Give the use case a short title"
          required
        />
        {errors.title ? <p className="text-sm text-destructive">{errors.title}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="problem">Problem</Label>
        <Textarea
          id="problem"
          name="problem"
          value={form.problem}
          onChange={handleChange}
          placeholder="Describe the problem this use case solves"
          required
        />
        {errors.problem ? <p className="text-sm text-destructive">{errors.problem}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hoursSavedPerOccurrence">Hours Saved per Occurrence</Label>
          <Input
            id="hoursSavedPerOccurrence"
            name="hoursSavedPerOccurrence"
            type="number"
            min="0"
            step="0.1"
            value={form.hoursSavedPerOccurrence}
            onChange={handleChange}
          />
          {errors.hoursSavedPerOccurrence ? (
            <p className="text-sm text-destructive">{errors.hoursSavedPerOccurrence}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="occurrencesPerMonth">Occurrences per Month</Label>
          <div className="flex items-center gap-3">
            <input
              id="occurrencesPerMonth"
              name="occurrencesPerMonth"
              type="range"
              min="0"
              max="200"
              step="1"
              value={form.occurrencesPerMonth}
              onChange={handleChange}
              className="flex-1"
            />
            <Input
              aria-label="Occurrences per Month"
              name="occurrencesPerMonth"
              type="number"
              min="0"
              step="1"
              value={form.occurrencesPerMonth}
              onChange={handleChange}
              className="w-24"
            />
          </div>
          {errors.occurrencesPerMonth ? (
            <p className="text-sm text-destructive">{errors.occurrencesPerMonth}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="valuePerHour">Value per Hour (USD)</Label>
          <Input
            id="valuePerHour"
            name="valuePerHour"
            type="number"
            min="0"
            step="1"
            value={form.valuePerHour}
            onChange={handleChange}
          />
          {errors.valuePerHour ? <p className="text-sm text-destructive">{errors.valuePerHour}</p> : null}
        </div>
        <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
          <p className="text-sm font-medium text-muted-foreground">Estimated Monthly Value</p>
          <p className="text-2xl font-semibold">{formattedValueScore}</p>
          <p className="text-xs text-muted-foreground">
            Calculated as hours saved × occurrences × hourly value.
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Add Use Case"}
        </Button>
      </div>
    </form>
  );
}
