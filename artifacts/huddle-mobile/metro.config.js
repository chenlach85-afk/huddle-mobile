const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Force CJS build of supabase-js — its ESM has a bare import(OTEL_PKG)
// that Hermes bytecode compile cannot parse in production builds.
const supabasePkg = require.resolve("@supabase/supabase-js/package.json");
const supabaseCjs = path.resolve(path.dirname(supabasePkg), "dist/index.cjs");
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@supabase/supabase-js") {
    return { type: "sourceFile", filePath: supabaseCjs };
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
