"use client";

import type { ReactNode } from "react";

/**
 * A reusable table section for approval queues.
 */
export type ApprovalTableSectionProps<R> = {
  title: string;
  columns: string[];
  rows: R[];
  renderRow: (row: R) => ReactNode;
};

export default function ApprovalTableSection<R>({ title, columns, rows, renderRow }: ApprovalTableSectionProps<R>) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {columns.map((column) => (
                <th key={column} className="py-2">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows.map(renderRow)}</tbody>
        </table>
      </div>
    </div>
  );
}
