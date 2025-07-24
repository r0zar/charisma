'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface DrawCountdownProps {
  targetDate: Date
}

export function DrawCountdown({ targetDate }: DrawCountdownProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime()
      const distance = targetDate.getTime() - now

      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  return (
    <div className="flex items-center justify-center gap-4 text-center">
      <Clock className="h-5 w-5 text-muted-foreground" />
      <div className="flex gap-4">
        {timeLeft.days > 0 && (
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{timeLeft.days}</div>
            <div className="text-xs text-muted-foreground">Days</div>
          </div>
        )}
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{timeLeft.hours.toString().padStart(2, '0')}</div>
          <div className="text-xs text-muted-foreground">Hours</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{timeLeft.minutes.toString().padStart(2, '0')}</div>
          <div className="text-xs text-muted-foreground">Minutes</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{timeLeft.seconds.toString().padStart(2, '0')}</div>
          <div className="text-xs text-muted-foreground">Seconds</div>
        </div>
      </div>
    </div>
  )
}