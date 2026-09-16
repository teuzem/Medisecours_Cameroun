'use client'

import { memo, useState } from 'react'
import { resolveImgPath } from '../../lib/config'

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#FF8A65', '#81C784']

function avatarColor(name?: string) {
  if (!name) return '#45B7D1'
  return AVATAR_COLORS[name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length]
}

function avatarInitials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

const UserAvatar = memo(function UserAvatar({ user: u, size = 40, className = '' }: { user: any; size?: number; className?: string }) {
  const [imgErr, setImgErr] = useState(false)
  const src = u?.photoProfil ? resolveImgPath(u.photoProfil) : null
  const name = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : '?'

  if (src && !imgErr) {
    return (
      <img
        src={src}
        alt={name}
        className={`${className} rounded-full object-cover ring-2 ring-white shadow-sm shrink-0`}
        style={{ width: size, height: size }}
        onError={() => setImgErr(true)}
      />
    )
  }

  return (
    <div
      className={`${className} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}
      style={{ width: size, height: size, backgroundColor: avatarColor(name), fontSize: size * 0.38 }}
    >
      {avatarInitials(name)}
    </div>
  )
})

export default UserAvatar
