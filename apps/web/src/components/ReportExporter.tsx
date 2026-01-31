'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { generatePdf } from '@/lib/pdf';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportExporter() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expenses');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch expenses');
      }

      const columns = [
        { header: 'Date', dataKey: 'date' },
        { header: 'Description', dataKey: 'description' },
        { header: 'Category', dataKey: 'category' },
        { header: 'Amount', dataKey: 'amount' },
        { header: 'Status', dataKey: 'status' },
      ];

      const expenses = data.data.map((expense: any) => ({
        ...expense,
        date: new Date(expense.date).toLocaleDateString(),
        amount: Number(expense.amount),
      }));

      generatePdf({
        title: 'Expenses Report',
        columns,
        data: expenses,
        fileName: 'expenses-report.pdf',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={loading}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Export PDF
    </Button>
  );
}
