'use client';

import React from 'react';
import { trpc } from '@/app/providers';
import { Loader2, ArrowLeft, Play, CheckCircle2, XCircle, Clock, AlertCircle, Copy, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { JsonDisplay } from '@/components/ui/json-display';
import { formatDistanceToNow, intervalToDuration } from 'date-fns';

export default function PipelineDetailPage() {
  const params = useParams();
  const pipelineId = params.id as string;

  const { data: pipeline, isLoading: isPipelineLoading, error: pipelineError } = trpc.pipeline.get.useQuery({ id: pipelineId });
  const { data: runsData, isLoading: isRunsLoading, error: runsError } = trpc.run.getByPipeline.useQuery(
    {
      pipelineId,
      limit: 50,
    },
    {
      // Poll every 2 seconds when there are active runs
      refetchInterval: (data) => {
        const hasActiveRuns = data?.runs?.some((run) => run.status === 'pending' || run.status === 'running');
        return hasActiveRuns ? 2000 : false;
      },
    }
  );

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = React.useState<string>('');
  const [showFileInput, setShowFileInput] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);

  const utils = trpc.useUtils();

  const uploadFileMutation = trpc.pipeline.uploadFile.useMutation();

  const triggerMutation = trpc.pipeline.trigger.useMutation({
    onSuccess: () => {
      utils.pipeline.get.invalidate({ id: pipelineId });
      utils.run.getByPipeline.invalidate({ pipelineId, limit: 50 });
      setShowFileInput(false);
      setSelectedFile(null);
      setUploadedFilePath('');
    },
  });

  const handleTrigger = () => {
    // Check if this pipeline requires file input
    const requiresFileInput = pipeline?.name === 'image-upload-test' || pipeline?.name === 'document-processing';

    if (requiresFileInput) {
      setShowFileInput(true);
    } else {
      triggerMutation.mutate({ id: pipelineId });
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsUploading(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64Content = base64Data.split(',')[1];

        try {
          const result = await uploadFileMutation.mutateAsync({
            fileData: base64Content,
            mimeType: file.type,
            originalName: file.name,
          });

          setUploadedFilePath(result.tempPath);
        } catch (error) {
          console.error('Upload failed:', error);
          alert('File upload failed. Please try again.');
          setSelectedFile(null);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File reading failed:', error);
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  const handleSubmitWithFile = () => {
    if (!uploadedFilePath) return;

    triggerMutation.mutate({
      id: pipelineId,
      metadata: { filePath: uploadedFilePath },
    });
  };


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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
            <div className="flex gap-2 items-center">
              {showFileInput && (
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    disabled={isUploading || triggerMutation.isPending}
                    className="px-3 py-2 border rounded-md min-w-[300px]"
                  />
                  {selectedFile && (
                    <span className="text-sm text-muted-foreground">
                      {isUploading ? 'Uploading...' : '✓ Ready'}
                    </span>
                  )}
                </div>
              )}
              {showFileInput ? (
                <>
                  <Button
                    className="gap-2"
                    onClick={handleSubmitWithFile}
                    disabled={triggerMutation.isPending || !uploadedFilePath || isUploading}
                  >
                    {triggerMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {triggerMutation.isPending ? 'Starting...' : 'Run Pipeline'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowFileInput(false);
                      setSelectedFile(null);
                      setUploadedFilePath('');
                    }}
                    disabled={triggerMutation.isPending || isUploading}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  className="gap-2"
                  onClick={handleTrigger}
                  disabled={triggerMutation.isPending}
                >
                  {triggerMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {triggerMutation.isPending ? 'Starting...' : 'Run Now'}
                </Button>
              )}
            </div>
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
                  onClick={handleTrigger}
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
              <Accordion type="single" collapsible className="space-y-4">
                {runs.map((run) => {
                  const duration = calculateDuration(run.startedAt, run.finishedAt);
                  const failedSteps = run.steps.filter((s) => s.status === 'failed').length;
                  const successSteps = run.steps.filter((s) => s.status === 'success').length;

                  // Merge pipeline step definitions with actual execution steps
                  const stepDefinitions = runsData?.stepDefinitions || (pipeline as any)?.stepDefinitions || [];
                  const executedSteps = run.steps || [];
                  const executedStepsByName = new Map(executedSteps.map(s => [s.name, s]));

                  // Create unified step list (all steps from definition, matched with execution data)
                  const allSteps = stepDefinitions.length > 0
                    ? stepDefinitions.map(def => {
                        const executed = executedStepsByName.get(def.name);
                        return executed || {
                          id: `pending-${def.name}`,
                          name: def.name,
                          status: 'pending',
                          startedAt: null,
                          finishedAt: null,
                          attemptCount: 0,
                          result: null,
                          error: null,
                        };
                      })
                    : executedSteps; // Fallback to executed steps if no definition

                  return (
                    <AccordionItem key={run.id} value={run.id} className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-start justify-between gap-4 w-full pr-4">
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-3 mb-2">
                              {getStatusBadge(run.status)}
                              <code className="text-sm text-muted-foreground">
                                {run.id.slice(0, 8)}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(run.id);
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
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
                                <span className="font-medium">Steps:</span> {successSteps}/{stepDefinitions.length || run.steps.length}
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
                      </AccordionTrigger>
                      <AccordionContent>
                        {/* Step Timeline */}
                        <div className="space-y-4 pt-4">
                          {allSteps.map((step, index) => (
                            <div key={step.id} className="relative">
                              {/* Timeline connector */}
                              {index < allSteps.length - 1 && (
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
                                      <h4 className="font-semibold text-sm">{step.name}</h4>
                                      {step.startedAt && (
                                        <p className="text-xs text-muted-foreground">
                                          Duration: {calculateDuration(step.startedAt, step.finishedAt)}
                                          {step.attemptCount > 1 && ` • Attempt ${step.attemptCount}`}
                                        </p>
                                      )}
                                    </div>
                                    {getStatusBadge(step.status)}
                                  </div>

                                  {/* Error display */}
                                  {step.error && (
                                    <div className="mt-2 p-3 rounded-lg border border-destructive bg-destructive/10">
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                                          <p className="text-xs font-semibold text-destructive">Error</p>
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
                                      <div className={step.error.length > 500 ? "max-h-40 overflow-y-auto" : ""}>
                                        <JsonDisplay
                                          content={step.error}
                                          className="text-destructive/80"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Result display */}
                                  {step.result && step.status === 'success' && (
                                    <div className="mt-2 p-3 rounded-lg border bg-muted/50">
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <p className="text-xs font-semibold">Result</p>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => copyToClipboard(step.result || '')}
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <div className={step.result.length > 500 ? "max-h-40 overflow-y-auto" : ""}>
                                        <JsonDisplay
                                          content={step.result}
                                          className="text-muted-foreground"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* View full details link */}
                        <div className="mt-4 pt-4 border-t">
                          <Link href={`/pipeline/${pipelineId}/run/${run.id}`}>
                            <Button variant="outline" size="sm" className="w-full">
                              View Full Run Details
                            </Button>
                          </Link>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
