import { useEffect, useRef } from "react";
import { useUseCaseStore } from "@/store/useCases";

export function UseCaseTable() {
  const useCases = useUseCaseStore((state) => state.useCases);
  const fetchUseCases = useUseCaseStore((state) => state.fetchUseCases);
  const loading = useUseCaseStore((state) => state.loading);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) {
      return;
    }
    hasLoaded.current = true;
    void fetchUseCases();
  }, [fetchUseCases]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Title
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Problem
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card/40">
          {useCases.length === 0 && !loading ? (
            <tr>
              <td colSpan={3} className="px-6 py-4 text-center text-sm text-muted-foreground">
                No use cases yet. Add one above!
              </td>
            </tr>
          ) : (
            useCases.map((useCase) => (
              <tr key={useCase.id} className="hover:bg-muted/50">
                <td className="px-6 py-4 text-sm font-medium text-foreground">{useCase.title}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  <p className="max-w-3xl whitespace-pre-wrap">{useCase.problem}</p>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {new Date(useCase.createdAt).toLocaleString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
