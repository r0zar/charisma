import { LotteryBall } from './lottery-ball'

interface NumberGridProps {
  selectedNumbers: number[]
  onNumberToggle: (number: number) => void
  maxNumbers?: number
}

export function NumberGrid({ selectedNumbers, onNumberToggle, maxNumbers = 6 }: NumberGridProps) {
  return (
    <div className="grid grid-cols-7 gap-3 p-4">
      {Array.from({ length: 49 }, (_, i) => i + 1).map((number) => (
        <LotteryBall
          key={number}
          number={number}
          isSelected={selectedNumbers.includes(number)}
          onClick={() => {
            if (selectedNumbers.includes(number)) {
              onNumberToggle(number)
            } else if (selectedNumbers.length < maxNumbers) {
              onNumberToggle(number)
            }
          }}
        />
      ))}
    </div>
  )
}