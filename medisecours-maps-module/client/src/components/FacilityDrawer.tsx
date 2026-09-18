import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { googleDirectionsUrl, googleMapsPlaceUrl, googleNearbyHealthUrl, googlePlacePhotoProxyUrl, phoneSmsUrl } from "@/lib/facilityLinks";
import { BadgeCheck, Bookmark, Building2, ChevronDown, Clock3, ExternalLink, FileImage, Heart, ImagePlus, MapPin, Navigation2, Phone, Send, Share2, ShieldCheck, Siren, Smartphone, Star, ThumbsUp, UsersRound, X } from "lucide-react";
import React, { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";

type MediaItem = {
  id: number;
  url: string;
  photoReference?: string;
  mediaType: "image" | "video";
  caption: string | null;
  reviewId?: number | null;
  source?: "google" | "medisecours";
};

type ReviewItem = {
  review: { id: number; rating: number; title: string | null; content: string; createdAt: Date };
  author: string | null;
  authorAttribution?: { displayName: string; uri: string | null; photoUri: string | null };
  relativeTimeDescription?: string | null;
  source?: "google" | "medisecours";
};

type FacilityDetail = {
  facility: {
    id: number;
    isLive?: boolean;
    googlePlaceId?: string;
    name: string;
    categoryLabel: string | null;
    category: string;
    address: string;
    city: string | null;
    district: string | null;
    region: string | null;
    latitude: number;
    longitude: number;
    phones: string[] | null;
    website: string | null;
    openingHours: Array<{ day: string; open?: string; close?: string; closed?: boolean }> | null;
    about?: string | null;
    aboutStatus?: "draft" | "published";
    aboutApprovedAt?: Date | null;
    googleMapsUrl?: string | null;
    googleBusinessStatus?: string | null;
    googleTypes?: string[];
    googleUtcOffsetMinutes?: number | null;
    googlePlusCode?: string | null;
    googleRating: string | null;
    googleRatingCount: number;
    medisecoursRating: string | null;
    medisecoursRatingCount: number;
    isOpenNow: boolean | null;
    verificationStatus: "unverified" | "verified" | "claimed";
    lastSyncedAt: Date | null;
  };
  media: MediaItem[];
  reviews: ReviewItem[];
};

export type SimilarFacility = {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  googleRating: string | null;
  googleRatingCount: number;
  category: string;
  categoryLabel: string;
};

const tabs = ["Infos", "Photos & vidéos", "Avis", "À propos"] as const;
type Tab = (typeof tabs)[number];
type MediaFilter = "all" | "image" | "video";
type ReviewSort = "relevant" | "recent" | "positive" | "critical";

export const facilityDrawerViewportClass = "fixed inset-0 z-40 min-h-0 overflow-y-auto overscroll-contain border-r border-slate-200 bg-white md:left-0 md:right-auto md:w-[500px]";
export const facilityDrawerScrollClass = "px-5 py-5";

export function hasMobileDrawerScrollContract() {
  return facilityDrawerViewportClass.includes("inset-0") && facilityDrawerViewportClass.includes("min-h-0") && facilityDrawerViewportClass.includes("overflow-y-auto") && facilityDrawerViewportClass.includes("overscroll-contain");
}

type FacilityDrawerProps = {
  detail?: FacilityDetail;
  loading: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  initialTab?: Tab;
  similar?: SimilarFacility[];
  onOpenSimilar?: (facility: SimilarFacility) => void;
  onContributionPublished?: () => void;
  onRouteRequest?: (destination: { latitude: number; longitude: number; facilityId?: number; googlePlaceId?: string }, travelMode: "DRIVING" | "WALKING" | "BICYCLING") => void;
  onSosRequest?: (destination: { latitude: number; longitude: number; facilityId?: number; googlePlaceId?: string }) => void;
};

function StarRating({ value, size = "h-4 w-4" }: { value: string | null; size?: string }) {
  const rating = Number(value ?? 0);
  return <span className="inline-flex items-center gap-0.5 text-amber-400" aria-label={`Note ${rating} sur 5`}>{[1, 2, 3, 4, 5].map(index => <Star key={index} className={`${size} ${index <= Math.round(rating) ? "fill-current" : "text-slate-200"}`} />)}</span>;
}

function FacilityAction({ label, onClick, children, active = false, tone = "default" }: { label: string; onClick: () => void; children: ReactNode; active?: boolean; tone?: "default" | "sos" }) {
  const sos = tone === "sos";
  return <button type="button" onClick={onClick} className={`group flex min-w-0 w-full flex-col items-center gap-1.5 text-center text-[11px] font-medium leading-3 transition ${sos ? "text-rose-700" : "text-[#135b64]"}`}><span className={`grid h-10 w-10 place-items-center rounded-full transition group-hover:bg-[#e8f4f5] ${sos ? "bg-rose-50 text-rose-700" : active ? "bg-[#d8f0f2] text-[#087f8c]" : "bg-[#f1f5f5] text-[#135b64]"}`}>{children}</span><span className="min-h-6 max-w-full text-balance">{label}</span></button>;
}

function CollapsibleInfo({ title, icon, children, open = false }: { title: string; icon: ReactNode; children: ReactNode; open?: boolean }) {
  return <details open={open} className="group border-b border-slate-100 px-1"><summary className="flex cursor-pointer list-none items-center gap-3 py-4 font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">{icon}<span className="flex-1">{title}</span><ChevronDown className="h-5 w-5 text-slate-400 transition group-open:rotate-180" /></summary><div className="border-t border-slate-100 pb-4 pt-3 text-sm leading-6 text-slate-600">{children}</div></details>;
}

function ReviewActions({ reviewId, onShare }: { reviewId: number; onShare: () => void }) {
  const [liked, setLiked] = useState(false);
  return <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
    <button type="button" onClick={() => setLiked(value => !value)} aria-pressed={liked} className={`inline-flex items-center gap-1.5 text-xs font-medium ${liked ? "text-[#087f8c]" : "text-slate-500 hover:text-[#087f8c]"}`}><ThumbsUp className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />{liked ? "J’aime" : "J’aime"}</button>
    <button type="button" onClick={onShare} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#087f8c]"><Share2 className="h-4 w-4" />Partager</button>
  </div>;
}

export function FacilityDrawer({ detail, loading, isAuthenticated, onClose, initialTab = "Infos", similar = [], onOpenSimilar, onContributionPublished, onRouteRequest, onSosRequest }: FacilityDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [reviewMediaCaption, setReviewMediaCaption] = useState("");
  const [reviewMedia, setReviewMediaFiles] = useState<(File[] & { name?: string })>([]);
  const setReviewMedia = (value: File | File[] | undefined) => {
    if (!value) return setReviewMediaFiles([]);
    const files = Array.isArray(value) ? value : [value];
    setReviewMediaFiles(files as File[] & { name?: string });
  };
  const [reviewComposerOpen, setReviewComposerOpen] = useState(false);
  const [reviewSort, setReviewSort] = useState<ReviewSort>("relevant");
  const [suggestion, setSuggestion] = useState("");
  const [routeOptionsOpen, setRouteOptionsOpen] = useState(false);
  const [collectionOptionsOpen, setCollectionOptionsOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const accountDashboard = trpc.account.dashboard.useQuery(undefined, { enabled: isAuthenticated, staleTime: 10_000 });
  const reviewMutation = trpc.facilities.submitReview.useMutation({
    onSuccess: result => { toast.success(result.message); setReviewTitle(""); setReviewContent(""); setReviewMediaCaption(""); setReviewMedia([]); setReviewComposerOpen(false); onContributionPublished?.(); },
    onError: error => toast.error(error.message),
  });
  const placeReviewMutation = trpc.facilities.submitPlaceReview.useMutation({
    onSuccess: result => { toast.success(result.message); setReviewTitle(""); setReviewContent(""); setReviewMediaCaption(""); setReviewMedia([]); setReviewComposerOpen(false); onContributionPublished?.(); },
    onError: error => toast.error(error.message),
  });
  const mediaMutation = trpc.facilities.submitMedia.useMutation({
    onSuccess: result => { toast.success(result.message); setMediaCaption(""); onContributionPublished?.(); },
    onError: error => toast.error(error.message),
  });
  const suggestionMutation = trpc.facilities.suggestEdit.useMutation({ onSuccess: result => { toast.success(result.message); setSuggestion(""); }, onError: error => toast.error(error.message) });
  const togglePlaceMutation = trpc.account.togglePlace.useMutation({
    onSuccess: async result => {
      toast.success(result.active ? "Établissement ajouté à votre liste." : "Établissement retiré de votre liste.");
      await accountDashboard.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const recordRouteMutation = trpc.account.recordRoute.useMutation({ onError: error => toast.error(error.message) });
  const createCollectionMutation = trpc.account.createCollection.useMutation({
    onSuccess: async result => { toast.success(`Collection « ${result.collection.name} » créée.`); setCollectionName(""); await accountDashboard.refetch(); },
    onError: error => toast.error(error.message),
  });
  const addToCollectionMutation = trpc.account.addToCollection.useMutation({
    onSuccess: async result => { toast.success(result.added ? "Établissement ajouté à la collection." : "Cet établissement est déjà dans cette collection."); await accountDashboard.refetch(); },
    onError: error => toast.error(error.message),
  });

  if (loading || !detail) return <aside className={`${facilityDrawerViewportClass} p-6`}><div className="animate-pulse space-y-5"><div className="h-36 rounded-2xl bg-slate-200" /><div className="h-7 w-64 rounded bg-slate-200" /><div className="h-24 rounded-2xl bg-slate-100" /></div></aside>;

  const { facility, media, reviews: rawReviews } = detail;
  const accountTarget = facility.isLive && facility.googlePlaceId ? { googlePlaceId: facility.googlePlaceId } : { facilityId: facility.id };
  const accountTargetKey = facility.isLive && facility.googlePlaceId ? `place:${facility.googlePlaceId}` : `facility:${facility.id}`;
  const isSaved = Boolean(accountDashboard.data?.places.some(entry => entry.item.listType === "saved" && entry.item.targetKey === accountTargetKey));
  const isWishlisted = Boolean(accountDashboard.data?.places.some(entry => entry.item.listType === "wishlist" && entry.item.targetKey === accountTargetKey));
  const displayedRating = facility.medisecoursRating ?? facility.googleRating;
  const displayedCount = facility.medisecoursRatingCount || facility.googleRatingCount;
  const googleMapsUrl = facility.googleMapsUrl || googleMapsPlaceUrl(facility);
  const directionsUrl = googleDirectionsUrl(facility);
  const galleryMedia = mediaFilter === "all" ? media : media.filter(item => item.mediaType === mediaFilter);
  const cover = media.find(item => item.mediaType === "image");
  const photoCount = media.filter(item => item.mediaType === "image").length;
  const videoCount = media.filter(item => item.mediaType === "video").length;
  const ratingHistogram = [5, 4, 3, 2, 1].map(value => ({ value, count: rawReviews.filter(({ review }) => review.rating === value).length }));
  const maxHistogram = Math.max(1, ...ratingHistogram.map(item => item.count));
  const mediaUrl = (item: MediaItem) => item.photoReference ? googlePlacePhotoProxyUrl(item.photoReference) : item.url;
  const reviews = [...rawReviews].sort((left, right) => {
    if (reviewSort === "recent") return new Date(right.review.createdAt).getTime() - new Date(left.review.createdAt).getTime();
    if (reviewSort === "positive") return right.review.rating - left.review.rating || new Date(right.review.createdAt).getTime() - new Date(left.review.createdAt).getTime();
    if (reviewSort === "critical") return left.review.rating - right.review.rating || new Date(right.review.createdAt).getTime() - new Date(left.review.createdAt).getTime();
    return Number(right.source === "medisecours") - Number(left.source === "medisecours") || new Date(right.review.createdAt).getTime() - new Date(left.review.createdAt).getTime();
  });
  const requestLogin = () => { window.location.assign("/connexion"); };
  const submitReview = (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return requestLogin();
    const send = (media: Array<{ dataUrl: string; caption?: string }> | undefined) => facility.isLive && facility.googlePlaceId
      ? placeReviewMutation.mutate({ googlePlaceId: facility.googlePlaceId, rating, title: reviewTitle || undefined, content: reviewContent, media })
      : reviewMutation.mutate({ facilityId: facility.id, rating, title: reviewTitle || undefined, content: reviewContent, media });
    if (!reviewMedia.length) return send(undefined);
    Promise.all(reviewMedia.map(file => new Promise<{ dataUrl: string; caption?: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve({ dataUrl: reader.result, caption: reviewMediaCaption || undefined }) : reject(new Error("Lecture impossible"));
      reader.onerror = () => reject(reader.error ?? new Error("Lecture impossible"));
      reader.readAsDataURL(file);
    }))).then(send).catch(error => toast.error(error instanceof Error ? error.message : "Lecture du média impossible."));
  };
  const onReviewMediaSelect = (files: FileList | null) => {
    const selected = Array.from(files ?? []);
    if (selected.length > 5) return toast.error("Vous pouvez joindre au maximum 5 images.");
    const invalid = selected.find(file => !file.type.startsWith("image/") || file.size > 2 * 1024 * 1024);
    if (invalid) return toast.error("Chaque image doit être au format image et peser au maximum 2 Mo.");
    setReviewMedia(selected);
  };
  const submitSuggestion = (event: FormEvent) => { event.preventDefault(); if (!isAuthenticated) return requestLogin(); suggestionMutation.mutate({ facilityId: facility.id, fieldName: "other", proposedValue: suggestion }); };
  const onMediaSelect = (file?: File) => {
    if (!file) return;
    if (!isAuthenticated) return requestLogin();
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") mediaMutation.mutate({ facilityId: facility.id, dataUrl: reader.result, caption: mediaCaption || undefined }); };
    reader.readAsDataURL(file);
  };
  const togglePersonalList = (listType: "saved" | "wishlist") => {
    if (!isAuthenticated) return requestLogin();
    togglePlaceMutation.mutate({ listType, ...accountTarget });
  };
  const startRoute = (travelMode: "DRIVING" | "WALKING" | "BICYCLING") => {
    if (!isAuthenticated) return requestLogin();
    recordRouteMutation.mutate({ ...accountTarget, travelMode });
    if (onRouteRequest) onRouteRequest({ latitude: facility.latitude, longitude: facility.longitude, ...accountTarget }, travelMode);
    else window.open(`${directionsUrl}&travelmode=${travelMode.toLowerCase()}`, "_blank", "noopener,noreferrer");
    setRouteOptionsOpen(false);
  };
  const addToCollection = (collectionId: number) => {
    if (!isAuthenticated) return requestLogin();
    addToCollectionMutation.mutate({ collectionId, ...accountTarget });
  };
  const createCollection = (event: FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) return requestLogin();
    createCollectionMutation.mutate({ name: collectionName });
  };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: facility.name, text: `${facility.name} — ${facility.address}`, url: googleMapsUrl }); else { await navigator.clipboard.writeText(`${facility.name}\n${facility.address}\n${googleMapsUrl}`); toast.success("Lien de l’établissement copié."); } } catch (error) { if ((error as Error).name !== "AbortError") toast.error("Le partage n’a pas pu être ouvert."); } };
  const sendToPhone = () => { window.location.href = phoneSmsUrl(facility); toast.success("Le message est prêt à être envoyé depuis votre application SMS."); };
  const startSos = () => {
    if (!isAuthenticated) return requestLogin();
    if (!onSosRequest) return toast.error("Le service SOS n’est pas disponible actuellement.");
    onSosRequest({ latitude: facility.latitude, longitude: facility.longitude, ...accountTarget });
  };

  return <aside className={facilityDrawerViewportClass}>
    <div className="relative h-32 shrink-0 overflow-hidden bg-gradient-to-br from-[#11405e] via-[#0b8a96] to-[#7acbd3] md:h-44">
      {cover ? <img src={mediaUrl(cover)} alt={`Vue de ${facility.name}`} className="h-full w-full object-cover" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,.22),transparent_32%),linear-gradient(135deg,rgba(16,43,70,.2),rgba(11,138,150,.18))]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-[#102b46]/70 via-transparent to-transparent" />
      <p className="absolute bottom-3 left-5 flex items-center gap-2 text-xs font-semibold text-white/90"><Building2 className="h-4 w-4" />{cover?.source === "google" ? "Photo publique Google Maps" : cover ? "Média public MediSecours" : "Fiche cartographique MediSecours"}</p>
      <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-white/95 p-2 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900" aria-label="Fermer la fiche"><X className="h-5 w-5" /></button>
    </div>
    <div className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0b8a96]"><Building2 className="h-4 w-4" />{facility.categoryLabel || facility.category.replaceAll("_", " ")}</div><h2 className="text-xl font-bold tracking-tight text-[#102b46]">{facility.name}</h2><div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600"><StarRating value={displayedRating} /><span className="font-semibold text-slate-800">{Number(displayedRating ?? 0).toLocaleString("fr-CM", { maximumFractionDigits: 1 })}</span><span>({displayedCount} avis MediSecours)</span>{facility.verificationStatus !== "unverified" && <span className="inline-flex items-center gap-1 font-medium text-[#0b8a96]"><BadgeCheck className="h-4 w-4" />Vérifié</span>}</div>{facility.isLive && <p className="mt-1 text-xs font-medium text-[#087f8c]">{facility.googleRatingCount.toLocaleString("fr-CM")} avis Google au total · données affichées à la demande</p>}</div>
    <div className="shrink-0 border-b border-slate-200 px-4"><div className="flex" role="tablist" aria-label="Détails de l’établissement">{tabs.map(tab => <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`relative flex-1 whitespace-nowrap px-1 py-3 text-xs font-semibold ${activeTab === tab ? "text-[#087f8c]" : "text-slate-500 hover:text-slate-800"}`}>{tab}{activeTab === tab && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-[#0b8a96]" />}</button>)}</div></div>
    <div className="shrink-0 border-b border-slate-100 px-4 py-3"><div className="grid grid-cols-4 gap-x-1.5 gap-y-3"><FacilityAction label="Itinéraire" onClick={() => setRouteOptionsOpen(value => !value)} active={routeOptionsOpen}><Navigation2 className="h-5 w-5" /></FacilityAction><FacilityAction label={isSaved ? "Enregistré" : "Enregistrer"} onClick={() => togglePersonalList("saved")} active={isSaved}><Bookmark className={`h-5 w-5 ${isSaved ? "fill-current" : ""}`} /></FacilityAction><FacilityAction label={isWishlisted ? "Souhaité" : "Souhait"} onClick={() => togglePersonalList("wishlist")} active={isWishlisted}><Heart className={`h-5 w-5 ${isWishlisted ? "fill-current" : ""}`} /></FacilityAction><FacilityAction label="Collection" onClick={() => setCollectionOptionsOpen(value => !value)} active={collectionOptionsOpen}><Bookmark className="h-5 w-5" /></FacilityAction><FacilityAction label="À proximité" onClick={() => window.open(googleNearbyHealthUrl(facility), "_blank", "noopener,noreferrer")}><UsersRound className="h-5 w-5" /></FacilityAction><FacilityAction label="Vers téléphone" onClick={sendToPhone}><Smartphone className="h-5 w-5" /></FacilityAction><FacilityAction label="Partager" onClick={() => void share()}><Share2 className="h-5 w-5" /></FacilityAction><FacilityAction label="SOS urgence" tone="sos" onClick={startSos}><Siren className="h-5 w-5" /></FacilityAction></div>{routeOptionsOpen && <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-[#eefbfc] p-2"><button type="button" onClick={() => startRoute("DRIVING")} className="rounded-xl bg-white px-2 py-2 text-xs font-bold text-[#087f8c] shadow-sm hover:bg-[#dff7fa]">Voiture</button><button type="button" onClick={() => startRoute("WALKING")} className="rounded-xl bg-white px-2 py-2 text-xs font-bold text-[#087f8c] shadow-sm hover:bg-[#dff7fa]">À pied</button><button type="button" onClick={() => startRoute("BICYCLING")} className="rounded-xl bg-white px-2 py-2 text-xs font-bold text-[#087f8c] shadow-sm hover:bg-[#dff7fa]">Vélo</button></div>}{collectionOptionsOpen && <div className="mt-3 rounded-2xl bg-[#eefbfc] p-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#087f8c]">Ajouter à une collection privée</p>{accountDashboard.data?.collections?.length ? <div className="mt-2 flex flex-wrap gap-2">{accountDashboard.data.collections.map(entry => <button type="button" key={entry.collection.id} onClick={() => addToCollection(entry.collection.id)} disabled={addToCollectionMutation.isPending} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#135b64] shadow-sm hover:bg-[#dff7fa]">{entry.collection.name}</button>)}</div> : <p className="mt-2 text-xs text-slate-600">Créez votre première collection pour classer vos établissements.</p>}<form onSubmit={createCollection} className="mt-3 flex gap-2"><input value={collectionName} onChange={event => setCollectionName(event.target.value)} required minLength={2} maxLength={80} placeholder="Ex. Urgences à proximité" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0b8a96]" /><button type="submit" disabled={createCollectionMutation.isPending} className="rounded-xl bg-[#0b8a96] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Créer</button></form></div>}</div>
    <div className={facilityDrawerScrollClass}>
      {activeTab === "Avis" && <button type="button" onClick={() => setReviewComposerOpen(true)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#102b46] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#183c5f]"><Star className="h-4 w-4" />Rédiger un avis</button>}
      {activeTab === "Avis" && <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Trier les avis">{([{ id: "relevant", label: "Pertinence" }, { id: "recent", label: "Les plus récents" }, { id: "positive", label: "Les plus favorables" }, { id: "critical", label: "Les plus critiques" }] as Array<{ id: ReviewSort; label: string }>).map(option => <button type="button" key={option.id} onClick={() => setReviewSort(option.id)} aria-pressed={reviewSort === option.id} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${reviewSort === option.id ? "bg-[#0b8a96] text-white" : "bg-slate-100 text-slate-600 hover:bg-[#eefbfc] hover:text-[#087f8c]"}`}>{option.label}</button>)}</div>}
      {activeTab === "Infos" && <div className="space-y-3"><div className="flex gap-3 rounded-2xl bg-[#eefbfc] p-4"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#0b8a96]" /><div><p className="font-semibold text-slate-800">{facility.address}</p><p className="mt-1 text-sm text-slate-500">{[facility.district, facility.city, facility.region].filter(Boolean).join(", ")}</p></div></div><CollapsibleInfo title={facility.isOpenNow ? "Ouvert actuellement" : "Horaires à vérifier"} icon={<Clock3 className="h-5 w-5 text-[#0b8a96]" />}>{facility.openingHours?.length ? <ul className="space-y-1">{facility.openingHours.map(item => <li key={item.day}>{item.open || item.close ? `${item.day} : ${item.closed ? "Fermé" : `${item.open ?? ""} – ${item.close ?? ""}`}` : item.day}</li>)}</ul> : "Horaires non renseignés."}</CollapsibleInfo><CollapsibleInfo title="Coordonnées et contacts" icon={<Phone className="h-5 w-5 text-[#0b8a96]" />}>{(facility.phones ?? []).length ? (facility.phones ?? []).map(phone => <a key={phone} href={`tel:${phone.replaceAll(" ", "")}`} className="mb-2 flex font-medium text-[#087f8c] hover:underline">{phone}</a>) : <p>Aucun numéro renseigné.</p>}{facility.website && <a href={facility.website} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 font-medium text-[#087f8c] hover:underline"><ExternalLink className="h-4 w-4" />{facility.website.replace(/^https?:\/\//, "")}</a>}</CollapsibleInfo><CollapsibleInfo title="Informations de la fiche" icon={<ShieldCheck className="h-5 w-5 text-[#0b8a96]" />}>{facility.lastSyncedAt ? `Dernière mise à jour : ${new Date(facility.lastSyncedAt).toLocaleString("fr-CM")}` : "Informations disponibles selon la dernière réponse cartographique."}{facility.isLive && <dl className="mt-3 space-y-1 text-xs"><div><dt className="inline font-semibold text-slate-700">Avis Google au total : </dt><dd className="inline">{facility.googleRatingCount.toLocaleString("fr-CM")}</dd></div>{facility.googleBusinessStatus && <div><dt className="inline font-semibold text-slate-700">Statut Google : </dt><dd className="inline">{facility.googleBusinessStatus}</dd></div>}{facility.googleTypes?.length ? <div><dt className="inline font-semibold text-slate-700">Types : </dt><dd className="inline">{facility.googleTypes.join(", ")}</dd></div> : null}{facility.googlePlusCode && <div><dt className="inline font-semibold text-slate-700">Plus Code : </dt><dd className="inline">{facility.googlePlusCode}</dd></div>}{facility.googleUtcOffsetMinutes !== null && facility.googleUtcOffsetMinutes !== undefined && <div><dt className="inline font-semibold text-slate-700">Fuseau UTC : </dt><dd className="inline">UTC{facility.googleUtcOffsetMinutes >= 0 ? "+" : ""}{Math.trunc(facility.googleUtcOffsetMinutes / 60)}</dd></div>}{facility.googleMapsUrl && <div><a href={facility.googleMapsUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#087f8c] hover:underline">Ouvrir la fiche Google Maps</a></div>}</dl>}</CollapsibleInfo><button type="button" onClick={() => setRouteOptionsOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b8a96] px-4 py-3 font-semibold text-white hover:bg-[#08717b]"><MapPin className="h-4 w-4" />Préparer un itinéraire</button>{similar.length > 0 && <section className="pt-2"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-[#102b46]">Établissements similaires</h3><span className="text-xs text-slate-500">À proximité</span></div><div className="space-y-2">{similar.map(item => <button type="button" key={item.placeId} onClick={() => onOpenSimilar?.(item)} className="w-full rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition hover:border-[#0b8a96] hover:bg-[#eefbfc]"><p className="truncate font-semibold text-slate-800">{item.name}</p><p className="mt-1 truncate text-xs text-slate-500">{item.address}</p><p className="mt-2 text-xs font-semibold text-amber-600">★ {Number(item.googleRating ?? 0).toLocaleString("fr-CM", { maximumFractionDigits: 1 })} · {item.googleRatingCount} avis</p></button>)}</div></section>}</div>}
      {activeTab === "Photos & vidéos" && <div className="space-y-5"><section className="overflow-hidden rounded-3xl border border-slate-100 bg-slate-50"><div className="grid grid-cols-2 gap-px bg-slate-200">{cover ? <img src={mediaUrl(cover)} alt={`Couverture ${facility.name}`} className="aspect-[4/3] h-full w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-[#0b8a96] to-[#102b46] p-5 text-center text-sm font-semibold text-white">Aucun média public disponible actuellement.</div>}<div className="grid aspect-[4/3] place-items-end bg-[#102b46] p-4 text-white"><p className="rounded-full bg-black/30 px-3 py-1 text-sm font-semibold">{photoCount + videoCount} média{photoCount + videoCount > 1 ? "s" : ""}</p></div></div><div className="flex gap-2 overflow-x-auto p-3"><button onClick={() => setMediaFilter("all")} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${mediaFilter === "all" ? "bg-[#0b8a96] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>Tout ({media.length})</button><button onClick={() => setMediaFilter("image")} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${mediaFilter === "image" ? "bg-[#0b8a96] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>Photos ({photoCount})</button><button onClick={() => setMediaFilter("video")} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${mediaFilter === "video" ? "bg-[#0b8a96] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>Vidéos ({videoCount})</button></div></section>{galleryMedia.length ? <div className="grid grid-cols-2 gap-3">{galleryMedia.map(item => item.mediaType === "video" ? <video key={item.id} controls preload="metadata" className="aspect-square w-full rounded-2xl bg-slate-900 object-cover"><source src={mediaUrl(item)} /></video> : <figure key={item.id}><img src={mediaUrl(item)} alt={item.caption || `Photo de ${facility.name}`} loading="lazy" className="aspect-square w-full rounded-2xl object-cover" /><figcaption className="mt-1 px-1 text-xs text-slate-500">{item.caption}</figcaption></figure>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center"><FileImage className="mx-auto h-7 w-7 text-[#0b8a96]" /><p className="mt-2 font-semibold text-slate-700">Aucun média public disponible</p><p className="mt-1 text-sm leading-6 text-slate-500">Les médias Google Maps sont chargés à la demande ; les membres peuvent aussi ajouter leurs propres médias.</p></div>}{!media.length && <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-[#eefbfc] p-4 text-sm font-semibold text-[#087f8c] hover:bg-[#dff7fa]"><ExternalLink className="h-4 w-4" />Voir les médias publics sur Google Maps</a>}{!facility.isLive && <div className="rounded-2xl bg-[#eefbfc] p-4"><p className="font-semibold text-[#102b46]">Ajouter des photos ou vidéos</p><input value={mediaCaption} onChange={event => setMediaCaption(event.target.value)} placeholder="Légende facultative" className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0b8a96]" /><label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0b8a96] px-4 py-3 font-semibold text-white hover:bg-[#08717b]"><ImagePlus className="h-4 w-4" />{mediaMutation.isPending ? "Envoi…" : "Ajouter un média"}<input type="file" accept="image/*,video/*" className="hidden" onChange={event => onMediaSelect(event.target.files?.[0])} disabled={mediaMutation.isPending} /></label>{!isAuthenticated && <p className="mt-2 text-center text-xs text-slate-500">Connectez-vous pour ajouter un média.</p>}</div>}</div>}
      {activeTab === "Avis" && <div className="space-y-5"><section className="rounded-3xl bg-[#eefbfc] p-5"><p className="text-sm font-semibold text-slate-600">Résumé des avis disponibles</p><div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-5"><div className="space-y-2">{ratingHistogram.map(item => <div key={item.value} className="flex items-center gap-2 text-xs"><span className="w-3">{item.value}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-white"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${(item.count / maxHistogram) * 100}%` }} /></span><span className="w-4 text-right">{item.count}</span></div>)}</div><div className="text-center"><p className="text-4xl font-bold text-[#102b46]">{Number(displayedRating ?? 0).toLocaleString("fr-CM", { maximumFractionDigits: 1 })}</p><StarRating value={displayedRating} /><p className="mt-1 text-xs text-slate-500">{facility.isLive ? `${facility.googleRatingCount.toLocaleString("fr-CM")} avis Google` : `${displayedCount} avis`}</p></div></div></section>{facility.isLive && <p className="rounded-2xl border border-[#b8e9ed] bg-white px-4 py-3 text-xs leading-5 text-slate-600">Google retourne le compteur total exact ci-dessus et les {reviews.filter(item => item.source === "google").length} texte{reviews.filter(item => item.source === "google").length > 1 ? "s" : ""} d’avis disponibles dans la réponse en direct. Vos avis MediSecours sont publiés séparément, immédiatement sur cette fiche.</p>}<form onSubmit={submitReview} className="rounded-2xl border border-slate-200 p-4"><p className="font-semibold text-slate-800">Rédiger un avis MediSecours</p><div className="mt-3 flex gap-1">{[1, 2, 3, 4, 5].map(value => <button type="button" key={value} onClick={() => setRating(value)} className="p-1" aria-label={`${value} étoiles`}><Star className={`h-6 w-6 ${value <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} /></button>)}</div><input value={reviewTitle} onChange={event => setReviewTitle(event.target.value)} placeholder="Titre facultatif" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0b8a96]" /><textarea value={reviewContent} onChange={event => setReviewContent(event.target.value)} placeholder="Décrivez votre expérience sans information médicale personnelle." className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0b8a96]" /><label className="mt-3 block text-sm font-semibold text-slate-700">Joindre un média à l’avis<input value={reviewMediaCaption} onChange={event => setReviewMediaCaption(event.target.value)} placeholder="Légende facultative du média" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-[#0b8a96]" /><span className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#0b8a96] px-3 py-2.5 text-sm font-semibold text-[#087f8c]"><ImagePlus className="h-4 w-4" />{reviewMedia ? reviewMedia.name : "Joindre photo ou vidéo"}<input type="file" accept="image/*,video/*" className="hidden" onChange={event => setReviewMedia(event.target.files?.[0])} /></span></label><p className="mt-2 text-xs leading-5 text-slate-500">Le média sélectionné est rattaché à votre avis et publié immédiatement avec votre contribution.</p><button type="submit" disabled={reviewMutation.isPending || placeReviewMutation.isPending} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#102b46] px-4 py-3 font-semibold text-white disabled:opacity-60"><Send className="h-4 w-4" />{isAuthenticated ? "Publier l’avis" : "Se connecter pour noter"}</button></form>{facility.isLive && <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-[#b8e9ed] bg-[#eefbfc] p-4 text-sm leading-6 text-slate-700 hover:bg-[#dff7fa]"><ExternalLink className="h-5 w-5 shrink-0 text-[#087f8c]" /><span>Les avis Google affichés ci-dessous sont chargés en direct depuis la fiche publique.</span></a>}<section><h3 className="font-bold text-[#102b46]">{facility.isLive ? `Avis disponibles (${reviews.length})` : `Avis (${reviews.length})`}</h3><div className="mt-3 space-y-4">{reviews.length ? reviews.map(({ review, author, authorAttribution, relativeTimeDescription, source }) => { const attachments = media.filter(item => item.reviewId === review.id); return <article key={`${source || "medisecours"}-${review.id}`} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2">{authorAttribution?.photoUri && <img src={authorAttribution.photoUri} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />}<div><p className="font-semibold text-slate-800">{author || "Utilisateur MediSecours"}</p><StarRating value={String(review.rating)} />{source === "google" && authorAttribution?.uri && <a href={authorAttribution.uri} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-medium text-[#087f8c] hover:underline">Profil Google Maps</a>}</div></div><span className="text-xs text-slate-500">{relativeTimeDescription || new Date(review.createdAt).toLocaleDateString("fr-CM")}</span></div>{review.title && <p className="mt-3 font-medium text-slate-800">{review.title}</p>}{review.content && <p className="mt-1 text-sm leading-6 text-slate-600">{review.content}</p>}{source === "google" && <p className="mt-3 text-xs font-medium text-[#087f8c]">Source : Google Maps</p>}{source === "medisecours" && facility.isLive && <p className="mt-3 text-xs font-medium text-[#087f8c]">Contribution MediSecours publiée</p>}{attachments.length ? <div className="mt-3 grid grid-cols-2 gap-2">{attachments.map(item => item.mediaType === "video" ? <video key={item.id} controls className="aspect-square w-full rounded-xl bg-slate-900 object-cover"><source src={mediaUrl(item)} /></video> : <img key={item.id} src={mediaUrl(item)} alt={item.caption || "Média joint à cet avis"} className="aspect-square w-full rounded-xl object-cover" />)}</div> : null}</article>; }) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Aucun texte d’avis public disponible dans la réponse actuelle.</p>}</div></section></div>}
      {activeTab === "À propos" && <div className="space-y-5">{facility.about ? <div className="rounded-2xl border border-[#b8e9ed] bg-[#eefbfc] p-4"><div className="flex items-center gap-2 font-semibold text-[#102b46]"><ShieldCheck className="h-5 w-5 text-[#0b8a96]" />{facility.isLive ? "Informations publiques Google Maps" : "Informations MediSecours"}</div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{facility.about}</p>{facility.isLive && <p className="mt-3 text-xs text-slate-500">Affiché à la demande depuis la fiche publique.</p>}</div> : <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 font-semibold text-[#102b46]"><ShieldCheck className="h-5 w-5 text-[#0b8a96]" />Informations complémentaires</div><p className="mt-2 text-sm leading-6 text-slate-600">Cette source ne fournit pas de description publique complémentaire actuellement.</p></div>}<CollapsibleInfo title="Coordonnées GPS" icon={<MapPin className="h-5 w-5 text-[#0b8a96]" />}>{facility.latitude.toFixed(6)}, {facility.longitude.toFixed(6)}</CollapsibleInfo>{!facility.isLive ? <form onSubmit={submitSuggestion} className="rounded-2xl border border-slate-200 p-4"><p className="font-semibold text-slate-800">Suggérer une modification</p><textarea required minLength={2} value={suggestion} onChange={event => setSuggestion(event.target.value)} placeholder="Ex. nouveau numéro, changement d’horaires, précision d’adresse…" className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0b8a96]" /><button type="submit" disabled={suggestionMutation.isPending} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#0b8a96] px-4 py-3 text-sm font-semibold text-[#087f8c] hover:bg-[#eefbfc]"><Send className="h-4 w-4" />{isAuthenticated ? "Envoyer la suggestion" : "Se connecter pour suggérer"}</button></form> : <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-[#b8e9ed] bg-[#eefbfc] p-4 text-sm leading-6 text-slate-700 hover:bg-[#dff7fa]"><ExternalLink className="h-5 w-5 shrink-0 text-[#087f8c]" /><span>Voir la fiche publique Google Maps pour les informations complémentaires.</span></a>}</div>}
    </div>
    {reviewComposerOpen && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/30 p-0 md:items-center md:p-6" role="dialog" aria-modal="true" aria-label="Rédiger un avis">
      <form onSubmit={submitReview} className="w-full max-w-lg border border-slate-200 bg-white p-5 md:rounded-2xl">
        <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0b8a96]">Votre avis</p><h3 className="mt-1 text-xl font-semibold text-[#102b46]">Rédiger un avis</h3></div><button type="button" onClick={() => setReviewComposerOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer"><X className="h-5 w-5" /></button></div>
        <div className="mt-4 flex gap-1">{[1, 2, 3, 4, 5].map(value => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} étoiles`}><Star className={`h-6 w-6 ${value <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} /></button>)}</div>
        <input value={reviewTitle} onChange={event => setReviewTitle(event.target.value)} placeholder="Titre facultatif" className="mt-4 w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0b8a96]" />
        <textarea value={reviewContent} onChange={event => setReviewContent(event.target.value)} required minLength={2} placeholder="Partagez votre expérience..." className="mt-2 min-h-28 w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0b8a96]" />
        <label className="mt-3 block text-sm font-medium text-slate-700">Ajouter jusqu’à 5 images (2 Mo maximum par image)<input type="file" accept="image/*" multiple className="mt-2 block w-full text-sm" onChange={event => onReviewMediaSelect(event.target.files)} /></label>
        <p className="mt-2 text-xs text-slate-500">{reviewMedia.length ? `${reviewMedia.length} image(s) sélectionnée(s)` : "Aucune image sélectionnée"}</p>
        <button type="submit" disabled={reviewMutation.isPending || placeReviewMutation.isPending} className="mt-4 w-full bg-[#0b8a96] px-4 py-3 text-sm font-semibold text-white hover:bg-[#08717b] disabled:opacity-60">{isAuthenticated ? "Publier l’avis" : "Se connecter pour noter"}</button>
        <ReviewActions reviewId={0} onShare={() => void share()} />
      </form>
    </div>}
  </aside>;
}
