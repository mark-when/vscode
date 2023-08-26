import { getNonce } from "./utilities/nonce";
import { Webview } from "vscode";
import WebSocket, { WebSocketServer } from "ws";

export type ColorMap = Record<string, Record<string, string>>;
export type EventPath = number[];

export interface AppState {
  isDark?: boolean;
  hoveringPath?: EventPath;
  detailPath?: EventPath;
  colorMap: ColorMap;
}
export interface MarkwhenState {
  rawText?: string;
  parsed: any[];
  transformed?: any;
}
type DateRangeIso = { fromDateTimeIso: string; toDateTimeIso: string };
export interface MessageTypes {
  appState: AppState;
  markwhenState: MarkwhenState;
  setHoveringPath: EventPath;
  setDetailPath: EventPath;
  key: string;
  showInEditor: EventPath;
  newEvent: {
    dateRangeIso: DateRangeIso;
    granularity?: unknown;
    immediate: boolean;
  };
  editEventDateRange: {
    path: EventPath;
    range: DateRangeIso;
    scale: unknown;
    preferredInterpolationFormat: string | undefined;
  };
  jumpToPath: {
    path: EventPath;
  };
  jumpToRange: {
    dateRangeIso: { fromDateTimeIso: string; toDateTimeIso: string };
  };
}

export type MessageType<ViewSpecificMessageTypes> = keyof (MessageTypes &
  ViewSpecificMessageTypes);
export type MessageParam<VSMT, T extends MessageType<VSMT>> = (MessageTypes &
  VSMT)[T];

export interface Message<VSMT, T extends MessageType<VSMT>> {
  type: T;
  request?: boolean;
  response?: boolean;
  id: string;
  params?: MessageParam<VSMT, T>;
}

export type MessageListeners<VSMT> = {
  [Property in MessageType<VSMT>]?: (
    event: (MessageTypes & VSMT)[Property]
  ) => any;
};

export function useLpc<ViewSpecificMessageTypes = {}>(
  webview: Webview,
  listeners: MessageListeners<ViewSpecificMessageTypes>
) {
  const calls: Map<
    string,
    {
      resolve: (a: any) => void;
      reject: (a: any) => void;
    }
  > = new Map();

  const postRequest = <T extends MessageType<ViewSpecificMessageTypes>>(
    type: T,
    params: any
  ) => {
    const id = `markwhen_${getNonce()}`;
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

  const postResponse = <T extends MessageType<ViewSpecificMessageTypes>>(
    id: string,
    type: T,
    params: MessageParam<ViewSpecificMessageTypes, T>
  ) => post({ type, response: true, id, params });
  const post = <T extends MessageType<ViewSpecificMessageTypes>>(
    message: Message<ViewSpecificMessageTypes, T>
  ) => {
    webview.postMessage(message);
  };

  const messageListener = (e: any) => {
    if (!e.id) {
      return;
    }
    const { request, response, type, params } = e;
    if (response) {
      calls.get(e.id)?.resolve(e);
      calls.delete(e.id);
    } else if (request) {
      // @ts-ignore
      const result = listeners?.[type]?.(params!);
      Promise.resolve(result).then((resp) => {
        if (typeof resp !== "undefined") {
          postResponse(e.id, type, resp);
        }
      });
    } else {
      throw new Error("Not a request or response");
    }
  };
  webview.onDidReceiveMessage(messageListener);
  return { postRequest, post };
}
