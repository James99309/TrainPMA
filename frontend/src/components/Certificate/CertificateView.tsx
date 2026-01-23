import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { toPng } from 'html-to-image';
import type { Certificate } from '../../types';

interface CertificateViewProps {
  certificate: Certificate;
  onBack: () => void;
}

/**
 * Get rank medal and title
 */
function getRankInfo(rank: number): { medal: string; title: string; color: string } {
  if (rank === 1) {
    return { medal: '\ud83e\udd47', title: '第一名', color: 'text-yellow-500' };
  }
  if (rank === 2) {
    return { medal: '\ud83e\udd48', title: '第二名', color: 'text-gray-400' };
  }
  if (rank === 3) {
    return { medal: '\ud83e\udd49', title: '第三名', color: 'text-orange-400' };
  }
  if (rank <= 10) {
    return { medal: '\ud83c\udfc5', title: `第 ${rank} 名`, color: 'text-orange-500' };
  }
  return { medal: '\ud83c\udf96', title: `第 ${rank} 名`, color: 'text-blue-500' };
}

/**
 * Format date string
 */
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function CertificateView({ certificate, onBack }: CertificateViewProps) {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const rankInfo = getRankInfo(certificate.rank);
  const percentage = certificate.max_score > 0
    ? Math.round((certificate.score / certificate.max_score) * 100)
    : 0;

  /**
   * Download certificate as image
   */
  const handleDownload = async () => {
    if (!certificateRef.current) return;

    setDownloading(true);
    try {
      const dataUrl = await toPng(certificateRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `certificate-${certificate.syllabus_name}-${certificate.user_name}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to download certificate:', error);
      alert('下载失败，请重试');
    } finally {
      setDownloading(false);
    }
  };

  /**
   * Share certificate
   */
  const handleShare = async () => {
    setSharing(true);
    try {
      const shareUrl = `${window.location.origin}/certificate/${certificate.certificate_id}`;

      if (navigator.share) {
        await navigator.share({
          title: `${certificate.user_name} 的培训证书`,
          text: `我在「${certificate.syllabus_name}」培训中获得了第 ${certificate.rank} 名！`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('链接已复制到剪贴板');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to share:', error);
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              {'\ud83d\udcdc'} 培训证书
            </h1>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={handleShare}
              disabled={sharing}
              className="px-3 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              whileTap={{ scale: 0.95 }}
            >
              {sharing ? '分享中...' : '\ud83d\udcf2 分享'}
            </motion.button>
            <motion.button
              onClick={handleDownload}
              disabled={downloading}
              className="px-3 py-1.5 bg-[#58CC02] text-white text-sm font-medium rounded-lg disabled:opacity-50"
              whileTap={{ scale: 0.95 }}
            >
              {downloading ? '下载中...' : '\ud83d\udcbe 下载'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Certificate preview */}
      <div className="p-4 overflow-x-auto">
        <div className="min-w-[360px] max-w-[480px] mx-auto">
          {/* Printable certificate */}
          <motion.div
            ref={certificateRef}
            className="bg-white rounded-xl shadow-xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {/* Certificate header */}
            <div className="bg-gradient-to-r from-[#58CC02] to-[#2ebd2e] p-6 text-center text-white">
              <div className="text-5xl mb-2">{'\ud83c\udfc6'}</div>
              <h1 className="text-2xl font-bold">培训证书</h1>
              <p className="text-green-100 text-sm">Training Certificate</p>
            </div>

            {/* Certificate body */}
            <div className="p-6">
              {/* Recipient */}
              <div className="text-center mb-6">
                <p className="text-gray-500 text-sm mb-1">兹证明</p>
                <h2 className="text-2xl font-bold text-gray-900">
                  {certificate.user_name}
                </h2>
                {certificate.user_company && (
                  <p className="text-gray-600">{certificate.user_company}</p>
                )}
              </div>

              {/* Training name */}
              <div className="text-center mb-6">
                <p className="text-gray-500 text-sm mb-1">完成了以下培训课程</p>
                <h3 className="text-xl font-bold text-[#58CC02]">
                  {certificate.syllabus_name}
                </h3>
              </div>

              {/* Score & Rank */}
              <div className="flex justify-center gap-8 mb-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">
                    {certificate.score}
                    <span className="text-lg text-gray-400">/{certificate.max_score}</span>
                  </p>
                  <p className="text-gray-500 text-sm">总得分</p>
                </div>
                <div className="text-center">
                  <p className={`text-3xl font-bold ${rankInfo.color}`}>
                    {rankInfo.medal} {certificate.rank}
                  </p>
                  <p className="text-gray-500 text-sm">
                    共 {certificate.total_participants} 人
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500">
                    {percentage}%
                  </p>
                  <p className="text-gray-500 text-sm">正确率</p>
                </div>
              </div>

              {/* Course scores */}
              {Object.keys(certificate.course_scores || {}).length > 0 && (
                <div className="mb-6">
                  <p className="text-gray-500 text-sm mb-2 text-center">课程得分明细</p>
                  <div className="bg-gray-50 rounded-lg p-3">
                    {Object.entries(certificate.course_scores).map(([courseId, data]) => (
                      <div
                        key={courseId}
                        className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
                      >
                        <span className="text-sm text-gray-700 truncate max-w-[200px]">
                          {data.name}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {data.score} 分
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issue date */}
              <div className="text-center text-gray-500 text-sm pt-4 border-t border-gray-100">
                <p>颁发日期: {formatDate(certificate.issued_at)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  证书编号: {certificate.certificate_id}
                </p>
              </div>
            </div>

            {/* Certificate footer */}
            <div className="bg-gray-50 px-6 py-3 text-center">
              <p className="text-xs text-gray-400">
                Powered by Stargirl Learning Platform
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Info section */}
      <div className="p-4">
        <div className="max-w-[480px] mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">
              {'\u2139\ufe0f'} 关于此证书
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>{'\u2022'} 此证书由系统自动生成，记录您的培训成绩</li>
              <li>{'\u2022'} 可下载保存或分享给他人查看</li>
              <li>{'\u2022'} 证书链接永久有效</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CertificateView;
