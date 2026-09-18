import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

type AuthMode = "login" | "register";

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const isRegister = mode === "register";
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAuth = () => {
    setAuthError(null);
    try {
      startLogin("/espace-patient");
    } catch (error) {
      console.error("[Auth] Unable to start OAuth flow", error);
      setAuthError("Le service de connexion n’est pas configuré sur cet environnement. Réessayez après publication de la version Manus.");
    }
  };

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/espace-patient");
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <main className="min-h-dvh bg-[#eef6fb] px-4 py-5 sm:grid sm:place-items-center sm:p-8">
      <section className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_90px_rgba(16,43,70,0.18)] lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="relative overflow-hidden bg-[#0f4e9a] p-7 text-white sm:p-10">
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #76cbd4 0 2px, transparent 3px), radial-gradient(circle at 85% 70%, #ffffff 0 1px, transparent 2px)", backgroundSize: "32px 32px, 24px 24px" }} />
          <div className="relative flex h-full min-h-[340px] flex-col">
            <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-white/85 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Retour à la carte</Link>
            <div className="mt-10 rounded-2xl bg-white p-4 shadow-xl shadow-[#082f63]/25"><img src="/manus-storage/medisecours-logo-officiel_8a4af45c.png" alt="MediSecours" className="h-14 w-auto" /></div>
            <p className="mt-9 text-xs font-bold uppercase tracking-[0.18em] text-[#a9f4fb]">Espace sécurisé</p>
            <h1 className="mt-3 max-w-sm text-3xl font-bold leading-tight sm:text-4xl">Votre santé, accompagnée avec rigueur.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-blue-100">Retrouvez vos recherches, vos établissements favoris et vos contributions depuis un espace privé, pensé pour votre parcours de soins.</p>
            <div className="mt-auto space-y-3 border-t border-white/20 pt-7 text-sm text-blue-50">
              {[
                "Connexion chiffrée et session protégée",
                "Données personnelles limitées à votre espace",
                "Administration accessible selon votre rôle",
              ].map(item => <p key={item} className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#8ff1f4]" />{item}</p>)}
            </div>
          </div>
        </aside>

        <div className="p-7 sm:p-10 lg:p-14">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#087f8c]">{isRegister ? "Créer votre espace" : "Bon retour"}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#102b46]">{isRegister ? "Votre compte patient commence ici." : "Retrouvez votre espace MediSecours."}</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">{isRegister ? "Créez votre compte sécurisé pour enregistrer des établissements, conserver vos recherches et contribuer aux fiches." : "Connectez-vous pour retrouver vos établissements enregistrés, votre liste de souhaits, vos recherches et vos contributions."}</p>

          <div className="mt-9 rounded-2xl border border-[#bfe6ea] bg-[#f2fbfc] p-5 text-sm leading-6 text-[#135b64]">
            <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#087f8c]" /><p><strong>Connexion MediSecours sécurisée.</strong> Vous êtes dirigé vers le fournisseur d’identité configuré, puis ramené automatiquement dans votre espace. Aucun mot de passe n’est traité par cette carte.</p></div>
          </div>

          <button type="button" onClick={handleAuth} className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-[#102b46] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#102b46]/20 transition hover:bg-[#183c5f] active:scale-[0.98]"><LockKeyhole className="h-5 w-5" />{isRegister ? "Créer mon compte patient" : "Se connecter en toute sécurité"}</button>
          {authError && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">{authError}</p>}
          <div className="my-6 flex items-center gap-3 text-xs font-medium text-slate-400"><span className="h-px flex-1 bg-slate-200" /> une expérience MediSecours <span className="h-px flex-1 bg-slate-200" /></div>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600"><p className="flex items-center gap-2 font-semibold text-slate-800"><Sparkles className="h-4 w-4 text-[#0b8a96]" /> Patient ou administrateur</p><p className="mt-1 leading-6">Votre rôle est contrôlé après connexion. Les accès administratifs ne sont jamais sélectionnables publiquement.</p></div>
          <p className="mt-7 text-center text-sm text-slate-600">{isRegister ? "Vous avez déjà un compte ?" : "Vous découvrez MediSecours ?"} <Link href={isRegister ? "/connexion" : "/inscription"} className="font-bold text-[#087f8c] hover:underline">{isRegister ? "Se connecter" : "Créer un compte"}</Link></p>
        </div>
      </section>
    </main>
  );
}
