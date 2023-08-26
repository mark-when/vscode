import { TextDecoder } from "util";
import vscode from "vscode";
import { AppState, MessageListeners, useLpc } from "./lpc";
import { Server } from "http";
import { useColors } from "./utilities/colorMap";

export let webviewPanels = [] as vscode.WebviewPanel[];

const getPanel = () => {
  return webviewPanels[webviewPanels.length - 1];
};

let cachedParser: any;
const mwParser = async () => {
  if (cachedParser) {
    return cachedParser;
  }
  cachedParser = await import("@markwhen/parser");
  return cachedParser;
};

export class MarkwhenTimelineEditorProvider
  implements
    vscode.CustomTextEditorProvider,
    vscode.HoverProvider,
    vscode.FoldingRangeProvider
{
  document?: vscode.TextDocument;
  lpc?: ReturnType<typeof useLpc>;
  parseResult?: {
    markwhenState: {
      rawText: string;
      parsed: any[];
      transformed: any;
    };
    appState: {
      colorMap: Record<string, Record<string, string>>;
    };
  };

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
    const mw = (await mwParser()).parse(document.getText());
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
    const resp = null; //await localProcedureCall?.hoverFromEditor(
    //document.offsetAt(position)
    //);
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
    this.lpc?.postRequest("jumpToPath", path);
  }

  onDocumentChange(event: vscode.TextDocumentChangeEvent) {
    if (event.document.uri.toString() === this.document?.uri.toString()) {
      this.updateWebview();
    }
  }

  async parse() {
    const parser = await mwParser();
    const rawText = this.document?.getText() ?? "";
    const parsed = parser.parse(rawText);
    this.parseResult = {
      markwhenState: {
        rawText,
        parsed: parsed.timelines,
        transformed: parsed.timelines[0].events,
      },
      appState: {
        colorMap: useColors(parsed.timelines[0]),
      },
    };
    this.lpc?.postRequest("markwhenState", this.parseResult?.markwhenState);
    this.lpc?.postRequest("appState", this.getAppState());
  }

  async updateWebview() {
    await this.parse();
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    this.document = document;
    webviewPanels.push(webviewPanel);

    getPanel().webview.options = {
      enableScripts: true,
    };
    getPanel().webview.html = await this.getHtmlForWebview(
      webviewPanel.webview
    );

    vscode.window.onDidChangeActiveColorTheme((theme) => {
      this.lpc?.postRequest("appState", this.getAppState());
    });

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      this.onDocumentChange
    );

    const updateTextRequest = (text: string) => {
      this.setDocument(document, text);
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

    getPanel().onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    this.updateWebview();
  }

  getAppState(): AppState {
    const isDark =
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    return {
      isDark,
      hoveringPath: undefined,
      detailPath: undefined,
      colorMap: this.parseResult?.appState.colorMap ?? {},
    };
  }

  appState() {
    this.lpc?.postRequest("appState", this.getAppState());
  }

  async markwhenState() {
    const parser = await mwParser();
    const rawText = this.document?.getText();
    // (await import("@markwhen/parser")).parse(rawText).timelines[0]
    const parsed = parser.parse(rawText);
    // const transformed = parsed;
    return {
      rawText,
      parsed: parsed.timelines,
      transformed: parsed.timelines[0].events,
    };
  }

  private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    // const scriptUri = webview.asWebviewUri(
    //   vscode.Uri.joinPath(this.context.extensionUri, "assets", "index.js")
    // );
    // const cssUri = webview.asWebviewUri(
    //   vscode.Uri.joinPath(this.context.extensionUri, "assets", "index.css")
    // );
    // const websocket = await this.getWebsocket()
    this.lpc = await useLpc(webview, this);
    const p = vscode.Uri.joinPath(
      vscode.Uri.file(this.context.asAbsolutePath("assets/views/timeline.html"))
    );

    // const uriPath = vscode.Uri.joinPath(
    //   this.context.extensionUri,
    //   "assets",
    //   "views",
    //   "timeline.html"
    // );
    return vscode.workspace.fs.readFile(p).then((v) => {
      const td = new TextDecoder();
      const s = td.decode(v);
      return s;
    });
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
