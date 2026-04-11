// frontend/src/components/TagInput.tsx
import { useState, useEffect, useRef } from 'react';

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions: string[];
}

export default function TagInput({ value, onChange, placeholder, suggestions }: TagInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const match = value.match(/@([\w\\-]*)?$/);
    if (match) {
      const search = match[1] || '';
      const filteredSuggestions = suggestions.filter(s =>
        s.toLowerCase().startsWith('@' + search.toLowerCase())
      );
      setFiltered(filteredSuggestions);
      setShowDropdown(filteredSuggestions.length > 0);
      setActiveIndex(0);
    } else {
      setShowDropdown(false);
    }
  }, [value, suggestions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        selectSuggestion(filtered[activeIndex]);
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    }
  };

  const selectSuggestion = (suggestion: string) => {
    const newValue = value.replace(/@[\w\\-]*$/, suggestion);
    onChange(newValue);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          width: '100%',
          fontFamily: 'DM Mono, monospace',
          fontSize: '0.85rem',
          padding: '7px 10px',
          background: 'var(--paper)',
          border: '1px solid var(--border)',
          borderRadius: 5,
          color: 'var(--ink)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {showDropdown && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--panel-bg)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            marginTop: 4,
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {filtered.map((s, idx) => (
            <div
              key={s}
              onClick={() => selectSuggestion(s)}
              style={{
                padding: '6px 10px',
                cursor: 'pointer',
                background: idx === activeIndex ? 'var(--accent-light)' : 'transparent',
                color: 'var(--ink)',
                fontFamily: 'DM Mono, monospace',
                fontSize: '0.8rem',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}