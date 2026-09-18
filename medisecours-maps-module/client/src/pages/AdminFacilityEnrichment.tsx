import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowLeft, FileText, Save, ShieldCheck, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const parseLines = (value: string) => value.split("\n").map(item => item.trim()).filter(Boolean);

export default function AdminFacilityEnrichment() {
  const { user, isAuthenticated, loading } = useAuth();
  const isAdmin = isAuthenticated && user?.isOwner === true;
  const facilities = trpc.facilities.search.useQuery({ limit: 120 }, { enabled: isAdmin });
  const [facilityId, setFacilityId] = useState<number>();
  const enrichment = trpc.admin.facilityEnrichment.useQuery({ facilityId: facilityId ?? 1 }, { enabled: isAdmin && Boolean(facilityId) });
  const [services, setServices] = useState("");
  const [infrastructure, setInfrastructure] = useState("");
  const [benefits, setBenefits] = useState("");
  const [updates, setUpdates] = useState("");
  const [officialVideoUrl, setOfficialVideoUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  useEffect(() => {
    if (!enrichment.data) return;
    setServices((enrichment.data.services || []).join("\n"));
    setInfrastructure((enrichment.data.infrastructure || []).join("\n"));
    setBenefits((enrichment.data.benefits || []).join("\n"));
    setUpdates((enrichment.data.updates || []).map(item => item.title).join("\n"));
    setOfficialVideoUrl(enrichment.data.officialVideoUrl || "");
    setSourceUrl(enrichment.data.enrichmentSourceUrl || "");
  }, [enrichment.data]);
  const publish = trpc.admin.publishFacilityEnrichment.useMutation({ onSuccess: () => { toast.success("Informations institutionnelles publiées."); void enrichment.refetch(); }, onError: error => toast.error(error.message) });

  if (loading) return <main className="grid min-h-dvh place-items-center bg-slate-50 text-slate-500">Vérification des droits…</main>;
  if (!isAdmin) return <main className="grid min-h-dvh place-items-center bg-slate-50 p-6"><section className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"><AlertTriangle className="mx-auto h-12 w-12 text-amber-500" /><h1 className="mt-4 text-2xl font-bold text-[#102b46]">Accès administrateur refusé</h1><p className="mt-3 text-slate-600">Cette zone est réservée aux comptes administrateur. Toutes les opérations sont aussi contrôlées côté serveur.</p><Link href="/" className="mt-6 inline-flex rounded-xl bg-[#102b46] px-5 py-3 font-semibold text-white">Retour à la carte</Link></section></main>;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!facilityId) return toast.error("Sélectionnez un établissement.");
    publish.mutate({ facilityId, services: parseLines(services), infrastructure: parseLines(infrastructure), benefits: parseLines(benefits), updates: parseLines(updates).map(title => ({ title })), officialVideoUrl: officialVideoUrl.trim() || null, sourceUrl: sourceUrl.trim() });
  };
  return <main className="min-h-dvh bg-[#f5f8fb] p-4 text-[#102b46] md:p-8"><div className="mx-auto max-w-4xl"><Link href="/administration" className="inline-flex items-center gap-2 text-sm font-bold text-[#087f8c] hover:underline"><ArrowLeft className="h-4 w-4" /> Administration</Link><header className="mt-5 rounded-3xl bg-gradient-to-br from-[#102b46] to-[#0b8a96] p-7 text-white"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-cyan-100"><ShieldCheck className="h-4 w-4" /> Publication institutionnelle</p><h1 className="mt-3 text-3xl font-bold">Enrichir une fiche sanitaire</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-50">Ajoutez seulement des informations vérifiées auprès de l’établissement. Les médias Google ne sont ni extraits ni copiés dans ce formulaire.</p></header><form onSubmit={submit} className="mt-6 space-y-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><label className="block text-sm font-bold text-slate-700">Établissement<select value={facilityId ?? ""} onChange={event => setFacilityId(Number(event.target.value) || undefined)} required className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-[#0b8a96]"><option value="">Sélectionner une fiche MediSecours</option>{facilities.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="grid gap-5 md:grid-cols-3">{[{ label: "Services proposés", value: services, setValue: setServices, placeholder: "Urgences\nMaternité\nLaboratoire" }, { label: "Infrastructures et atouts", value: infrastructure, setValue: setInfrastructure, placeholder: "Ambulance\nBloc opératoire" }, { label: "Avantages", value: benefits, setValue: setBenefits, placeholder: "Accueil 24h/24\nAccessibilité" }].map(field => <label key={field.label} className="block text-sm font-bold text-slate-700">{field.label}<textarea value={field.value} onChange={event => field.setValue(event.target.value)} placeholder={field.placeholder} className="mt-2 min-h-36 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-[#0b8a96]" /></label>)}</div><label className="block text-sm font-bold text-slate-700">Actualités institutionnelles<textarea value={updates} onChange={event => setUpdates(event.target.value)} placeholder="Une actualité par ligne" className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-[#0b8a96]" /></label><div className="grid gap-5 md:grid-cols-2"><label className="block text-sm font-bold text-slate-700">Vidéo officielle facultative<Video className="ml-1 inline h-4 w-4 text-[#0b8a96]" /><input type="url" value={officialVideoUrl} onChange={event => setOfficialVideoUrl(event.target.value)} placeholder="https://…" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-[#0b8a96]" /></label><label className="block text-sm font-bold text-slate-700">Lien de la source officielle<input type="url" required value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://site-etablissement.cm/…" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-[#0b8a96]" /></label></div><p className="rounded-2xl bg-[#eefbfc] p-4 text-sm leading-6 text-slate-600"><FileText className="mr-2 inline h-4 w-4 text-[#087f8c]" />Les listes sont affichées dans la fiche publique avec leur source. Ne publiez pas de données médicales individuelles ou de contenu sans autorisation.</p><button type="submit" disabled={publish.isPending || !facilityId || !sourceUrl.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#0b8a96] px-5 py-3 font-bold text-white disabled:opacity-60"><Save className="h-4 w-4" />{publish.isPending ? "Publication…" : "Publier l’enrichissement"}</button></form></div></main>;
}
