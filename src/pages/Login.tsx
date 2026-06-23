import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, resetPassword } from '../firebase/auth';
import { LogIn, ShieldAlert } from 'lucide-react';
import { verifyRecaptcha, loadRecaptcha } from '../utils/recaptcha';
import {
  loginRateLimiter,
  checkLoginLockout,
  recordFailedAttempt,
  resetLockout,
  formatRemainingTime,
} from '../utils/rateLimiter';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const companyCode = localStorage.getItem('companyCode');
    if (!companyCode && import.meta.env.VITE_DEMO_MODE !== 'true') {
      navigate('/activation', { replace: true });
    }
    // Preload reCAPTCHA script
    loadRecaptcha().catch(() => {});
  }, [navigate]);

  // Lockout countdown timer
  useEffect(() => {
    const { locked, remainingMs } = checkLoginLockout();
    if (locked) {
      setLockoutRemaining(remainingMs);
      startLockoutTimer();
    }

    return () => {
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
    };
  }, []);

  const startLockoutTimer = () => {
    if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
    lockoutTimerRef.current = setInterval(() => {
      const { locked, remainingMs } = checkLoginLockout();
      if (!locked) {
        setLockoutRemaining(0);
        if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
      } else {
        setLockoutRemaining(remainingMs);
      }
    }, 1000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // 1. Check lockout
    const { locked, remainingMs } = checkLoginLockout();
    if (locked) {
      setLockoutRemaining(remainingMs);
      setError(`Too many failed attempts. Try again in ${formatRemainingTime(remainingMs)}.`);
      startLockoutTimer();
      return;
    }

    // 2. Check rate limiter
    const { allowed, retryAfterMs } = loginRateLimiter.consume();
    if (!allowed) {
      setError(`Too many requests. Please wait ${formatRemainingTime(retryAfterMs)}.`);
      return;
    }

    setLoading(true);

    try {
      // 3. reCAPTCHA v3 verification
      const { passed, score } = await verifyRecaptcha('login');
      if (!passed) {
        setError(`Verification failed (score: ${score.toFixed(2)}). Please try again.`);
        setLoading(false);
        return;
      }

      // 4. Firebase Auth
      await login(email, password);
      resetLockout();
      navigate('/');
    } catch (err: any) {
      recordFailedAttempt();

      // Check if now locked out after this attempt
      const postCheck = checkLoginLockout();
      if (postCheck.locked) {
        setLockoutRemaining(postCheck.remainingMs);
        setError(`Too many failed attempts. Try again in ${formatRemainingTime(postCheck.remainingMs)}.`);
        startLockoutTimer();
      } else {
        setError(err.message || 'Failed to login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first to reset password');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await resetPassword(email);
      setMessage('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const isLockedOut = lockoutRemaining > 0;

  return (
    <div className="flex-center min-h-screen" style={{ flexDirection: 'column' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-6">
          <LogIn size={48} color="var(--accent-primary)" style={{ margin: '0 auto 16px' }} />
          <h2>Welcome Back</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
            Sign in to your dashboard
          </p>
        </div>
        
        {import.meta.env.VITE_DEMO_MODE === 'true' && (
          <div className="mb-4" style={{
            padding: '16px', borderRadius: '8px', fontSize: '13px',
            backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)',
            color: 'var(--text-primary)', textAlign: 'left', lineHeight: '1.5'
          }}>
            <strong style={{ color: 'var(--accent-success)', display: 'block', marginBottom: '8px' }}>🚀 Demo Mode Active</strong>
            <p style={{ margin: 0 }}><strong>Admin:</strong> admin@demo.com</p>
            <p style={{ margin: 0 }}><strong>Manager:</strong> manager@demo.com</p>
            <p style={{ margin: 0 }}><strong>Supervisor:</strong> supervisor@demo.com</p>
            <p style={{ margin: 0 }}><strong>Salesman:</strong> salesman@demo.com</p>
            <p style={{ margin: 0 }}><strong>Warehouse:</strong> warehousesupervisor@demo.com</p>
            <p style={{ margin: '8px 0 0' }}><strong>Password:</strong> demo@1234</p>
          </div>
        )}
        {isLockedOut && (
          <div className="mb-4" style={{
            display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
            padding: '12px', borderRadius: '8px', fontSize: '13px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--accent-danger)'
          }}>
            <ShieldAlert size={16} />
            <span>Locked out — try again in <strong>{formatRemainingTime(lockoutRemaining)}</strong></span>
          </div>
        )}

        {error && !isLockedOut && (
          <div className="mb-4" style={{ color: 'var(--accent-danger)', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4" style={{ color: 'var(--accent-success)', fontSize: '14px', textAlign: 'center' }}>
            {message}
          </div>
        )}
        
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLockedOut}
            />
          </div>
          <div className="mb-6">
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLockedOut}
            />
            <div style={{ textAlign: 'right', marginTop: '8px' }}>
              <button 
                type="button" 
                onClick={handleResetPassword}
                disabled={loading || isLockedOut}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
              >
                Forgot Password?
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || isLockedOut}>
            {loading ? 'Signing In...' : isLockedOut ? 'Account Locked' : 'Sign In'}
          </button>
        </form>
      </div>
      <div className="animate-fade-in" style={{ marginTop: '24px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', opacity: 0.6 }}>
        &copy; 2026 Joshua Alforque Ocampo. All Rights Reserved.
        <br />
        Protected by reCAPTCHA — <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }}>Privacy</a> · <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }}>Terms</a>
      </div>
    </div>
  );
};

export default Login;
