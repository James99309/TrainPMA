import { motion } from 'framer-motion';

interface ProgressBarProps {
  current: number;
  total: number;
  showLabel?: boolean;
}

export function ProgressBar({ current, total, showLabel = false }: ProgressBarProps) {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="w-full">
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-[#58CC02] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {showLabel && (
        <p className="text-center text-sm text-gray-500 mt-1">
          {current} / {total}
        </p>
      )}
    </div>
  );
}
