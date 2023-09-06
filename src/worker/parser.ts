const { parentPort } = require("worker_threads");

let mwParser: any;
const parser = async () => {
  if (!mwParser) {
    mwParser = await import("@markwhen/parser");
  }
  return mwParser;
};

parentPort.addListener(
  "message",
  async ({ id, payload }: { id: number; payload: any }) => {
    parentPort.postMessage({
      id,
      payload: (await parser()).parse(payload),
    });
  }
);
