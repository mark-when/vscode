import * as vscode from "vscode";
const tokenTypes = [
  "comment",
  "string",
  "function",
  "variable",
  "parameter",
  "property",
  "keyword",
  "type",
  "class",
];
export const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

export const provider: vscode.DocumentSemanticTokensProvider = {
  async provideDocumentSemanticTokens(
    document: vscode.TextDocument
  ): Promise<vscode.SemanticTokens> {
    const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
    const mwParser = await import("@markwhen/parser");
    const { RangeType } = await import("@markwhen/parser/Types");

    const markwhen = mwParser.parse(document.getText());
    markwhen.timelines.forEach((timeline) => {
      timeline.ranges.forEach((range) => {
        const from = document.positionAt(range.from);
        const to = document.positionAt(range.to);
        const vscodeRange = new vscode.Range(from, to);
        switch (range.type) {
          case RangeType.Comment:
            tokensBuilder.push(vscodeRange, "comment");
            break;
          case RangeType.DateRange:
            tokensBuilder.push(vscodeRange, "type");
            break;
          case RangeType.Description:
          case RangeType.Section:
          case RangeType.Title:
          case RangeType.View:
            tokensBuilder.push(vscodeRange, "keyword");
            break;
          case RangeType.Tag:
            tokensBuilder.push(vscodeRange, "property");
          case RangeType.Recurrence:
            tokensBuilder.push(vscodeRange, "class");
          default:
            tokensBuilder.push(vscodeRange, "string");
        }
      });
    });

    return tokensBuilder.build();
  },
};
