import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../firebase/auth';
import { LogIn } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const companyCode = localStorage.getItem('companyCode');
    if (!companyCode) {
      navigate('/activation', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

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
        
        {error && (
          <div className="mb-4" style={{ color: 'var(--accent-danger)', fontSize: '14px', textAlign: 'center' }}>
            {error}
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
            />
          </div>
          <div className="mb-6">
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
      <div className="animate-fade-in" style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
        &copy; 2026 Joshua Alforque Ocampo. All Rights Reserved.
      </div>
    </div>
  );
};

export default Login;
