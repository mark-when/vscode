// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { MarkwhenTimelineEditorProvider } from './timelineEditor';
import "./semanticTokenProvider"
import { legend, provider } from './semanticTokenProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(MarkwhenTimelineEditorProvider.register(context))
  vscode.languages.registerDocumentSemanticTokensProvider(
    { language: "markwhen", scheme: "file" },
    provider,
    legend
  );
  
}

// this method is called when your extension is deactivated
export function deactivate() {}
