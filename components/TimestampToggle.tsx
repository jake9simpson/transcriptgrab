'use client';

import { Switch } from '@/components/ui/switch';

interface TimestampToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export default function TimestampToggle({ enabled, onToggle }: TimestampToggleProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        aria-label="Show timestamps"
      />
      <span className="text-foreground">Show timestamps</span>
    </label>
  );
}
