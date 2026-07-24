export type Element = 'kim' | 'moc' | 'thuy' | 'hoa' | 'tho'
export type Rarity = 'Phàm' | 'Hiếm' | 'Sử Thi' | 'Truyền Thuyết'

export type Technique = {
  id: string
  name: string
  element: Element
  rarity: Rarity
  icon: string
  description: string
  qi: number
  cooldown: number
  power: number
  status?: 'burn' | 'poison' | 'freeze' | 'shield'
}

export const ELEMENTS: Record<Element, { label: string; icon: string; color: string }> = {
  kim: { label: 'Kim', icon: '✦', color: '#f6d36b' },
  moc: { label: 'Mộc', icon: '❧', color: '#73d17c' },
  thuy: { label: 'Thủy', icon: '❄', color: '#68d5f7' },
  hoa: { label: 'Hỏa', icon: '♨', color: '#ff775c' },
  tho: { label: 'Thổ', icon: '◆', color: '#d9a35f' },
}

export const TECHNIQUES: Technique[] = [
  { id: 'fire-seal', name: 'Liệt Diễm Ấn', element: 'hoa', rarity: 'Phàm', icon: '🔥', description: 'Gây 145% ATK và 3 tầng Thiêu Đốt.', qi: 16, cooldown: 3, power: 1.45, status: 'burn' },
  { id: 'water-moon', name: 'Hàn Nguyệt Quyết', element: 'thuy', rarity: 'Hiếm', icon: '❄️', description: 'Gây 115% ATK, 35% Đóng Băng và hồi 8 Qi.', qi: 13, cooldown: 4, power: 1.15, status: 'freeze' },
  { id: 'wood-vine', name: 'Thanh Mộc Đằng', element: 'moc', rarity: 'Phàm', icon: '🌿', description: 'Gây 90% ATK, Trầm Độc và hồi 5% HP.', qi: 12, cooldown: 3, power: .9, status: 'poison' },
  { id: 'gold-sword', name: 'Canh Kim Kiếm Khí', element: 'kim', rarity: 'Hiếm', icon: '⚔️', description: 'Gây 175% ATK, tăng mạnh tỷ lệ bạo kích.', qi: 19, cooldown: 4, power: 1.75 },
  { id: 'earth-guard', name: 'Huyền Thổ Hộ Thể', element: 'tho', rarity: 'Phàm', icon: '🛡️', description: 'Gây 70% ATK và tạo Khiên bằng 14% HP.', qi: 15, cooldown: 4, power: .7, status: 'shield' },
  { id: 'phoenix', name: 'Chu Tước Phần Thiên', element: 'hoa', rarity: 'Sử Thi', icon: '🦅', description: 'Bùng cháy 230% ATK; Thiêu Đốt lập tức kích nổ.', qi: 27, cooldown: 5, power: 2.3, status: 'burn' },
  { id: 'lotus', name: 'Bích Liên Sinh Tức', element: 'moc', rarity: 'Hiếm', icon: '🪷', description: 'Hồi 12% HP rồi gieo 4 tầng Trầm Độc.', qi: 18, cooldown: 5, power: .75, status: 'poison' },
  { id: 'thunder', name: 'Thần Lôi Chú', element: 'kim', rarity: 'Sử Thi', icon: '⚡', description: 'Lôi kích 205% ATK, xuyên 35% Hộ Thể.', qi: 25, cooldown: 4, power: 2.05 },
  { id: 'tide', name: 'Thương Hải Triều Sinh', element: 'thuy', rarity: 'Sử Thi', icon: '🌊', description: 'Gây 150% ATK, chắc chắn làm Ướt và hồi 14 Qi.', qi: 20, cooldown: 4, power: 1.5, status: 'freeze' },
]

export const ROOTS = [
  { name: 'Hỏa Linh Căn', element: 'hoa' as Element, bonus: 'Thiêu Đốt +30%, đánh thường 20% gây Bỏng', detail: 'Hỏa pháp nung cháy mọi sinh cơ.' },
  { name: 'Thủy Linh Căn', element: 'thuy' as Element, bonus: '+10% Đóng Băng, +3 Qi mỗi Tick', detail: 'Thủy pháp lưu chuyển, tạo Làm Ướt trong 2 Tick.' },
  { name: 'Thanh Mộc Linh Căn', element: 'moc' as Element, bonus: 'Hồi máu +25%, Độc thêm 2% HP mục tiêu', detail: 'Sinh cơ bất tận, độc tố ăn sâu vào huyết mạch.' },
  { name: 'Canh Kim Linh Căn', element: 'kim' as Element, bonus: '+15% Crit DMG, Kim pháp -1 CD', detail: 'Kiếm khí sắc bén, xuyên giáp cao.' },
  { name: 'Hậu Thổ Linh Căn', element: 'tho' as Element, bonus: 'Đầu trận tạo Khiên 10% HP, +15% DEF', detail: 'Sơn hà hộ thể, vững như bàn thạch.' },
]

export const TALENTS = [
  { name: 'Thiên Mệnh Chi Tử', icon: '☯', detail: 'Khí Vận +12, Cơ Duyên hiếm xuất hiện nhiều hơn.' },
  { name: 'Kiếm Tâm Thông Minh', icon: '剣', detail: 'Mỗi 6 đòn đánh nhận 1 tầng Kiếm Ý.' },
  { name: 'Bách Độc Bất Xâm', icon: '☘', detail: 'Kháng hiệu ứng +20%, Hấp Huyết +5%.' },
  { name: 'Đạo Pháp Tự Nhiên', icon: '道', detail: 'Khởi đầu với 18 Ngộ Tính và thêm 10 Qi.' },
]

export const ENEMY_NAMES = ['Hắc Phong Lang', 'U Minh Xà', 'Thiết Giáp Khôi', 'Xích Diễm Điểu', 'Lôi Long']
export const SPEEDS = [1, 1.5, 2] as const
export const META_KEY = 'cuu-thien-luan-hoi-meta-v1'
