import type { ReactNode } from "react";
import { SegmentedControl } from "./SegmentedControl.tsx";

export interface TabSpec<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

export interface TabsProps<T extends string> {
  tabs: TabSpec<T>[];
  value: T;
  onChange: (value: T) => void;
  children?: ReactNode;
}

export function Tabs<T extends string>({ tabs, value, onChange, children }: TabsProps<T>) {
  return (
    <div className="tabs-wrap">
      <SegmentedControl<T>
        variant="tabs"
        options={tabs.map((t) => ({ value: t.value, label: t.label, count: t.count }))}
        value={value}
        onChange={onChange}
      />
      <div className="tabs-panel">{children}</div>
    </div>
  );
}
