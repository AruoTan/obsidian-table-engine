import { LiveModeTable, ReadModeTable } from "@/table";
import {
  MarkdownPostProcessorContext,
  MarkdownRenderer,
  Plugin,
} from "obsidian";

export default function createParesr(plugin: Plugin) {
  const app = plugin.app;

  class ReadModeParser {
    static grids: ContGrid[] = [];

    static async parseCodeBlock(
      source: string,
      el: HTMLElement,
      ctx: MarkdownPostProcessorContext
    ): Promise<void> {
      await MarkdownRenderer.render(app, source, el, "", plugin);

      const tEl = el.querySelector("table");
      if (!tEl) return;

      const grid = ReadModeTable.buildContGrid(source.split("\n"));
      if (grid) ctx.addChild(new ReadModeTable(app, tEl, grid).renderChild);
    }

    static parseRawTables(
      el: HTMLElement,
      ctx: MarkdownPostProcessorContext
    ): void {
      const prev: {
        callout?: any;
        t?: string;
        s?: number;
        ed?: number;
        r?: string[];
      } = {};

      if (!app.workspace.getActiveFileView()) return;
      if (el.hasClass("block-language-table")) return;

      const tableEls = Array.from(el.querySelectorAll("table"));
      if (!tableEls[0]) return;
      tableEls.map(async (tEl, tIndex) => {
        let grid;

        const sec = ctx.getSectionInfo(tEl);
        if (!sec) {
          await sleep(50);
          const callout = tEl.offsetParent;

          if (callout?.cmView) {
            // for source mode, assume table is in callout
            let rowSources;

            if (prev.callout === callout) {
              rowSources = prev.r;
            } else {
              const a1 = callout.cmView.widget.text;
              if (!a1) return; // table in Dataview

              rowSources = a1
                .split("\n")
                .map((line: string) => ReadModeTable.formatLine(line));
            }

            prev.callout = callout;
            if (rowSources)
              ({ contGrid: grid, remaining: prev.r } =
                ReadModeTable.findTable(rowSources));
          } else {
            grid = ReadModeParser.grids[tIndex]; // when export
            // if (grid && el.className == 'slides') return
          }
        }
        // reading mode
        else {
          const { text, lineStart, lineEnd } = sec;
          let rowSources;

          if (prev.t == text && prev.s == lineStart && prev.ed == lineEnd) {
            rowSources = prev.r; // continue old one
          } else {
            const a1 = text.split("\n").slice(lineStart, lineEnd + 1);
            rowSources = a1.map((line: string) =>
              ReadModeTable.formatLine(line)
            ); // get new one
          }

          prev.t = text;
          prev.s = lineStart;
          prev.ed = lineEnd;

          if (rowSources) {
            ({ contGrid: grid, remaining: prev.r } =
              ReadModeTable.findTable(rowSources));
            if (grid) ReadModeParser.grids.push(grid);
          }
        }

        if (grid) ctx.addChild(new ReadModeTable(app, tEl, grid).renderChild);
      });
    }
  }

  class LiveModeParser {
    update(update: any): void {
      const eMode = LiveModeParser.getEMode();
      if (!eMode) return;

      const { tableCell } = eMode; // when cursor in a table you can get tableCell
      const undo = update.transactions.find((tr: any) =>
        tr.isUserEvent("undo")
      );

      // table.render() is an Ob prototype, you can use table.rebuildTable() too
      if (undo && tableCell) {
        tableCell.table.render();
        LiveModeTable.process(tableCell.table);
      }

      const { view } = update;
      if ((update.focusChanged && view.hasFocus) || update.viewportChanged) {
        setTimeout(() => LiveModeParser.render(view));
      }
    }

    static getRebuildCommand() {
      return async () => {
        ReadModeParser.grids = [];

        const eMode = LiveModeParser.getEMode();
        if (!eMode) return;

        const { tableCell } = eMode;
        if (tableCell) {
          const checking = LiveModeTable.unmerge(
            tableCell.table.rows,
            tableCell.cell
          );
          if (!checking) LiveModeTable.process(tableCell.table);
        } else {
          const leaves = app.workspace
            .getLeavesOfType("markdown")
            .filter((leaf) => leaf.view.path == eMode.path);

          for (const leaf of leaves) await leaf.rebuildView();
        }
      };
    }

    static getEMode = () => app.workspace.getActiveFileView()?.editMode;

    static render(view: any) {
      view.docView.children
        .flatMap((c: any) =>
          c.dom.className.includes("table-widget") ? c.widget : []
        )
        .map(LiveModeTable.process);
    }
  }

  return { LiveModeParser, ReadModeParser };
}
