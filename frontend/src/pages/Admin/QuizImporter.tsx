import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import adminApi, { type ParsedQuestion, type ImportSummary } from '../../services/adminApi';

export function QuizImporter() {
  const [step, setStep] = useState<'upload' | 'preview' | 'survey' | 'done'>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [surveyId, setSurveyId] = useState('');
  const [addedCount, setAddedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Survey creation form
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyDescription, setSurveyDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [passScore, setPassScore] = useState(60);
  const [createNewSurvey, setCreateNewSurvey] = useState(true);
  const [existingSurveyId, setExistingSurveyId] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const filename = file.name.toLowerCase();
    if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
      setError('请上传 Excel 文件 (.xlsx)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await adminApi.parseExcel(file);
      setParsedQuestions(result.questions);
      setSummary(result.summary);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || '解析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPreview = () => {
    // Set default times
    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    setStartTime(now.toISOString().slice(0, 16));
    setEndTime(oneMonthLater.toISOString().slice(0, 16));
    setStep('survey');
  };

  const handleCreateAndImport = async () => {
    setLoading(true);
    setError('');

    try {
      let targetSurveyId = existingSurveyId;

      // Create new survey if needed
      if (createNewSurvey) {
        if (!surveyTitle.trim()) {
          setError('请输入考卷名称');
          setLoading(false);
          return;
        }
        if (!startTime || !endTime) {
          setError('请设置开始和结束时间');
          setLoading(false);
          return;
        }

        targetSurveyId = await adminApi.createSurvey({
          title: surveyTitle,
          description: surveyDescription,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          duration_minutes: durationMinutes,
          total_questions: parsedQuestions.length,
          pass_score: passScore,
        });
      } else {
        if (!existingSurveyId.trim()) {
          setError('请输入现有考卷 ID');
          setLoading(false);
          return;
        }
      }

      // Import questions
      const count = await adminApi.confirmImport(targetSurveyId, parsedQuestions);
      setSurveyId(targetSurveyId);
      setAddedCount(count);
      setStep('done');
    } catch (err: any) {
      setError(err.message || '导入失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setParsedQuestions([]);
    setSummary(null);
    setSurveyId('');
    setAddedCount(0);
    setError('');
    setSurveyTitle('');
    setSurveyDescription('');
    setCreateNewSurvey(true);
    setExistingSurveyId('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const apiKey = localStorage.getItem('admin_api_key') || '';
    const url = adminApi.getTemplateUrl();

    // Use fetch to download with API key header
    fetch(url, {
      headers: { 'X-API-Key': apiKey }
    })
      .then(response => response.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'quiz_template.xlsx';
        link.click();
      })
      .catch(() => setError('下载模板失败'));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        题目导入
      </h2>

      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-8">
        {['上传文件', '预览题目', '创建考卷', '完成'].map((label, index) => {
          const stepNames = ['upload', 'preview', 'survey', 'done'];
          const isActive = stepNames.indexOf(step) >= index;
          const isCurrent = stepNames[index] === step;

          return (
            <div key={label} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                } ${isCurrent ? 'ring-2 ring-indigo-600 ring-offset-2 dark:ring-offset-gray-900' : ''}`}
              >
                {index + 1}
              </div>
              <span
                className={`ml-2 text-sm ${
                  isActive
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {label}
              </span>
              {index < 3 && (
                <div
                  className={`w-12 h-0.5 mx-4 ${
                    stepNames.indexOf(step) > index
                      ? 'bg-indigo-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg"
        >
          {error}
        </motion.div>
      )}

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8"
          >
            <div className="text-center mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                上传 Excel 考卷文件
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                支持 .xlsx 格式，请按照模板格式填写题目
              </p>
            </div>

            {/* Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-500 transition-colors"
            >
              {loading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  <span className="text-gray-500 dark:text-gray-400">解析中...</span>
                </div>
              ) : (
                <>
                  <span className="text-5xl block mb-4">📊</span>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
                    点击或拖拽上传 Excel 文件
                  </p>
                  <p className="text-sm text-gray-400">
                    支持 .xlsx 格式
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Download Template */}
            <div className="mt-6 text-center">
              <button
                onClick={downloadTemplate}
                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm"
              >
                📥 下载 Excel 模板
              </button>
            </div>

            {/* Format Guide */}
            <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                Excel 格式说明
              </h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="pb-2">列</th>
                    <th className="pb-2">内容</th>
                    <th className="pb-2">示例</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  <tr>
                    <td className="py-1">A</td>
                    <td>题型</td>
                    <td><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">single</code> 或 <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">multiple</code></td>
                  </tr>
                  <tr>
                    <td className="py-1">B</td>
                    <td>题目</td>
                    <td>什么是变量？</td>
                  </tr>
                  <tr>
                    <td className="py-1">C-H</td>
                    <td>选项 A-F</td>
                    <td>存储数据的容器</td>
                  </tr>
                  <tr>
                    <td className="py-1">I</td>
                    <td>正确答案</td>
                    <td><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">A</code> 或 <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">A,B,D</code></td>
                  </tr>
                  <tr>
                    <td className="py-1">J</td>
                    <td>分值</td>
                    <td>5</td>
                  </tr>
                  <tr>
                    <td className="py-1">K</td>
                    <td>解析</td>
                    <td>变量用于存储数据</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
          >
            {/* Summary */}
            {summary && (
              <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <h4 className="font-medium text-indigo-900 dark:text-indigo-300 mb-2">
                  解析结果
                </h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">总题数：</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">
                      {summary.total}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">单选题：</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">
                      {summary.single_choice}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">多选题：</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">
                      {summary.multiple_choice}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">总分值：</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">
                      {summary.total_score}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Questions Preview */}
            <div className="max-h-96 overflow-y-auto">
              {parsedQuestions.map((q, index) => (
                <div
                  key={index}
                  className="p-4 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          q.question_type === 'single_choice'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        }`}>
                          {q.question_type === 'single_choice' ? '单选' : '多选'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {q.score} 分
                        </span>
                      </div>
                      <p className="text-gray-900 dark:text-white mb-2">
                        {q.question_text}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {q.options.map((opt, optIdx) => {
                          const letter = String.fromCharCode(65 + optIdx);
                          const isCorrect = Array.isArray(q.correct_answer)
                            ? q.correct_answer.includes(letter)
                            : q.correct_answer === letter;
                          return (
                            <div
                              key={optIdx}
                              className={`px-3 py-1.5 rounded ${
                                isCorrect
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                  : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {letter}. {opt}
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          💡 {q.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                重新上传
              </button>
              <button
                onClick={handleConfirmPreview}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                下一步：创建考卷
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Create Survey */}
        {step === 'survey' && (
          <motion.div
            key="survey"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
              创建或选择考卷
            </h3>

            {/* Toggle */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setCreateNewSurvey(true)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                  createNewSurvey
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <span className="block text-lg mb-1">🆕</span>
                <span className={createNewSurvey ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400'}>
                  创建新考卷
                </span>
              </button>
              <button
                onClick={() => setCreateNewSurvey(false)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                  !createNewSurvey
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <span className="block text-lg mb-1">📋</span>
                <span className={!createNewSurvey ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400'}>
                  添加到现有考卷
                </span>
              </button>
            </div>

            {createNewSurvey ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    考卷名称 *
                  </label>
                  <input
                    type="text"
                    value={surveyTitle}
                    onChange={(e) => setSurveyTitle(e.target.value)}
                    placeholder="例如：Python 基础测验"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    考卷描述
                  </label>
                  <textarea
                    value={surveyDescription}
                    onChange={(e) => setSurveyDescription(e.target.value)}
                    placeholder="简单介绍考卷内容..."
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      开始时间 *
                    </label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      结束时间 *
                    </label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      答题时长 (分钟)
                    </label>
                    <input
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      min={1}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      及格分数
                    </label>
                    <input
                      type="number"
                      value={passScore}
                      onChange={(e) => setPassScore(Number(e.target.value))}
                      min={0}
                      max={100}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  现有考卷 ID *
                </label>
                <input
                  type="text"
                  value={existingSurveyId}
                  onChange={(e) => setExistingSurveyId(e.target.value)}
                  placeholder="输入 Survey ID"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  题目将追加到该考卷中
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setStep('preview')}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                返回预览
              </button>
              <button
                onClick={handleCreateAndImport}
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {loading ? '导入中...' : '确认导入'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center"
          >
            <span className="text-6xl block mb-4">🎉</span>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              导入成功！
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              成功导入 {addedCount} 道题目到考卷
            </p>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">考卷 ID</p>
              <p className="font-mono text-lg text-gray-900 dark:text-white select-all">
                {surveyId}
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              可在"课程管理"中将此考卷关联到课程
            </p>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              继续导入
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default QuizImporter;
