import { useCombobox, useMultipleSelection } from "downshift";
import { type ReactNode, useMemo, useState } from "react";
import { Close } from "../icons/index.tsx";

export interface AutocompleteProps<T> {
  items: T[];
  selected: T[];
  onSelectedChange: (items: T[]) => void;
  itemToString: (item: T) => string;
  itemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  renderChip: (item: T) => ReactNode;
  placeholder?: string;
  onQueryChange?: (query: string) => void;
  /** When true, Enter on a free-text input adds it as a custom item. */
  allowFreeText?: boolean;
  /** Validate free text before adding. */
  freeTextValidator?: (text: string) => boolean;
  /** Build a T from a free-text string. Required if `allowFreeText` is true. */
  freeTextToItem?: (text: string) => T;
  /** Heading shown above the list when no query has been typed. */
  emptyQueryHeading?: ReactNode;
}

export function Autocomplete<T>({
  items,
  selected,
  onSelectedChange,
  itemToString,
  itemKey,
  renderItem,
  renderChip,
  placeholder = "Type to search…",
  onQueryChange,
  allowFreeText,
  freeTextValidator,
  freeTextToItem,
  emptyQueryHeading,
}: AutocompleteProps<T>) {
  const [inputValue, setInputValue] = useState("");

  const filtered = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    const sel = new Set(selected.map(itemKey));
    return items
      .filter((i) => !sel.has(itemKey(i)))
      .filter((i) => (q ? itemToString(i).toLowerCase().includes(q) : true));
  }, [items, inputValue, selected, itemKey, itemToString]);

  const multi = useMultipleSelection<T>({
    selectedItems: selected,
    onStateChange({ selectedItems: next, type }) {
      switch (type) {
        case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownBackspace:
        case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownDelete:
        case useMultipleSelection.stateChangeTypes.DropdownKeyDownBackspace:
        case useMultipleSelection.stateChangeTypes.FunctionRemoveSelectedItem:
          onSelectedChange(next ?? []);
          break;
      }
    },
  });

  const combobox = useCombobox<T>({
    items: filtered,
    inputValue,
    selectedItem: null,
    itemToString: (i) => (i ? itemToString(i) : ""),
    stateReducer(_state, { changes, type }) {
      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
          return {
            ...changes,
            isOpen: true,
            highlightedIndex: 0,
            inputValue: "",
          };
        default:
          return changes;
      }
    },
    onStateChange({ inputValue: next, type, selectedItem }) {
      switch (type) {
        case useCombobox.stateChangeTypes.InputChange:
          setInputValue(next ?? "");
          onQueryChange?.(next ?? "");
          break;
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
          if (selectedItem) {
            onSelectedChange([...selected, selectedItem]);
          } else if (allowFreeText && inputValue.trim() && freeTextToItem) {
            const text = inputValue.trim();
            if (!freeTextValidator || freeTextValidator(text)) {
              onSelectedChange([...selected, freeTextToItem(text)]);
            }
          }
          setInputValue("");
          break;
      }
    },
  });

  return (
    <div className="ac-wrap">
      <div className="ac-field" onClick={() => (document.activeElement as HTMLElement)?.blur?.()}>
        {selected.map((item, idx) => (
          <span
            key={itemKey(item)}
            className="ac-chip"
            {...multi.getSelectedItemProps({ selectedItem: item, index: idx })}
          >
            {renderChip(item)}
            <button
              type="button"
              aria-label="Remove"
              className="ac-chip-remove"
              onClick={(e) => {
                e.stopPropagation();
                onSelectedChange(selected.filter((s) => itemKey(s) !== itemKey(item)));
              }}
            >
              <Close size={12} />
            </button>
          </span>
        ))}
        <input
          {...combobox.getInputProps(multi.getDropdownProps({ preventKeyAction: combobox.isOpen }))}
          placeholder={selected.length === 0 ? placeholder : ""}
          className="ac-input"
        />
      </div>
      <ul {...combobox.getMenuProps()} className={`ac-suggest ${combobox.isOpen ? "open" : ""}`}>
        {combobox.isOpen && (
          <>
            {!inputValue && emptyQueryHeading && <li className="ac-heading">{emptyQueryHeading}</li>}
            {filtered.length === 0 && inputValue && (
              <li className="ac-empty">No matches{allowFreeText ? " — press Enter to add as custom" : ""}</li>
            )}
            {filtered.map((item, index) => (
              <li
                key={itemKey(item)}
                {...combobox.getItemProps({ item, index })}
                className={`ac-suggest-item ${combobox.highlightedIndex === index ? "highlighted" : ""}`}
              >
                {renderItem(item)}
              </li>
            ))}
          </>
        )}
      </ul>
    </div>
  );
}
