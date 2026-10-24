import { useState } from 'react';

interface SpriteProps {
  id: string;
  size?: number;
  className?: string;
}

/** Self-hosted official sprite; falls back to a plain tile when a sprite isn't available yet. */
export function Sprite({ id, size = 48, className = '' }: SpriteProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={`sprite sprite-missing ${className}`} style={{ width: size, height: size }} aria-hidden="true" />;
  return (
    <img
      className={`sprite ${className}`}
      src={`/sprites/${id}.webp`}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
