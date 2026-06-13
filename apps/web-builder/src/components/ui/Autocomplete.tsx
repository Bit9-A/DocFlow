'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useDocumentStore } from '@/store/useDocumentStore';

// ============================================================
// Helper functions for parsing and flattening JSON
// ============================================================

export function flattenJsonKeys(obj: any, prefix = ''): string[] {
  if (obj === null || obj === undefined) return [];
  
  // If it's a primitive, just return the prefix
  if (typeof obj !== 'object') {
    return prefix ? [prefix] : [];
  }

  let paths: string[] = [];

  if (Array.isArray(obj)) {
    // For arrays, let's add the array path itself
    if (prefix) paths.push(prefix);
    
    // Add paths for the first element as a representative model
    const firstEl = obj[0];
    if (firstEl !== undefined) {
      const arrayPrefix = `${prefix}.0`;
      if (typeof firstEl === 'object' && firstEl !== null) {
        paths = paths.concat(flattenJsonKeys(firstEl, arrayPrefix));
      } else {
        paths.push(arrayPrefix);
      }
    }
  } else {
    for (const key of Object.keys(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const val = obj[key];
      if (typeof val === 'object' && val !== null) {
        paths.push(path);
        paths = paths.concat(flattenJsonKeys(val, path));
      } else {
        paths.push(path);
      }
    }
  }

  return paths;
}

export function getTableItemSuggestions(uploadedJsonStr: string): string[] {
  if (!uploadedJsonStr) return [];
  try {
    const data = JSON.parse(uploadedJsonStr);
    const suggestions: string[] = [];

    const findArrays = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        const firstEl = obj[0];
        if (firstEl && typeof firstEl === 'object') {
          for (const key of Object.keys(firstEl)) {
            suggestions.push(`item.${key}`);
          }
        }
        return;
      }
      for (const key of Object.keys(obj)) {
        findArrays(obj[key]);
      }
    };

    findArrays(data);
    return suggestions;
  } catch (e) {
    return [];
  }
}

// ============================================================
// Autocomplete Component
// ============================================================

interface AutocompleteProps {
  query: string;
  coords: { top: number; left: number } | null;
  onSelect: (variable: string) => void;
  onClose: () => void;
  extraSuggestions?: string[];
}

export function Autocomplete({
  query,
  coords,
  onSelect,
  onClose,
  extraSuggestions = [],
}: AutocompleteProps) {
  const metadata = useDocumentStore((s) => s.metadata);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Gather all suggestions
  const systemVars = ['currentPage', 'totalPages', 'currentDate'];
  
  const customVars = (metadata.customVariables ?? []).map((v) => v.key);
  
  let jsonVars: string[] = [];
  let tableItemVars: string[] = [];
  if (metadata.uploadedJson) {
    try {
      const parsed = JSON.parse(metadata.uploadedJson);
      jsonVars = flattenJsonKeys(parsed);
      tableItemVars = getTableItemSuggestions(metadata.uploadedJson);
    } catch (e) {
      // Ignored
    }
  }

  const allVars = Array.from(
    new Set([
      ...systemVars,
      ...customVars,
      ...jsonVars,
      ...tableItemVars,
      ...extraSuggestions,
    ])
  );

  // 2. Filter by query
  const cleanQuery = query.startsWith('{{') ? query.slice(2) : query;
  const filtered = allVars.filter((v) =>
    v.toLowerCase().includes(cleanQuery.toLowerCase())
  );

  // 3. Handle Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (filtered.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          onSelect(selected);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [filtered, selectedIndex, onSelect, onClose]);

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (filtered.length === 0 || !coords) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 9999,
      }}
      className="
        w-52 max-h-48 overflow-y-auto rounded-lg border border-white/10
        bg-[#1a1a2e] shadow-2xl p-1 flex flex-col gap-0.5 scrollbar-thin
        scrollbar-thumb-white/10 select-none
      "
      aria-label="Variable autocomplete menu"
      role="listbox"
    >
      {filtered.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        // Determine type/source of variable for label styling
        let typeLabel = 'JSON';
        let typeColor = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';

        if (systemVars.includes(item)) {
          typeLabel = 'System';
          typeColor = 'text-green-400 bg-green-500/10 border-green-500/20';
        } else if (customVars.includes(item)) {
          typeLabel = 'Custom';
          typeColor = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
        } else if (item.startsWith('item.')) {
          typeLabel = 'Row Item';
          typeColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20';
        }

        return (
          <div
            key={item}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(item);
            }}
            onMouseEnter={() => setSelectedIndex(idx)}
            className={`
              flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors text-xs
              ${isSelected ? 'bg-indigo-600 text-white font-medium' : 'text-white/70 hover:bg-white/5'}
            `}
            role="option"
            aria-selected={isSelected}
          >
            <span className="font-mono truncate mr-2">{item}</span>
            <span
              className={`
                px-1 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold border
                ${isSelected ? 'text-white/80 bg-white/10 border-white/20' : typeColor}
              `}
            >
              {typeLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Autocomplete wrapper for standard Inputs / Textareas
// ============================================================

interface AutocompleteInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onValueChange: (val: string) => void;
  extraSuggestions?: string[];
}

export function AutocompleteInput({
  value,
  onValueChange,
  extraSuggestions,
  className,
  ...props
}: AutocompleteInputProps) {
  const [acState, setAcState] = useState<{
    show: boolean;
    query: string;
    coords: { top: number; left: number } | null;
  }>({ show: false, query: '', coords: null });

  const inputRef = useRef<HTMLInputElement>(null);

  function handleInput(e: React.FormEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const val = el.value;
    onValueChange(val);

    const selStart = el.selectionStart ?? 0;
    const beforeCursor = val.slice(0, selStart);
    const triggerMatch = beforeCursor.match(/\{\{([a-zA-Z0-9._]*)$/);

    if (triggerMatch) {
      const rect = el.getBoundingClientRect();
      setAcState({
        show: true,
        query: triggerMatch[1] ?? '',
        coords: {
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
        },
      });
    } else {
      setAcState({ show: false, query: '', coords: null });
    }
  }

  function handleSelect(variable: string) {
    if (!inputRef.current) return;
    const el = inputRef.current;
    const val = el.value;
    const selStart = el.selectionStart ?? 0;
    const beforeCursor = val.slice(0, selStart);
    const afterCursor = val.slice(selStart);
    
    // Replace the matched dynamic prefix with selected variable
    const updatedBefore = beforeCursor.replace(/\{\{([a-zA-Z0-9._]*)$/, `{{${variable}}}`);
    const newVal = updatedBefore + afterCursor;
    onValueChange(newVal);

    setAcState({ show: false, query: '', coords: null });

    // Put focus back and move cursor to end of inserted variable
    setTimeout(() => {
      el.focus();
      const newCursor = updatedBefore.length;
      el.setSelectionRange(newCursor, newCursor);
    }, 10);
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        value={value}
        onInput={handleInput}
        className={className}
        {...props}
      />
      {acState.show && (
        <Autocomplete
          query={acState.query}
          coords={acState.coords}
          onSelect={handleSelect}
          onClose={() => setAcState({ show: false, query: '', coords: null })}
          extraSuggestions={extraSuggestions}
        />
      )}
    </div>
  );
}

// ============================================================
// Autocomplete wrapper for Textareas
// ============================================================

interface AutocompleteTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onValueChange: (val: string) => void;
  extraSuggestions?: string[];
}

export function AutocompleteTextarea({
  value,
  onValueChange,
  extraSuggestions,
  className,
  ...props
}: AutocompleteTextareaProps) {
  const [acState, setAcState] = useState<{
    show: boolean;
    query: string;
    coords: { top: number; left: number } | null;
  }>({ show: false, query: '', coords: null });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const val = el.value;
    onValueChange(val);

    const selStart = el.selectionStart ?? 0;
    const beforeCursor = val.slice(0, selStart);
    const triggerMatch = beforeCursor.match(/\{\{([a-zA-Z0-9._]*)$/);

    if (triggerMatch) {
      const rect = el.getBoundingClientRect();
      setAcState({
        show: true,
        query: triggerMatch[1] ?? '',
        coords: {
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
        },
      });
    } else {
      setAcState({ show: false, query: '', coords: null });
    }
  }

  function handleSelect(variable: string) {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const val = el.value;
    const selStart = el.selectionStart ?? 0;
    const beforeCursor = val.slice(0, selStart);
    const afterCursor = val.slice(selStart);

    const updatedBefore = beforeCursor.replace(/\{\{([a-zA-Z0-9._]*)$/, `{{${variable}}}`);
    const newVal = updatedBefore + afterCursor;
    onValueChange(newVal);

    setAcState({ show: false, query: '', coords: null });

    setTimeout(() => {
      el.focus();
      const newCursor = updatedBefore.length;
      el.setSelectionRange(newCursor, newCursor);
    }, 10);
  }

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onInput={handleInput}
        className={className}
        {...props}
      />
      {acState.show && (
        <Autocomplete
          query={acState.query}
          coords={acState.coords}
          onSelect={handleSelect}
          onClose={() => setAcState({ show: false, query: '', coords: null })}
          extraSuggestions={extraSuggestions}
        />
      )}
    </div>
  );
}
