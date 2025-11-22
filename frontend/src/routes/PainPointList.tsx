export default function PainPointList() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Pain Points</h1>
        <p className="text-sm text-gray-600 mt-1">
          Identify and track process pain points across your organization
        </p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="mt-4 text-base font-semibold text-gray-900">No pain points yet</h3>
        <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
          Connect this view to /api/pain-points to load and manage pain point data
        </p>
      </div>
    </div>
  );
}
