import log from "../logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerFn = (...args: any[]) => any;

export function loggedHandler(
  domain: string,
  name: string,
  fn: HandlerFn,
): HandlerFn {
  return (...args) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((e: unknown) => {
          log.error(`[${domain}] ${name} failed:`, e);
          throw e;
        });
      }
      return result;
    } catch (e) {
      log.error(`[${domain}] ${name} failed:`, e);
      throw e;
    }
  };
}
