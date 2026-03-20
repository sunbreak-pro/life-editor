export function notSupported(feature: string): never {
  throw new Error(`${feature} is not supported`);
}
