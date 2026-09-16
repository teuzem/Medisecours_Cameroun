type AuthenticatedUser = {
  roles?: string[]
}

export function destinationForUser(user: AuthenticatedUser, requestedPath = '/') {
  if (user.roles?.includes('ROLE_ADMIN')) return '/admin'
  if (user.roles?.includes('ROLE_MEDECIN')) return '/medecin'

  return requestedPath
}
