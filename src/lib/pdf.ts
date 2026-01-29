import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Column {
  header: string;
  dataKey: string;
}

interface PdfOptions {
  title: string;
  columns: Column[];
  data: any[];
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

  (doc as any).autoTable({
    startY: 20,
    head: [columns.map((col) => col.header)],
    body: data.map((row) => columns.map((col) => row[col.dataKey])),
  });

  doc.save(fileName);
}
