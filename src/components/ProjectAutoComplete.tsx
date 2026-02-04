'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';

interface Project {
  id: string;
  projectId: string;
  name: string;
  client?: { name: string } | null;
}

interface ProjectAutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  refreshKey?: number;
  disabled?: boolean;
}

export default function ProjectAutoComplete({
  value,
  onChange,
  placeholder = 'Select project...',
  refreshKey = 0,
  disabled = false,
}: ProjectAutoCompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch projects');
        }
        // Filter only active projects
        const activeProjects = data.data?.filter((p: Project) => p.name) || [];
        setProjects(activeProjects);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [refreshKey]);

  const selectedProject = projects.find((p) => p.projectId === value || p.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={loading || disabled}
        >
          {selectedProject
            ? `${selectedProject.projectId} - ${selectedProject.name}`
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search project..." />
          <CommandEmpty>No project found.</CommandEmpty>
          <CommandGroup>
            {/* Option to clear selection */}
            <CommandItem
              key="none"
              value=""
              onSelect={() => {
                onChange('');
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  'mr-2 h-4 w-4',
                  !value ? 'opacity-100' : 'opacity-0'
                )}
              />
              None (No project)
            </CommandItem>
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                value={`${project.projectId} ${project.name} ${project.client?.name || ""}`}
                onSelect={() => {
                  onChange(project.projectId);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === project.projectId || value === project.name ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="flex flex-col">
                  <span className="font-medium">{project.projectId} - {project.name}</span>
                  <span className="text-xs text-gray-500">{project.client?.name || "-"}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
