import path from "path";

import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const state = process.env.NODE_ENV;

export default {
  entry: "./src/main.ts",
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "commonjs",
  },
  mode: state === "production" ? "production" : "development",
  devtool: state === "production" ? false : "inline-source-map",
  watch: state === "production" ? false : true,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.(css|scss)$/,
        use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"],
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [new MiniCssExtractPlugin({ filename: "styles.css" })],
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@style": path.resolve(__dirname, "style"),
    },
  },
  externals: {
    obsidian: "commonjs2 obsidian",
    electron: "commonjs2 electron",
    "@codemirror/autocomplete": "commonjs2 @codemirror/autocomplete",
    "@codemirror/collab": "commonjs2 @codemirror/collab",
    "@codemirror/commands": "commonjs2 @codemirror/commands",
    "@codemirror/language": "commonjs2 @codemirror/language",
    "@codemirror/lint": "commonjs2 @codemirror/lint",
    "@codemirror/search": "commonjs2 @codemirror/search",
    "@codemirror/state": "commonjs2 @codemirror/state",
    "@codemirror/view": "commonjs2 @codemirror/view",
    "@lezer/common": "commonjs2 @lezer/common",
    "@lezer/highlight": "commonjs2 @lezer/highlight",
    "@lezer/lr": "commonjs2 @lezer/lr",
    // 添加 Node.js 内置模块
    fs: "commonjs2 fs",
    path: "commonjs2 path",
    os: "commonjs2 os",
    child_process: "commonjs2 child_process",
    crypto: "commonjs2 crypto",
    buffer: "commonjs2 buffer",
    stream: "commonjs2 stream",
    util: "commonjs2 util",
  },
};
