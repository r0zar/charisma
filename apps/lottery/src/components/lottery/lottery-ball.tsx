interface LotteryBallProps {
  number: number
  isSelected?: boolean
  onClick?: () => void
  isWinning?: boolean
}

export function LotteryBall({ number, isSelected, onClick, isWinning = false }: LotteryBallProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        w-12 h-12 rounded-full border-2 font-bold text-sm transition-all
        flex items-center justify-center
        ${isSelected
          ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-110'
          : isWinning
            ? 'bg-yellow-500 text-white border-yellow-400 shadow-lg'
            : 'bg-background border-border hover:bg-accent hover:border-primary/50 hover:scale-105'
        }
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      {number}
    </button>
  )
}