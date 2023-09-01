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

  const previewHandler = () => {
    const active = vscode.window.activeTextEditor;
    if (!active) {
      return;
    }
    vscode.commands.executeCommand(
      "vscode.openWith",
      active.document.uri,
      "markwhen.timeline",
      vscode.ViewColumn.Beside
    );
  };

  context.subscriptions.push(
    providerRegistration,
    vscode.commands.registerCommand(command_preview, previewHandler),
    vscode.commands.registerCommand(command_viewInTimeline, async (arg) => {
      if (!webviewPanels.length) {
        const active = vscode.window.activeTextEditor;
        if (!active) {
          return;
        }
        await vscode.commands.executeCommand(
          "vscode.openWith",
          active.document.uri,
          "markwhen.timeline",
          vscode.ViewColumn.Beside
        );
      }
      editor.viewInTimeline(arg);
    })
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
