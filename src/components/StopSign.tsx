/** The "not legal this season" mark: a small stop sign, kept in full color even when the sprite is dimmed. */
export function StopSign({ className = '' }: { className?: string }) {
  return (
    <svg className={`stop-sign ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path className="stop-sign-face" d="M8.1 1.5h7.8l6.6 6.6v7.8l-6.6 6.6H8.1l-6.6-6.6V8.1z" />
      <path className="stop-sign-bar" d="M7 12h10" />
    </svg>
  );
}
