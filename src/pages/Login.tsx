import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Music, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ADMIN_EMAIL = "admin@admin";
const ADMIN_PASSWORD = "admin2023";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      localStorage.setItem("auth_admin", "1");
      navigate("/", { replace: true });
    } else {
      toast.error("Credenciais inválidas");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-card border border-border rounded-xl p-6 space-y-5 shadow-lg"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Music className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Entrar</h1>
          <p className="text-xs text-muted-foreground">Acesso restrito</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">E-mail</label>
          <Input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@admin"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Senha</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" className="w-full gap-2">
          <Lock className="w-4 h-4" />
          Entrar
        </Button>
      </form>
    </div>
  );
}
