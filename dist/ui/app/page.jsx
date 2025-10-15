'use client';
import { trpc } from './providers';
export default function Home() {
    const { data: pipelines, isLoading, error } = trpc.pipeline.list.useQuery();
    return (<main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Orbit Pipeline</h1>
        <p className="text-gray-600 mb-8">
          Resilient job execution pipeline with retry logic and state persistence
        </p>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4">Pipelines</h2>

          {isLoading && <p className="text-gray-500">Loading pipelines...</p>}

          {error && (<p className="text-red-500">Error loading pipelines: {error.message}</p>)}

          {pipelines && pipelines.length === 0 && (<p className="text-gray-500">No pipelines found. Create your first pipeline to get started.</p>)}

          {pipelines && pipelines.length > 0 && (<div className="space-y-4">
              {pipelines.map((pipeline) => (<div key={pipeline.id} className="border rounded-lg p-4">
                  <h3 className="text-xl font-medium">{pipeline.name}</h3>
                  {pipeline.description && (<p className="text-gray-600 mt-2">{pipeline.description}</p>)}
                  <div className="mt-2 text-sm text-gray-500">
                    Runs: {pipeline._count.runs}
                  </div>
                </div>))}
            </div>)}
        </div>
      </div>
    </main>);
}
//# sourceMappingURL=page.jsx.map