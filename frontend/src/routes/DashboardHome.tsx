export default function DashboardHome() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          Overview of your process intelligence and opportunities
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Companies</p>
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">-</p>
          <p className="text-xs text-gray-500 mt-1">Connect to API to load data</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Processes</p>
            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">-</p>
          <p className="text-xs text-gray-500 mt-1">Connect to API to load data</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Pain Points</p>
            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">-</p>
          <p className="text-xs text-gray-500 mt-1">Connect to API to load data</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Solutions</p>
            <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">-</p>
          <p className="text-xs text-gray-500 mt-1">Connect to API to load data</p>
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Welcome to AIValue</h2>
        <p className="text-sm text-gray-700 mt-2">
          Start by adding your companies and business units to begin tracking process intelligence and identifying opportunities for improvement.
        </p>
      </div>
    </div>
  );
}
