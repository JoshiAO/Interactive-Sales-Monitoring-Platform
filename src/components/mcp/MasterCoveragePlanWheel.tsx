import React, { useRef, useEffect, useState } from 'react';

interface SalesmanData {
  id: string;
  name: string;
  photoURL?: string;
  supervisor?: string;
  towns?: string[];
  team?: string;
  type?: string;
}

interface MasterCoveragePlanWheelProps {
  salesmen: SalesmanData[];
  selectedSalesmanId: string | null;
  onSelect: (id: string) => void;
  onActiveChange?: (salesman: SalesmanData) => void;
}

const MasterCoveragePlanWheel: React.FC<MasterCoveragePlanWheelProps> = ({ salesmen, selectedSalesmanId, onSelect, onActiveChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const ITEM_HEIGHT = 180;
  const GAP = 24;
  const TOTAL_ITEM_HEIGHT = ITEM_HEIGHT + GAP;
  
  // Find initial index based on selectedSalesmanId
  const initialIndex = useRef<number>((() => {
    if (!selectedSalesmanId) return 0;
    const idx = salesmen.findIndex(s => s.id === selectedSalesmanId);
    return idx >= 0 ? idx : 0;
  })());
  
  const [activeIndex, setActiveIndex] = useState(initialIndex.current);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = () => {
    if (containerRef.current) {
      const scrollY = containerRef.current.scrollTop;
      containerRef.current.style.setProperty('--scroll-y', `${scrollY}px`);
      
      const newActiveIndex = Math.round(scrollY / TOTAL_ITEM_HEIGHT);
      if (newActiveIndex !== activeIndex) {
        setActiveIndex(newActiveIndex);
        
        // Debounce the parent update to prevent React re-rendering the whole page 
        // and glitching the map while the user is rapidly scrolling
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          if (onActiveChange && salesmen[newActiveIndex]) {
            onActiveChange(salesmen[newActiveIndex]);
          }
        }, 150);
      }
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      const height = containerRef.current.clientHeight;
      containerRef.current.style.setProperty('--container-half', `${height / 2}px`);
      containerRef.current.style.setProperty('--item-height', `${TOTAL_ITEM_HEIGHT}px`);
      
      // Initialize scroll-y and scroll position
      let currentScroll = containerRef.current.scrollTop;
      
      // If this is the initial mount, force the scroll position to the initial index
      if (initialIndex.current > 0 && currentScroll === 0) {
        currentScroll = initialIndex.current * TOTAL_ITEM_HEIGHT;
        containerRef.current.scrollTop = currentScroll;
      }
      
      containerRef.current.style.setProperty('--scroll-y', `${currentScroll}px`);
      
      // Calculate initial active index
      const newActiveIndex = Math.round(currentScroll / TOTAL_ITEM_HEIGHT);
      setActiveIndex(newActiveIndex);
    }
    
    // Use ResizeObserver to robustly handle container height changes
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        // Use getBoundingClientRect to avoid infinite loops caused by changing padding
        const height = containerRef.current.getBoundingClientRect().height;
        // Only update if height is non-zero
        if (height > 0) {
          containerRef.current.style.setProperty('--container-half', `${height / 2}px`);
        }
      }
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [TOTAL_ITEM_HEIGHT]);

  // Trigger initial map load when salesmen array populates
  useEffect(() => {
    if (onActiveChange && salesmen[activeIndex]) {
      onActiveChange(salesmen[activeIndex]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesmen]);

  // Scroll to card when it's selected (e.g. clicked)
  useEffect(() => {
    if (selectedSalesmanId && containerRef.current) {
      const index = salesmen.findIndex(s => s.id === selectedSalesmanId);
      // Only scroll if the clicked card is not already the centered (active) one
      if (index >= 0 && index !== activeIndex) {
        containerRef.current.scrollTo({
          top: index * TOTAL_ITEM_HEIGHT,
          behavior: 'smooth'
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSalesmanId, salesmen, TOTAL_ITEM_HEIGHT]);

  // If selectedSalesmanId changes externally, we could scroll to it, but let's keep it simple.

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        '--item-height': `${TOTAL_ITEM_HEIGHT}px`,
        height: '100%',
        width: '500px',
        maxWidth: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollSnapType: 'y mandatory',
        scrollBehavior: 'smooth',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start', // Align left
        paddingLeft: '48px', // Add padding to the left edge
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        position: 'relative'
      } as any}
      className="hide-scrollbar wheel-container"
    >
      <style>
        {`
          .wheel-container::-webkit-scrollbar {
            display: none;
          }
          .wheel-card {
            --item-y: calc(var(--index) * var(--item-height, 204px));
            /* Because of the physical spacers, the position is simply item-y minus scroll-y */
            --diff: calc(var(--item-y) - var(--scroll-y, 0px));
            --factor: calc(var(--diff) / 400px);
            --abs-factor: max(var(--factor), calc(-1 * var(--factor)));
            
            /* Curve calculation: push left/right */
            /* Removed scale() because width/height transitions already handle sizing */
            transform: translateX(calc(var(--abs-factor) * -60px));
            
            /* Gentler opacity drop-off: adjacent items will be ~40% opacity, 2 items away ~10% */
            opacity: max(0.1, calc(1 - var(--abs-factor) * 1.2));
            
            transform-origin: left center;
          }
        `}
      </style>

      {/* Top Spacer to push first item to center */}
      <div style={{ height: 'calc(var(--container-half, 300px) - (var(--item-height, 204px) / 2))', flexShrink: 0, width: '100%' }} />

      {salesmen.map((salesman, i) => {
        const isSelected = selectedSalesmanId === salesman.id;
        const isCentered = activeIndex === i;
        
        return (
          <div 
            key={salesman.id}
            onClick={() => onSelect(salesman.id)}
            className="wheel-card"
            style={{
              '--index': i,
              scrollSnapAlign: 'center',
              flexShrink: 0,
              width: isCentered ? '420px' : '340px',
              height: `${ITEM_HEIGHT}px`,
              marginBottom: `${GAP}px`,
              transition: 'width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-panel)',
              borderRadius: '24px',
              border: `2px solid ${isSelected ? 'var(--accent-primary)' : isCentered ? 'rgba(255,255,255,0.2)' : 'transparent'}`,
              boxShadow: isSelected ? '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)' : '0 10px 20px rgba(0,0,0,0.2)',
              position: 'relative',
              overflow: 'hidden',
              padding: '16px 24px',
              gap: '24px',
              zIndex: isCentered ? 10 : 1
            } as any}
          >
            {/* Background Glow for selected */}
            {isSelected && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, transparent 100%)',
                pointerEvents: 'none'
              }} />
            )}

            {/* Avatar - Left side */}
            <div style={{
              width: isCentered ? '90px' : '70px',
              height: isCentered ? '90px' : '70px',
              flexShrink: 0,
              borderRadius: '50%',
              background: 'var(--bg-dark)',
              border: `3px solid ${isSelected ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: isSelected ? '0 8px 24px rgba(59, 130, 246, 0.3)' : 'none'
            }}>
              {salesman.photoURL ? (
                <img src={salesman.photoURL} alt={salesman.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: isCentered ? '32px' : '24px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                  {salesman.name.charAt(0)}
                </span>
              )}
            </div>

            {/* Info - Right side */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <h3 style={{ 
                  margin: 0,
                  fontSize: isCentered ? '20px' : '16px', 
                  fontWeight: 700, 
                  color: 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: 'all 0.3s ease'
                }}>
                  {salesman.name}
                </h3>
                <span style={{ 
                  background: 'var(--bg-dark)', 
                  padding: '2px 8px', 
                  borderRadius: '8px', 
                  fontSize: '11px', 
                  fontWeight: 600, 
                  color: 'var(--accent-primary)',
                  flexShrink: 0
                }}>
                  {salesman.id}
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Supervisor</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {salesman.supervisor}
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Assigned Cities</span>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: 500, 
                    color: 'var(--text-main)',
                    display: '-webkit-box',
                    WebkitLineClamp: isCentered ? 2 : 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: '1.4'
                  }}>
                    {salesman.towns && salesman.towns.length > 0 ? salesman.towns.join(', ') : 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* View Button - Only visible when centered and selected */}
            {isCentered && isSelected && (
              <div style={{ position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '8px 16px', borderRadius: '20px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(salesman.id); // Trigger again to confirm/open table
                  }}
                >
                  View &rarr;
                </button>
              </div>
            )}
          </div>
        );
      })}
      
      {/* Bottom Spacer to allow last item to reach center */}
      <div style={{ height: 'calc(var(--container-half, 300px) - (var(--item-height, 204px) / 2))', flexShrink: 0, width: '100%' }} />
    </div>
  );
};

export default MasterCoveragePlanWheel;
