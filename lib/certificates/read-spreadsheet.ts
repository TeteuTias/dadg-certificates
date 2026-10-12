import ExcelJS from "exceljs";
function readCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0];
  const separator = first.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
    if (row.length > 50) throw new Error("Limite de 50 colunas.");
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
    if (rows.length > 5000) throw new Error("Limite de 5.000 linhas.");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === separator) pushCell();
    else if (!quoted && (c === "\n" || c === "\r")) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else cell += c;
  }
  if (quoted) throw new Error("CSV com aspas não fechadas.");
  if (cell || row.length) pushRow();
  return rows;
}
export async function readCertificateSheet(input: ArrayBuffer | string) {
  const bytes =
    typeof input === "string"
      ? Uint8Array.from(input, (c) => c.charCodeAt(0))
      : new Uint8Array(input);
  if (bytes.length > 5 * 1024 * 1024)
    throw new Error("A planilha deve ter até 5 MB.");
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf)
    throw new Error("Salve a planilha XLS como XLSX ou CSV antes de importar.");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    return readCsv(
      new TextDecoder("utf-8", { fatal: true })
        .decode(bytes)
        .replace(/^\uFEFF/, ""),
    );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  if (sheet.rowCount > 5000 || sheet.columnCount > 50)
    throw new Error("Limite de 5.000 linhas e 50 colunas.");
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values: string[] = [];
    for (let n = 1; n <= sheet.columnCount; n++) {
      const cell = row.getCell(n);
      values.push(
        cell.isMerged && Number(cell.master.col) !== n ? "" : cell.text || "",
      );
    }
    rows.push(values);
  });
  return rows;
}
