export default function TypingDots() {
  return (
    <div className="flex justify-start mb-3 pl-[44px]">
      <div className="bg-[#EDEDED] dark:bg-white/10 rounded-[18px] rounded-bl-[4px] px-4 py-3 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-gray-400" style={{ animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: '0s' }} />
        <span className="w-2 h-2 rounded-full bg-gray-400" style={{ animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: '0.2s' }} />
        <span className="w-2 h-2 rounded-full bg-gray-400" style={{ animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: '0.4s' }} />
      </div>
    </div>
  )
}
