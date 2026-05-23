const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all monorepo packages so Metro can bundle them
config.watchFolders = [workspaceRoot];

// Resolve from both the app's node_modules and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Required for pnpm workspace symlinks (@workspace/api-client-react etc.)
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
