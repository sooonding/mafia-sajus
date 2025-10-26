'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';

interface ResultSectionProps {
  title: string;
  data: Record<string, string>;
}

export function ResultSection({ title, data }: ResultSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">
              {key}
            </h4>
            <p className="text-sm whitespace-pre-wrap">{value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
