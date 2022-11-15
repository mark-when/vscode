import * as vscode from "vscode";
import { lpc } from "./lpc";
import { getNonce } from "./utilities/nonce";

export let webviewPanels = [] as vscode.WebviewPanel[];
export let localProcedureCall: ReturnType<typeof lpc> | undefined;

const getPanel = () => {
  return webviewPanels[webviewPanels.length - 1];
};

export class MarkwhenTimelineEditorProvider
  implements vscode.CustomTextEditorProvider, vscode.HoverProvider
{
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

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const resp = await localProcedureCall?.hoverFromEditor(
      document.offsetAt(position)
    );
    if (!resp || !resp.params) {
      return null;
    }
    const viewInTimelineCommandUri = vscode.Uri.parse(
      `command:markwhen.viewInTimeline?${encodeURIComponent(
        JSON.stringify(resp.params)
      )}`
    );
    const view = new vscode.MarkdownString(
      `[View in timeline](${viewInTimelineCommandUri})`
    );
    // To enable command URIs in Markdown content, you must set the `isTrusted` flag.
    // When creating trusted Markdown string, make sure to properly sanitize all the
    // input content so that only expected command URIs can be executed
    view.isTrusted = true;

    const rangeFrom = document.positionAt(resp.params.range.from);
    const rangeTo = document.positionAt(resp.params.range.to);

    return new vscode.Hover(view, new vscode.Range(rangeFrom, rangeTo));
  }

  public viewInTimeline(...args: any[]) {
    const path = args[0].path;
    localProcedureCall?.scrollTo(path);
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanels.push(webviewPanel);

    getPanel().webview.options = {
      enableScripts: true,
    };
    getPanel().webview.html = this.getHtmlForWebview(webviewPanel.webview);

    const updateWebview = () => {
      localProcedureCall?.updateWebviewText(document.getText());
    };

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      }
    );

    getPanel().onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    const updateTextRequest = (text: string) => {
      this.setDocument(document, text);
    };

    localProcedureCall = lpc(getPanel().webview, updateTextRequest);
    updateWebview();
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "assets", "index.js")
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "assets", "index.css")
    );
    const nonce = getNonce();
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
