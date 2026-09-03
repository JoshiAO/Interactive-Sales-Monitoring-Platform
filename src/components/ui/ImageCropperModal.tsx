import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Modal } from './Modal';
import { ChevronLeft, ChevronRight, Check, ZoomIn, ZoomOut, Crop } from 'lucide-react';
import type { CropSettings } from '../../utils/cropUtils';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  initialCrops?: CropSettings;
  onComplete: (crops: CropSettings) => void;
}

const steps = [
  { id: 'thumbInactive', title: 'Thumbnail (Inactive State)', aspect: 340 / 420, ratioText: '17:21 (Portrait Card)' },
  { id: 'thumbActive', title: 'Thumbnail (Active State)', aspect: 340 / 180, ratioText: '17:9 (Expanded Card)' },
  { id: 'background', title: 'Background Overlay', aspect: 16 / 9, ratioText: '16:9 (App Background)' },
  { id: 'banner', title: 'Dashboard Banner', aspect: 3.5 / 1, ratioText: '3.5:1 (Hero Banner)' },
] as const;

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ 
  isOpen, 
  onClose, 
  imageUrl, 
  initialCrops,
  onComplete 
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  // Crop state per step
  const [crops, setCrops] = useState<{ [key: string]: { x: number; y: number } }>({
    thumbInactive: { x: 0, y: 0 },
    thumbActive: { x: 0, y: 0 },
    background: { x: 0, y: 0 },
    banner: { x: 0, y: 0 },
  });
  const [zooms, setZooms] = useState<{ [key: string]: number }>({
    thumbInactive: 1,
    thumbActive: 1,
    background: 1,
    banner: 1,
  });
  const [croppedAreas, setCroppedAreas] = useState<{ [key: string]: { x: number; y: number; width: number; height: number } }>({});

  // Populate initial crops if editing an existing program
  useEffect(() => {
    if (initialCrops) {
      setCroppedAreas({
        thumbInactive: initialCrops.thumbInactive,
        thumbActive: initialCrops.thumbActive,
        background: initialCrops.background,
        banner: initialCrops.banner,
      });
    }
  }, [initialCrops]);

  const step = steps[currentStep];

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrops(prev => ({ ...prev, [step.id]: crop }));
  };

  const onZoomChange = (zoom: number) => {
    setZooms(prev => ({ ...prev, [step.id]: zoom }));
  };

  const onCropComplete = useCallback((croppedArea: any) => {
    setCroppedAreas(prev => ({ ...prev, [step.id]: croppedArea }));
  }, [step.id]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleFinish = () => {
    const getArea = (id: string) => croppedAreas[id] || initialCrops?.[id as keyof CropSettings] || { x: 0, y: 0, width: 100, height: 100 };
    
    onComplete({
      thumbInactive: getArea('thumbInactive'),
      thumbActive: getArea('thumbActive'),
      background: getArea('background'),
      banner: getArea('banner')
    });
  };

  if (!isOpen) return null;

  const currentZoom = zooms[step.id] || 1;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Adjust Crop: ${step.title}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Step Indicator Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Crop size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>
              Step {currentStep + 1} of 4: {step.title}
            </span>
          </div>
          <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
            {step.ratioText}
          </span>
        </div>

        {/* Main Cropper Box with Side Navigation Buttons */}
        <div style={{ position: 'relative', width: '100%', height: '380px', background: '#090d16', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <Cropper
            image={imageUrl}
            crop={crops[step.id] || { x: 0, y: 0 }}
            zoom={currentZoom}
            aspect={step.aspect}
            onCropChange={onCropChange}
            onCropComplete={onCropComplete}
            onZoomChange={onZoomChange}
          />

          {/* Left Side Navigation Arrow */}
          <button 
            onClick={handlePrev}
            disabled={currentStep === 0}
            style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              zIndex: 10,
              background: currentStep === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(15, 23, 42, 0.75)', 
              color: currentStep === 0 ? 'rgba(255,255,255,0.2)' : 'white',
              border: '1px solid rgba(255,255,255,0.15)', 
              borderRadius: '50%', 
              width: '40px', 
              height: '40px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: currentStep === 0 ? 'default' : 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease'
            }}
            title="Previous Crop Setting"
          >
            <ChevronLeft size={22} />
          </button>

          {/* Right Side Navigation Arrow */}
          <button 
            onClick={handleNext}
            disabled={currentStep === steps.length - 1}
            style={{ 
              position: 'absolute', 
              right: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              zIndex: 10,
              background: currentStep === steps.length - 1 ? 'rgba(0,0,0,0.2)' : 'rgba(15, 23, 42, 0.75)', 
              color: currentStep === steps.length - 1 ? 'rgba(255,255,255,0.2)' : 'white',
              border: '1px solid rgba(255,255,255,0.15)', 
              borderRadius: '50%', 
              width: '40px', 
              height: '40px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: currentStep === steps.length - 1 ? 'default' : 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease'
            }}
            title="Next Crop Setting"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* Zoom Slider Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
          <ZoomOut size={16} color="var(--text-muted)" />
          <input 
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={currentZoom}
            onChange={e => onZoomChange(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
          />
          <ZoomIn size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '36px', textAlign: 'right' }}>
            {currentZoom.toFixed(1)}x
          </span>
        </div>
        
        {/* Footer Navigation & Dots */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <button 
            className="btn" 
            onClick={handlePrev} 
            disabled={currentStep === 0}
            style={{ opacity: currentStep === 0 ? 0.5 : 1 }}
          >
            <ChevronLeft size={16} /> Previous
          </button>
          
          {/* Clickable Step Dots */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {steps.map((s, i) => (
              <button 
                key={s.id} 
                onClick={() => setCurrentStep(i)}
                style={{ 
                  padding: 0,
                  border: 'none',
                  cursor: 'pointer',
                  width: i === currentStep ? '28px' : '10px', 
                  height: '10px', 
                  borderRadius: '5px', 
                  background: i === currentStep ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)',
                  transition: 'all 0.3s ease'
                }} 
                title={`Jump to Step ${i + 1}: ${s.title}`}
              />
            ))}
          </div>
          
          {currentStep < steps.length - 1 ? (
            <button className="btn btn-primary" onClick={handleNext}>
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleFinish} style={{ background: 'var(--accent-success)', borderColor: 'var(--accent-success)' }}>
              <Check size={16} /> Finish Cropping
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
