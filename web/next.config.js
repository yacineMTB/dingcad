const webpack = require("webpack");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    viewTransition: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // manifold-3d's Emscripten loader conditionally imports node:module at runtime.
      // Webpack statically parses it, so we strip the node: prefix and provide a
      // browser-safe empty fallback.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        module: false,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};
module.exports = nextConfig;
