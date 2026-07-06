// ./lib/modem/registry.js
const modemRegistry = new Map();

export function registerModem(id, config) {
  modemRegistry.set(id, config);
}
export function getRegisteredModems() {
  return Array.from(modemRegistry.entries()).map(([id, modem]) => ({
    id, name: modem.name, controls: modem.controls
  }));
}
export function getModemDriver(id) {
  return modemRegistry.get(id);
}

