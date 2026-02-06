'use client';

import { useSearchParams } from 'next/navigation';

export default function FinancialClient() {
  const searchParams = useSearchParams();

  return <div>Financial page (query: {searchParams.toString()})</div>;
}
