import { QuickPick, QuickPickItem, Range, Selection, TextEditor, commands, window } from "vscode";

const selectionStyle = window.createTextEditorDecorationType({
  border: "solid",
  borderWidth: "medium",
  borderColor: "red"
});

export abstract class AQuickItem implements QuickPickItem {
  abstract get label(): string;
  abstract get range(): Range;
}

export abstract class QuickPickBase<TQuickItem extends AQuickItem> {
  constructor() {
    if (!window.activeTextEditor) {
      throw new Error("Expected window.activeTextEditor to be defined")
    }

    this._editor = window.activeTextEditor;
    this._initialSelection = this._editor.selection;
    this._initialVisibleRanges = this._editor.visibleRanges

    this._inner = window.createQuickPick()
    this._inner.title = `Search for results below`;
    this._inner.matchOnDescription = false;
    this._inner.keepScrollPosition = true;

    // This is a proposal api
    (this._inner as any).sortByLabel = false;

    this._inner.onDidChangeActive(items => this._onDidChangeActive(items));
    this._inner.onDidAccept(() => this._onDidChangeAccept())
    this._inner.onDidChangeValue((value) => this._onDidChangeValue(value))
    this._inner.onDidHide(() => this._onDidHide());
    this._inner.show();

    commands.executeCommand("setContext", "inQuickTools", true);
  }

  private _didClickAccept: boolean = false;

  private readonly _initialSelection: Selection;
  private readonly _initialVisibleRanges: readonly Range[];

  protected readonly _inner: QuickPick<TQuickItem>;
  protected readonly _editor: TextEditor
  protected abstract _onDidChangeValue(searchStr: string): void;

  private _onDidHide(): void {
    if (!this._didClickAccept) {
      // If we entered hide from anything other than `accept`, restore 
      // the original cursor position
      this._editor.selection = this._initialSelection;
      this._editor.revealRange(this._initialVisibleRanges[0])
    }

    this._editor.setDecorations(selectionStyle, []);
    this._inner.dispose()

    commands.executeCommand("setContext", "inQuickTools", false);
  }

  private _onDidChangeActive(items: readonly TQuickItem[]): void {
    if (!items.length) {
      return;
    }

    const item = items[0];
    this._editor.setDecorations(selectionStyle, [item.range]);
    this._editor.revealRange(item.range);
  }

  private _onDidChangeAccept(): any {
    const item = this._inner.activeItems[0];
    if (!item) {
      return;
    }

    const range = item.range;

    this._editor.selection = new Selection(range.start, range.start);
    this._editor.revealRange(range);
    this._didClickAccept = true;
    this._inner.hide();
  }
}