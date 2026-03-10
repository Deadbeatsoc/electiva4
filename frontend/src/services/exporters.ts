interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

interface ExportTableOptions<T> {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function downloadBlob(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel<T>(options: ExportTableOptions<T>) {
  const headerHtml = options.columns
    .map((column) => `<th>${escapeHtml(column.header)}</th>`)
    .join('');

  const rowsHtml = options.rows
    .map((row) => {
      const cells = options.columns
        .map((column) => {
          const raw = normalizeValue(column.value(row));
          return `<td>${escapeHtml(raw)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const excelHtml = `
    <html>
      <head>
        <meta charset="UTF-8" />
      </head>
      <body>
        <h1>${escapeHtml(options.title)}</h1>
        ${options.subtitle ? `<p>${escapeHtml(options.subtitle)}</p>` : ''}
        <table border="1" cellspacing="0" cellpadding="4">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
  `;

  downloadBlob(
    excelHtml,
    'application/vnd.ms-excel;charset=utf-8;',
    `${options.filename}.xls`
  );
}

export function exportToPdf<T>(options: ExportTableOptions<T>) {
  const printWindow = window.open('', '_blank', 'width=1280,height=900');
  if (!printWindow) {
    throw new Error('No se pudo abrir la ventana de impresion');
  }

  const headerHtml = options.columns
    .map(
      (column) =>
        `<th style="border:1px solid #d1d5db;padding:8px;background:#f3f4f6;text-align:left;">${escapeHtml(
          column.header
        )}</th>`
    )
    .join('');

  const rowsHtml = options.rows
    .map((row) => {
      const cells = options.columns
        .map((column) => {
          const raw = normalizeValue(column.value(row));
          return `<td style="border:1px solid #e5e7eb;padding:8px;">${escapeHtml(raw)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  printWindow.document.write(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(options.title)}</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 24px; color: #111827;">
        <h1 style="margin: 0 0 8px 0;">${escapeHtml(options.title)}</h1>
        ${options.subtitle ? `<p style="margin: 0 0 16px 0;">${escapeHtml(options.subtitle)}</p>` : ''}
        <table style="width:100%; border-collapse: collapse; font-size: 12px;">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
