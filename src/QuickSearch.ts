import { Range, TextLine } from "vscode";
import { AQuickItem, QuickPickBase } from "./QuickBase";
import { search } from "./search";
import { pad } from "./utils";


class SearchItem extends AQuickItem {
  constructor(
    private readonly _line: TextLine,
    readonly range: Range,
  ) {
    super()
  }

  get label(): string {
    const lineNumber = pad(this._line.lineNumber.toString());
    const lineText = this._line.text.trim();

    return `${lineNumber}${lineText}`
  }
}

export class QuickSearch extends QuickPickBase<SearchItem> {

  protected _onDidChangeValue(searchStr: string): void {
    const results = search(this._editor.document, searchStr)
    const resultsBelow = results
      .filter(line => line.lineNumber >= this._editor.selection.start.line);
    const items = resultsBelow.map(item => new SearchItem(item, item.range));

    this._inner.items = items;
    this._inner.title = `${results.length - resultsBelow.length} results above`;
  }

}