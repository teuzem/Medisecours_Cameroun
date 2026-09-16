'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Contact {
  id: number
  name: string
  avatar: string
  online: boolean
  lastMessage: string
  timestamp: string
  unread: number
}

interface Message {
  id: number
  senderId: number
  text: string
  timestamp: string
  type: 'text' | 'image'
  images?: string[]
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const CONTACTS: Contact[] = [
  { id: 1, name: 'Temitope Ola', avatar: '', online: true, lastMessage: 'Boss, the design is ready for review', timestamp: '08:52 am', unread: 2 },
  { id: 2, name: 'Sarah Kone', avatar: '', online: true, lastMessage: 'Thanks for the update! 😊', timestamp: '11:23 am', unread: 0 },
  { id: 3, name: 'James Osei', avatar: '', online: false, lastMessage: 'Let me know when you\'re free', timestamp: '5 days', unread: 0 },
  { id: 4, name: 'Amara Diallo', avatar: '', online: true, lastMessage: 'Can we reschedule?', timestamp: '2 days', unread: 1 },
  { id: 5, name: 'Kofi Mensah', avatar: '', online: false, lastMessage: 'Great work on the project!', timestamp: '20 days', unread: 0 },
  { id: 6, name: 'Fatoumata Sy', avatar: '', online: false, lastMessage: 'Please find the files attached', timestamp: '1 month', unread: 0 },
]

const CURRENT_USER_ID = 0

const MESSAGES_BY_CONVERSATION: Record<number, Message[]> = {
  1: [
    { id: 1, senderId: 1, text: 'Hi Emma, just checked the latest mockups you sent over.', timestamp: '10:30 am', type: 'text' },
    { id: 2, senderId: 1, text: 'They look great overall, but I noticed a few alignment issues on the dashboard page. 😎', timestamp: '10:31 am', type: 'text' },
    { id: 3, senderId: 0, text: 'Morning Temitope! Thanks for the review. Could you point out which specific elements need adjustment?', timestamp: '10:33 am', type: 'text' },
    { id: 4, senderId: 1, text: '', timestamp: '10:35 am', type: 'image', images: ['https://picsum.photos/seed/design1/300/200', 'https://picsum.photos/seed/design2/300/200'] },
    { id: 5, senderId: 1, text: 'Mostly the card spacing and the button alignment in the header section.', timestamp: '10:35 am', type: 'text' },
    { id: 6, senderId: 0, text: 'Got it, I\'ll fix those and send you the updated version by end of day.', timestamp: '10:38 am', type: 'text' },
    { id: 7, senderId: 1, text: 'Sounds perfect. Also, should we add a dark mode toggle?', timestamp: '10:40 am', type: 'text' },
    { id: 8, senderId: 0, text: 'Great idea — let\'s include it in the next sprint.', timestamp: '10:42 am', type: 'text' },
  ],
  2: [
    { id: 1, senderId: 2, text: 'Hey! How\'s the project going?', timestamp: '11:00 am', type: 'text' },
    { id: 2, senderId: 0, text: 'Going well! Finishing up the frontend now.', timestamp: '11:05 am', type: 'text' },
    { id: 3, senderId: 2, text: 'Thanks for the update! 😊', timestamp: '11:23 am', type: 'text' },
  ],
  3: [
    { id: 1, senderId: 3, text: 'Hi, let me know when you\'re free to discuss the new requirements.', timestamp: '2:00 pm', type: 'text' },
    { id: 2, senderId: 0, text: 'I\'ll be free tomorrow afternoon. Does 3pm work?', timestamp: '2:05 pm', type: 'text' },
    { id: 3, senderId: 3, text: 'Perfect, see you then!', timestamp: '2:10 pm', type: 'text' },
  ],
  4: [
    { id: 1, senderId: 4, text: 'Can we reschedule our meeting? Something came up.', timestamp: '9:00 am', type: 'text' },
  ],
  5: [
    { id: 1, senderId: 5, text: 'Great work on the project! The client is very happy.', timestamp: '3:00 pm', type: 'text' },
  ],
  6: [
    { id: 1, senderId: 6, text: 'Please find the files attached for the quarterly report.', timestamp: '1:00 pm', type: 'text' },
  ],
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2 bg-[#F0F0F0] rounded-t-[12px]">
      <span className="w-3 h-3 rounded-full bg-[#DDDDDD]" />
      <span className="w-3 h-3 rounded-full bg-[#DDDDDD]" />
      <span className="w-3 h-3 rounded-full bg-[#DDDDDD]" />
    </div>
  )
}

function TopNav() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-lg bg-[#2196F3] flex items-center justify-center text-white font-bold text-sm">Q</div>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <span className="absolute left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-[0.2em] text-gray-700">{t('visitor.chatPreview.messages')}</span>
      <div className="flex items-center gap-6">
        <button className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase hover:text-gray-600 transition-colors">{t('visitor.chatPreview.downloadApp')}</button>
        <button className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase hover:text-gray-600 transition-colors">{t('visitor.chatPreview.logout')}</button>
      </div>
    </div>
  )
}

function Avatar({ name, online, size = 48 }: { name: string; online?: boolean; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
  const colorIndex = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length
  const bg = colors[colorIndex]

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full flex items-center justify-center text-white font-semibold text-sm"
        style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.38 }}
      >
        {initials}
      </div>
      {online && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#4CAF50] border-2 border-white" />
      )}
    </div>
  )
}

function ConversationItem({
  contact, active, dimmed, onClick,
}: {
  contact: Contact; active: boolean; dimmed: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors duration-150 border-b border-gray-100 ${
        active
          ? 'bg-[#2196F3]'
          : dimmed
            ? 'hover:bg-gray-50 opacity-40'
            : 'hover:bg-gray-50'
      }`}
    >
      <Avatar name={contact.name} online={contact.online} size={48} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold truncate ${active ? 'text-white' : 'text-[#212121]'}`}>
            {contact.name}
          </span>
          <span className={`text-[11px] shrink-0 ${active ? 'text-white/80' : 'text-gray-400'}`}>
            {contact.timestamp}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className={`text-xs truncate ${active ? 'text-white/80' : 'text-gray-500'}`}>
            {contact.lastMessage}
          </span>
          {contact.unread > 0 && !active && (
            <span className="w-5 h-5 rounded-full bg-[#2196F3] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {contact.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function MessageBubble({ message, isMine, showAvatar }: { message: Message; isMine: boolean; showAvatar: boolean }) {
  const { t } = useTranslation()
  if (message.type === 'image' && message.images) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-3`}>
        {!isMine && showAvatar && (
          <div className="mr-2 self-end">
            <Avatar name="Temitope Ola" size={36} />
          </div>
        )}
        {!isMine && !showAvatar && <div className="w-[36px] mr-2 shrink-0" />}
        <div className={`max-w-[70%] ${isMine ? 'order-1' : ''}`}>
          <div className="flex gap-1.5 mb-1">
            {message.images.map((img, i) => (
              <div key={i} className="relative group rounded-[14px] overflow-hidden" style={{ width: 140, height: 100 }}>
                <img src={img} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
          {message.text && (
            <p className={`text-sm leading-relaxed ${isMine ? 'text-white' : 'text-[#212121]'}`}>
              {message.text}
            </p>
          )}
          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className={`text-[10px] ${isMine ? 'text-white/60' : 'text-gray-400'}`}>{message.timestamp}</span>
          </div>
        </div>
        {isMine && showAvatar && (
          <div className="ml-2 self-end">
            <Avatar name={t('visitor.chatPreview.you')} size={36} />
          </div>
        )}
        {isMine && !showAvatar && <div className="w-[36px] ml-2 shrink-0" />}
      </div>
    )
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isMine && showAvatar && (
        <div className="mr-2 self-end">
          <Avatar name="Temitope Ola" size={36} />
        </div>
      )}
      {!isMine && !showAvatar && <div className="w-[36px] mr-2 shrink-0" />}
      <div className={`max-w-[70%] ${isMine ? 'order-1' : ''}`}>
        <div
          className={`px-4 py-2.5 text-sm leading-relaxed ${
            isMine
              ? 'bg-[#2196F3] text-white rounded-[18px] rounded-br-[4px]'
              : 'bg-[#EDEDED] text-[#212121] rounded-[18px] rounded-bl-[4px]'
          }`}
        >
          {message.text}
        </div>
        <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-gray-400">{message.timestamp}</span>
        </div>
      </div>
      {isMine && showAvatar && (
        <div className="ml-2 self-end">
          <Avatar name={t('visitor.chatPreview.you')} size={36} />
        </div>
      )}
      {isMine && !showAvatar && <div className="w-[36px] ml-2 shrink-0" />}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="mr-2 self-end">
        <Avatar name="Temitope Ola" size={36} />
      </div>
      <div className="bg-[#EDEDED] rounded-[18px] rounded-bl-[4px] px-4 py-3 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

function DateDivider({ label }: { label: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{t(label)}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

function MessageInput({ onSend }: { onSend: (text: string) => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
    inputRef.current?.focus()
  }, [value, onSend])

  return (
    <div className="flex items-center gap-3 px-5 py-4 bg-white border-t border-gray-200">
      <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
        <svg className="w-5 h-5 text-gray-500 -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder={t('visitor.chatPreview.inputPlaceholder')}
        className="flex-1 text-sm text-[#212121] placeholder-gray-400 bg-transparent outline-none"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim()}
        className={`text-xs font-bold tracking-wider uppercase transition-colors ${
          value.trim() ? 'text-[#2196F3] hover:text-blue-700' : 'text-gray-300'
        }`}
      >
        {t('visitor.chatPreview.send')}
      </button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ModernChat() {
  const [activeContactId, setActiveContactId] = useState(1)
  const [messages, setMessages] = useState<Message[]>(MESSAGES_BY_CONVERSATION[1] || [])
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Simulate typing indicator briefly after opening a conversation
  useEffect(() => {
    setTyping(true)
    const t = setTimeout(() => setTyping(false), 2000)
    return () => clearTimeout(t)
  }, [activeContactId])

  // Load messages when conversation changes
  useEffect(() => {
    setMessages(MESSAGES_BY_CONVERSATION[activeContactId] || [])
  }, [activeContactId])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback((text: string) => {
    const now = new Date()
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
    const newMsg: Message = {
      id: Date.now(),
      senderId: CURRENT_USER_ID,
      text,
      timestamp: time,
      type: 'text',
    }
    setMessages((prev) => [...prev, newMsg])
  }, [])

  const activeContact = CONTACTS.find((c) => c.id === activeContactId)

  // Group messages to determine when to show avatar
  const getShowAvatar = (msgs: Message[], index: number) => {
    if (index === 0) return true
    return msgs[index].senderId !== msgs[index - 1].senderId
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-white rounded-[12px] shadow-xl overflow-hidden" style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <TrafficLights />
        <TopNav />
        <div className="flex h-[600px]">
          {/* Sidebar */}
          <div className="w-[320px] shrink-0 border-r border-gray-200 bg-white flex flex-col">
            <div className="flex-1 overflow-y-auto">
              {CONTACTS.map((contact, idx) => (
                <ConversationItem
                  key={contact.id}
                  contact={contact}
                  active={activeContactId === contact.id}
                  dimmed={idx === CONTACTS.length - 1}
                  onClick={() => setActiveContactId(contact.id)}
                />
              ))}
            </div>
          </div>

          {/* Chat Panel */}
          <div className="flex-1 flex flex-col bg-[#FAFAFA]">
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <DateDivider label="visitor.chatPreview.dateDivider" />
              {messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isMine={msg.senderId === CURRENT_USER_ID}
                  showAvatar={getShowAvatar(messages, idx)}
                />
              ))}
              {typing && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
            <MessageInput onSend={handleSend} />
          </div>
        </div>
      </div>
    </div>
  )
}
