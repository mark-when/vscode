import * as vscode from "vscode";
import { MarkwhenTimelineEditorProvider } from "./timelineEditor";
export class Hover implements vscode.HoverProvider {
  editor: MarkwhenTimelineEditorProvider;

  constructor(editor: MarkwhenTimelineEditorProvider) {
    this.editor = editor;
  }

  provideHover(
    _document: vscode.TextDocument,
    _position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const commentCommandUri = vscode.Uri.parse(
      `command:editor.action.addCommentLine`
    );
    const contents = new vscode.MarkdownString(
      `[Add comment](${commentCommandUri})`
    );

    // To enable command URIs in Markdown content, you must set the `isTrusted` flag.
    // When creating trusted Markdown string, make sure to properly sanitize all the
    // input content so that only expected command URIs can be executed
    contents.isTrusted = true;

    return new vscode.Hover(contents);
  }
}
