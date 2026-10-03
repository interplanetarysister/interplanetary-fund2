import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { runtimeContract } from '@/lib/runtimeContract';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { getFrontendIdentity } from '@/lib/adminBootstrap';

const AuthContext = createContext();
const SAFE_APP_ERROR = 'Unable to load the application. Please try again.';
const APP_STATE_TIMEOUT_MS = 12000;
const AUTH_STATE_TIMEOUT_MS = 12000;

const withTimeout = (promise, timeoutMs, label) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out`);
      error.code = 'IFUND_BOOTSTRAP_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      const trustedAppBaseUrl = runtimeContract.appBaseUrl;
      const trustedAppId = runtimeContract.appId;
      if (!trustedAppId) throw new Error('Missing build-owned application identity.');
      const appClient = createAxiosClient({
        baseURL: trustedAppBaseUrl ? `${trustedAppBaseUrl}/api/apps/public` : `/api/apps/public`,
        headers: {
          'X-App-Id': trustedAppId
        },
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${trustedAppId}`, { timeout: APP_STATE_TIMEOUT_MS });
        setAppPublicSettings(publicSettings);
        
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Preserve intentional auth-state messages but never expose provider/server exception text.
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: SAFE_APP_ERROR
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: SAFE_APP_ERROR
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: SAFE_APP_ERROR
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await withTimeout(base44.auth.me(), AUTH_STATE_TIMEOUT_MS, 'Authentication check');
      // Revoke access for an account whose deletion is in progress — the
      // backend state machine set account_deletion_pending before wiping data.
      if (currentUser?.account_deletion_pending) {
        setIsLoadingAuth(false);
        setAuthChecked(true);
        base44.auth.logout();
        return;
      }
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      } else {
        // Never leave bootstrap on an infinite loading screen when the auth
        // provider is unavailable or a request stalls. Public routes can still
        // render and protected routes can offer retry/login recovery.
        setAuthError({
          type: 'auth_unavailable',
          message: SAFE_APP_ERROR
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  const frontendIdentity = getFrontendIdentity(user);

  return (
    <AuthContext.Provider value={{ 
      user,
      frontendIdentity,
      isSuperAdmin: frontendIdentity.superAdminOwner,
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
