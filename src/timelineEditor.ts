import * as vscode from "vscode";
import { lpc } from "./lpc";

export class MarkwhenTimelineEditorProvider
  implements vscode.CustomTextEditorProvider, vscode.HoverProvider
{
  webviewPanel?: vscode.WebviewPanel;
  lpc?: ReturnType<typeof lpc>;

  public static register(context: vscode.ExtensionContext): {
    providerRegistration: vscode.Disposable;
    editor: MarkwhenTimelineEditorProvider;
  } {
    const provider = new MarkwhenTimelineEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      MarkwhenTimelineEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    );
    return { providerRegistration, editor: provider };
  }

  private static readonly viewType = "markwhen.timeline";

  constructor(private readonly context: vscode.ExtensionContext) {}

  provideHover(
    _document: vscode.TextDocument,
    _position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const commentCommandUri = vscode.Uri.parse(
      `command:editor.action.addCommentLine`
    );
    const contents = new vscode.MarkdownString(
      `[Add comment ${_position}](${commentCommandUri})`
    );

    // To enable command URIs in Markdown content, you must set the `isTrusted` flag.
    // When creating trusted Markdown string, make sure to properly sanitize all the
    // input content so that only expected command URIs can be executed
    contents.isTrusted = true;

    return new vscode.Hover(contents);
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    this.webviewPanel = webviewPanel;

    this.webviewPanel.webview.options = {
      enableScripts: true,
    };
    this.webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview
    );

    const updateWebview = () => {
      this.lpc?.updateWebviewText(document.getText());
    };

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      }
    );

    this.webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    const updateTextRequest = (text: string) => {
      this.setDocument(document, text);
    };

    this.lpc = lpc(this.webviewPanel.webview, updateTextRequest);
    updateWebview();
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "assets", "index.js")
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "assets", "index.css")
    );

    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Markwhen</title>
				<meta 
          http-equiv="Content-Security-Policy" 
          content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
        >

        <script type="module" crossorigin src="${scriptUri}" nonce="${nonce}"></script>
        <link rel="stylesheet" href="${cssUri}">
      </head>
      <body>
        <div id="app" style="height: 100%"></div>
      </body>
    </html>
    `;
  }

  private setDocument(document: vscode.TextDocument, timelineString: string) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      timelineString
    );
    return vscode.workspace.applyEdit(edit);
  }
}
