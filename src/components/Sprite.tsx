import { useEffect, useState } from 'react';

interface SpriteProps {
  id: string;
  /** A cosmetic variant of the form (e.g. alcremie-ruby-cream); shows that version's picture. */
  variant?: string | null;
  size?: number;
  className?: string;
}

/** The one place sprite URLs are built, so artwork can be swapped in one edit. */
export function spriteUrl(id: string, variant?: string | null): string {
  return variant ? `/sprites/variants/${variant}.webp` : `/sprites/${id}.webp`;
}

/** Self-hosted sprite; a missing variant falls back to the form's picture, then to a plain tile. */
export function Sprite({ id, variant = null, size = 48, className = '' }: SpriteProps) {
  const [stage, setStage] = useState<'variant' | 'form' | 'none'>(variant ? 'variant' : 'form');
  useEffect(() => setStage(variant ? 'variant' : 'form'), [id, variant]);
  if (stage === 'none') return <span className={`sprite sprite-missing ${className}`} style={{ width: size, height: size }} aria-hidden="true" />;
  return (
    <img
      className={`sprite ${className}`}
      src={spriteUrl(id, stage === 'variant' ? variant : null)}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setStage(stage === 'variant' ? 'form' : 'none')}
    />
  );
}
