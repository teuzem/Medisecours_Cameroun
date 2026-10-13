type AuthenticatedUser = {
  roles?: string[]
}

export function destinationForUser(user: AuthenticatedUser, requestedPath = '/') {
  if (user.roles?.includes('ROLE_ADMIN')) return '/admin'
  if (user.roles?.includes('ROLE_MEDECIN')) return '/medecin'
  if (user.roles?.includes('ROLE_ETABLISSEMENT')) return '/espace-etablissement'
  if (user.roles?.includes('ROLE_PERSONNEL')) return '/personnel'
  // Patient (et profils simples) : espace patient par défaut, en conservant
  // un deep-link explicite (/patient/consultations, /carte, …).
  if (user.roles?.includes('ROLE_PATIENT')) {
    return requestedPath && requestedPath !== '/' ? requestedPath : '/patient'
  }

  return requestedPath
}
