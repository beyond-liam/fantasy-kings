"use client";

import { createContext, useContext } from "react";

export const DEFAULT_DATA_TABLE_HEADER_CLASS = "font-semibold";

type DataTableHeaderContextValue = {
  headerClassName: string;
};

const DataTableHeaderContext = createContext<DataTableHeaderContextValue>({
  headerClassName: DEFAULT_DATA_TABLE_HEADER_CLASS,
});

export function DataTableHeaderProvider({
  headerClassName = DEFAULT_DATA_TABLE_HEADER_CLASS,
  children,
}: {
  headerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <DataTableHeaderContext.Provider value={{ headerClassName }}>
      {children}
    </DataTableHeaderContext.Provider>
  );
}

export function useDataTableHeaderClass() {
  return useContext(DataTableHeaderContext).headerClassName;
}
