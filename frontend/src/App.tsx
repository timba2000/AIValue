import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UseCaseForm } from "@/components/UseCaseForm";
import { UseCaseTable } from "@/components/UseCaseTable";
import { useUseCaseStore } from "@/store/useCases";

function App() {
  const error = useUseCaseStore((state) => state.error);
  const loading = useUseCaseStore((state) => state.loading);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Use Case Library</h1>
          <p className="text-muted-foreground">
            Capture problems your team is solving and keep them searchable in one place.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Add a new use case</CardTitle>
          </CardHeader>
          <CardContent>
            <UseCaseForm />
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <section aria-live="polite" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">All use cases</h2>
            {loading && <span className="text-sm text-muted-foreground">Loading...</span>}
          </div>
          <UseCaseTable />
        </section>
      </div>
    </div>
  );
}

export default App;
