'use client';

import Image from 'next/image';
import { VideoMetadata } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';

interface VideoInfoProps {
  metadata: VideoMetadata;
}

export default function VideoInfo({ metadata }: VideoInfoProps) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-start gap-4">
        <Image
          src={metadata.thumbnailUrl}
          alt={metadata.title}
          width={120}
          height={68}
          unoptimized
          className="shrink-0 rounded-md"
        />
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug">
            {metadata.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {metadata.author}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
