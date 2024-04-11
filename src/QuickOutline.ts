import { Position, Range, SymbolInformation, SymbolKind, TextDocument, commands, window } from "vscode";
import { AQuickItem, QuickPickBase } from "./QuickBase";
import { createFallbackDescription, iconForKind } from "./symbolUtils";
import { pad } from "./utils";

export class QuickOutlineItem extends AQuickItem {
  static tryCreate(
    symbol: SymbolInformation,
    document: TextDocument,
    depth = 0,
    parent: QuickOutlineItem | null = null
  ): QuickOutlineItem | null {
    // Drop any symbols that are labeled "callbacks" & not at the top level
    if (symbol.kind === SymbolKind.Function && symbol.name.includes("callback") && depth !== 0) {
      return null;
    }

    if (
      depth !== 0 && (
        symbol.kind === SymbolKind.Constant ||
        symbol.kind === SymbolKind.Variable ||
        symbol.kind === SymbolKind.Object)
    ) {
      return null;
    }

    return new QuickOutlineItem(symbol, document, depth, parent);
  }

  private constructor(
    private readonly _symbol: SymbolInformation,
    private _document: TextDocument,
    private readonly _depth: number,
    readonly parent: QuickOutlineItem | null) {
    super()

    const detail = "detail" in this._symbol &&
      typeof this._symbol["detail"] === "string" &&
      this._symbol.detail.length > 0 ? this._symbol.detail : null;

    this._description = detail ?? createFallbackDescription(this._symbol, this._document);

    if ("children" in _symbol) {
      const children = (_symbol.children as any as SymbolInformation[]) || [];
      children.sort((a, b) => a.location.range.start.line - b.location.range.start.line);

      this.children = children
        .map(child => QuickOutlineItem.tryCreate(child, this._document, this._depth + 1, this))
        .filter(item => item !== null) as QuickOutlineItem[];
    }
  }

  static forEachParent(item: QuickOutlineItem, callback: (parent: QuickOutlineItem) => void): void {
    if (!item) {
      throw new Error("Tried to call forEachParent on null item");
    }

    let parent = item.parent;

    while (parent !== null) {
      callback(parent);
      parent = parent.parent;
    }
  }

  readonly _description: string;
  readonly children: readonly QuickOutlineItem[] = [];

  expanded: boolean = true;
  inSearchMode: boolean = false;

  get symbolKind(): SymbolKind {
    return this._symbol.kind;
  }

  get label(): string {
    const lineNumber = pad(this._symbol.location.range.start.line.toString());
    // Only include pathing if we are in the outline view
    const depthPadding = this.inSearchMode ?
      "" :
      "".padEnd(this._depth * 4, " ");;

    return `${lineNumber} ${depthPadding} ${iconForKind(this._symbol.kind)} ${this._symbol.name}`;
  }

  get description(): string {
    if (this.parent && this.inSearchMode) {
      return `[${this.parent?._symbol.name}] ` + this._description;
    }

    return this._description
  }

  get range(): Range {
    const document = this._document;
    const startOffset = document.offsetAt(this._symbol.location.range.start);
    const tokenOffset = document.getText(this._symbol.location.range)
      .indexOf(this._symbol.name) + startOffset;
    const tokenPosition = document.positionAt(tokenOffset);
    const newPosition = tokenPosition.translate({ characterDelta: 1 });
    const tokenRange = document.getWordRangeAtPosition(newPosition);
    const end = new Position(tokenPosition.line, tokenPosition.character + 4);

    return tokenRange ?? new Range(tokenPosition, end);
  }

  expandAll(): void {
    this.expanded = true;

    for (const child of this.children) {
      child.collapseAll();
    }
  }

  collapseAll(): void {
    this.expanded = false;

    for (const child of this.children) {
      child.collapseAll();
    }
  }
}

export class QuickOutline extends QuickPickBase<QuickOutlineItem> {

  static LastSearch: string = "";

  static async create(): Promise<QuickOutline> {
    const document = window.activeTextEditor?.document;
    if (!document) {
      throw new Error("Quick outline must have a text document");
    }

    const command = "vscode.executeDocumentSymbolProvider";
    const symbols = await commands.executeCommand<SymbolInformation[]>(command, document.uri);

    return new QuickOutline(document, symbols);
  }

  private constructor(document: TextDocument, symbols: SymbolInformation[]) {
    super();

    this._inner.value = QuickOutline.LastSearch;
    this._items = symbols
      .map(symbol => QuickOutlineItem.tryCreate(symbol, document))
      .filter(x => x) as QuickOutlineItem[]

    this._update()
  }

  private _items: QuickOutlineItem[];
  private _filter = new Set<SymbolKind>();

  protected _onDidChangeValue(searchStr: string): void {
    if (searchStr === "f ") {
      this._filter.clear()
      this._filter.add(SymbolKind.Method)
      this._filter.add(SymbolKind.Function)
      this._inner.value = ""
    }
    else if (searchStr === "t ") {
      this._filter.clear()
      this._filter.add(SymbolKind.Enum);
      this._filter.add(SymbolKind.EnumMember);
      this._filter.add(SymbolKind.Struct);
      this._filter.add(SymbolKind.Class);
      this._filter.add(SymbolKind.Interface);
      this._filter.add(SymbolKind.TypeParameter);
      this._inner.value = ""
    }
    else if (searchStr === "p ") {
      this._filter.clear()
      this._filter.add(SymbolKind.EnumMember);
      this._filter.add(SymbolKind.Property);
      this._filter.add(SymbolKind.TypeParameter);
      this._inner.value = ""
    }
    else if (searchStr === "  ") {
      this._filter.clear()
      this._inner.value = ""
    }

    QuickOutline.LastSearch = searchStr;

    for (const item of this._items) {
      item.expandAll();
    }

    this._update()
  }

  setActiveItemExpandEnabled(expanded: boolean): void {
    let item = this._inner.activeItems[0];
    let activeItem = item;
    if (!item) {
      return;
    }

    // When collapsing, collapse the entire group up to the parent
    // TODO: Make configurable or as a separate command?
    if (!expanded) {
      // Go up
      if (item.parent !== null) {
        item = item.parent;
        activeItem = item;
      }
      else {
        // No parent? Try to go back to the root previous
        const index = this._items.indexOf(item);
        const prev = this._items[index - 1];
        if (prev) {
          activeItem = prev;
        }
      }
    }
    // Otherwise if we are expanding
    else if (expanded) {
      // Jump to the first child
      if (item.children.length) {
        activeItem = item.children[0];
      }
      // If we have no children, instead move to the next item
      else {
        const index = this._inner.items.indexOf(item);
        const next = this._inner.items[index + 1];
        if (next) {
          activeItem = next;
        }
      }
    }

    if (!item) {
      return;
    }

    item.expanded = expanded;

    // If we are collapsing an item, also collapse any children
    if (!expanded) {
      item.collapseAll()
    }
    console.log("call updates")

    this._update(activeItem);
  }

  private _update(activeItem?: QuickOutlineItem): void {
    let items = this._extractExpandedItems(this._items);
    if (this._filter.size) {
      items = items.filter(item => this._filter.has(item.symbolKind))
    }

    for (const item of items) {
      item.inSearchMode = !!QuickOutline.LastSearch || !!this._filter.size;
    }

    this._inner.items = items;

    if (activeItem) {
      if (!this._inner.items.find(item => item === activeItem)) {
        console.error("ERROR: QuickOutline: Tried to set an active item that does not exist.")
      }
      else {
        console.log("updating active items")
        this._inner.activeItems = [activeItem];
      }
    }
  }

  private _extractExpandedItems(
    items: readonly QuickOutlineItem[],
    out: QuickOutlineItem[] = []
  ): QuickOutlineItem[] {
    for (const item of items) {
      out.push(item);

      if (item.expanded) {
        this._extractExpandedItems(item.children, out);
      }
    }

    return out;
  }
}