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

/** Where an item's picture lives; built here like spriteUrl so the paths stay in one file. */
export function itemSpriteUrl(itemId: string): string {
  return `/sprites/items/${itemId}.webp`;
}

/** An item's picture, or a plain tile if it hasn't been downloaded yet. */
export function ItemSprite({ id, size = 48, className = '' }: { id: string; size?: number; className?: string }) {
  const [missing, setMissing] = useState(false);
  useEffect(() => setMissing(false), [id]);
  if (missing) return <span className={`sprite item-sprite sprite-missing ${className}`} style={{ width: size, height: size }} aria-hidden="true" />;
  return (
    <img
      className={`sprite item-sprite ${className}`}
      src={itemSpriteUrl(id)}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setMissing(true)}
    />
  );
}
