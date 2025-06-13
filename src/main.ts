import createParesr from "@/parsers";
import { ViewPlugin } from "@codemirror/view";
import { App, Plugin, PluginManifest } from "obsidian";

import "@style";

export default class TableEnginePlugin extends Plugin {
  LiveModeParser;

  ReadModeParser;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    const parser = createParesr(this);
    this.LiveModeParser = parser.LiveModeParser;
    this.ReadModeParser = parser.ReadModeParser;
  }

  async onload() {
    this.registerEditorExtension([ViewPlugin.fromClass(this.LiveModeParser)]);
    this.registerMarkdownPostProcessor(this.ReadModeParser.parseRawTables);
    this.registerMarkdownCodeBlockProcessor(
      "table",
      this.ReadModeParser.parseCodeBlock
    );

    const update = () => {
      this.ReadModeParser.grids = [];
      const eMode = this.LiveModeParser.getEMode();
      if (!eMode) return;
      const view = eMode.cm;
      if (view) setTimeout(() => this.LiveModeParser.render(view), 50);
    };

    this.registerEvent(this.app.workspace.on("file-open", update));
    this.app.workspace.onLayoutReady(update);

    this.addCommand({
      id: "rebuild",
      name: "rebuildCurrent",
      callback: this.LiveModeParser.getRebuildCommand(),
      hotkeys: [{ modifiers: [], key: "F5" }],
    });
  }
}
