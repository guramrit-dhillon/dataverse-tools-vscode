import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import "./autocomplete.css";

export interface AutocompleteOption {
  key: string;
  label: string;
}

interface AutocompleteProps {
  fieldId: string;
  options: AutocompleteOption[];
  value: AutocompleteOption | null;
  onSearch: (query: string) => void;
  onSelect: (option: AutocompleteOption | null) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  clearOnBlur?: boolean;
  debounceMs?: number;
}

export function Autocomplete({
  fieldId,
  options,
  value,
  onSearch,
  onSelect,
  loading = false,
  disabled = false,
  placeholder,
  required,
  clearOnBlur = true,
  debounceMs = 300,
}: AutocompleteProps): React.ReactElement {
  const [inputText, setInputText] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync input text when value changes externally
  useEffect(() => {
    setInputText(value?.label ?? "");
  }, [value?.key, value?.label]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const fireSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) { clearTimeout(debounceRef.current); }
      debounceRef.current = setTimeout(() => onSearch(query), debounceMs);
    },
    [onSearch, debounceMs]
  );

  // Cleanup debounce on unmount
  useEffect(() => () => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const text = e.target.value;
    setInputText(text);
    setOpen(true);
    setHighlightIndex(-1);
    fireSearch(text);
  };

  const handleSelect = (option: AutocompleteOption): void => {
    onSelect(option);
    setInputText(option.label);
    setOpen(false);
    setHighlightIndex(-1);
  };

  const handleBlur = (e: React.FocusEvent): void => {
    // Don't close if focus moves within the container (e.g. clicking a dropdown item)
    if (containerRef.current?.contains(e.relatedTarget as Node)) { return; }
    setOpen(false);
    setHighlightIndex(-1);
    if (clearOnBlur) {
      if (inputText === "") {
        // User explicitly cleared the field — treat as clearing the selection.
        if (value !== null) { onSelect(null); }
      } else {
        // Partial input without selecting — revert to the committed value.
        setInputText(value?.label ?? "");
      }
    }
  };

  const handleFocus = (): void => {
    if (disabled) { return; }
    setOpen(true);
    // Select all text for easy replacement
    const input = document.getElementById(fieldId) as HTMLInputElement | null;
    input?.select();
    // Fire initial search with current text
    fireSearch(inputText);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < options.length) {
          handleSelect(options[highlightIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setHighlightIndex(-1);
        if (clearOnBlur) {
          setInputText(value?.label ?? "");
        }
        break;
    }
  };

  return (
    <div className="autocomplete" ref={containerRef} onBlur={handleBlur}>
      <div className="autocomplete-input-wrap">
        <input
          id={fieldId}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`${fieldId}-listbox`}
          aria-activedescendant={highlightIndex >= 0 ? `${fieldId}-opt-${highlightIndex}` : undefined}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={inputText}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
        />
        {loading && <span className="autocomplete-spinner" />}
      </div>
      {open && (
        <ul
          id={`${fieldId}-listbox`}
          ref={listRef}
          className="autocomplete-dropdown"
          role="listbox"
        >
          {options.length === 0 && !loading && (
            <li className="autocomplete-empty">No results</li>
          )}
          {options.map((opt, i) => (
            <li
              key={opt.key}
              id={`${fieldId}-opt-${i}`}
              role="option"
              aria-selected={highlightIndex === i}
              className={[
                "autocomplete-option",
                highlightIndex === i ? "highlighted" : "",
                value?.key === opt.key ? "selected" : "",
              ].filter(Boolean).join(" ")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
