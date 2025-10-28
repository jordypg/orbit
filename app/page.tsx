'use client';

import { trpc } from './providers';
import { PipelineCard } from '@/components/pipeline-card';
import { Activity, Loader2 } from 'lucide-react';

export default function Home() {
    const { data: pipelines, isLoading, error } = trpc.pipeline.list.useQuery();

    return (
        <main className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Activity className="h-8 w-8" />
                        <h1 className="text-3xl font-bold">Orbit Pipeline</h1>
                    </div>
                    <p className="text-muted-foreground">
                        Native and resilient TypeScript job execution pipeline
                    </p>
                </div>
            </header>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-semibold mb-1">Pipelines</h2>
                        <p className="text-sm text-muted-foreground">
                            {pipelines ? `${pipelines.length} pipeline${pipelines.length !== 1 ? 's' : ''} configured` : 'Loading...'}
                        </p>
                    </div>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
                        <h3 className="font-semibold text-destructive mb-2">Error loading pipelines</h3>
                        <p className="text-sm text-destructive/80">{error.message}</p>
                    </div>
                )}

                {/* Empty State */}
                {pipelines && pipelines.length === 0 && (
                    <div className="rounded-lg border border-dashed p-12 text-center">
                        <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No pipelines found</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Create your first pipeline to get started with automated job execution.
                        </p>
                    </div>
                )}

                {/* Pipeline Grid */}
                {pipelines && pipelines.length > 0 && (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {pipelines.map((pipeline) => {
                            return (
                                <PipelineCard
                                    key={pipeline.id}
                                    id={pipeline.id}
                                    name={pipeline.name}
                                    description={pipeline.description}
                                    runCount={pipeline._count?.runs || 0}
                                    successRate={pipeline.stats.successRate}
                                    status={pipeline.stats.status as 'success' | 'failed' | 'running' | 'idle' | undefined}
                                    lastRunAt={pipeline.stats.lastRunAt}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
