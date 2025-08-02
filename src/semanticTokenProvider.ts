import * as vscode from "vscode";
import { parse } from "./useParserWorker";
import { RangeType } from "@markwhen/parser";

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

    const markwhen = await parse(document.getText());
    markwhen.ranges.forEach((range: any) => {
      const from = document.positionAt(range.from);
      const to = document.positionAt(range.to);
      const vscodeRange = new vscode.Range(from, to);
      switch (range.type) {
        case RangeType.listItemIndicator:
        case RangeType.CheckboxItemIndicator:
          tokensBuilder.push(vscodeRange, "variable");
          break;
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
        case RangeType.PropertyKey:
          tokensBuilder.push(vscodeRange, "parameter");
          break;
        case RangeType.Tag:
        case RangeType.PropertyValue:
          tokensBuilder.push(vscodeRange, "string");
        case RangeType.Recurrence:
          tokensBuilder.push(vscodeRange, "class");
      }
    });

    return tokensBuilder.build();
  },
};
