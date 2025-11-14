import { useState, type ChangeEvent, type FormEvent } from "react";
import { useUseCaseStore } from "@/store/useCases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState = {
  title: "",
  problem: ""
};

export function UseCaseForm() {
  const [form, setForm] = useState(initialState);
  const [submitting, setSubmitting] = useState(false);
  const addUseCase = useUseCaseStore((state) => state.addUseCase);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.problem.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      await addUseCase({
        title: form.title.trim(),
        problem: form.problem.trim()
      });
      setForm(initialState);
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
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Add Use Case"}
        </Button>
      </div>
    </form>
  );
}
