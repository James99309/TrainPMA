import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CertificateBadge } from './CertificateBadge';
import { getUserCertificates } from '../../services/certificateApi';
import type { Certificate } from '../../types';

interface CertificateListProps {
  onSelectCertificate: (certificate: Certificate) => void;
  onBack: () => void;
}

export function CertificateList({ onSelectCertificate, onBack }: CertificateListProps) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCertificates = async () => {
      setLoading(true);
      try {
        const data = await getUserCertificates();
        setCertificates(data);
      } catch (error) {
        console.error('Failed to fetch certificates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCertificates();
  }, []);

  /**
   * Format date string
   */
  const formatDate = (isoString: string) => {
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
  };

  /**
   * Get rank badge color
   */
  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500';
    if (rank <= 3) return 'text-gray-400';
    if (rank <= 10) return 'text-orange-500';
    return 'text-blue-500';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {'\ud83c\udfc6'} 我的证书
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#58CC02] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-500 dark:text-gray-400">加载中...</p>
          </div>
        ) : certificates.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-16 px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-6xl mb-4">{'\ud83c\udf96'}</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              暂无证书
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-center">
              完成培训课程后，管理员会为您颁发证书
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {/* Badge showcase */}
            {certificates.length > 0 && (
              <motion.div
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                  成就徽章
                </h2>
                <div className="flex flex-wrap gap-4 justify-center">
                  {certificates.slice(0, 6).map((cert) => (
                    <CertificateBadge
                      key={cert.certificate_id}
                      certificate={cert}
                      size="md"
                      onClick={() => onSelectCertificate(cert)}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Certificate list */}
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 px-1">
              全部证书 ({certificates.length})
            </h2>

            {certificates.map((cert, index) => (
              <motion.div
                key={cert.certificate_id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelectCertificate(cert)}
              >
                <div className="flex items-center gap-4">
                  {/* Badge */}
                  <CertificateBadge certificate={cert} size="sm" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white truncate">
                      {cert.syllabus_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(cert.issued_at)}
                    </p>
                  </div>

                  {/* Score & Rank */}
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white">
                      {cert.score} / {cert.max_score}
                    </p>
                    <p className={`text-sm font-medium ${getRankColor(cert.rank)}`}>
                      第 {cert.rank} 名
                    </p>
                  </div>

                  {/* Arrow */}
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CertificateList;
