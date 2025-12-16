import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Music, Mail, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(72),
});

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'reset' ? 'reset' : 'login';
  
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [emailSentType, setEmailSentType] = useState<'confirm' | 'reset'>('confirm');
  
  const { signIn, signUp, resetPassword, updatePassword, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated && mode !== 'reset') {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, loading, navigate, mode]);

  // Update mode when URL changes
  useEffect(() => {
    if (searchParams.get('mode') === 'reset') {
      setMode('reset');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      switch (mode) {
        case 'login': {
          const validation = authSchema.safeParse({ email, password });
          if (!validation.success) {
            toast.error(validation.error.errors[0].message);
            return;
          }
          
          const { error } = await signIn(email, password);
          if (error) {
            if (error.message.includes('Invalid login credentials')) {
              toast.error('Email ou senha incorretos');
            } else if (error.message.includes('Email not confirmed')) {
              toast.error('Email não confirmado. Verifique sua caixa de entrada.');
            } else {
              toast.error(error.message);
            }
          } else {
            toast.success('Login realizado com sucesso!');
            navigate('/', { replace: true });
          }
          break;
        }
        
        case 'signup': {
          const validation = authSchema.safeParse({ email, password });
          if (!validation.success) {
            toast.error(validation.error.errors[0].message);
            return;
          }
          
          if (password !== confirmPassword) {
            toast.error('As senhas não conferem');
            return;
          }
          
          const { error } = await signUp(email, password);
          if (error) {
            if (error.message.includes('already registered')) {
              toast.error('Este email já está cadastrado');
            } else {
              toast.error(error.message);
            }
          } else {
            setEmailSentType('confirm');
            setShowEmailSent(true);
          }
          break;
        }
        
        case 'forgot': {
          if (!z.string().email().safeParse(email).success) {
            toast.error('Email inválido');
            return;
          }
          
          const { error } = await resetPassword(email);
          if (error) {
            toast.error(error.message);
          } else {
            setEmailSentType('reset');
            setShowEmailSent(true);
          }
          break;
        }
        
        case 'reset': {
          if (password.length < 6) {
            toast.error('Senha deve ter no mínimo 6 caracteres');
            return;
          }
          
          if (password !== confirmPassword) {
            toast.error('As senhas não conferem');
            return;
          }
          
          const { error } = await updatePassword(password);
          if (error) {
            toast.error(error.message);
          } else {
            toast.success('Senha alterada com sucesso!');
            navigate('/', { replace: true });
          }
          break;
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Carregando...</div>
      </div>
    );
  }

  // Email sent confirmation screen
  if (showEmailSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">
              {emailSentType === 'confirm' ? 'Verifique seu email' : 'Email enviado'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {emailSentType === 'confirm' 
                ? 'Enviamos um link de confirmação para:'
                : 'Enviamos um link para redefinir sua senha para:'}
            </p>
            <p className="text-sm font-medium text-foreground">{email}</p>
          </div>

          <div className="bg-card p-4 rounded-lg border border-border space-y-3">
            <p className="text-sm text-muted-foreground">
              {emailSentType === 'confirm'
                ? 'Clique no link enviado para confirmar seu email e ativar sua conta.'
                : 'Clique no link enviado para criar uma nova senha.'}
            </p>
            <p className="text-xs text-muted-foreground">
              Não recebeu? Verifique a pasta de spam.
            </p>
          </div>

          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setShowEmailSent(false);
              setMode('login');
              setPassword('');
              setConfirmPassword('');
            }}
          >
            Voltar para login
          </Button>
        </div>
      </div>
    );
  }

  // Reset password screen (when coming from email link)
  if (mode === 'reset') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Nova senha</h1>
            <p className="text-sm text-muted-foreground">
              Digite sua nova senha
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-lg border border-border">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="bg-background"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não conferem</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || password !== confirmPassword}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Music className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Stageback</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Playback profissional para músicos
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-lg border border-border">
          {/* Forgot password mode */}
          {mode === 'forgot' ? (
            <>
              <div className="text-center space-y-1 pb-2">
                <h2 className="font-semibold">Esqueceu sua senha?</h2>
                <p className="text-xs text-muted-foreground">
                  Digite seu email para receber um link de recuperação
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  className="bg-background"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar link'}
              </Button>
              
              <Button 
                type="button"
                variant="ghost" 
                className="w-full" 
                onClick={() => setMode('login')}
              >
                Voltar para login
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="bg-background"
                />
              </div>

              {/* Confirm password field - only show for signup */}
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="bg-background"
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive">As senhas não conferem</p>
                  )}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting || (mode === 'signup' && password !== confirmPassword)}
              >
                {isSubmitting ? 'Carregando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
              </Button>
            </>
          )}
        </form>

        {/* Toggle login/signup */}
        {mode !== 'forgot' && (
          <p className="text-center text-sm text-muted-foreground">
            {mode === 'login' ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setConfirmPassword('');
              }}
              className="text-primary hover:underline font-medium"
            >
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
