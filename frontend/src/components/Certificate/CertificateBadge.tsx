import { motion } from 'framer-motion';
import type { Certificate } from '../../types';

interface CertificateBadgeProps {
  certificate: Certificate;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Get badge color based on rank
 */
function getBadgeColor(rank: number): { bg: string; border: string; text: string; icon: string } {
  if (rank === 1) {
    return {
      bg: 'bg-gradient-to-br from-yellow-300 to-yellow-500',
      border: 'border-yellow-400',
      text: 'text-yellow-900',
      icon: 'text-yellow-400',
    };
  }
  if (rank <= 3) {
    return {
      bg: 'bg-gradient-to-br from-gray-200 to-gray-400',
      border: 'border-gray-300',
      text: 'text-gray-700',
      icon: 'text-gray-400',
    };
  }
  if (rank <= 10) {
    return {
      bg: 'bg-gradient-to-br from-orange-300 to-orange-500',
      border: 'border-orange-400',
      text: 'text-orange-900',
      icon: 'text-orange-400',
    };
  }
  return {
    bg: 'bg-gradient-to-br from-blue-200 to-blue-400',
    border: 'border-blue-300',
    text: 'text-blue-800',
    icon: 'text-blue-400',
  };
}

/**
 * Get rank medal emoji
 */
function getRankMedal(rank: number): string {
  if (rank === 1) return '\ud83e\udd47';
  if (rank === 2) return '\ud83e\udd48';
  if (rank === 3) return '\ud83e\udd49';
  return '\ud83c\udfc5';
}

/**
 * Get size classes
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg'): { badge: string; text: string; medal: string } {
  switch (size) {
    case 'sm':
      return {
        badge: 'w-16 h-16',
        text: 'text-[10px]',
        medal: 'text-2xl',
      };
    case 'lg':
      return {
        badge: 'w-28 h-28',
        text: 'text-sm',
        medal: 'text-4xl',
      };
    default:
      return {
        badge: 'w-20 h-20',
        text: 'text-xs',
        medal: 'text-3xl',
      };
  }
}

export function CertificateBadge({ certificate, onClick, size = 'md' }: CertificateBadgeProps) {
  const colors = getBadgeColor(certificate.rank);
  const sizeClasses = getSizeClasses(size);
  const medal = getRankMedal(certificate.rank);

  return (
    <motion.div
      className={`
        ${sizeClasses.badge} rounded-full ${colors.bg} ${colors.border}
        border-4 shadow-lg cursor-pointer
        flex flex-col items-center justify-center
        relative overflow-hidden
      `}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
    >
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent pointer-events-none" />

      {/* Medal */}
      <span className={sizeClasses.medal}>{medal}</span>

      {/* Rank */}
      <span className={`${sizeClasses.text} ${colors.text} font-bold`}>
        #{certificate.rank}
      </span>
    </motion.div>
  );
}

/**
 * Small inline badge for list items
 */
interface CertificateBadgeInlineProps {
  certificate: Certificate;
  onClick?: () => void;
}

export function CertificateBadgeInline({ certificate, onClick }: CertificateBadgeInlineProps) {
  const colors = getBadgeColor(certificate.rank);
  const medal = getRankMedal(certificate.rank);

  return (
    <motion.div
      className={`
        inline-flex items-center gap-2 px-3 py-2 rounded-xl
        ${colors.bg} ${colors.border} border-2 shadow-sm cursor-pointer
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      <span className="text-lg">{medal}</span>
      <div className="flex flex-col">
        <span className={`text-xs font-bold ${colors.text} truncate max-w-[120px]`}>
          {certificate.syllabus_name}
        </span>
        <span className={`text-[10px] ${colors.text} opacity-80`}>
          #{certificate.rank} / {certificate.total_participants}
        </span>
      </div>
    </motion.div>
  );
}

export default CertificateBadge;
