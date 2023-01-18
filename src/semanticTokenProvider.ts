import * as vscode from "vscode";
import { parse } from "@markwhen/parser";
import { RangeType } from "@markwhen/parser/lib/Types";

const tokenTypes = [
  "comment",
  "string",
  "function",
  "variable",
  "parameter",
  "property",
  "keyword",
  "type",
  "class"
];
export const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

export const provider: vscode.DocumentSemanticTokensProvider = {
  provideDocumentSemanticTokens(
    document: vscode.TextDocument
  ): vscode.ProviderResult<vscode.SemanticTokens> {
    const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
    const markwhen = parse(document.getText());
    markwhen.timelines.forEach((timeline) => {
      timeline.ranges.forEach((range) => {
        const vscodeRange = new vscode.Range(
          range.lineFrom.line,
          range.lineFrom.index,
          range.lineTo.line,
          range.lineTo.index
        );
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
            tokensBuilder.push(vscodeRange, "class")
          default:
            tokensBuilder.push(vscodeRange, "string")
        }
      });
    });

    return tokensBuilder.build();
  },
};
