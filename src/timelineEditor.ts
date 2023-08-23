import { TextDecoder } from "util";
import vscode from "vscode";
import { lpc } from "./lpc";
import { parse as parseHtml } from "node-html-parser";

export let webviewPanels = [] as vscode.WebviewPanel[];
export let localProcedureCall: ReturnType<typeof lpc> | undefined;

const getPanel = () => {
  return webviewPanels[webviewPanels.length - 1];
};

export class MarkwhenTimelineEditorProvider
  implements
    vscode.CustomTextEditorProvider,
    vscode.HoverProvider,
    vscode.FoldingRangeProvider
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

  async provideFoldingRanges(
    document: vscode.TextDocument,
    context: vscode.FoldingContext,
    token: vscode.CancellationToken
  ): Promise<vscode.FoldingRange[]> {
    const mw = (await import("@markwhen/parser")).parse(document.getText());
    const ranges = [] as vscode.FoldingRange[];
    for (const timeline of mw.timelines) {
      const indices = Object.keys(timeline.foldables);
      for (const index of indices) {
        // @ts-ignore
        const foldable = timeline.foldables[index] as Foldable;
        ranges.push(
          new vscode.FoldingRange(
            foldable.startLine,
            document.positionAt(foldable.endIndex).line,
            foldable.type === "section"
              ? vscode.FoldingRangeKind.Region
              : vscode.FoldingRangeKind.Comment
          )
        );
      }
    }
    return ranges;
  }

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
    getPanel().webview.html = await this.getHtmlForWebview(
      webviewPanel.webview
    );

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

    const allowSource = async (src?: string) => {
      const alreadyAllowed =
        (this.context.globalState.get("allowedSources") as
          | string[]
          | undefined) || [];
      if (!src) {
        localProcedureCall?.allowedSources(alreadyAllowed);
      } else {
        const newSet = Array.from(new Set([src, ...alreadyAllowed]));
        await this.context.globalState.update("allowedSources", newSet);
        localProcedureCall?.allowedSources(newSet);
      }
    };

    const showInEditor = (location: number) => {
      const activeTextEditor = vscode.window.activeTextEditor;
      if (activeTextEditor) {
        const position = activeTextEditor.document.positionAt(location);
        activeTextEditor.selections = [
          new vscode.Selection(position, position),
        ];
      }
    };

    localProcedureCall = lpc(
      getPanel().webview,
      updateTextRequest,
      allowSource,
      showInEditor
    );
    updateWebview();
  }

  private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    // const scriptUri = webview.asWebviewUri(
    //   vscode.Uri.joinPath(this.context.extensionUri, "assets", "index.js")
    // );
    // const cssUri = webview.asWebviewUri(
    //   vscode.Uri.joinPath(this.context.extensionUri, "assets", "index.css")
    // );
    const p = vscode.Uri.joinPath(
      vscode.Uri.file(this.context.asAbsolutePath("assets/views/timeline.html"))
    );

    const uriPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "assets",
      "views",
      "timeline.html"
    );
    console.log("uriPath", uriPath);
    const baseAssetsPath = webview.asWebviewUri(uriPath);
    console.log("baseAssetsPath", baseAssetsPath);
    const a = await vscode.workspace.fs.readFile(p).then((v) => {
      const td = new TextDecoder();
      const s = td.decode(v);
      return s;
    });
    // console.log(a.substring(0, 200));
    // const nonce = getNonce();
    const html = injectScript(
      a,
      `var __markwhen_wss_url = "ws://localhost:7237";`
    );
    return html;
    // return `<!DOCTYPE html>
    // <html lang="en" style="height:100%; width: 100%">
    //   <head>
    //     <meta charset="UTF-8" />
    //     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    //     <title>Markwhen</title>
    // 		<link rel="" href="${baseAssetsPath}">
    //     <script nonce=${nonce}>var __baseAssetsPath = "${p.toString(
    //   true
    // )}"</script>
    //   </head>
    //   <body style="height:100%; width: 100%">
    //     <iframe style="border: 0; height: 100%; width: 100%; margin: 0, padding: 0" src="${baseAssetsPath}">
    //   </body>
    // </html>
    // `;
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

function injectScript(domString: string, jsToInject: string) {
  const html = parseHtml(domString);
  const script = `<script>${jsToInject}</script>`;
  const head = html.getElementsByTagName("head")[0];
  head.innerHTML = script + head.innerHTML;
  return html.toString();
}
