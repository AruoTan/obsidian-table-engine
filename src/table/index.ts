import { FootMgr } from "@/utils";
import { App, MarkdownRenderChild, MarkdownRenderer } from "obsidian";

class BasicSyntax {
  static readonly BORDER_RGX = /(?<!\\)\|/;
  static readonly HEADER_RGX = /^\s*?(:)?(?:-+)(:)?\s*/;

  static formatLine(line: string): string {
    return line.replace(/^.*?(?=(?<!\\)\|)/, "");
  }

  static findTable(rowSources: string[]): {
    contGrid?: ContGrid | undefined;
    remaining?: string[] | undefined;
  } {
    if (rowSources[0]?.startsWith("```"))
      return {
        remaining: rowSources,
      }; // exclude codeblock

    const findIndex = (arr: string[], isPipeStart: boolean): number =>
      arr.findIndex((i) => (isPipeStart ? /^\|/ : /^(?!\|)/).test(i));

    do {
      rowSources.splice(0, findIndex(rowSources, true));
      const index = findIndex(rowSources, false);
      if (index == -1) break;
      const contGrid = BasicSyntax.buildContGrid(rowSources.splice(0, index));
      if (contGrid)
        return {
          contGrid,
          remaining: rowSources,
        };
    } while (true);

    return {
      contGrid: BasicSyntax.buildContGrid(rowSources),
      remaining: [],
    };
  }

  static buildContGrid(sources: string[]): ContGrid | undefined {
    const contGrid = sources
      .filter((row) => row)
      .map((row) =>
        row
          .split(BasicSyntax.BORDER_RGX)
          .slice(1, -1)
          .map((cell) => cell.trim())
      );

    const headerRow = contGrid.findIndex((row) =>
      row.every((col) => BasicSyntax.HEADER_RGX.test(col))
    );

    if (contGrid[headerRow - 1] && contGrid[headerRow + 1]) {
      contGrid.splice(headerRow, 1);
      return contGrid;
    }
    return;
  }
}

export class TableSyntax extends BasicSyntax {
  static readonly SIGN_OF_MERGING_ROWS: string = "^";
  static readonly SIGN_OF_MERGING_COLS: string = "<";

  static readonly ID_OF_TABLE: string = "m-table";
  static readonly ID_OF_MERGED_CELL: string = "m-table-cell";

  static readonly ID_OF_T_CELL = "m-table-corner-top";
  static readonly ID_OF_B_CELL = "m-table-corner-bottom";

  static readonly ID_OF_TL_CELL = "m-table-corner-top-left";
  static readonly ID_OF_TR_CELL = "m-table-corner-top-right";
  static readonly ID_OF_BL_CELL = "m-table-corner-bottom-left";
  static readonly ID_OF_BR_CELL = "m-table-corner-bottom-right";

  static check(sign: string): boolean {
    return [
      TableSyntax.SIGN_OF_MERGING_ROWS,
      TableSyntax.SIGN_OF_MERGING_COLS,
    ].includes(sign);
  }

  static merge(cell: TableCell, cells: TableCell[]) {
    if (cell.el.id == TableSyntax.ID_OF_MERGED_CELL) return;

    let i = 1;
    let params:
      | {
          find: (obj: TableCell) => boolean;
          stop: string;
          type: "colSpan" | "rowSpan";
        }
      | undefined;

    if (cell.text == TableSyntax.SIGN_OF_MERGING_COLS && cell.col > 0) {
      params = {
        find: (obj) => obj.row == cell.row && obj.col == cell.col - i,
        stop: TableSyntax.SIGN_OF_MERGING_ROWS,
        type: "colSpan",
      };
    } else if (cell.text == TableSyntax.SIGN_OF_MERGING_ROWS && cell.row > 0) {
      params = {
        find: (obj) => obj.row == cell.row - i && obj.col == cell.col,
        stop: TableSyntax.SIGN_OF_MERGING_COLS,
        type: "rowSpan",
      };
    } else {
      return;
    }

    cell.el.id = TableSyntax.ID_OF_MERGED_CELL;
    cell.el.style.display = "none";

    let target: TableCell | undefined;
    let broke: boolean | undefined;

    do {
      target = cells.find(params.find);
      if (!target || target.text == params.stop) {
        broke = true;
        break;
      }
      i++;
    } while (target.el.id == TableSyntax.ID_OF_MERGED_CELL);
    if (broke || !target) return;

    const { el: cellEl } = target;
    if (!cellEl[params.type]) {
      Object.assign(cellEl, { [params.type]: 1 });
    }
    cellEl[params.type] += 1;

    return true;
  }

  static unmerge(domGrid: CellGrid, tgt: TableCell): boolean {
    const { row, col, el } = tgt;
    if (el.rowSpan > 1 || el.colSpan > 1) {
      domGrid
        .flat()
        .filter(
          (cell: TableCell) =>
            row <= cell.row &&
            cell.row < row + el.rowSpan &&
            col <= cell.col &&
            cell.col < col + el.colSpan
        )
        .map((cell: TableCell) => {
          cell.el.removeAttribute("id");
          cell.el.style.display = "table-cell";
        });
      el.colSpan = el.rowSpan = 1;

      const id = tgt.el.id;
      if (!id) return true;
      tgt.el.removeAttribute("id");
      const maxRowIndex = domGrid.length - 1;
      const maxColIndex = domGrid[0].length - 1;
      switch (id) {
        case TableSyntax.ID_OF_T_CELL:
          TableSyntax.setTLCornor(domGrid);
          TableSyntax.setTRCornor(domGrid, maxColIndex);
          break;
        case TableSyntax.ID_OF_B_CELL:
          TableSyntax.setBLCornor(domGrid, maxRowIndex);
          TableSyntax.setBRCornor(domGrid, maxRowIndex, maxColIndex);
          break;
        case TableSyntax.ID_OF_TL_CELL:
          TableSyntax.setTLCornor(domGrid);
          break;
        case TableSyntax.ID_OF_TR_CELL:
          TableSyntax.setTRCornor(domGrid, maxColIndex);
          break;
        case TableSyntax.ID_OF_BL_CELL:
          TableSyntax.setBLCornor(domGrid, maxRowIndex);
          break;
        case TableSyntax.ID_OF_BR_CELL:
          TableSyntax.setBRCornor(domGrid, maxRowIndex, maxColIndex);
          break;
      }

      return true;
    }
    return false;
  }

  static setCornor(domGrid: CellGrid): void {
    if (!domGrid || domGrid.length === 0 || domGrid[0].length === 0) return;
    const maxRowIndex = domGrid.length - 1;
    const maxColIndex = domGrid[0].length - 1;
    TableSyntax.setTLCornor(domGrid);
    TableSyntax.setBLCornor(domGrid, maxRowIndex);
    TableSyntax.setTRCornor(domGrid, maxColIndex);
    TableSyntax.setBRCornor(domGrid, maxRowIndex, maxColIndex);
  }

  static setTLCornor(domGrid: CellGrid) {
    domGrid[0][0].el.id = TableSyntax.ID_OF_TL_CELL;
  }

  static setBLCornor(domGrid: CellGrid, maxRowIndex: number) {
    domGrid[TableSyntax.findRowCell(domGrid, maxRowIndex, 0)][0].el.id =
      TableSyntax.ID_OF_BL_CELL;
  }

  static setTRCornor(domGrid: CellGrid, maxColIndex: number) {
    const cTRIndex = TableSyntax.findColCell(domGrid, 0, maxColIndex);
    if (domGrid[0][cTRIndex].el.id == TableSyntax.ID_OF_TL_CELL)
      domGrid[0][cTRIndex].el.id = TableSyntax.ID_OF_T_CELL;
    else domGrid[0][cTRIndex].el.id = TableSyntax.ID_OF_TR_CELL;
  }

  static setBRCornor(
    domGrid: CellGrid,
    maxRowIndex: number,
    maxColIndex: number
  ) {
    let rBRIndex = maxRowIndex;
    let cBRIndex = maxColIndex;
    switch (domGrid[maxRowIndex][maxColIndex].text) {
      case TableSyntax.SIGN_OF_MERGING_ROWS:
        rBRIndex = TableSyntax.findRowCell(domGrid, rBRIndex, cBRIndex);
        break;
      case TableSyntax.SIGN_OF_MERGING_COLS:
        cBRIndex = TableSyntax.findColCell(domGrid, rBRIndex, cBRIndex);
        break;
    }
    if (domGrid[rBRIndex][cBRIndex].el.id == TableSyntax.ID_OF_BL_CELL)
      domGrid[rBRIndex][cBRIndex].el.id = TableSyntax.ID_OF_B_CELL;
    else domGrid[rBRIndex][cBRIndex].el.id = TableSyntax.ID_OF_BR_CELL;
  }

  static findColCell(domGrid: CellGrid, row: number, col: number): number {
    while (domGrid[row][col].text == TableSyntax.SIGN_OF_MERGING_COLS) {
      col -= 1;
      if (col == 0) break;
    }
    return col;
  }

  static findRowCell(domGrid: CellGrid, row: number, col: number): number {
    while (domGrid[row][col].text == TableSyntax.SIGN_OF_MERGING_ROWS) {
      row -= 1;
      if (row == 0) break;
    }
    return row;
  }
}

export class LiveModeTable extends TableSyntax {
  static process(table: Table): void {
    const cells = table.rows.flat();
    for (const cell of cells) {
      LiveModeTable.merge(cell, cells);
    }
    LiveModeTable.setCornor(table.rows);
    LiveModeTable.focusWrapper(table);
  }

  static focusWrapper(table: Table): void {
    const origin = table.receiveCellFocus;

    table.receiveCellFocus = (
      row: number,
      col: number,
      func?: Function,
      flag?: boolean
    ): void => {
      if (table.rows[row]?.[col]?.el.style.display == "none") {
        const { cell } = table.editor.tableCell;
        const lastCell = table.rows.flat().pop() as TableCell;
        const { row: maxRow, col: maxCol } = lastCell;

        if (row === cell.row) {
          while (LiveModeTable.check(table.rows[row]?.[col]?.text)) {
            col += col < cell.col ? -1 : 1;
          }
          if (col < 0) {
            while (LiveModeTable.check(table.rows[row]?.[0].text)) row--;
          }
          if (col > maxCol) {
            col = 0;
            row++;
            if (row > maxRow) table.insertRow(row, col);
          }
        } else if (col === cell.col) {
          while (LiveModeTable.check(table.rows[row]?.[col]?.text)) {
            row += row < cell.row ? -1 : 1;
          }
          if (row < 0) {
            while (LiveModeTable.check(table.rows[0][col]?.text)) col--;
          }
        } else {
          if (row === cell.row - 1) {
            while (LiveModeTable.check(table.rows[row][col]?.text)) col--;
          }
          if (row === cell.row + 1) {
            while (LiveModeTable.check(table.rows[row][col]?.text)) col++;
          }
        }
      }

      origin.call(table, row, col, func, flag);
    };
  }
}

export class ReadModeTable extends TableSyntax {
  private app: App;
  private domGrid: CellGrid;

  renderChild: MarkdownRenderChild;

  constructor(app: App, el: HTMLTableElement, contGrid: ContGrid) {
    super();

    this.renderChild = new MarkdownRenderChild(el);
    el.id = TableSyntax.ID_OF_TABLE;

    this.app = app;
    this.domGrid = Array.from(el.rows).map((tr, rowIndex) => {
      return Array.from(tr.cells).map((td, colIndex) => ({
        el: td,
        row: rowIndex,
        col: colIndex,
        text: contGrid[rowIndex][colIndex],
      }));
    });

    this.proces(this.domGrid);
  }

  proces(domGrid: CellGrid) {
    const cells = domGrid.flat();

    for (const cell of cells) {
      const state = ReadModeTable.merge(cell, cells);
      if (!state) this.normalizeCell(cell);
    }

    ReadModeTable.setCornor(domGrid);
  }

  private normalizeCell({
    text,
    el,
  }: {
    text: string;
    el: HTMLTableCellElement;
  }): void {
    const footMgr = new FootMgr();
    text = text.replaceAll("<br>", "\n");
    text = footMgr.dummy(text);
    footMgr.retain(el);

    el.empty();

    MarkdownRenderer.render(
      this.app,
      text || "\u200B",
      el,
      "",
      this.renderChild
    ).then(() => this.afterRender(el, footMgr));
  }

  private afterRender(cellEl: HTMLElement, footMgr: FootMgr): void {
    footMgr.handleInline(cellEl);

    const isP = (el: Element): boolean => el.tagName == "P";

    [cellEl.firstChild, cellEl.lastChild].forEach((el) => {
      if (!el || !isP(el as Element)) return;

      if (!(el as Element).textContent && !(el as Element).children[0]) {
        el.remove();
      }
    });

    let html = "";

    for (const node of Array.from(cellEl.childNodes)) {
      if (node.nodeType === 3) {
        html += node.textContent === "\n" ? "<br><br>" : node.textContent;
      } else {
        html += isP(node as Element)
          ? (node as Element).innerHTML
          : (node as Element).outerHTML;
      }
    }

    html = footMgr.restore(html);
    cellEl.innerHTML = html;
  }
}
