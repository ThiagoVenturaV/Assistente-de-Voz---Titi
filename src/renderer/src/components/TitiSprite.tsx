import { useEffect, useMemo, useState } from 'react'
import type { MascotState } from '../../../shared/contracts'

interface AnimationDefinition {
  row: number
  frames: number
  speed: number
}

const animations: Record<MascotState, AnimationDefinition> = {
  idle: { row: 0, frames: 6, speed: 230 },
  listening: { row: 6, frames: 6, speed: 145 },
  thinking: { row: 7, frames: 6, speed: 105 },
  speaking: { row: 3, frames: 4, speed: 155 },
  success: { row: 4, frames: 5, speed: 125 },
  error: { row: 5, frames: 8, speed: 155 },
  standby: { row: 0, frames: 6, speed: 420 },
  review: { row: 8, frames: 6, speed: 190 }
}

interface TitiSpriteProps {
  state?: MascotState
  size?: number
  className?: string
  label?: string
}

export function TitiSprite({
  state = 'idle',
  size = 132,
  className = '',
  label = 'Titi'
}: TitiSpriteProps): React.JSX.Element {
  const [frame, setFrame] = useState(0)
  const animation = animations[state]
  const height = Math.round(size * (208 / 192))

  useEffect(() => {
    setFrame(0)
    const timer = window.setInterval(
      () => setFrame((current) => (current + 1) % animation.frames),
      animation.speed
    )
    return () => window.clearInterval(timer)
  }, [animation.frames, animation.speed, state])

  const style = useMemo(
    () => ({
      width: `${size}px`,
      height: `${height}px`,
      backgroundImage: 'url(./spritesheet.webp)',
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${size * 8}px ${height * 11}px`,
      backgroundPosition: `${-frame * size}px ${-animation.row * height}px`
    }),
    [animation.row, frame, height, size]
  )

  return (
    <div
      className={`titi-sprite titi-sprite--${state} ${className}`}
      style={style}
      role="img"
      aria-label={`${label} — ${state}`}
    />
  )
}
