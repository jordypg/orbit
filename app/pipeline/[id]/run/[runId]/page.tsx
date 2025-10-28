'use client';

import { trpc } from '@/app/providers';
import { Loader2, ArrowLeft, RefreshCw, Copy, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { JsonDisplay } from '@/components/ui/json-display';
import { formatDistanceToNow, formatDuration, intervalToDuration } from 'date-fns';

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;
  const pipelineId = params.id as string;

  const { data: run, isLoading, error } = trpc.run.get.useQuery(
    { id: runId },
    {
      // Poll every 2 seconds while run is active
      refetchInterval: (data) => {
        const isActive = data?.status === 'pending' || data?.status === 'running';
        return isActive ? 2000 : false;
      },
    }
  );
  const utils = trpc.useUtils();
  const retryMutation = trpc.run.retry.useMutation({
    onSuccess: () => {
      utils.run.get.invalidate({ id: runId });
      utils.run.getByPipeline.invalidate({ pipelineId });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'running':
        return <Clock className="h-5 w-5 text-yellow-600 animate-spin" />;
      case 'retrying':
        return <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
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
      case 'retrying':
        return <Badge variant="warning" className="gap-1">{getStatusIcon(status)} Retrying</Badge>;
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h3 className="font-semibold text-destructive mb-2">Error loading run</h3>
          <p className="text-sm text-destructive/80">{error?.message || 'Run not found'}</p>
          <Link href={`/pipeline/${pipelineId}`}>
            <Button variant="outline" className="mt-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Pipeline
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const duration = calculateDuration(run.startedAt, run.finishedAt);

  // Get step definitions and calculate counts
  const stepDefinitions = (run as any).stepDefinitions || [];
  const totalSteps = stepDefinitions.length || run.steps.length;
  const completedSteps = run.steps.filter(s => s.status === 'success').length;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <Link href={`/pipeline/${pipelineId}`}>
            <Button variant="ghost" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Pipeline
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{run.pipeline.name}</h1>
              <p className="text-muted-foreground">Run Details</p>
            </div>
            {getStatusBadge(run.status)}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Run Metadata */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Run Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Run ID</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono">{run.id.slice(0, 8)}...</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(run.id)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Started</p>
                <p className="text-sm font-medium">
                  {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Duration</p>
                <p className="text-sm font-medium">{duration}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Triggered By</p>
                <p className="text-sm font-medium">{run.triggeredBy || 'Manual'}</p>
              </div>
            </div>
            {run.status === 'failed' && (
              <div className="mt-4">
                <Button
                  onClick={() => retryMutation.mutate({ id: run.id })}
                  disabled={retryMutation.isPending}
                  className="gap-2"
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Retry Run
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Steps Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Execution Timeline</CardTitle>
            <CardDescription>
              {completedSteps}/{totalSteps} step{totalSteps !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {run.steps.map((step, index) => (
                <div key={step.id} className="relative">
                  {/* Timeline connector */}
                  {index < run.steps.length - 1 && (
                    <div className="absolute left-[18px] top-10 h-full w-0.5 bg-border" />
                  )}

                  {/* Step content */}
                  <div className="flex gap-4">
                    {/* Status icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(step.status)}
                    </div>

                    {/* Step details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h3 className="font-semibold">{step.name}</h3>
                          {step.startedAt && (
                            <p className="text-sm text-muted-foreground">
                              Duration: {calculateDuration(step.startedAt, step.finishedAt)}
                              {step.attemptCount > 1 && ` • Attempt ${step.attemptCount}`}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(step.status)}
                      </div>

                      {/* Error display */}
                      {step.error && (
                        <div className="mt-2 p-4 rounded-lg border border-destructive bg-destructive/10">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                              <p className="text-sm font-semibold text-destructive">Error</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(step.error || '')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <JsonDisplay
                            content={step.error}
                            className="text-destructive/80"
                          />
                        </div>
                      )}

                      {/* Result display */}
                      {step.result && step.status === 'success' && (
                        <div className="mt-2 p-4 rounded-lg border bg-muted/50">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-semibold">Result</p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(step.result || '')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <JsonDisplay
                            content={step.result}
                            className="text-muted-foreground"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
