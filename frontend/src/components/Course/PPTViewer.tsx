import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { useCourseStore } from '../../stores/courseStore';
import { useProgressStore } from '../../stores/progressStore';
import type { Course } from '../../types';

interface PPTViewerProps {
  course: Course;
  onComplete: () => void;
  onBack: () => void;
}

export function PPTViewer({ course, onComplete, onBack }: PPTViewerProps) {
  const { currentPage, setPage, markCourseComplete, getCourseProgress } = useCourseStore();
  const { addXP } = useProgressStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [direction, setDirection] = useState(0);

  const slides = course.slides || [];
  const totalSlides = slides.length;
  const currentSlide = slides[currentPage - 1];

  // Load saved progress
  useEffect(() => {
    const progress = getCourseProgress(course.id);
    if (progress?.currentPage && progress.currentPage <= totalSlides) {
      setPage(progress.currentPage);
    }
  }, [course.id, getCourseProgress, setPage, totalSlides]);

  const goToSlide = useCallback(
    (slideNum: number) => {
      if (slideNum >= 1 && slideNum <= totalSlides) {
        setDirection(slideNum > currentPage ? 1 : -1);
        setPage(slideNum);
        setImageLoading(true);
        setImageError(false);
      }
    },
    [currentPage, totalSlides, setPage]
  );

  const handlePrevSlide = () => {
    if (currentPage > 1) {
      goToSlide(currentPage - 1);
    }
  };

  const handleNextSlide = () => {
    if (currentPage < totalSlides) {
      goToSlide(currentPage + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    markCourseComplete(course.id);
    addXP(50);
    onComplete();
  };

  const handleSwipe = (info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x > threshold && currentPage > 1) {
      handlePrevSlide();
    } else if (info.offset.x < -threshold && currentPage < totalSlides) {
      handleNextSlide();
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevSlide();
      else if (e.key === 'ArrowRight') handleNextSlide();
      else if (e.key === 'Escape') setIsFullscreen(false);
    },
    [currentPage, totalSlides]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const progressPercent = totalSlides > 0 ? Math.round((currentPage / totalSlides) * 100) : 0;
  const isLastSlide = currentPage >= totalSlides;

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div
      className={`fixed inset-0 bg-gray-900 flex flex-col ${
        isFullscreen ? 'z-50' : ''
      }`}
    >
      {/* Header */}
      {!isFullscreen && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gray-800 shadow-lg"
        >
          <div className="flex items-center justify-between p-4">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-gray-700 transition text-white"
            >
              <span className="text-2xl">←</span>
            </button>

            <div className="text-center flex-1">
              <h2 className="font-bold text-white truncate px-4">{course.title}</h2>
              <p className="text-sm text-gray-400">
                {currentPage} / {totalSlides}
              </p>
            </div>

            <button
              onClick={() => setIsFullscreen(true)}
              className="p-2 rounded-full hover:bg-gray-700 transition text-white"
            >
              <span className="text-xl">⛶</span>
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-gray-700">
            <motion.div
              className="h-full bg-[#58CC02]"
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}

      {/* Slide content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentPage}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => handleSwipe(info)}
            className="absolute inset-0 flex items-center justify-center p-4"
          >
            {currentSlide ? (
              <div className="relative max-w-4xl w-full">
                {/* Slide image */}
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      className="w-12 h-12 border-4 border-[#58CC02] border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                )}

                {imageError ? (
                  <div className="bg-gray-800 rounded-2xl p-12 text-center">
                    <span className="text-6xl">📊</span>
                    <h3 className="text-white text-2xl font-bold mt-4">
                      {currentSlide.text || `幻灯片 ${currentPage}`}
                    </h3>
                    <p className="text-gray-400 mt-2">图片加载失败</p>
                  </div>
                ) : (
                  <motion.img
                    src={currentSlide.imageUrl}
                    alt={currentSlide.text || `Slide ${currentPage}`}
                    className={`w-full rounded-2xl shadow-2xl ${
                      imageLoading ? 'opacity-0' : 'opacity-100'
                    }`}
                    onLoad={() => setImageLoading(false)}
                    onError={() => {
                      setImageLoading(false);
                      setImageError(true);
                    }}
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}

                {/* Slide title overlay */}
                {currentSlide.text && !imageError && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm rounded-xl p-4"
                  >
                    <p className="text-white text-lg font-medium text-center">
                      {currentSlide.text}
                    </p>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <span className="text-6xl">📊</span>
                <p className="mt-4">没有可用的幻灯片</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows (desktop) */}
        <button
          onClick={handlePrevSlide}
          disabled={currentPage <= 1}
          className={`absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition ${
            currentPage <= 1
              ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          ←
        </button>

        <button
          onClick={handleNextSlide}
          className={`absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition ${
            isLastSlide
              ? 'bg-[#58CC02] text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {isLastSlide ? '✓' : '→'}
        </button>

        {/* Fullscreen exit button */}
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* Thumbnail navigation */}
      {!isFullscreen && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-gray-800 p-4"
        >
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
            {slides.map((slide, index) => (
              <motion.button
                key={index}
                onClick={() => goToSlide(index + 1)}
                className={`relative flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition ${
                  index + 1 === currentPage
                    ? 'border-[#58CC02]'
                    : 'border-transparent hover:border-gray-600'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <img
                  src={slide.imageUrl}
                  alt={`Slide ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div
                  className={`absolute inset-0 flex items-center justify-center bg-gray-700/80 ${
                    index + 1 === currentPage ? 'hidden' : ''
                  }`}
                >
                  <span className="text-white text-xs font-medium">{index + 1}</span>
                </div>
                {index + 1 === currentPage && (
                  <div className="absolute inset-0 bg-[#58CC02]/20" />
                )}
              </motion.button>
            ))}
          </div>

          {/* Complete button */}
          {isLastSlide && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleComplete}
              className="w-full mt-4 py-4 bg-[#58CC02] text-white rounded-xl font-bold text-lg shadow-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              完成学习 +50 XP ✨
            </motion.button>
          )}
        </motion.div>
      )}

      {/* Swipe hint */}
      {currentPage === 1 && !isFullscreen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 3, delay: 1 }}
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
        >
          <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm">
            左右滑动切换幻灯片
          </div>
        </motion.div>
      )}
    </div>
  );
}
