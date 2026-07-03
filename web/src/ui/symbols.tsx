// SF Symbol 名 → emoji 映射（数据层沿用 iOS 的 symbol 名，Web 展示为 emoji）。

const SYMBOL_EMOJI: Record<string, string> = {
  'book.fill': '📚',
  'house.fill': '🏠',
  'heart.fill': '❤️',
  'star.fill': '⭐',
  'pencil.and.ruler.fill': '✏️',
  'bed.double.fill': '🛏️',
  'alarm.fill': '⏰',
  'hands.sparkles.fill': '🧹',
  'tortoise.fill': '🐢',
  'exclamationmark.bubble.fill': '💢',
  'gift.fill': '🎁',
  'tv.fill': '📺',
  'gamecontroller.fill': '🎮',
  'birthday.cake.fill': '🍦',
  'books.vertical.fill': '📖',
  'tree.fill': '🌳',
  'teddybear.fill': '🧸',
  'leaf.fill': '🍃',
  rosette: '🏵️',
  'crown.fill': '👑',
  'flame.fill': '🔥',
  'flame.circle.fill': '💪',
  DefaultAvatar: '🧒',
  'figure.child': '🧒',
  'person.crop.circle': '🧒',
}

export function symbolEmoji(name: string): string {
  return SYMBOL_EMOJI[name] ?? '⭐'
}

export function SymbolIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={className} aria-hidden>{symbolEmoji(name)}</span>
}

/** 规则/奖励编辑器里可选的图标集合 */
export const PICKABLE_SYMBOLS = [
  'star.fill', 'book.fill', 'pencil.and.ruler.fill', 'house.fill', 'bed.double.fill',
  'alarm.fill', 'hands.sparkles.fill', 'heart.fill', 'tortoise.fill', 'exclamationmark.bubble.fill',
  'gift.fill', 'tv.fill', 'gamecontroller.fill', 'birthday.cake.fill', 'books.vertical.fill', 'tree.fill',
]
