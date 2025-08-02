// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import {
  MarkwhenTimelineEditorProvider,
  webviewPanels,
} from "./MarkwhenTimelineEditorProvider";
import "./semanticTokenProvider";
import { legend, provider } from "./semanticTokenProvider";

const command_preview = "markwhen.openPreview";
const command_viewInTimeline = "markwhen.viewInTimeline";

export function activate(context: vscode.ExtensionContext) {
  const { providerRegistration, editor } =
    MarkwhenTimelineEditorProvider.register(context);

  vscode.languages.registerDocumentSemanticTokensProvider(
    { language: "markwhen", scheme: "file" },
    provider,
    legend
  );

  vscode.languages.registerHoverProvider("markwhen", editor);
  vscode.languages.registerFoldingRangeProvider("markwhen", editor);

  const openPreview = async () => {
    const active = vscode.window.activeTextEditor;
    if (!active) {
      return;
    }

    return vscode.commands.executeCommand(
      "vscode.openWith",
      active.document.uri,
      "markwhen.timeline",
      vscode.ViewColumn.Beside
    );
  };

  async function openView(viewName: "timeline" | "calendar" | "oneview") {
    if (!webviewPanels.length) {
      await openPreview();
    }
    await editor.setView(viewName);
    editor.postState()
  }

  context.subscriptions.push(
    providerRegistration,
    vscode.commands.registerCommand(command_preview, openPreview),
    vscode.commands.registerCommand(command_viewInTimeline, async (arg) => {
      if (!webviewPanels.length) {
        await openPreview();
      }
      editor.viewInTimeline(arg);
    }),
    vscode.commands.registerCommand("markwhen.timelineView", async (arg) => {
      return openView("timeline")
    }),
    vscode.commands.registerCommand("markwhen.calendarView", async (arg) => {
      return openView('calendar')
    }),
    vscode.commands.registerCommand("markwhen.oneView", async (arg) => {
      return openView('oneview')
    })
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
