'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface Option {
  value: string | number;
  label: string;
}

interface SearchableSelectProps {
  options: (Option | string | number)[];
  value: string | number;
  onChange: (value: any) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  compact?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  disabled = false,
  style,
  className = 'input-field',
  compact = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; placeAbove?: boolean }>({
    top: 0,
    left: 0,
    width: 200,
  });

  // Modal State for custom + Tambah Baru
  const [showAddModal, setShowAddModal] = useState(false);
  const [customInputValue, setCustomInputValue] = useState('');

  const triggerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const seenValues = new Set<string>();
  const normalizedOptions: Option[] = options
    .map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: opt, label: String(opt) };
      }
      return opt;
    })
    .filter((opt) => {
      const k = String(opt.value);
      if (seenValues.has(k)) return false;
      seenValues.add(k);
      return true;
    });

  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));

  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateMenuPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < menuHeight && rect.top > menuHeight;

      setMenuPos({
        top: placeAbove ? rect.top - menuHeight - 4 : rect.bottom + 4,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - 230)),
        width: Math.max(rect.width, 180),
        placeAbove,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateMenuPosition();
      const handleScrollOrResize = () => updateMenuPosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        const portalMenu = document.getElementById('searchable-select-portal-menu');
        if (portalMenu && portalMenu.contains(e.target as Node)) {
          return;
        }
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (val: string | number) => {
    if (String(val) === '+ Tambah Baru' || String(val) === 'Tambah Baru') {
      setIsOpen(false);
      setCustomInputValue('');
      setShowAddModal(true);
    } else {
      onChange(val);
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const handleSaveCustomValue = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInputValue.trim()) {
      onChange(customInputValue.trim());
      setShowAddModal(false);
      setCustomInputValue('');
    }
  };

  return (
    <div
      ref={triggerRef}
      style={{
        position: 'relative',
        width: '100%',
        display: 'inline-block',
        ...style,
      }}
    >
      {/* Trigger Button Box */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          padding: compact ? '0.35rem 0.6rem' : undefined,
          opacity: disabled ? 0.6 : 1,
          boxSizing: 'border-box',
          background: isOpen ? 'rgba(255, 255, 255, 0.95)' : undefined,
          borderColor: isOpen ? '#3b82f6' : undefined,
          boxShadow: isOpen ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : undefined,
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: compact ? '0.825rem' : '0.95rem',
            fontWeight: selectedOption ? 600 : 400,
            color: selectedOption || value ? 'inherit' : 'var(--text-muted, #94a3b8)',
          }}
        >
          {selectedOption ? selectedOption.label : value ? String(value) : placeholder}
        </span>
        <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: '0.4rem' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {/* FLOATING PORTAL DROPDOWN MENU */}
      {isOpen &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            id="searchable-select-portal-menu"
            style={{
              position: 'fixed',
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
              zIndex: 999999,
              background: '#ffffff',
              borderRadius: '10px',
              boxShadow: '0 20px 30px -10px rgba(0,0,0,0.18), 0 8px 15px -6px rgba(0,0,0,0.1)',
              border: '1px solid #cbd5e1',
              overflow: 'hidden',
              minWidth: '200px',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Search Input Box */}
            <div style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <input
                ref={searchInputRef}
                type="text"
                className="input-field"
                placeholder="🔍 Cari opsi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  margin: 0,
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.825rem',
                  boxSizing: 'border-box',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Options List */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '0.3rem 0' }}>
              {filteredOptions.length === 0 ? (
                <div
                  style={{
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.825rem',
                    color: '#94a3b8',
                    textAlign: 'center',
                  }}
                >
                  Tidak ada opsi yang sesuai
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = String(opt.value) === String(value);
                  const isTambahBaru = String(opt.value) === '+ Tambah Baru' || String(opt.value) === 'Tambah Baru';
                  return (
                    <div
                      key={`${String(opt.value)}-${idx}`}
                      onClick={() => handleSelect(opt.value)}
                      style={{
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        background: isSelected ? '#eff6ff' : isTambahBaru ? '#f0f9ff' : 'transparent',
                        color: isSelected ? '#2563eb' : isTambahBaru ? '#0284c7' : '#1e293b',
                        fontWeight: isSelected || isTambahBaru ? 700 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: isTambahBaru ? '1px solid #e2e8f0' : 'none',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = isTambahBaru ? '#e0f2fe' : '#f1f5f9';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = isTambahBaru ? '#f0f9ff' : 'transparent';
                      }}
                    >
                      <span>{isTambahBaru ? `➕ ${opt.label}` : opt.label}</span>
                      {isSelected && <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>✓</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}

      {/* CUSTOM BEAUTIFUL MODAL FOR + TAMBAH BARU */}
      {showAddModal &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999999,
            }}
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="glass-card"
              style={{
                width: '90%',
                maxWidth: '420px',
                padding: '1.5rem',
                background: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                ➕ Tambah Opsi Baru
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
                Masukkan opsi kustom baru yang ingin ditambahkan ke daftar.
              </p>

              <form onSubmit={handleSaveCustomValue} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Nama Opsi Baru</label>
                  <input
                    autoFocus
                    type="text"
                    className="input-field"
                    placeholder="Contoh: Survey Dapil, Kajian Khusus..."
                    value={customInputValue}
                    onChange={(e) => setCustomInputValue(e.target.value)}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-primary btn-secondary"
                    onClick={() => setShowAddModal(false)}
                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', background: '#0284c7' }}
                  >
                    + Simpan & Pilih
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
