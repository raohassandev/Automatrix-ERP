'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface SortableHeaderProps {
  label: string;
  value: string;
}

export default function SortableHeader({ label, value }: SortableHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = searchParams.get('sort');
  const [sortBy, order] = sort?.split(':') || [];

  const handleSort = () => {
    const newOrder = order === 'asc' ? 'desc' : 'asc';
    const params = new URLSearchParams(searchParams);
    params.set('sort', `${value}:${newOrder}`);
    router.replace(`?${params.toString()}`);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleSort}>
      {label}
      {sortBy === value && (
        <span className="ml-2">
          {order === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
        </span>
      )}
    </Button>
  );
}
