import { TextDocument, TextLine } from "vscode";

export function search(document: TextDocument, searchString: string): TextLine[] {
  const out = [];
  const processedSearch = searchString.trim().toLowerCase();
  if (processedSearch.length <= 1) {
    return [];
  }

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);

    if (line.text.toLowerCase().includes(processedSearch)) {
      out.push(line)
    }
  }

  return out;
}