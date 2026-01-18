import { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { useCourseStore } from '../../stores/courseStore';
import { useProgressStore } from '../../stores/progressStore';
import type { Course } from '../../types';

// react-pdf 样式
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Set worker source for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// API Base URL for PDF files
const API_BASE_URL = import.meta.env.VITE_QUIZ_API_URL || '';

interface PDFViewerProps {
  course: Course;
  onComplete: () => void;
  onBack: () => void;
}

export function PDFViewer({ course, onComplete, onBack }: PDFViewerProps) {
  const { currentPage, setPage, nextPage, prevPage, markCourseComplete, getCourseProgress } =
    useCourseStore();
  const { addXP } = useProgressStore();

  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load saved progress
  useEffect(() => {
    const progress = getCourseProgress(course.id);
    if (progress?.currentPage) {
      setPage(progress.currentPage);
    }
  }, [course.id, getCourseProgress, setPage]);

  // Measure container width for responsive PDF sizing
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        // Account for padding (8px on each side on mobile, 16px on desktop)
        const padding = window.innerWidth < 768 ? 16 : 32;
        setContainerWidth(containerRef.current.clientWidth - padding);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('PDF load error:', err);
    setError('无法加载 PDF 文件');
    setLoading(false);
  }, []);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      prevPage();
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      nextPage();
    } else {
      // Reached the last page - mark as complete
      handleComplete();
    }
  };

  const handleComplete = () => {
    markCourseComplete(course.id);
    addXP(50); // Award XP for completing the course material
    onComplete();
  };

  const handleZoomIn = () => {
    setScale((s) => Math.min(s + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(s - 0.25, 0.5));
  };

  const handleSwipe = (info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x > threshold && currentPage > 1) {
      handlePrevPage();
    } else if (info.offset.x < -threshold && currentPage < numPages) {
      handleNextPage();
    }
  };

  const progressPercent = numPages > 0 ? Math.round((currentPage / numPages) * 100) : 0;
  const isLastPage = currentPage >= numPages;

  // Auto-hide controls
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (showControls) {
      timer = setTimeout(() => setShowControls(false), 3000);
    }
    return () => clearTimeout(timer);
  }, [showControls, currentPage]);

  return (
    <div
      className="fixed inset-0 bg-gray-100 dark:bg-gray-900 flex flex-col"
      onClick={() => setShowControls(true)}
    >
      {/* Header */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-0 left-0 right-0 z-20 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-md"
          >
            <div className="flex items-center justify-between p-4">
              <button
                onClick={onBack}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <span className="text-2xl">←</span>
              </button>

              <div className="text-center flex-1">
                <h2 className="font-bold text-gray-900 dark:text-white truncate px-4">
                  {course.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  第 {currentPage} / {numPages || '...'} 页
                </p>
              </div>

              {/* Zoom controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleZoomOut}
                  className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  <span className="text-lg">−</span>
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-300 w-12 text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  <span className="text-lg">+</span>
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-gray-200 dark:bg-gray-700">
              <motion.div
                className="h-full bg-[#58CC02]"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-2 md:p-4 pt-16 pb-20"
      >
        {loading && (
          <div className="flex flex-col items-center gap-4">
            <motion.div
              className="w-16 h-16 border-4 border-[#58CC02] border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-gray-500 dark:text-gray-400">加载中...</p>
          </div>
        )}

        {error && (
          <div className="text-center">
            <span className="text-6xl">😕</span>
            <p className="text-red-500 mt-4">{error}</p>
            <button
              onClick={onBack}
              className="mt-4 px-6 py-2 bg-[#58CC02] text-white rounded-full font-bold"
            >
              返回
            </button>
          </div>
        )}

        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => handleSwipe(info)}
          style={{ touchAction: 'pan-y' }}
          className="relative"
        >
          <Document
            file={`${API_BASE_URL}${course.mediaUrl}`}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            className="shadow-2xl rounded-lg overflow-hidden pointer-events-none select-none"
          >
            <Page
              pageNumber={currentPage}
              width={containerWidth > 0 ? containerWidth * scale : undefined}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="bg-white"
            />
          </Document>
          {/* Transparent overlay to capture swipe gestures */}
          <div className="absolute inset-0" />
        </motion.div>
      </div>

      {/* Navigation Footer */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 z-20 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg safe-area-bottom"
          >
            <div className="flex items-center justify-between p-2 gap-2">
              {/* Previous button */}
              <motion.button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className={`px-3 py-2 md:px-5 md:py-3 rounded-full font-bold text-xs md:text-base transition flex-shrink-0 ${
                  currentPage <= 1
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                whileHover={currentPage > 1 ? { scale: 1.05 } : {}}
                whileTap={currentPage > 1 ? { scale: 0.95 } : {}}
              >
                <span className="hidden md:inline">← 上一页</span>
                <span className="md:hidden">← 上一页</span>
              </motion.button>

              {/* Page indicator - hidden on small screens */}
              <div className="hidden md:flex items-center gap-1">
                {Array.from({ length: Math.min(numPages, 5) }).map((_, i) => {
                  const pageNum =
                    numPages <= 5
                      ? i + 1
                      : currentPage <= 3
                      ? i + 1
                      : currentPage >= numPages - 2
                      ? numPages - 4 + i
                      : currentPage - 2 + i;

                  return (
                    <button
                      key={i}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-full text-sm font-medium transition ${
                        pageNum === currentPage
                          ? 'bg-[#58CC02] text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              {/* Simple page counter for mobile */}
              <div className="md:hidden text-xs text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
                {currentPage}/{numPages}
              </div>

              {/* Next / Complete button */}
              <motion.button
                onClick={handleNextPage}
                className={`px-3 py-2 md:px-5 md:py-3 rounded-full font-bold text-xs md:text-base transition flex-shrink-0 ${
                  isLastPage
                    ? 'bg-[#58CC02] text-white'
                    : 'bg-[#1CB0F6] text-white hover:bg-[#1a9ed9]'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="hidden md:inline">{isLastPage ? '完成 ✓' : '下一页 →'}</span>
                <span className="md:hidden">{isLastPage ? '完成 ✓' : '下一页 →'}</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swipe gesture hints */}
      {!loading && !error && currentPage === 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
        >
          <motion.div
            className="bg-black/50 text-white px-4 py-2 rounded-full text-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -20] }}
            transition={{ duration: 3, delay: 1 }}
          >
            左右滑动切换页面
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
