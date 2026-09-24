import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  headerRight?: React.ReactNode;
  hideCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = '500px',
  headerRight,
  hideCloseButton = false
}) => {
  if (!isOpen) return null;
  
  return createPortal(
    <div className="animate-fade-in-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="glass-panel animate-fade-in" style={{ width: '90%', maxWidth: maxWidth, padding: '24px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
          {typeof title === 'string' ? <h3 style={{ margin: 0 }}>{title}</h3> : title}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {headerRight}
            {!hideCloseButton && (
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={24} />
              </button>
            )}
          </div>
        </div>
        <div style={{ overflowY: 'auto', paddingRight: '8px', paddingBottom: '4px' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
