import { EditorView } from "@codemirror/view";
import "obsidian";

declare module "obsidian" {
  interface App {
    workspace: Workspace;
  }

  interface Workspace {
    getActiveFileView(): MarkdownView | null;
    getLeavesOfType(type: string): any[];
    on(name: string, callback: (...args: any[]) => any): EventRef;
    onLayoutReady(callback: () => any): void;
  }

  interface MarkdownView {
    editMode: EditMode;
    path: string;
    rebuildView(): Promise<void>;
  }

  interface EditMode {
    cm: EditorView;
    path: string;
    tableCell?: {
      table: Table;
      cell: TableCell;
    };
  }

  interface MarkdownRenderChild {
    el: HTMLElement;
    onload(): void;
    onunload(): void;
  }
}

declare global {
  interface TableCell {
    el: HTMLTableCellElement;
    row: number;
    col: number;
    text: string;
  }

  type CellGrid = TableCell[][];

  interface Table {
    rows: CellGrid;
    editor: {
      tableCell: {
        cell: TableCell;
        table: Table;
      };
    };
    receiveCellFocus: (
      row: number,
      col: number,
      func?: Function,
      flag?: boolean
    ) => void;
    insertRow: (row: number, col: number) => void;
    render: () => void;
    rebuildTable: () => void;
  }

  interface Element {
    cmView?: {
      widget: {
        text: string;
      };
    };
  }

  type ContGrid = string[][];
}
