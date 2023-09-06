import * as vscode from "vscode";
import { parse } from "./useParserWorker";

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
enum RangeType {
  Comment = "comment",
  CheckboxItemIndicator = "checkboxItemIndicator",
  listItemIndicator = "listItemIndicator",
  ListItemContents = "listItemContents",
  Tag = "tag",
  tagDefinition = "tagDefinition",
  Title = "title",
  View = "view",
  Viewer = "viewer",
  Description = "description",
  Section = "section",
  DateRange = "dateRange",
  DateRangeColon = "dateRangeColon",
  Event = "event",
  Edit = "edit",
  Editor = "editor",
  Recurrence = "recurrence",
  FrontmatterDelimiter = "frontMatterDelimiter",
  HeaderKey = "headerKey",
  HeaderKeyColon = "headerKeyColon",
  HeaderValue = "headerValue"
}
export const legend = new vscode.SemanticTokensLegend(tokenTypes, []);

export const provider: vscode.DocumentSemanticTokensProvider = {
  async provideDocumentSemanticTokens(
    document: vscode.TextDocument
  ): Promise<vscode.SemanticTokens> {
    const tokensBuilder = new vscode.SemanticTokensBuilder(legend);

    const markwhen = await parse(document.getText());
    markwhen.timelines.forEach((timeline: any) => {
      timeline.ranges.forEach((range: any) => {
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
          case RangeType.Tag:
            tokensBuilder.push(vscodeRange, "property");
          case RangeType.Recurrence:
            tokensBuilder.push(vscodeRange, "class");
        }
      });
    });

    return tokensBuilder.build();
  },
};
