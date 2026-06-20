import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface MonthPickerProps {
  selectedMonth: string; // 'current' or 'YYYY-MM'
  availableMonths: string[];
  onChange: (month: string) => void;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const MonthPicker: React.FC<MonthPickerProps> = ({ selectedMonth, availableMonths, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (selectedMonth !== 'current' && selectedMonth) {
      return parseInt(selectedMonth.split('-')[0], 10);
    }
    return new Date().getFullYear();
  });
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const getDisplayLabel = () => {
    if (selectedMonth === 'current') return 'Current Month (Live)';
    const [y, m] = selectedMonth.split('-');
    const mIndex = parseInt(m, 10) - 1;
    return `${MONTH_NAMES[mIndex]} ${y}`;
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          width: '100%', 
          padding: '10px 14px', 
          background: 'var(--bg-dark)', 
          border: '1px solid var(--border)', 
          borderRadius: '10px', 
          color: selectedMonth === 'current' ? 'var(--accent-primary)' : 'var(--accent-warning)',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: isOpen ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} />
          {getDisplayLabel()}
        </div>
      </button>

      {isOpen && (
        <div style={{ 
          position: 'absolute', 
          top: '100%', 
          left: 0, 
          right: 0, 
          marginTop: '8px', 
          background: 'rgba(15, 23, 42, 0.95)', 
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)', 
          borderRadius: '12px', 
          padding: '16px',
          zIndex: 100,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)'
        }}>
          
          <button 
            type="button"
            onClick={() => handleSelect('current')}
            style={{ 
              width: '100%', 
              padding: '10px', 
              background: selectedMonth === 'current' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', 
              border: selectedMonth === 'current' ? '1px solid var(--accent-primary)' : '1px solid var(--border)', 
              borderRadius: '8px', 
              color: 'var(--accent-primary)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: '16px',
              transition: 'background 0.2s'
            }}
          >
            Current Month (Live) {selectedMonth === 'current' && <Check size={16} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <button 
              type="button"
              className="btn-icon" 
              onClick={() => setViewYear(y => y - 1)}
              style={{ background: 'var(--bg-panel)', width: '28px', height: '28px' }}
            >
              <ChevronLeft size={16} />
            </button>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '15px' }}>{viewYear}</div>
            <button 
              type="button"
              className="btn-icon" 
              onClick={() => setViewYear(y => y + 1)}
              style={{ background: 'var(--bg-panel)', width: '28px', height: '28px' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {MONTH_NAMES.map((m, idx) => {
              const monthNumStr = (idx + 1).toString().padStart(2, '0');
              const valueStr = `${viewYear}-${monthNumStr}`;
              const hasData = availableMonths.includes(valueStr);
              const isSelected = selectedMonth === valueStr;
              
              return (
                <button
                  key={m}
                  type="button"
                  disabled={!hasData}
                  onClick={() => handleSelect(valueStr)}
                  style={{
                    padding: '8px 0',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid var(--accent-warning)' : '1px solid transparent',
                    background: isSelected 
                      ? 'rgba(245, 158, 11, 0.15)' 
                      : hasData 
                        ? 'var(--bg-panel)' 
                        : 'transparent',
                    color: isSelected 
                      ? 'var(--accent-warning)' 
                      : hasData 
                        ? 'var(--text-main)' 
                        : 'rgba(148, 163, 184, 0.2)', // Ghost/dimmed text for no data
                    cursor: hasData ? 'pointer' : 'default',
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: '13px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (hasData && !isSelected) {
                      e.currentTarget.style.background = 'var(--bg-panel-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (hasData && !isSelected) {
                      e.currentTarget.style.background = 'var(--bg-panel)';
                    }
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
};
