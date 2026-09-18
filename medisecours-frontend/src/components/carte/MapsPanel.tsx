'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Bookmark, ChevronLeft, Clock, FolderPlus, History, MapPin, MoreHorizontal, Navigation, Phone, Search, Send, Share2, ShieldCheck, Star, ThumbsUp, X } from 'lucide-react'
import useSWR, { mutate } from 'swr'
import api from '../../api/axios'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../ui/Toast'
import { FicheInfos, MediaGallery, type EtablissementDrawerProps } from './EtablissementDrawer'
import { formatDistanceKm, formatDuration, getEtablissementPhoto, haversineKm, toGoogleMapsUrl, toWazeUrl, WAYFINDING_MODES, type Avis, type FicheCentre } from '../../lib/carte'
import { imgUrl } from '../../lib/config'

type View = 'explore' | 'saved' | 'recent'
type Collection = { id: string; name: string; places: number[]; note: string }
const COLLECTION_KEY = 'medisecours_map_named_collections'

function ResultPhoto({ centre }: { centre: FicheCentre | EtablissementDrawerProps['visibleCentres'][number] }) {
  const photo = getEtablissementPhoto(centre)
  return <img className="maps-result-thumb" src={imgUrl(photo) ?? '/images/home-doctor-visit.jpg'} alt={photo ? centre.nom : 'Illustration de soins, pas une photo de cet etablissement'} loading="lazy" onError={event => {
    event.currentTarget.onerror = null
    event.currentTarget.src = '/images/home-doctor-visit.jpg'
    event.currentTarget.alt = 'Illustration de soins, pas une photo de cet etablissement'
  }} />
}

function Rating({ value }: { value: number }) {
  return <span className="maps-stars" aria-label={`${value} sur 5`}>{[1, 2, 3, 4, 5].map(star => <Star key={star} size={14} fill={star <= Math.round(value) ? 'currentColor' : 'none'} />)}</span>
}

function Action({ icon, children, onClick, active = false }: { icon: ReactNode; children: ReactNode; onClick: () => void; active?: boolean }) {
  return <button type="button" className="maps-action" onClick={onClick} aria-pressed={active}><span className={active ? 'maps-action-icon is-active' : 'maps-action-icon'}>{icon}</span><span>{children}</span></button>
}

export default function MapsPanel(props: EtablissementDrawerProps & { initialView: View; onViewChange: (view: View) => void }) {
  const { user, isAuthenticated, isMedecin } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<'presentation' | 'reviews' | 'about' | 'directions'>('presentation')
  const [sort, setSort] = useState('recent')
  const [reviewSearch, setReviewSearch] = useState('')
  const [composer, setComposer] = useState(false)
  const [note, setNote] = useState(0)
  const [comment, setComment] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [likes, setLikes] = useState<number[]>([])
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [collectionName, setCollectionName] = useState('')
  const [nearbyOnly, setNearbyOnly] = useState(false)
  const selected = props.visibleCentres.find(centre => centre.id === props.selectedId)
  const { data: detail, error: detailError } = useSWR<FicheCentre>(selected ? `/api/centre_de_santes/${selected.id}/fiche` : null)
  const { data: reviewResponse, error: reviewError, isLoading, mutate: refreshReviews } = useSWR<unknown>(selected ? `/api/avis_etablissements?etablissement=${selected.id}` : null)
  const facility = detail ? { ...selected, ...detail } : selected
  const reviews = useMemo(() => {
    const raw = reviewResponse as { member?: Avis[]; 'hydra:member'?: Avis[] } | Avis[] | undefined
    const values = Array.isArray(raw) ? raw : raw?.member ?? raw?.['hydra:member'] ?? []
    return values.filter(review => review.statut === 'PUBLIE').filter(review => !reviewSearch || `${review.auteurNom} ${review.commentaire}`.toLocaleLowerCase().includes(reviewSearch.toLocaleLowerCase())).sort((a, b) => {
      if (sort === 'positive') return b.note - a.note
      if (sort === 'critical') return a.note - b.note
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [reviewResponse, reviewSearch, sort])

  useEffect(() => {
    setTab('presentation'); setComposer(false); setNote(0); setComment(''); setFiles([]); setJoined(false)
  }, [props.selectedId])
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(COLLECTION_KEY) ?? '[]')
      if (Array.isArray(stored)) setCollections(stored.filter(item => typeof item?.id === 'string' && typeof item.name === 'string' && Array.isArray(item.places)))
    } catch { /* Local storage may be disabled. */ }
    if (isAuthenticated) {
      void api.get('/api/carte/collections').then(response => {
        const items = Array.isArray(response.data?.items) ? response.data.items : []
        setCollections(items.map((item: any) => ({
          id: String(item.id), name: String(item.name), note: String(item.note ?? ''), places: Array.isArray(item.places) ? item.places.map(Number) : [],
        })))
      }).catch(() => undefined)
    }
  }, [isAuthenticated])
  useEffect(() => {
    if (!composer && !collectionOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setComposer(false); setCollectionOpen(false) } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [composer, collectionOpen])

  const saveCollections = (next: Collection[]) => {
    try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(next)); setCollections(next) }
    catch { toast.error('Le stockage de cet appareil est indisponible.') }
    if (isAuthenticated) {
      for (const collection of next) {
        const numericId = Number(collection.id)
        const request = Number.isInteger(numericId)
          ? api.patch(`/api/carte/collections/${numericId}`, { name: collection.name, note: collection.note, places: collection.places })
          : api.post('/api/carte/collections', { name: collection.name, note: collection.note, places: collection.places })
        void request.catch(() => toast.info('La collection reste disponible localement, mais n’a pas pu être synchronisée.'))
      }
    }
  }
  const placeUrl = () => {
    const url = new URL('/carte', window.location.origin)
    if (selected) url.searchParams.set('centre', String(selected.id))
    return url.toString()
  }
  const share = async (text?: string) => {
    try {
      if (navigator.share) await navigator.share({ title: facility?.nom, text: text ?? facility?.adresse, url: placeUrl() })
      else { await navigator.clipboard.writeText(`${text ?? facility?.nom ?? ''}\n${placeUrl()}`); toast.success('Lien copie.') }
    } catch (cause) { if ((cause as Error).name !== 'AbortError') toast.error('Le partage est indisponible.') }
  }
  const submit = async () => {
    if (!selected || !note || sending) return
    setSending(true)
    try {
      if (files.length) {
        const form = new FormData()
        form.set('centre', String(selected.id)); form.set('note', String(note)); form.set('commentaire', comment.trim())
        files.forEach(file => form.append('images[]', file))
        await api.post('/api/avis_etablissements/avec-images', form)
      } else {
        await api.post('/api/avis_etablissements', { etablissement: `/api/centre_de_santes/${selected.id}`, note, commentaire: comment.trim() || null })
      }
      setComposer(false); setNote(0); setComment(''); setFiles([])
      await refreshReviews()
      void mutate(`/api/centre_de_santes/${selected.id}/fiche`)
      toast.success('Avis publie.')
    } catch (cause: any) { toast.error(cause?.response?.data?.error ?? 'Impossible de publier cet avis. Veuillez reessayer.') }
    finally { setSending(false) }
  }
  const join = async () => {
    if (!selected) return
    setJoining(true)
    try { await api.post('/api/affiliation_medecins', { etablissement: `/api/centre_de_santes/${selected.id}`, teleconsultation: false }); setJoined(true); toast.success('Demande envoyee.') }
    catch (cause: any) { if (cause?.response?.status === 409) setJoined(true); else toast.error('Impossible de transmettre la demande.') }
    finally { setJoining(false) }
  }

  const baseList = props.initialView === 'saved' ? props.visibleCentres.filter(centre => props.favorites.includes(centre.id))
    : props.initialView === 'recent' ? props.recentIds.flatMap(id => props.visibleCentres.filter(centre => centre.id === id))
      : props.visibleCentres
  const list = nearbyOnly && props.position
    ? baseList.filter(centre => (haversineKm(props.position, centre) ?? Number.POSITIVE_INFINITY) <= 25)
    : baseList
  const mean = facility?.noteMoyenne ?? 0
  const total = facility?.totalAvis ?? 0
  const hasCoords = facility?.latitude != null && facility.longitude != null

  return <>
    <nav className="maps-rail" aria-label="Mes lieux">
      {([['explore', MapPin, 'Explorer'], ['saved', Bookmark, 'Enregistres'], ['recent', History, 'Recents']] as const).map(([view, Icon, label]) => <button type="button" key={view} onClick={() => { props.onBackToList(); props.onViewChange(view) }} aria-pressed={props.initialView === view}><Icon size={22} /><span>{label}</span></button>)}
    </nav>
    {props.open && <aside className="maps-panel" aria-label={facility?.nom ?? 'Etablissements'}>
      {facility ? <>
        <div className="maps-cover"><MediaGallery centre={facility} compact /><button type="button" className="maps-cover-back" onClick={props.onBackToList} aria-label="Retour aux resultats"><ChevronLeft size={22} /></button><button type="button" className="maps-cover-close" onClick={props.onClose} aria-label="Fermer la fiche"><X size={20} /></button></div>
        <header className="maps-place-heading"><h1>{facility.nom}</h1><div className="maps-rating-line"><span>{mean.toFixed(1)}</span><Rating value={mean} /><button type="button" onClick={() => setTab('reviews')}>({total} avis)</button></div><p>{facility.type.replaceAll('_', ' ')}{facility.verificationStatut === 'VERIFIE' && <ShieldCheck size={15} aria-label="Verifie" />}</p></header>
        <div className="maps-tabs" role="tablist" aria-label="Fiche etablissement">{([['presentation', 'Presentation'], ['reviews', 'Avis'], ['about', 'A propos']] as const).map(([id, label]) => <button type="button" key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
        <div className="maps-actions">
          <Action icon={<Navigation size={20} />} onClick={() => { props.onRequestDirections(); setTab('directions') }}>Itineraire</Action>
          <Action icon={<Bookmark size={20} />} active={props.favorites.includes(facility.id)} onClick={() => props.onToggleFavorite(facility.id)}>{props.favorites.includes(facility.id) ? 'Enregistre' : 'Enregistrer'}</Action>
          <Action icon={<MapPin size={20} />} active={nearbyOnly} onClick={() => { setNearbyOnly(true); props.onBackToList(); props.onViewChange('explore') }}>A proximite</Action>
          <Action icon={<Send size={20} />} onClick={() => { window.location.href = `sms:?body=${encodeURIComponent(`${facility.nom}\n${placeUrl()}`)}` }}>Telephone</Action>
          <Action icon={<Share2 size={20} />} onClick={() => void share()}>Partager</Action>
        </div>
        <details className="maps-more"><summary><MoreHorizontal size={18} />Autres actions</summary><div>
          <button type="button" onClick={() => setCollectionOpen(true)}><FolderPlus size={18} />Ajouter a une collection</button>
          {facility.telephone && <a href={`tel:${facility.telephone}`}><Phone size={18} />Appeler</a>}
          <button type="button" onClick={props.onSosClick}><Phone size={18} />SOS urgence</button>
        </div></details>
        {detailError && <p role="status" className="maps-inline-status">Les details complementaires ne sont pas disponibles.</p>}
        <section className="maps-panel-content" role="tabpanel">
          {(tab === 'presentation' || tab === 'about') && <><FicheInfos fiche={facility as FicheCentre} isMedecin={isMedecin} medecinJoined={joined || Boolean(detail?.medecins?.some(medecin => String(medecin.medecinId) === String(user?.id)))} onJoin={() => void join()} joining={joining} />{tab === 'presentation' && <section className="maps-gallery-section"><h2>Photos et videos</h2><MediaGallery centre={facility} /></section>}</>}
          {tab === 'directions' && <div className="maps-directions">
            <h2>Itineraire</h2>
            {!hasCoords && <p role="status">Cet etablissement ne dispose pas encore de coordonnees verifiees.</p>}
            <div className="maps-mode-selector">{WAYFINDING_MODES.map(mode => <button type="button" key={mode} aria-pressed={props.mode === mode} onClick={() => props.onModeChange(mode)}>{mode === 'driving' ? 'Voiture' : mode === 'walking' ? 'A pied' : 'Velo'}</button>)}</div>
            <button type="button" className="maps-outline-command" disabled={!hasCoords} onClick={props.onRequestDirections}><Navigation size={18} />{props.position ? 'Calculer depuis ma position' : 'Autoriser ma localisation'}</button>
            {props.routeLoading ? <p role="status">Calcul en cours...</p> : <div><p>{formatDistanceKm(props.distance != null ? props.distance / 1000 : null)} · {formatDuration(props.duration)}</p>{props.isFallback && <p role="status">Trace approximatif, ne pas utiliser pour la navigation.</p>}{props.routeError && <p role="alert">{props.routeError}</p>}</div>}
            <ol>{props.steps.map((step, index) => <li key={index}><span>{index + 1}.</span> {step.instruction} <small>{Math.round(step.distance)} m</small></li>)}</ol>
            <div className="maps-external-links"><a href={toGoogleMapsUrl(facility)} target="_blank" rel="noopener noreferrer">Google Maps</a><a href={toWazeUrl(facility)} target="_blank" rel="noopener noreferrer">Waze</a>{props.routeActive && <button type="button" onClick={props.onClearRoute}>Effacer l'itineraire</button>}</div>
          </div>}
          {tab === 'reviews' && <div className="maps-reviews">
            <div className="maps-review-summary"><div>{[5, 4, 3, 2, 1].map(star => <div className="maps-rating-bar" key={star}><span>{star}</span><progress max={Math.max(1, reviews.length)} value={reviews.filter(review => review.note === star).length} /></div>)}</div><div><strong>{mean.toFixed(1)}</strong><Rating value={mean} /><p>{total} avis</p></div></div>
            <button type="button" className="maps-outline-command" onClick={() => isAuthenticated ? setComposer(true) : window.location.assign('/login')}><Star size={18} />Rediger un avis</button>
            <div className="maps-review-tools"><label><Search size={17} /><input value={reviewSearch} onChange={event => setReviewSearch(event.target.value)} placeholder="Rechercher dans les avis" aria-label="Rechercher dans les avis" /></label><select aria-label="Trier les avis" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Les plus recents</option><option value="positive">Les plus favorables</option><option value="critical">Les plus critiques</option></select></div>
            {isLoading && <p role="status">Chargement des avis...</p>}
            {reviewError && <p role="alert">Impossible de charger les avis.</p>}
            {!isLoading && !reviewError && !reviews.length && <p>Aucun avis correspondant.</p>}
            {reviews.map(review => <article className="maps-review" key={review.id}><div className="maps-review-author"><span className="maps-avatar">{(review.auteurNom || 'U')[0]}</span><div><strong>{review.auteurNom || 'Utilisateur'}</strong><div><Rating value={review.note} /><small>{new Date(review.createdAt).toLocaleDateString('fr-CM')}</small></div></div></div><p>{review.commentaire}</p>{review.images?.length ? <div className="maps-review-images">{review.images.map(image => <a key={image.id} href={imgUrl(image.contentUrl) ?? image.contentUrl} target="_blank" rel="noopener noreferrer"><img src={imgUrl(image.contentUrl) ?? image.contentUrl} alt="Photo jointe a cet avis" loading="lazy" /></a>)}</div> : null}<div className="maps-review-actions"><button type="button" aria-pressed={likes.includes(review.id)} onClick={() => setLikes(current => current.includes(review.id) ? current.filter(id => id !== review.id) : [...current, review.id])}><ThumbsUp size={17} fill={likes.includes(review.id) ? 'currentColor' : 'none'} />J'aime</button><button type="button" onClick={() => void share(review.commentaire)}><Share2 size={17} />Partager</button></div></article>)}
          </div>}
        </section>
      </> : <>
        <header className="maps-results-heading"><h1>{props.initialView === 'saved' ? 'Enregistres' : props.initialView === 'recent' ? 'Recents' : 'Resultats'}</h1><button type="button" onClick={props.onClose} aria-label="Fermer les resultats"><X size={20} /></button></header>
        <div className="maps-result-meta"><span>{list.length} etablissements</span><label><input type="checkbox" checked={props.onlyUrgence} onChange={event => props.onUrgenceChange(event.target.checked)} />Urgences 24h</label></div>
        {props.loading ? <p className="maps-inline-status">Recherche en cours...</p> : !list.length ? <p className="maps-inline-status">Aucun etablissement correspondant.</p> : list.map(centre => <button type="button" className="maps-result" key={centre.id} onClick={() => props.onSelect(centre.id)}><div><h2>{centre.nom}</h2><div className="maps-rating-line"><span>{(centre.noteMoyenne ?? 0).toFixed(1)}</span><Rating value={centre.noteMoyenne ?? 0} /><small>({centre.totalAvis ?? 0})</small></div><p>{centre.type.replaceAll('_', ' ')}</p><p>{centre.adresse}</p>{props.position && <small>{formatDistanceKm(haversineKm(props.position, centre))}</small>}</div><ResultPhoto centre={centre} /></button>)}
      </>}
    </aside>}
    {composer && facility && <div className="maps-modal-backdrop" onClick={() => !sending && setComposer(false)}><form className="maps-dialog" role="dialog" aria-modal="true" aria-label="Rediger un avis" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); void submit() }}><header><h2>{facility.nom}</h2><button type="button" disabled={sending} onClick={() => setComposer(false)} aria-label="Fermer"><X size={22} /></button></header><div className="maps-review-stars" role="group" aria-label="Note">{[1, 2, 3, 4, 5].map(star => <button type="button" key={star} aria-label={`${star} etoiles`} aria-pressed={note === star} onClick={() => setNote(star)}><Star size={34} fill={star <= note ? 'currentColor' : 'none'} /></button>)}</div><textarea autoFocus value={comment} minLength={5} maxLength={2000} onChange={event => setComment(event.target.value)} placeholder="Partagez votre experience" aria-label="Votre avis" /><label className="maps-upload">Ajouter des photos<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => {
      const selectedFiles = Array.from(event.target.files ?? [])
      if (selectedFiles.length > 5 || selectedFiles.some(file => file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { event.target.value = ''; toast.error('Maximum 5 images JPEG, PNG ou WebP de 2 Mo chacune.'); return }
      setFiles(selectedFiles)
    }} /></label><ul className="maps-selected-files">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><button type="button" onClick={() => setFiles(current => current.filter((_, item) => item !== index))} aria-label={`Retirer ${file.name}`}><X size={16} /></button></li>)}</ul><footer><button type="button" disabled={sending} onClick={() => setComposer(false)}>Annuler</button><button type="submit" disabled={!note || sending}>{sending ? 'Publication...' : 'Publier'}</button></footer></form></div>}
    {collectionOpen && facility && <div className="maps-modal-backdrop"><section className="maps-dialog" role="dialog" aria-modal="true" aria-label="Collections"><header><h2>Enregistrer dans une collection</h2><button type="button" onClick={() => setCollectionOpen(false)} aria-label="Fermer"><X size={20} /></button></header>{collections.map(collection => <div className="maps-collection" key={collection.id}><label><input type="checkbox" checked={collection.places.includes(facility.id)} onChange={event => saveCollections(collections.map(item => item.id !== collection.id ? item : { ...item, places: event.target.checked ? [...item.places, facility.id] : item.places.filter(id => id !== facility.id) }))} />{collection.name}</label><input value={collection.note} placeholder="Note privee" aria-label={`Note pour ${collection.name}`} maxLength={600} onChange={event => saveCollections(collections.map(item => item.id !== collection.id ? item : { ...item, note: event.target.value }))} /><button type="button" onClick={() => saveCollections(collections.filter(item => item.id !== collection.id))}>Supprimer</button></div>)}<form onSubmit={event => { event.preventDefault(); if (!collectionName.trim()) return; saveCollections([...collections, { id: crypto.randomUUID(), name: collectionName.trim(), places: [facility.id], note: '' }]); setCollectionName('') }}><input required maxLength={80} value={collectionName} onChange={event => setCollectionName(event.target.value)} placeholder="Nom de la collection" aria-label="Nom de la collection" /><button type="submit">Creer</button></form></section></div>}
  </>
}
