import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyRecaptcha, loadRecaptcha } from '../utils/recaptcha';
import { activationRateLimiter, formatRemainingTime } from '../utils/rateLimiter';

const Activation: React.FC = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Preload reCAPTCHA script on mount
    loadRecaptcha().catch(() => {});
  }, []);

  const hashString = async (message: string) => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. Rate limiter check
    const { allowed, retryAfterMs } = activationRateLimiter.consume();
    if (!allowed) {
      setError(`Too many attempts. Please wait ${formatRemainingTime(retryAfterMs)}.`);
      return;
    }

    setLoading(true);

    try {
      // 2. reCAPTCHA v3 verification
      const { passed, score } = await verifyRecaptcha('activation');
      if (!passed) {
        setError(`Verification failed (score: ${score.toFixed(2)}). Please try again.`);
        setLoading(false);
        return;
      }

      // 3. Validate company code
      const hashedCode = await hashString(code);
      
      // Call Firestore REST API for the 'joshiao-active-projects' project
      const response = await fetch(`https://firestore.googleapis.com/v1/projects/joshiao-active-projects/databases/(default)/documents/company_codes/${hashedCode}`);
      
      if (!response.ok) {
        throw new Error('Invalid Company Code or Code not found.');
      }
      
      const data = await response.json();
      
      // Check if active is true
      if (data.fields && data.fields.active && data.fields.active.booleanValue === true) {
        // Success
        localStorage.setItem('companyCode', code);
        navigate('/login');
      } else {
        throw new Error('This Company Code is no longer active.');
      }
    } catch (err: any) {
      setError(err.message || 'Activation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center min-h-screen">
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-6">
          <img src="/JoshiAO.jpg" alt="Activation Logo" style={{ width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 16px', objectFit: 'cover', border: '2px solid var(--accent-primary)' }} />
          <h2>Activate Platform</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
            Enter your company code to proceed
          </p>
        </div>
        
        {error && (
          <div className="mb-4" style={{ color: 'var(--accent-danger)', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleActivate}>
          <div className="mb-4">
            <input 
              type="text" 
              placeholder="Company Code (e.g. COMP-CODE-JAO0-0000)" 
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Verifying...' : 'Activate'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Activation;
