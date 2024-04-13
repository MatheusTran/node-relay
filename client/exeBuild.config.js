module.exports = {
  file: "./dist/node-relay.cjs",
  icon: "./dist/node_relay.ico",
  name: "node-relay",
  description: "socket messaging platform",
  company: "Mat A Door",
  version: "2.3.0",
  copyright: "copyrighted",
  pkg: {
    targets: ["node16-win-x64"],
    outputPath: "dist/bin",
    assets: ["node_modules/**/*"]
  }
};