'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TranscriptInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export default function TranscriptInput({ onSubmit, isLoading }: TranscriptInputProps) {
  const [url, setUrl] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <Input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste YouTube URL here..."
        disabled={isLoading}
        className="h-11 flex-1"
      />
      <Button
        type="submit"
        disabled={isLoading || !url.trim()}
        size="lg"
        className="sm:w-auto"
      >
        {isLoading && (
          <span
            className="inline-block h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin"
            aria-hidden="true"
          />
        )}
        {isLoading ? 'Fetching...' : 'Get Transcript'}
      </Button>
    </form>
  );
}
