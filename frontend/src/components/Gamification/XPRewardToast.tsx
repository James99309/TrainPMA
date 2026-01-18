import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { useXPToastStore } from '../../stores/xpToastStore';

interface SingleToastProps {
  id: string;
  amount: number;
  reason: string;
  icon?: string;
  onComplete: () => void;
}

const SingleToast = ({ id, amount, reason, icon = '✨', onComplete }: SingleToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  // Generate star positions for particle effect
  const particles = Array.from({ length: 8 }, (_, i) => ({
    angle: (i * 45 * Math.PI) / 180,
    delay: 0.2 + i * 0.05,
  }));

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 50, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="relative flex items-center justify-center"
    >
      <div
        className="relative px-6 py-4 rounded-2xl shadow-lg border border-yellow-400/30 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.95) 0%, rgba(245, 158, 11, 0.95) 100%)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />

        {/* Content */}
        <div className="relative flex flex-col items-center gap-1">
          {/* Icon and XP Amount */}
          <div className="flex items-center gap-2">
            <motion.span
              className="text-2xl"
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
            >
              {icon}
            </motion.span>

            <motion.span
              className="text-2xl font-bold text-white drop-shadow-md"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.4, 1] }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              +{amount} XP
            </motion.span>

            <motion.span
              className="text-2xl"
              initial={{ rotate: 20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
            >
              {icon}
            </motion.span>
          </div>

          {/* Reason text */}
          <motion.p
            className="text-sm text-white/90 font-medium"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {reason}
          </motion.p>
        </div>

        {/* Particle effects - stars flying out */}
        {particles.map((particle, i) => (
          <motion.span
            key={i}
            className="absolute text-yellow-200 text-sm pointer-events-none"
            style={{
              left: '50%',
              top: '50%',
              marginLeft: '-6px',
              marginTop: '-6px',
            }}
            initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            animate={{
              x: Math.cos(particle.angle) * 60,
              y: Math.sin(particle.angle) * 40,
              opacity: 0,
              scale: 0,
            }}
            transition={{ duration: 0.7, delay: particle.delay, ease: 'easeOut' }}
          >
            ✨
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
};

export const XPRewardToast = () => {
  const { toasts, removeToast } = useXPToastStore();

  // Only show the first toast in queue
  const currentToast = toasts[0];

  return (
    <div className="fixed top-20 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <AnimatePresence mode="wait">
        {currentToast && (
          <SingleToast
            key={currentToast.id}
            {...currentToast}
            onComplete={() => removeToast(currentToast.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default XPRewardToast;
