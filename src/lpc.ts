import { Webview } from "vscode";
import { getNonce } from "./utilities/nonce";

interface Message {
  type: "hoverFromEditor" | "update" | "scrollTo" | "canUseSource";
  request?: boolean;
  response?: boolean;
  id: string;
  params?: unknown;
}

interface KnownMessage<Params> extends Message {
  params?: Params;
}

type HoverResponse = KnownMessage<{
  range: {
    from: number;
    to: number;
  };
  path: any;
}>;

export const lpc = (
  webview: Webview,
  updateText: (text: string) => void,
  allowedSource: (src: string) => void
) => {
  const calls: Map<
    string,
    {
      resolve: (a: any) => void;
      reject: (a: any) => void;
    }
  > = new Map();

  const postRequest = <T>(type: KnownMessage<T>["type"], params: any) => {
    const id = getNonce();
    return new Promise<T>((resolve, reject) => {
      calls.set(id, { resolve, reject });
      post({
        type,
        request: true,
        id,
        params,
      });
    });
  };

  const postResponse = (type: Message["type"], id: string, params?: any) =>
    post({ type, response: true, id, params });

  const post = (message: Message) => webview.postMessage(message);

  webview.onDidReceiveMessage((e) => {
    if (!e.id) {
      throw new Error("No id");
    }
    if (e.response) {
      calls.get(e.id)?.resolve(e);
      calls.delete(e.id);
    } else if (e.request) {
      switch (e.type as Message["type"]) {
        case "update":
          updateText(e.params.text);
          postResponse("update", e.id);
          break;
        case "canUseSource":
          allowedSource(e.params.source);
          break;
      }
    } else {
      throw new Error("Not a request or response");
    }
  });

  const hoverFromEditor = (index: number) =>
    postRequest<HoverResponse>("hoverFromEditor", { index });

  const updateWebviewText = (text: string) => postRequest("update", { text });

  const scrollTo = (path: any) => postRequest("scrollTo", { path });
  const allowedSources = (sources: string[]) =>
    postRequest("canUseSource", { sources });

  return { hoverFromEditor, updateWebviewText, scrollTo, allowedSources };
};
