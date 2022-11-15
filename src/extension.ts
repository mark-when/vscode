// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { MarkwhenTimelineEditorProvider } from "./timelineEditor";
import "./semanticTokenProvider";
import { legend, provider } from "./semanticTokenProvider";
import { Hover } from "./hover";

const command_preview = "markwhen.openPreview";

export function activate(context: vscode.ExtensionContext) {
  const { providerRegistration, editor } =
    MarkwhenTimelineEditorProvider.register(context);

  vscode.languages.registerDocumentSemanticTokensProvider(
    { language: "markwhen", scheme: "file" },
    provider,
    legend
  );

  vscode.languages.registerHoverProvider("markwhen", editor);

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
    vscode.commands.registerCommand(command_preview, previewHandler)
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
