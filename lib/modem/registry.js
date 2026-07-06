// ./lib/modem/registry.js
const modemRegistry = new Map();

export function registerModem(id, config) {
  modemRegistry.set(id, config);
}
//export function getRegisteredModems() {
//  return Array.from(modemRegistry.entries()).map(([id, modem]) => ({
//    id, name: modem.name, controls: modem.controls
//  }));
//}
export function getRegisteredModems() {
  return Array.from(modemRegistry.entries()).map(([id, modem]) => ({
    id,
    name: modem.name,
    controls: modem.controls,
    // 🌟 THE FIX: Explicitly expose the feedback schema to the frontend array loop
    feedbackMetadata: modem.feedbackMetadata || [] 
  }));
}
export function getModemDriver(id) {
  return modemRegistry.get(id);
}

