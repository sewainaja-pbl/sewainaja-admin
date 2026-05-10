'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { db } from '@/lib/firestore';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();

  // Lockout timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutTimer > 0) {
      timer = setInterval(() => {
        setLockoutTimer((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTimer]);

  // If already logged in and admin, redirect
  useEffect(() => {
    if (!loading && user && isAdmin) {
      router.replace('/dashboard');
    }
  }, [user, isAdmin, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimer > 0) return;

    setError('');
    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Check if user is admin
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      
      if (!userDoc.exists() || userDoc.data().isAdmin !== true) {
        // Not an admin, throw error
        await auth.signOut();
        throw new Error('Unauthorized access. Admin privileges required.');
      }
      
      // Success: Reset failed attempts
      setFailedAttempts(0);
      // If admin, routing is handled by useEffect via useAuth changes
    } catch (err: any) {
      console.error('Login error:', err);
      
      if (err.message.includes('Unauthorized access')) {
        setError(err.message);
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Access temporarily blocked for security.');
        setLockoutTimer(60); // Lock for 60 seconds
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        const newFailCount = failedAttempts + 1;
        setFailedAttempts(newFailCount);
        
        if (newFailCount >= 5) {
          setLockoutTimer(30); // 30 seconds lockout after 5 fails
          setError(`Too many failed attempts. Please try again in 30 seconds.`);
        } else {
          setError(`Invalid email or password. (${newFailCount}/5 attempts)`);
        }
      } else {
        setError('An error occurred during login. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // While checking auth status initially, don't show the login form yet to prevent flash
  if (loading || (user && isAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Brand Logo/Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-[var(--shadow-hover)] mb-4 transition-transform hover:scale-105">
            <span className="text-white text-2xl font-bold font-serif">S</span>
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-bold text-text-primary text-center">SewainAja Admin</h1>
          <p className="text-text-secondary text-[13px] sm:text-[14px] mt-2 text-center">
            Sign in to access the control panel
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface p-6 sm:p-8 rounded-[var(--radius-lg)] sm:rounded-[var(--radius-xl)] shadow-[var(--shadow-soft)] border border-border-color">
          {error && (
            <div className="mb-6 p-4 bg-status-error/10 border border-status-error/20 rounded-[var(--radius-md)] flex items-start gap-3">
              <AlertCircle size={20} className="text-status-error shrink-0 mt-0.5" />
              <p className="text-[13px] text-status-error font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-text-primary ml-1">Email Address</label>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-text-tertiary">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 bg-background border border-border-color rounded-[var(--radius-md)] pl-11 pr-4 text-[14px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-text-tertiary"
                  placeholder="admin@sewainaja.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[13px] font-medium text-text-primary">Password</label>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-text-tertiary">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 bg-background border border-border-color rounded-[var(--radius-md)] pl-11 pr-12 text-[14px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-text-tertiary"
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-text-tertiary hover:text-text-primary transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !email || !password || lockoutTimer > 0}
              className="mt-4 w-full h-12 rounded-[var(--radius-md)] text-[14px] font-semibold transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(1,45,29,0.15)] active:scale-[0.98] hover:brightness-110"
              style={{ backgroundColor: '#012D1D', color: 'white' }}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Signing In...</span>
                </>
              ) : lockoutTimer > 0 ? (
                <span>Locked ({lockoutTimer}s)</span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
        
        {/* Footer */}
        <p className="text-center text-[12px] text-text-tertiary mt-8">
          &copy; {new Date().getFullYear()} SewainAja Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
}
