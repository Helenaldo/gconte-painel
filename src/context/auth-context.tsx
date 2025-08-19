import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  nome: string;
  email: string;
  avatar_url?: string;
  role: 'operador' | 'administrador';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signUp: (email: string, password: string, userData: { nome: string; role?: 'operador' | 'administrador' }) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  // Legacy compatibility
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Sistema de logout automático
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 horas em milissegundos

  // Função para resetar o timer de inatividade
  const resetInactivityTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (user) {
      timeoutRef.current = setTimeout(() => {
        console.log('Logout automático por inatividade');
        signOut();
      }, INACTIVITY_TIMEOUT);
    }
  }, [user]);

  // Monitorar atividade do usuário
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const resetTimer = () => resetInactivityTimer();
    
    // Adicionar listeners para atividade
    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });
    
    // Iniciar timer
    resetInactivityTimer();
    
    return () => {
      // Remover listeners
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
      
      // Limpar timer
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, resetInactivityTimer]);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user profile
          setTimeout(async () => {
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (profileData) {
                setProfile(profileData);
              }
            } catch (error) {
              console.error('Error fetching profile:', error);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Fetch user profile
        setTimeout(async () => {
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (profileData) {
              setProfile(profileData);
            }
          } catch (error) {
            console.error('Error fetching profile:', error);
          } finally {
            setLoading(false);
          }
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, userData: { nome: string; role?: 'operador' | 'administrador' }) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome: userData.nome,
          role: userData.role || 'operador'
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Legacy compatibility methods
  const login = async (email: string, password: string): Promise<boolean> => {
    const { error } = await signIn(email, password);
    return !error;
  };

  const logout = () => {
    signOut();
  };

  const isAdmin = profile?.role === 'administrador';
  const isAuthenticated = !!user;
  const isLoading = loading;

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin,
    // Legacy compatibility
    isAuthenticated,
    login,
    logout,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}