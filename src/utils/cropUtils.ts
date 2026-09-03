export type CropSettings = {
  thumbInactive: { x: number; y: number; width: number; height: number };
  thumbActive: { x: number; y: number; width: number; height: number };
  background: { x: number; y: number; width: number; height: number };
  banner: { x: number; y: number; width: number; height: number };
};

export const getCropCss = (crop?: { x: number; y: number; width: number; height: number }) => {
  if (!crop || typeof crop.width !== 'number' || typeof crop.height !== 'number' || crop.width <= 0) {
    return {
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }

  // Clamp percentages to valid ranges to prevent division by zero or NaN
  const width = Math.min(Math.max(crop.width, 0.1), 100);
  const height = Math.min(Math.max(crop.height, 0.1), 100);
  const x = Math.min(Math.max(crop.x ?? 0, 0), 100 - width);
  const y = Math.min(Math.max(crop.y ?? 0, 0), 100 - height);

  // Scaling factor for width so that the cropped region width fills 100% of container width.
  // Using 'auto' for height ensures the image scales uniformly in both dimensions without aspect ratio distortion!
  const sizeX = 100 / (width / 100);

  // Calculate the position offset for background-position
  const posX = width >= 99.9 ? 50 : (x / (100 - width)) * 100;
  const posY = height >= 99.9 ? 50 : (y / (100 - height)) * 100;

  return {
    backgroundSize: `${sizeX.toFixed(2)}% auto`,
    backgroundPosition: `${posX.toFixed(2)}% ${posY.toFixed(2)}%`,
  };
};
