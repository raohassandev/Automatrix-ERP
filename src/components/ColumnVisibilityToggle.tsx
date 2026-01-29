'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings2 } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  visible: boolean;
}

interface ColumnVisibilityToggleProps {
  columns: Column[];
  onVisibilityChange: (columns: Column[]) => void;
}

export default function ColumnVisibilityToggle({
  columns,
  onVisibilityChange,
}: ColumnVisibilityToggleProps) {
  const [localColumns, setLocalColumns] = useState(columns);

  useEffect(() => {
    onVisibilityChange(localColumns);
  }, [localColumns, onVisibilityChange]);

  const handleCheckedChange = (key: string, checked: boolean) => {
    setLocalColumns((prev) =>
      prev.map((col) => (col.key === key ? { ...col, visible: checked } : col))
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-2 h-4 w-4" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {localColumns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={col.visible}
            onCheckedChange={(checked) => handleCheckedChange(col.key, Boolean(checked))}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
