'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { CheckCircle2, XCircle, Clock, Play, ArrowRight, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { trpc } from '@/app/providers';

interface PipelineCardProps {
  id: string;
  name: string;
  description?: string | null;
  lastRunAt?: Date | null;
  successRate?: number;
  status?: 'success' | 'failed' | 'running' | 'idle';
  runCount: number;
}

export function PipelineCard({
  id,
  name,
  description,
  lastRunAt,
  successRate = 0,
  status = 'idle',
  runCount,
}: PipelineCardProps) {
  const utils = trpc.useUtils();
  const triggerMutation = trpc.pipeline.trigger.useMutation({
    onSuccess: () => {
      // Invalidate queries to refresh the data
      utils.pipeline.list.invalidate();
      utils.pipeline.get.invalidate({ id });
    },
  });
  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'running':
        return <Clock className="h-4 w-4 animate-spin" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'success':
        return <Badge variant="success" className="gap-1">{getStatusIcon()} Success</Badge>;
      case 'failed':
        return <Badge variant="error" className="gap-1">{getStatusIcon()} Failed</Badge>;
      case 'running':
        return <Badge variant="warning" className="gap-1">{getStatusIcon()} Running</Badge>;
      default:
        return <Badge variant="outline" className="gap-1">{getStatusIcon()} Idle</Badge>;
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-xl">{name}</CardTitle>
            <CardDescription className="line-clamp-2">
              {description || 'No description provided'}
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Total Runs</p>
            <p className="text-2xl font-semibold">{runCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Success Rate</p>
            <p className={`text-2xl font-semibold ${getSuccessRateColor(successRate)}`}>
              {successRate.toFixed(0)}%
            </p>
          </div>
        </div>

        {lastRunAt && (
          <div className="text-sm">
            <p className="text-muted-foreground">Last run</p>
            <p className="font-medium">
              {formatDistanceToNow(new Date(lastRunAt), { addSuffix: true })}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          className="flex-1 gap-2"
          variant="default"
          onClick={() => triggerMutation.mutate({ id })}
          disabled={triggerMutation.isPending}
        >
          {triggerMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {triggerMutation.isPending ? 'Starting...' : 'Run Now'}
        </Button>
        <Link href={`/pipeline/${id}`} className="flex-1">
          <Button variant="outline" className="w-full gap-2">
            View Details
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
