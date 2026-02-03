import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Column {
  header: string;
  dataKey: string;
}

interface PdfOptions {
  title: string;
  columns: Column[];
  data: Record<string, unknown>[];
  fileName?: string;
}

export function generatePdf({
  title,
  columns,
  data,
  fileName = 'report.pdf',
}: PdfOptions) {
  const doc = new jsPDF();

  doc.text(title, 14, 15);

  autoTable(doc, {
    startY: 20,
    head: [columns.map((col) => col.header)],
    body: data.map((row) => columns.map((col) => String(row[col.dataKey] ?? ''))),
  });

  doc.save(fileName);
}
