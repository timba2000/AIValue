import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { PainPoint, PainPointPayload, ImpactType, RiskLevel } from "@/types/painPoint";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const IMPACT_TYPES: { value: ImpactType; label: string }[] = [
  { value: "time_waste", label: "Time Waste" },
  { value: "quality_issue", label: "Quality Issue" },
  { value: "compliance_risk", label: "Compliance Risk" },
  { value: "cost_overrun", label: "Cost Overrun" },
  { value: "customer_impact", label: "Customer Impact" },
  { value: "other", label: "Other" }
];

const RISK_LEVELS: { value: RiskLevel; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" }
];

interface FormState {
  statement: string;
  impactType: string[];
  businessImpact: string;
  magnitude: string;
  frequency: string;
  timePerUnit: string;
  fteCount: string;
  rootCause: string;
  workarounds: string;
  dependencies: string;
  riskLevel: string;
  effortSolving: string;
}

const emptyForm: FormState = {
  statement: "",
  impactType: [],
  businessImpact: "",
  magnitude: "",
  frequency: "",
  timePerUnit: "",
  fteCount: "",
  rootCause: "",
  workarounds: "",
  dependencies: "",
  riskLevel: "",
  effortSolving: ""
};

export default function PainPointList() {
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPainPoint, setEditingPainPoint] = useState<PainPoint | null>(null);
  const [formState, setFormState] = useState<FormState>(emptyForm);

  const filteredPainPoints = painPoints.filter((pp) =>
    search.trim() === "" ? true : pp.statement.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    fetchPainPoints();
  }, []);

  const fetchPainPoints = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<PainPoint[]>(`${API_BASE}/api/pain-points`);
      setPainPoints(response.data);
    } catch (error) {
      console.error(error);
      setError("Failed to load pain points");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPainPoint(null);
    setFormState(emptyForm);
    setFormOpen(true);
  };

  const handleEdit = (painPoint: PainPoint) => {
    setEditingPainPoint(painPoint);
    setFormState({
      statement: painPoint.statement,
      impactType: painPoint.impactType ?? [],
      businessImpact: painPoint.businessImpact ?? "",
      magnitude: painPoint.magnitude?.toString() ?? "",
      frequency: painPoint.frequency?.toString() ?? "",
      timePerUnit: painPoint.timePerUnit?.toString() ?? "",
      fteCount: painPoint.fteCount?.toString() ?? "",
      rootCause: painPoint.rootCause ?? "",
      workarounds: painPoint.workarounds ?? "",
      dependencies: painPoint.dependencies ?? "",
      riskLevel: painPoint.riskLevel ?? "",
      effortSolving: painPoint.effortSolving?.toString() ?? ""
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formState.statement.trim()) {
      setError("Statement is required");
      return;
    }

    setLoading(true);
    setError(null);

    const payload: PainPointPayload = {
      statement: formState.statement.trim(),
      impactType: formState.impactType.length > 0 ? formState.impactType : null,
      businessImpact: formState.businessImpact || null,
      magnitude: formState.magnitude ? Number(formState.magnitude) : null,
      frequency: formState.frequency ? Number(formState.frequency) : null,
      timePerUnit: formState.timePerUnit ? Number(formState.timePerUnit) : null,
      fteCount: formState.fteCount ? Number(formState.fteCount) : null,
      rootCause: formState.rootCause || null,
      workarounds: formState.workarounds || null,
      dependencies: formState.dependencies || null,
      riskLevel: formState.riskLevel || null,
      effortSolving: formState.effortSolving ? Number(formState.effortSolving) : null
    };

    try {
      if (editingPainPoint) {
        await axios.put(`${API_BASE}/api/pain-points/${editingPainPoint.id}`, payload);
      } else {
        await axios.post(`${API_BASE}/api/pain-points`, payload);
      }
      setFormOpen(false);
      await fetchPainPoints();
    } catch (error) {
      console.error(error);
      setError("Failed to save pain point");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pain point?")) return;

    setLoading(true);
    setError(null);

    try {
      await axios.delete(`${API_BASE}/api/pain-points/${id}`);
      await fetchPainPoints();
    } catch (error) {
      console.error(error);
      setError("Failed to delete pain point");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Pain Points</h1>
            <p className="text-sm text-gray-600 mt-1">
              Identify and track process pain points across your organization
            </p>
          </div>
          <Button onClick={handleCreate} className="shrink-0">
            New pain point
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="mb-4">
          <Label htmlFor="search">Search</Label>
          <input
            id="search"
            type="text"
            placeholder="Search by statement"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {loading && painPoints.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Loading pain points...</div>
        ) : filteredPainPoints.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {search ? "No pain points match your search" : "No pain points yet. Create one to get started!"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Statement</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Impact Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Risk Level</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Impact (1-10)</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Hrs/Month</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPainPoints.map((pp) => (
                  <tr key={pp.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">{pp.statement}</td>
                    <td className="py-3 px-4">
                      {pp.impactType && pp.impactType.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {pp.impactType.map((type) => (
                            <span key={type} className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                              {IMPACT_TYPES.find((t) => t.value === type)?.label ?? type}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {pp.riskLevel ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            pp.riskLevel === "critical"
                              ? "bg-red-100 text-red-800"
                              : pp.riskLevel === "high"
                              ? "bg-orange-100 text-orange-800"
                              : pp.riskLevel === "medium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {RISK_LEVELS.find((r) => r.value === pp.riskLevel)?.label ?? pp.riskLevel}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{pp.magnitude ?? "-"}</td>
                    <td className="py-3 px-4">
                      {pp.totalHoursPerMonth ? (
                        <span className="font-medium text-gray-900">{Number(pp.totalHoursPerMonth).toFixed(1)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(pp)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(pp.id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPainPoint ? "Edit Pain Point" : "Create Pain Point"}</DialogTitle>
            <DialogDescription>
              {editingPainPoint
                ? "Update the pain point details below"
                : "Add a new pain point to track process inefficiencies"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="statement">
                Statement <span className="text-red-500">*</span>
              </Label>
              <textarea
                id="statement"
                value={formState.statement}
                onChange={(e) => setFormState({ ...formState, statement: e.target.value })}
                rows={3}
                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Describe the pain point"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Impact Type (Select all that apply)</Label>
                <div className="mt-1.5 space-y-2">
                  {IMPACT_TYPES.map((type) => (
                    <label key={type.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formState.impactType.includes(type.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormState({ ...formState, impactType: [...formState.impactType, type.value] });
                          } else {
                            setFormState({ ...formState, impactType: formState.impactType.filter(t => t !== type.value) });
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="riskLevel">Risk Level</Label>
                <Select
                  id="riskLevel"
                  value={formState.riskLevel}
                  onChange={(e) => setFormState({ ...formState, riskLevel: e.target.value })}
                  className="mt-1.5"
                >
                  <option value="">Select risk level</option>
                  {RISK_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="businessImpact">Business Impact</Label>
              <textarea
                id="businessImpact"
                value={formState.businessImpact}
                onChange={(e) => setFormState({ ...formState, businessImpact: e.target.value })}
                rows={2}
                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="How does this affect the business?"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="magnitude">Impact of Pain Point (1-10)</Label>
                <p className="text-xs text-gray-500 mt-0.5">1 = Low impact, 10 = High impact</p>
                <input
                  id="magnitude"
                  type="number"
                  min="1"
                  max="10"
                  value={formState.magnitude}
                  onChange={(e) => setFormState({ ...formState, magnitude: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="1-10"
                />
              </div>

              <div>
                <Label htmlFor="effortSolving">Effort in Solving (1-10)</Label>
                <p className="text-xs text-gray-500 mt-0.5">1 = Low effort, 10 = High effort</p>
                <input
                  id="effortSolving"
                  type="number"
                  min="1"
                  max="10"
                  value={formState.effortSolving}
                  onChange={(e) => setFormState({ ...formState, effortSolving: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="1-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="frequency">Frequency (per month)</Label>
                <input
                  id="frequency"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.frequency}
                  onChange={(e) => setFormState({ ...formState, frequency: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Times per month"
                />
              </div>

              <div>
                <Label htmlFor="timePerUnit">Time Required per unit (Hrs)</Label>
                <input
                  id="timePerUnit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.timePerUnit}
                  onChange={(e) => setFormState({ ...formState, timePerUnit: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Hours per unit"
                />
              </div>

              <div>
                <Label htmlFor="fteCount"># FTE on painpoint</Label>
                <input
                  id="fteCount"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formState.fteCount}
                  onChange={(e) => setFormState({ ...formState, fteCount: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Number of FTEs"
                />
              </div>
            </div>

            {formState.frequency && formState.timePerUnit && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <Label className="text-blue-900">Total Hours per Month (Auto-calculated)</Label>
                <p className="text-lg font-semibold text-blue-900 mt-1">
                  {(Number(formState.frequency) * Number(formState.timePerUnit)).toFixed(2)} hours
                </p>
                <p className="text-xs text-blue-700 mt-1">This value is automatically calculated when you save</p>
              </div>
            )}

            <div>
              <Label htmlFor="rootCause">Root Cause</Label>
              <textarea
                id="rootCause"
                value={formState.rootCause}
                onChange={(e) => setFormState({ ...formState, rootCause: e.target.value })}
                rows={2}
                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Why is this happening?"
              />
            </div>

            <div>
              <Label htmlFor="workarounds">Current Workarounds</Label>
              <textarea
                id="workarounds"
                value={formState.workarounds}
                onChange={(e) => setFormState({ ...formState, workarounds: e.target.value })}
                rows={2}
                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="What temporary fixes exist?"
              />
            </div>

            <div>
              <Label htmlFor="dependencies">Dependencies</Label>
              <textarea
                id="dependencies"
                value={formState.dependencies}
                onChange={(e) => setFormState({ ...formState, dependencies: e.target.value })}
                rows={2}
                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="What other systems or processes are involved?"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {editingPainPoint ? "Save changes" : "Create pain point"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
