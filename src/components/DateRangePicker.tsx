'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Button } from '@/components/ui/button';

export default function DateRangePicker() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [startDate, setStartDate] = useState<Date | null>(
    searchParams.get('from') ? new Date(searchParams.get('from')!) : null
  );
  const [endDate, setEndDate] = useState<Date | null>(
    searchParams.get('to') ? new Date(searchParams.get('to')!) : null
  );

  const handleApply = () => {
    const params = new URLSearchParams(searchParams);
    if (startDate) {
      params.set('from', startDate.toISOString());
    } else {
      params.delete('from');
    }
    if (endDate) {
      params.set('to', endDate.toISOString());
    } else {
      params.delete('to');
    }
    router.replace(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <DatePicker
        selected={startDate}
        onChange={(date) => setStartDate(date)}
        selectsStart
        startDate={startDate}
        endDate={endDate}
        placeholderText="From"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <DatePicker
        selected={endDate}
        onChange={(date) => setEndDate(date)}
        selectsEnd
        startDate={startDate}
        endDate={endDate}
        minDate={startDate}
        placeholderText="To"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <Button onClick={handleApply} size="sm">
        Apply
      </Button>
    </div>
  );
}
