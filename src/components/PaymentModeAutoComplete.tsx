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
  className?: string;
  placeholder?: string;
}

const DEFAULT_PAYMENT_MODES = ['Cash', 'Bank Transfer', 'Cheque', 'Online Transfer', 'Credit Card', 'Other'];

export default function PaymentModeAutoComplete({
  value,
  onChange,
  className,
  placeholder = 'Select payment mode...',
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
        const modes = Array.isArray(data.data) && data.data.length > 0 ? data.data : DEFAULT_PAYMENT_MODES;
        setPaymentModes(modes);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        toast.error(message);
        setPaymentModes(DEFAULT_PAYMENT_MODES);
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
          className={cn('justify-between', className || 'w-[min(92vw,280px)]')}
          disabled={loading}
        >
          {value
            ? paymentModes.find((mode) => mode === value)
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('p-0', className || 'w-[min(92vw,280px)]')}>
        <Command>
          <CommandInput placeholder="Search payment mode..." />
          <CommandEmpty>No payment mode found.</CommandEmpty>
          <CommandGroup className="max-h-[50vh] overflow-y-auto">
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
