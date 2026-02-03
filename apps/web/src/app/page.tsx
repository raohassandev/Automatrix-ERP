import Link from 'next/link';

export default function Home() {
  return (
    <div className='rounded-xl border bg-card p-8 shadow-sm'>
      <h1 className='text-2xl font-semibold'>AutoMatrix ERP</h1>
      <p className='mt-2 text-muted-foreground'>
        Phase 1 & 2 scaffold is in place. Use the modules below to start
        building data flows.
      </p>
      <div className='mt-6 flex flex-wrap gap-3'>
        <Link
          className='rounded-md bg-black px-4 py-2 text-white'
          href='/dashboard'
        >
          Go to Dashboard
        </Link>
        <Link className='rounded-md border px-4 py-2' href='/expenses'>
          Expenses
        </Link>
        <Link className='rounded-md border px-4 py-2' href='/income'>
          Income
        </Link>
        <Link className='rounded-md border px-4 py-2' href='/approvals'>
          Approvals
        </Link>
      </div>
    </div>
  );
}
