import { join } from "path";
import { Worker } from "worker_threads";

let callId = 0;
const parserWorker = new Worker(join(__dirname, "./worker/parser.js"));
const calls = new Map<
  number,
  {
    resolve: (a: any) => void;
    reject: (a: any) => void;
  }
>();

parserWorker.addListener("message", ({ id, payload }) => {
  calls.get(id)?.resolve(payload);
});

export const parse = async (text: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const id = callId++;
    calls.set(id, {
      resolve,
      reject,
    });
    parserWorker.postMessage({ id, payload: text });
  });
};
