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

interface PaymentModeAutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
}

export default function PaymentModeAutoComplete({
  value,
  onChange,
}: PaymentModeAutoCompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [paymentModes, setPaymentModes] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchPaymentModes = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/payment-modes');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch payment modes');
        }
        setPaymentModes(data.data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchPaymentModes();
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
            ? paymentModes.find((mode) => mode === value)
            : 'Select payment mode...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search payment mode..." />
          <CommandEmpty>No payment mode found.</CommandEmpty>
          <CommandGroup>
            {paymentModes.map((mode) => (
              <CommandItem
                key={mode}
                value={mode}
                onSelect={(currentValue) => {
                  onChange(currentValue === value ? '' : currentValue);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === mode ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {mode}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
