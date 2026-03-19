"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface Vendor {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface VendorAutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectVendor?: (vendor: Vendor | null) => void;
  placeholder?: string;
  refreshKey?: number;
}

export default function VendorAutoComplete({
  value,
  onChange,
  onSelectVendor,
  placeholder = "Select vendor...",
  refreshKey = 0,
}: VendorAutoCompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [vendors, setVendors] = React.useState<Vendor[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchVendors = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/vendors");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch vendors");
        }
        setVendors(data.data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchVendors();
  }, [refreshKey]);

  const selectedVendor = vendors.find((vendor) => vendor.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={loading}
        >
          {selectedVendor ? selectedVendor.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,420px)] p-0">
        <Command>
          <CommandInput placeholder="Search vendor..." />
          <CommandEmpty>No vendor found.</CommandEmpty>
          <CommandGroup className="max-h-[50vh] overflow-y-auto">
            <CommandItem
              key="none"
              value=""
              onSelect={() => {
                onChange("");
                onSelectVendor?.(null);
                setOpen(false);
              }}
            >
              <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
              None (Manual entry)
            </CommandItem>
            {vendors.map((vendor) => {
              const meta = [vendor.contactName, vendor.phone, vendor.email].filter(Boolean).join(" ");
              return (
                <CommandItem
                  key={vendor.id}
                  value={`${vendor.name} ${meta}`}
                  onSelect={() => {
                    onChange(vendor.id);
                    onSelectVendor?.(vendor);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === vendor.id ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{vendor.name}</span>
                    {meta ? <span className="text-xs text-gray-500">{meta}</span> : null}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
