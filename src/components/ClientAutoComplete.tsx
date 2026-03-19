"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface Client {
  id: string;
  name: string;
  contacts?: { name?: string; phone?: string; email?: string }[];
}

interface ClientAutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  refreshKey?: number;
}

export default function ClientAutoComplete({
  value,
  onChange,
  placeholder = "Select client...",
  refreshKey = 0,
}: ClientAutoCompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/clients");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch clients");
        }
        setClients(data.data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [refreshKey]);

  const selectedClient = clients.find((client) => client.id === value);

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
          {selectedClient ? selectedClient.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,420px)] p-0">
        <Command>
          <CommandInput placeholder="Search client..." />
          <CommandEmpty>No client found.</CommandEmpty>
          <CommandGroup className="max-h-[50vh] overflow-y-auto">
            <CommandItem
              key="none"
              value=""
              onSelect={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
              None (Select later)
            </CommandItem>
            {clients.map((client) => {
              const contactsText = client.contacts
                ?.map((contact) => [contact.name, contact.phone, contact.email].filter(Boolean).join(" "))
                .join(" ") || "";
              return (
                <CommandItem
                  key={client.id}
                  value={`${client.name} ${contactsText}`}
                  onSelect={() => {
                    onChange(client.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === client.id ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{client.name}</span>
                    {contactsText ? (
                      <span className="text-xs text-gray-500">{contactsText}</span>
                    ) : null}
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
