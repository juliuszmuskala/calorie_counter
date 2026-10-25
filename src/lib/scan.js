// Barcode detection: the browser's native BarcodeDetector where it exists, otherwise a zxing-wasm ponyfill loaded on demand.
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export async function createDetector() {
  if ('BarcodeDetector' in globalThis) {
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) return new BarcodeDetector({ formats });
    } catch {
      // fall through to the ponyfill
    }
  }
  const [{ BarcodeDetector: Ponyfill, setZXingModuleOverrides }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  // bundle the wasm with the app so scanning also works offline
  setZXingModuleOverrides({ locateFile: (path, prefix) => (path.endsWith('.wasm') ? new URL(wasmUrl, document.baseURI).href : prefix + path) });
  return new Ponyfill({ formats: FORMATS });
}
