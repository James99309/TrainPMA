export const syllabusThemes = {
  default: {
    background: 'bg-white dark:bg-gray-800',
    textColor: 'text-gray-900 dark:text-white',
    subTextColor: 'text-gray-500 dark:text-gray-400',
    progressBg: 'text-gray-100 dark:text-gray-700',
  },
  green: {
    background: 'bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600',
    textColor: 'text-white',
    subTextColor: 'text-white/80',
    progressBg: 'text-white/30',
  },
  'red-chinese': {
    background: 'bg-gradient-to-br from-red-600 via-red-700 to-amber-800',
    textColor: 'text-white',
    subTextColor: 'text-white/80',
    progressBg: 'text-white/30',
  },
  blue: {
    background: 'bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600',
    textColor: 'text-white',
    subTextColor: 'text-white/80',
    progressBg: 'text-white/30',
  },
  purple: {
    background: 'bg-gradient-to-br from-purple-400 via-purple-500 to-pink-600',
    textColor: 'text-white',
    subTextColor: 'text-white/80',
    progressBg: 'text-white/30',
  },
  orange: {
    background: 'bg-gradient-to-br from-orange-400 via-orange-500 to-red-500',
    textColor: 'text-white',
    subTextColor: 'text-white/80',
    progressBg: 'text-white/30',
  },
};

export type SyllabusThemeKey = keyof typeof syllabusThemes;

export const themeLabels: Record<SyllabusThemeKey, string> = {
  default: '默认',
  green: '绿色渐变',
  'red-chinese': '新春红',
  blue: '蓝色渐变',
  purple: '紫色渐变',
  orange: '橙色渐变',
};
