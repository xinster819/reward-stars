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

/** 头像：avatarSymbol 为 data:URL（上传的照片）时渲染圆形图片，否则按 emoji 映射。 */
export function Avatar({ symbol, sizeClass = 'w-12 h-12 text-4xl' }: { symbol: string; sizeClass?: string }) {
  if (symbol.startsWith('data:image/')) {
    return <img src={symbol} alt="" className={`${sizeClass.split(' ').slice(0, 2).join(' ')} rounded-full object-cover`} />
  }
  return <span className={sizeClass.split(' ').pop()} aria-hidden>{symbolEmoji(symbol)}</span>
}

/** 头像可选 emoji 集 */
export const AVATAR_EMOJI_SYMBOLS = ['DefaultAvatar', 'teddybear.fill', 'star.fill', 'heart.fill', 'crown.fill', 'leaf.fill', 'gamecontroller.fill', 'books.vertical.fill']

/** 照片 → 128px 方形 JPEG data:URL（约 10–20KB，直接存 avatar_symbol 列，随数据同步） */
export function fileToAvatarDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const SIZE = 128
      const canvas = document.createElement('canvas')
      canvas.width = SIZE
      canvas.height = SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas unavailable'))
      // 居中裁方形
      const side = Math.min(img.width, img.height)
      const sx = (img.width - side) / 2
      const sy = (img.height - side) / 2
      ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('cannot load image'))
    }
    img.src = url
  })
}

/** 规则/奖励编辑器里可选的图标集合 */
export const PICKABLE_SYMBOLS = [
  'star.fill', 'book.fill', 'pencil.and.ruler.fill', 'house.fill', 'bed.double.fill',
  'alarm.fill', 'hands.sparkles.fill', 'heart.fill', 'tortoise.fill', 'exclamationmark.bubble.fill',
  'gift.fill', 'tv.fill', 'gamecontroller.fill', 'birthday.cake.fill', 'books.vertical.fill', 'tree.fill',
]
