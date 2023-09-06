import { TextDecoder } from "util";
import vscode from "vscode";
import { AppState, useLpc } from "./lpc";
import { useColors } from "./utilities/colorMap";
import { parse } from "./useParserWorker";

export let webviewPanels = [] as vscode.WebviewPanel[];

const getPanel = () => {
  return webviewPanels[webviewPanels.length - 1];
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
  view: "timeline" | "calendar" = "timeline";

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
    const mw = await parse(document.getText());
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
    return null;
    // const resp = await this.lpc?.hoverFromEditor(
    //   document.offsetAt(position)
    // );
    // if (!resp || !resp.params) {
    //   return null;
    // }
    // const viewInTimelineCommandUri = vscode.Uri.parse(
    //   `command:markwhen.viewInTimeline?${encodeURIComponent(
    //     JSON.stringify(resp.params)
    //   )}`
    // );
    // const view = new vscode.MarkdownString(
    //   `[View in timeline](${viewInTimelineCommandUri})`
    // );
    // // To enable command URIs in Markdown content, you must set the `isTrusted` flag.
    // // When creating trusted Markdown string, make sure to properly sanitize all the
    // // input content so that only expected command URIs can be executed
    // view.isTrusted = true;

    // const rangeFrom = document.positionAt(resp.params.range.from);
    // const rangeTo = document.positionAt(resp.params.range.to);

    // return new vscode.Hover(view, new vscode.Range(rangeFrom, rangeTo));
  }

  public viewInTimeline(...args: any[]) {
    const path = args[0].path;
    this.lpc?.postRequest("jumpToPath", path);
  }

  public async setView(view: "timeline" | "calendar") {
    this.view = view;
    getPanel().webview.html = await this.getHtmlForWebview(this.view);

    // @ts-ignore
    this.lpc = await useLpc(getPanel().webview, {
      markwhenState: async (event) => {
        const rawText = this.document?.getText() || "";
        const parsed = await parse(rawText);
        return {
          rawText,
          parsed: parsed.timelines,
          transformed: parsed.timelines[0].events,
        };
      },
      appState: () => {
        this.lpc?.postRequest("appState", this.getAppState());
      },
    });
  }

  onDocumentChange(event: vscode.TextDocumentChangeEvent) {
    if (!this.document) {
      throw new Error("No document");
    }
    if (event.document.uri.toString() === this.document?.uri.toString()) {
      this.updateWebview();
    }
  }

  async parse() {
    const rawText = this.document?.getText() ?? "";
    // console.log(rawText)
    const parsed = await parse(rawText);
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
    this.postState();
  }

  async updateWebview() {
    await this.parse();
  }

  public postState() {
    this.lpc?.postRequest("markwhenState", this.parseResult?.markwhenState);
    this.lpc?.postRequest("appState", this.getAppState());
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

    await this.setView(this.view);

    vscode.window.onDidChangeActiveColorTheme((theme) => {
      this.lpc?.postRequest("appState", this.getAppState());
    });

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        this.onDocumentChange(event);
      }
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

  private async getHtmlForWebview(
    view: "timeline" | "calendar"
  ): Promise<string> {
    const p = vscode.Uri.joinPath(
      vscode.Uri.file(this.context.asAbsolutePath(`assets/views/${view}.html`))
    );
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
