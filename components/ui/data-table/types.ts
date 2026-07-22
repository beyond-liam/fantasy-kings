import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    headerClassName?: string;
    cellClassName?: string;
    /**
     * Locked pixel width under `layout="fixed"`.
     * Columns without `width` share the remaining table width equally.
     */
    width?: number;
  }
}
