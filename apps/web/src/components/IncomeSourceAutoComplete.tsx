'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';

interface IncomeSourceAutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
}

export default function IncomeSourceAutoComplete({
  value,
  onChange,
}: IncomeSourceAutoCompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [incomeSources, setIncomeSources] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchIncomeSources = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/income-sources');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch income sources');
        }
        setIncomeSources(data.data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchIncomeSources();
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
          disabled={loading}
        >
          {value
            ? incomeSources.find((source) => source === value)
            : 'Select income source...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search income source..." />
          <CommandEmpty>No income source found.</CommandEmpty>
          <CommandGroup>
            {incomeSources.map((source) => (
              <CommandItem
                key={source}
                value={source}
                onSelect={(currentValue) => {
                  onChange(currentValue === value ? '' : currentValue);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === source ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {source}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
