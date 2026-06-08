import React from 'react';

interface FireEffectProps {
  type: string; // 'fire-red', 'fire-orange', 'fire-blue', or ''
}

const FireEffect: React.FC<FireEffectProps> = ({ type }) => {
  if (!type) return null;

  const getFilter = () => {
    switch(type) {
      case 'fire-red': return 'brightness(1.1) sepia(1) saturate(5) hue-rotate(-50deg)';
      case 'fire-orange': return 'brightness(1.1) sepia(1) saturate(5) hue-rotate(5deg)';
      case 'fire-blue': return 'brightness(1.1) sepia(1) saturate(5) hue-rotate(180deg)';
      default: return 'none';
    }
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    bottom: '-20%',
    left: 0,
    width: '100%',
    height: '120%',
    objectFit: 'cover',
    pointerEvents: 'none',
    zIndex: 0,
    mixBlendMode: 'screen',
    opacity: 0.85,
    filter: getFilter()
  };

  // Low Tier (Red) -> Tier1.gif
  if (type === 'fire-red') {
    return <img src="/animations/Tier1.gif" alt="fire" style={style} />;
  }

  // Mid Tier (Orange) -> Tier2.gif
  if (type === 'fire-orange') {
    return <img src="/animations/Tier2.gif" alt="fire" style={style} />;
  }

  // High Tier (Blue) -> Tier3.gif
  if (type === 'fire-blue') {
    return <img src="/animations/Tier3.gif" alt="fire" style={style} />;
  }

  return null;
};

export default FireEffect;
