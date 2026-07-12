import { toast } from "sonner";

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
  toast.success("CSV downloaded");
}

export async function exportToExcel(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 30));
  XLSX.writeFile(wb, `${filename}.xlsx`);
  toast.success("Excel downloaded");
}

export async function exportToPdf(filename: string, title: string, headers: string[], rows: (string | number)[][]) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString(), 14, 21);
  autoTable(doc, { head: [headers], body: rows.map((r) => r.map((c) => String(c ?? ""))), startY: 25, styles: { fontSize: 8 }, headStyles: { fillColor: [59, 130, 246] } });
  doc.save(`${filename}.pdf`);
  toast.success("PDF downloaded");
}

export function printTable(title: string, headers: string[], rows: (string | number)[][]) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { toast.error("Popup blocked"); return; }
  const html = `<html><head><title>${title}</title><style>
    body{font-family:system-ui,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin:0 0 4px}.meta{color:#666;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    thead{background:#f3f4f6}tr:nth-child(even){background:#fafafa}
    @media print{@page{size:landscape}}
  </style></head><body>
  <h1>${title}</h1><div class="meta">Generated ${new Date().toLocaleString()}</div>
  <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${String(c ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
  </body></html>`;
  w.document.write(html); w.document.close();
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
