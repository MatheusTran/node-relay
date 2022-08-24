module.exports = {
  file: "./dist/node-relay.cjs",
  icon: "./dist/iconset.ico",
  name: "node-relay",
  description: "secure TCP connection to communicate in terminal",
  company: "magi-tech",
  version: "1.7.8",
  copyright: "copyrighted",
  pkg: {
    targets: ["node16-win-x64"],
    outputPath: "dist",
    assets: ["node_modules/**/*"]
  }
};