import { Webview } from "vscode";
import { getNonce } from "./utilities/nonce";

interface Message {
  type: "hoverFromEditor" | "update";
  request?: boolean;
  response?: boolean;
  id: string;
  params?: any;
}

export const lpc = (webview: Webview, updateText: (text: string) => void) => {
  const calls: Map<string, (a: any, b?: any) => void> = new Map();

  const postRequest = (type: Message["type"], params: any) => {
    const id = getNonce();

    const callback = (resolve: any) => resolve;
    const result = new Promise(callback);
    calls.set(id, callback);
    post({
      type,
      request: true,
      id,
      params,
    });
    return result;
  };

  const postResponse = (type: Message["type"], id: string, params?: any) =>
    post({ type, response: true, id, params });

  const post = (message: Message) => webview.postMessage(message);

  const hoverFromEditor = (index: number) =>
    postRequest("hoverFromEditor", { index });

  const updateWebviewText = (text: string) => postRequest("update", { text });

  webview.onDidReceiveMessage((e) => {
    if (!e.id) {
      throw new Error("No id");
    }
    if (e.response) {
      calls.get(e.id)?.(e.response);
      calls.delete(e.id);
    } else if (e.request) {
      switch (e.type) {
        case "update":
          updateText(e.params.text);
          postResponse("update", e.id);
      }
    } else {
      throw new Error("Not a request or response");
    }
  });

  return { hoverFromEditor, updateWebviewText };
};
