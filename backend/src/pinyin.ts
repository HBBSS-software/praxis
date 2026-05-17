import { pinyin } from 'pinyin-pro';

export function getPinyinInitials(value: string) {
  return pinyin(value.trim(), {
    pattern: 'first',
    toneType: 'none',
    type: 'array',
    nonZh: 'consecutive'
  }).join('').toLowerCase();
}
