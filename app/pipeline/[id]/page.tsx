'use client';

import { trpc } from '@/app/providers';
import { Loader2, ArrowLeft, Play, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow, intervalToDuration } from 'date-fns';

export default function PipelineDetailPage() {
  const params = useParams();
  const pipelineId = params.id as string;

  const { data: pipeline, isLoading: isPipelineLoading, error: pipelineError } = trpc.pipeline.get.useQuery({ id: pipelineId });
  const { data: runsData, isLoading: isRunsLoading, error: runsError } = trpc.run.getByPipeline.useQuery({
    pipelineId,
    limit: 50,
  });

  const utils = trpc.useUtils();
  const triggerMutation = trpc.pipeline.trigger.useMutation({
    onSuccess: () => {
      utils.pipeline.get.invalidate({ id: pipelineId });
      utils.run.getByPipeline.invalidate({ pipelineId, limit: 50 });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Clock className="h-4 w-4 text-yellow-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="success" className="gap-1">{getStatusIcon(status)} Success</Badge>;
      case 'failed':
        return <Badge variant="error" className="gap-1">{getStatusIcon(status)} Failed</Badge>;
      case 'running':
        return <Badge variant="warning" className="gap-1">{getStatusIcon(status)} Running</Badge>;
      default:
        return <Badge variant="outline" className="gap-1">{getStatusIcon(status)} Pending</Badge>;
    }
  };

  const calculateDuration = (start: Date | string | null, end: Date | string | null) => {
    if (!start) return 'Not started';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();

    const duration = intervalToDuration({ start: startDate, end: endDate });
    const parts = [];

    if (duration.hours) parts.push(`${duration.hours}h`);
    if (duration.minutes) parts.push(`${duration.minutes}m`);
    if (duration.seconds) parts.push(`${duration.seconds}s`);

    return parts.length > 0 ? parts.join(' ') : '< 1s';
  };

  const calculateStats = () => {
    if (!runsData?.runs) return { total: 0, success: 0, failed: 0, running: 0, successRate: 0 };

    const total = runsData.runs.length;
    const success = runsData.runs.filter((r) => r.status === 'success').length;
    const failed = runsData.runs.filter((r) => r.status === 'failed').length;
    const running = runsData.runs.filter((r) => r.status === 'running').length;
    const successRate = total > 0 ? (success / total) * 100 : 0;

    return { total, success, failed, running, successRate };
  };

  if (isPipelineLoading || isRunsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pipelineError || runsError || !pipeline) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h3 className="font-semibold text-destructive mb-2">Error loading pipeline</h3>
          <p className="text-sm text-destructive/80">
            {pipelineError?.message || runsError?.message || 'Pipeline not found'}
          </p>
          <Link href="/">
            <Button variant="outline" className="mt-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const stats = calculateStats();
  const runs = runsData?.runs || [];

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <Link href="/">
            <Button variant="ghost" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{pipeline.name}</h1>
              <p className="text-muted-foreground">
                {pipeline.description || 'No description provided'}
              </p>
            </div>
            <Button
              className="gap-2"
              onClick={() => triggerMutation.mutate({ id: pipelineId })}
              disabled={triggerMutation.isPending}
            >
              {triggerMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {triggerMutation.isPending ? 'Starting...' : 'Run Now'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Runs</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Success Rate</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${
                stats.successRate >= 80 ? 'text-green-600' :
                stats.successRate >= 50 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {stats.successRate.toFixed(0)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Successful</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.success}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Failed</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
            </CardContent>
          </Card>
        </div>

        {/* Runs List */}
        <Card>
          <CardHeader>
            <CardTitle>Run History</CardTitle>
            <CardDescription>
              {runs.length} run{runs.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No runs yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This pipeline hasn't been executed yet. Start your first run!
                </p>
                <Button
                  className="gap-2"
                  onClick={() => triggerMutation.mutate({ id: pipelineId })}
                  disabled={triggerMutation.isPending}
                >
                  {triggerMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {triggerMutation.isPending ? 'Starting...' : 'Run Now'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {runs.map((run) => {
                  const duration = calculateDuration(run.startedAt, run.finishedAt);
                  const failedSteps = run.steps.filter((s) => s.status === 'failed').length;

                  return (
                    <Link key={run.id} href={`/pipeline/${pipelineId}/run/${run.id}`}>
                      <div className="p-4 rounded-lg border hover:border-primary transition-colors cursor-pointer">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              {getStatusBadge(run.status)}
                              <code className="text-sm text-muted-foreground">
                                {run.id.slice(0, 8)}
                              </code>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <div>
                                <span className="font-medium">Started:</span>{' '}
                                {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                              </div>
                              <div>
                                <span className="font-medium">Duration:</span> {duration}
                              </div>
                              <div>
                                <span className="font-medium">Steps:</span> {run.steps.length}
                                {failedSteps > 0 && (
                                  <span className="text-red-600 ml-1">
                                    ({failedSteps} failed)
                                  </span>
                                )}
                              </div>
                              {run.triggeredBy && (
                                <div>
                                  <span className="font-medium">Triggered by:</span> {run.triggeredBy}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
