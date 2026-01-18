import type { CourseIconType } from '../../types';

// Icon definitions with SVG components (using w-full h-full for flexibility)
export const courseIconMap: Record<CourseIconType, React.ReactNode> = {
  book: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white" />
      <rect x="7" y="6" width="10" height="2" fill="#9e9e9e" rx="1" />
      <rect x="7" y="10" width="8" height="2" fill="#9e9e9e" rx="1" />
      <rect x="7" y="14" width="6" height="2" fill="#9e9e9e" rx="1" />
    </svg>
  ),
  lightbulb: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z" fill="#FFD54F" />
    </svg>
  ),
  rocket: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2.5c-3 0-6 2-7.5 5.5L3 11l2 2-1.5 1.5 2 2 1-1 4.5 4.5 1-1 2 2 1.5-1.5 2 2 3-1.5c3.5-1.5 5.5-4.5 5.5-7.5C24 5.5 17.5 2.5 12 2.5z" fill="white" />
      <circle cx="15" cy="9" r="2" fill="#FF5722" />
      <path d="M6 17l-3 3 2 2 3-3-2-2z" fill="#FF5722" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="white" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H8v2h8v-2h-3v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z" fill="#FFD54F" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="white" />
      <circle cx="8" cy="10" r="1.5" fill="#9e9e9e" />
      <circle cx="12" cy="10" r="1.5" fill="#9e9e9e" />
      <circle cx="16" cy="10" r="1.5" fill="#9e9e9e" />
    </svg>
  ),
  code: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" fill="white" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <rect x="3" y="12" width="4" height="9" rx="1" fill="white" />
      <rect x="10" y="6" width="4" height="15" rx="1" fill="white" />
      <rect x="17" y="3" width="4" height="18" rx="1" fill="white" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="white" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="white" />
      <path d="M10 17l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="#4CAF50" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#FF5252" />
    </svg>
  ),
  flag: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z" fill="white" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <circle cx="12" cy="12" r="10" fill="white" />
      <circle cx="12" cy="12" r="6" fill="#FF5722" />
      <circle cx="12" cy="12" r="2" fill="white" />
    </svg>
  ),
  puzzle: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z" fill="white" />
    </svg>
  ),
  graduation: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3z" fill="white" />
      <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z" fill="#FFD54F" opacity="0.3" />
    </svg>
  ),
};

// Icon options for selector with labels
export const courseIconOptions: { value: CourseIconType; label: string }[] = [
  { value: 'book', label: '书本' },
  { value: 'lightbulb', label: '灯泡' },
  { value: 'rocket', label: '火箭' },
  { value: 'star', label: '星星' },
  { value: 'trophy', label: '奖杯' },
  { value: 'chat', label: '对话' },
  { value: 'code', label: '代码' },
  { value: 'chart', label: '图表' },
  { value: 'gear', label: '齿轮' },
  { value: 'shield', label: '盾牌' },
  { value: 'heart', label: '爱心' },
  { value: 'flag', label: '旗帜' },
  { value: 'target', label: '目标' },
  { value: 'puzzle', label: '拼图' },
  { value: 'graduation', label: '毕业帽' },
];

// Default icon when not set
export const defaultCourseIcon: CourseIconType = 'book';

// Get icon by type with fallback
export function getCourseIcon(iconType?: CourseIconType): React.ReactNode {
  if (iconType && courseIconMap[iconType]) {
    return courseIconMap[iconType];
  }
  return courseIconMap[defaultCourseIcon];
}

// Lock icon for locked courses
export const lockIcon = (
  <svg className="w-10 h-10 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

// Icon selector component for admin forms
interface IconSelectorProps {
  value?: CourseIconType;
  onChange: (icon: CourseIconType) => void;
}

export function IconSelector({ value, onChange }: IconSelectorProps) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {courseIconOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`
            p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-0.5
            ${value === option.value
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }
          `}
          title={option.label}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            value === option.value ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}>
            <div className="w-5 h-5">{courseIconMap[option.value]}</div>
          </div>
          <span className="text-[10px] text-gray-600 dark:text-gray-400">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export default courseIconMap;
