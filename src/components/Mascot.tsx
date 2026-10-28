/**
 * The ranch mascot's moods, drawn for RanchRadar. Decorative: the words next to it carry
 * the meaning, so it's hidden from screen readers.
 */
export type Mood = 'sleeping' | 'confused' | 'cheer';

export function Mascot({ mood, size, className }: { mood: Mood; size: number; className?: string }) {
  return (
    <img
      src={`/brand/mascot-${mood}.webp`}
      width={size} height={size} alt="" aria-hidden="true" decoding="async" draggable={false}
      className={['mascot', `mascot-${mood}`, className].filter(Boolean).join(' ')}
    />
  );
}
