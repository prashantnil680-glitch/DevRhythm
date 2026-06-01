'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent,
  useImperativeHandle,
  memo,
  useMemo,
} from 'react';
import { IoSearch, IoClose } from 'react-icons/io5';
import { ImSpinner8 } from 'react-icons/im';
import { useDebounceCallback, useClickOutside } from '@/shared/hooks';
import Input from '@/shared/components/Input';
import Button from '@/shared/components/Button';
import clsx from 'clsx';
import styles from './SearchBar.module.css';

export interface SuggestionItem {
  id: string | number;
  label: string;
  [key: string]: any;
}

export interface SearchBarProps {
  onSearch: (query: string) => void;
  onChange?: (query: string) => void;
  placeholder?: string;
  initialValue?: string;
  value?: string;
  debounceMs?: number;
  isLoading?: boolean;
  clearable?: boolean;
  className?: string;
  ariaLabel?: string;
  error?: boolean;
  disabled?: boolean;
  clearTriggersSearch?: boolean;
  fillInputOnSelect?: boolean;
  searchOnSelect?: boolean;
  suggestions?: SuggestionItem[];
  renderSuggestion?: (item: SuggestionItem, isSelected: boolean) => React.ReactNode;
  onSuggestionSelect?: (item: SuggestionItem) => void;
  noResultsMessage?: string;
  maxSuggestions?: number;
  showOnFocus?: boolean;
  ref?: React.Ref<SearchBarRef>;
}

export interface SearchBarRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  input: HTMLInputElement | null;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onChange,
  placeholder = 'Search...',
  initialValue = '',
  value: controlledValue,
  debounceMs = 300,
  isLoading = false,
  clearable = true,
  className,
  ariaLabel = 'Search',
  error = false,
  disabled = false,
  clearTriggersSearch = true,
  fillInputOnSelect = true,
  searchOnSelect = false,
  suggestions,
  renderSuggestion,
  onSuggestionSelect,
  noResultsMessage = 'No results found',
  maxSuggestions = 10,
  showOnFocus = false,
  ref,
}) => {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(initialValue);
  const inputValue = isControlled ? controlledValue : internalValue;

  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const disableAutoOpenRef = useRef(false);

  const displayedSuggestions = useMemo(
    () => suggestions?.slice(0, maxSuggestions) || [],
    [suggestions, maxSuggestions]
  );

  const showNoResults = useMemo(
    () => suggestions && inputValue.trim() !== '' && displayedSuggestions.length === 0 && !isLoading,
    [suggestions, inputValue, displayedSuggestions.length, isLoading]
  );

  const showRightSlot = useMemo(
    () => (clearable && inputValue && !isLoading) || isLoading,
    [clearable, inputValue, isLoading]
  );

  const debouncedSearch = useDebounceCallback(
    (query: string) => onSearch(query),
    debounceMs
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      disableAutoOpenRef.current = false;

      if (!isControlled) setInternalValue(newValue);
      onChange?.(newValue);

      if (debounceMs > 0) debouncedSearch(newValue);

      setSelectedIndex(-1);
    },
    [isControlled, onChange, debounceMs, debouncedSearch]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSearch(inputValue);
      setIsOpen(false);
    },
    [onSearch, inputValue]
  );

  const handleClear = useCallback(() => {
    if (!isControlled) setInternalValue('');
    onChange?.('');
    if (clearTriggersSearch) onSearch('');
    inputRef.current?.focus();
    setIsOpen(false);
    disableAutoOpenRef.current = false;
  }, [isControlled, onChange, clearTriggersSearch, onSearch]);

  const handleSuggestionSelect = useCallback(
    (item: SuggestionItem) => {
      onSuggestionSelect?.(item);

      if (fillInputOnSelect) {
        const newValue = item.label;
        if (!isControlled) setInternalValue(newValue);
        onChange?.(newValue);
      }

      if (searchOnSelect) onSearch(fillInputOnSelect ? item.label : inputValue);

      setIsOpen(false);
      disableAutoOpenRef.current = true;
      inputRef.current?.focus();
    },
    [onSuggestionSelect, fillInputOnSelect, isControlled, onChange, searchOnSelect, onSearch, inputValue]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || !displayedSuggestions.length) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < displayedSuggestions.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          if (selectedIndex >= 0 && displayedSuggestions[selectedIndex]) {
            e.preventDefault();
            handleSuggestionSelect(displayedSuggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, displayedSuggestions, selectedIndex, handleSuggestionSelect]
  );

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => setIsFocused(false), 150);
  }, []);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    clear: handleClear,
    input: inputRef.current,
  }));

  useClickOutside(containerRef, () => setIsOpen(false));

  // Global keyboard shortcut: Ctrl + / to focus the search bar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl + / (or Cmd + / on Mac)
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.key === '/') {
        e.preventDefault(); // Prevent browser's default action (e.g., opening help)

        // Do not focus if the current active element is an input, textarea, or contenteditable
        const activeElement = document.activeElement;
        const isInputActive =
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            (activeElement as HTMLElement).isContentEditable);

        if (isInputActive) return;

        // Focus the input element of this search bar
        if (inputRef.current) {
          inputRef.current.focus();
          // If the element is not visible, scroll it into view smoothly
          inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown as any);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown as any);
  }, []); // No dependencies – the ref is stable, and we don't need to reattach

  useEffect(() => {
    if (!isFocused) {
      setIsOpen(false);
      return;
    }

    if (disableAutoOpenRef.current) return;

    const hasNonEmptyInput = inputValue.trim() !== '';
    const hasSuggestions = displayedSuggestions.length > 0;

    if (hasNonEmptyInput && hasSuggestions) {
      setIsOpen(true);
    } else if (showOnFocus && isFocused) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [isFocused, inputValue, displayedSuggestions, showOnFocus]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const defaultRenderSuggestion = useCallback(
    (item: SuggestionItem, isSelected: boolean) => (
      <div className={styles.suggestionContent}>
        <IoSearch className={styles.suggestionIcon} />
        <span className={clsx(styles.suggestionLabel, isSelected && styles.selectedLabel)}>
          {item.label}
        </span>
      </div>
    ),
    []
  );

  return (
    <div ref={containerRef} className={clsx(styles.searchBar, className)}>
      <form onSubmit={handleSubmit} role="search">
        <div className={styles.inputWrapper}>
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            leftIcon={<IoSearch />}
            error={error}
            disabled={disabled}
            fullWidth
            aria-label={ariaLabel}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls="search-suggestions"
            className={clsx(showRightSlot && styles.inputWithRightSlot)}
          />

          {showRightSlot && (
            <div className={styles.rightSlot}>
              {isLoading ? (
                <ImSpinner8 className={styles.loadingSpinner} aria-label="Loading" />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<IoClose />}
                  onClick={handleClear}
                  aria-label="Clear search"
                  className={styles.clearButton}
                />
              )}
            </div>
          )}
        </div>
      </form>

      {isOpen && (displayedSuggestions.length > 0 || showNoResults) && (
        <div
          id="search-suggestions"
          ref={dropdownRef}
          className={styles.dropdown}
          role="listbox"
          aria-label="Search suggestions"
        >
          {displayedSuggestions.map((item, index) => (
            <div
              key={item.id}
              className={clsx(styles.suggestionItem, { [styles.selected]: index === selectedIndex })}
              onClick={() => handleSuggestionSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
              role="option"
              aria-selected={index === selectedIndex}
            >
              {renderSuggestion
                ? renderSuggestion(item, index === selectedIndex)
                : defaultRenderSuggestion(item, index === selectedIndex)}
            </div>
          ))}
          {showNoResults && (
            <div className={styles.noResults} role="status">
              {noResultsMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

SearchBar.displayName = 'SearchBar';

export default memo(SearchBar);