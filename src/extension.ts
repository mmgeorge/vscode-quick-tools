import { ExtensionContext, commands } from "vscode";
import { QuickOutline } from "./QuickOutline";
import { QuickSearch } from "./QuickSearch";

let outline: QuickOutline | undefined;

export function activate(context: ExtensionContext) {

  let disposables = [
    commands.registerCommand('quick-tools.search.searchDown', () => new QuickSearch()),
    commands.registerCommand('quick-tools.outline.search', () => createQuickOutline()),
    commands.registerCommand('quick-tools.outline.expand', () => outline?.setActiveItemExpandEnabled(true)),
    commands.registerCommand('quick-tools.outline.collapse', () => outline?.setActiveItemExpandEnabled(false)),
  ]

  context.subscriptions.push(...disposables);
}

async function createQuickOutline(): Promise<void> {
  outline = await QuickOutline.create()
}

export function deactivate() { }
