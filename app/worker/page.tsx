'use client';

import { trpc } from '../providers';
import { Activity, CheckCircle2, Clock, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function WorkerDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.worker.stats.useQuery(undefined, {
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const { data: health, isLoading: healthLoading } = trpc.worker.health.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const { data: pendingRuns } = trpc.worker.recentRuns.useQuery(
    { limit: 10, status: 'pending' },
    { refetchInterval: 5000 }
  );

  const { data: runningRuns } = trpc.worker.recentRuns.useQuery(
    { limit: 10, status: 'running' },
    { refetchInterval: 5000 }
  );

  const { data: recentCompleted } = trpc.worker.recentRuns.useQuery(
    { limit: 15 },
    { refetchInterval: 5000 }
  );

  const getHealthStatusColor = () => {
    if (!health) return 'bg-gray-500';
    switch (health.status) {
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getHealthIcon = () => {
    if (!health) return <Activity className="h-5 w-5" />;
    switch (health.status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Worker Monitor</h1>
            <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin ml-auto" />
          </div>
          <p className="text-muted-foreground">
            Real-time worker status and pipeline execution monitoring
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Worker Health Status */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Worker Health</h2>
          <div className="rounded-lg border p-6">
            {healthLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${getHealthStatusColor()} text-white`}>
                  {getHealthIcon()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">
                      {health?.status === 'healthy' && 'Worker is Healthy'}
                      {health?.status === 'warning' && 'Worker Warning'}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {health?.message}
                  </p>
                  {health?.lastActivity && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Last activity: {formatDistanceToNow(new Date(health.lastActivity), { addSuffix: true })}
                    </p>
                  )}
                </div>
                {health?.stuckRuns! > 0 && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-600">
                      {health?.stuckRuns}
                    </div>
                    <div className="text-xs text-muted-foreground">Stuck Runs</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Metrics</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Pending Runs */}
            <div className="rounded-lg border p-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <span className="text-2xl font-bold">
                  {statsLoading ? '-' : stats?.pending || 0}
                </span>
              </div>
              <div className="text-sm font-medium">Pending</div>
              <div className="text-xs text-muted-foreground">Waiting to run</div>
            </div>

            {/* Running Runs */}
            <div className="rounded-lg border p-6">
              <div className="flex items-center justify-between mb-2">
                <RefreshCw className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">
                  {statsLoading ? '-' : stats?.running || 0}
                </span>
              </div>
              <div className="text-sm font-medium">Running</div>
              <div className="text-xs text-muted-foreground">Currently executing</div>
            </div>

            {/* Runs Per Hour */}
            <div className="rounded-lg border p-6">
              <div className="flex items-center justify-between mb-2">
                <Activity className="h-5 w-5 text-purple-600" />
                <span className="text-2xl font-bold">
                  {statsLoading ? '-' : stats?.runsLastHour || 0}
                </span>
              </div>
              <div className="text-sm font-medium">Last Hour</div>
              <div className="text-xs text-muted-foreground">Runs executed</div>
            </div>

            {/* Error Rate */}
            <div className="rounded-lg border p-6">
              <div className="flex items-center justify-between mb-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="text-2xl font-bold">
                  {statsLoading ? '-' : `${stats?.errorRate || 0}%`}
                </span>
              </div>
              <div className="text-sm font-medium">Error Rate</div>
              <div className="text-xs text-muted-foreground">Last 24 hours</div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Avg Duration</div>
              <div className="text-xl font-semibold mt-1">
                {statsLoading ? '-' : `${((stats?.avgDurationMs || 0) / 1000).toFixed(2)}s`}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">24h Success</div>
              <div className="text-xl font-semibold mt-1 text-green-600">
                {statsLoading ? '-' : stats?.successCount || 0}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">24h Failed</div>
              <div className="text-xl font-semibold mt-1 text-red-600">
                {statsLoading ? '-' : stats?.failedCount || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Runs Queue */}
        <div className="grid gap-8 lg:grid-cols-2 mb-8">
          {/* Pending Runs */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Pending Queue</h2>
            <div className="rounded-lg border">
              {!pendingRuns || pendingRuns.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No pending runs</p>
                </div>
              ) : (
                <div className="divide-y">
                  {pendingRuns.map((run) => (
                    <div key={run.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{run.pipeline.name}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {run.steps.length} steps
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Running Runs */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Currently Running</h2>
            <div className="rounded-lg border">
              {!runningRuns || runningRuns.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <RefreshCw className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No running runs</p>
                </div>
              ) : (
                <div className="divide-y">
                  {runningRuns.map((run) => (
                    <div key={run.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{run.pipeline.name}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {run.steps.filter(s => s.status === 'completed').length} / {run.steps.length} steps
                          </div>
                          {/* Simple progress bar */}
                          <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all"
                              style={{
                                width: `${(run.steps.filter(s => s.status === 'completed').length / run.steps.length) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-right ml-4">
                          {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Completed Runs */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="rounded-lg border">
            {!recentCompleted || recentCompleted.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="divide-y">
                {recentCompleted.map((run) => (
                  <div key={run.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div>
                          {run.status === 'success' && (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          )}
                          {run.status === 'failed' && (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          {run.status === 'running' && (
                            <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                          )}
                          {run.status === 'pending' && (
                            <Clock className="h-5 w-5 text-yellow-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{run.pipeline.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {run.steps.length} steps
                            {run.finishedAt && run.startedAt && (
                              <span className="ml-2">
                                • {((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(2)}s
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
