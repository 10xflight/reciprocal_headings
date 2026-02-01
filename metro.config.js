const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Remove .mjs from source extensions so Metro resolves CJS builds
// instead of ESM builds that use import.meta.env (unsupported by Metro).
config.resolver.sourceExts = config.resolver.sourceExts.filter(
  (ext) => ext !== 'mjs'
);

module.exports = config;
