# HR 学习成绩查看功能 - 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在管理后台新增「学习成绩」页面，让 HR 实时查看每个学员的课程完成情况和成绩得分。

**Architecture:** 后端新增一个 admin API 端点，从 `course_badges`、`courses`、`syllabi`、`users` 表聚合数据。前端新增 `LearningAnalytics.tsx` 页面组件，以表格形式展示。全部概览视图展示用户汇总，课程表视图展示逐课程得分。

**Tech Stack:** Flask + SQLAlchemy (backend), React + TypeScript + Tailwind CSS (frontend)

---

## Task 1: 后端 API 端点

**Files:**
- Modify: `backend/app/routes/admin.py` (在文件末尾添加新路由)

**Step 1: 添加学习成绩 API 路由**

在 `backend/app/routes/admin.py` 文件末尾追加以下代码：

```python
# ==================== 学习成绩分析 ====================

@admin_bp.route('/learning-analytics', methods=['GET'])
@api_key_required
def get_learning_analytics():
    """
    获取学习成绩数据

    Query params:
      - syllabus_id: 可选，指定课程表 ID 时返回该课程表下的逐课程得分
      - 不传时返回全部概览（每个用户的汇总数据）
    """
    try:
        from app.models.user import User
        from app.models.course import Course
        from app.models.syllabus import Syllabus
        from app.models.course_badge import CourseBadge
        import json

        syllabus_id = request.args.get('syllabus_id')

        # 1. 获取所有用户
        users = User.query.all()
        user_map = {u.user_id: u.to_dict() for u in users}

        # 2. 获取所有课程（有测验的）
        all_courses = Course.query.filter(Course.quiz_survey_id.isnot(None)).all()
        course_map = {c.id: c for c in all_courses}

        # 3. 获取所有徽章
        all_badges = CourseBadge.query.all()

        # 按 user_id 分组徽章
        user_badges = {}
        for badge in all_badges:
            if badge.user_id not in user_badges:
                user_badges[badge.user_id] = {}
            user_badges[badge.user_id][badge.course_id] = badge.to_dict()

        if syllabus_id:
            # === 课程表详情视图 ===
            syllabus = db.session.get(Syllabus, syllabus_id)
            if not syllabus:
                return jsonify({'success': False, 'message': '课程表不存在'}), 404

            syl_dict = syllabus.to_dict()
            course_sequence = syl_dict.get('course_sequence', [])
            course_ids = [item['course_id'] for item in course_sequence if 'course_id' in item]

            # 构建课程列表（保持顺序）
            courses_info = []
            for cid in course_ids:
                c = course_map.get(cid)
                if c:
                    courses_info.append({
                        'course_id': c.id,
                        'title': c.title,
                        'pass_score': c.quiz_pass_score or 60,
                    })

            # 构建每个用户的行数据
            rows = []
            for uid, badges in user_badges.items():
                # 检查该用户是否有此课程表中任何课程的记录
                has_any = any(cid in badges for cid in course_ids)
                if not has_any:
                    continue

                user_info = user_map.get(uid, {})
                course_scores = {}
                passed_count = 0

                for cid in course_ids:
                    badge = badges.get(cid)
                    if badge:
                        course_scores[cid] = {
                            'score': badge['score'],
                            'max_score': badge['max_score'],
                            'percentage': badge['percentage'],
                            'passed': badge['percentage'] >= (course_map[cid].quiz_pass_score or 60) if cid in course_map else False,
                        }
                        if course_scores[cid]['passed']:
                            passed_count += 1
                    else:
                        course_scores[cid] = None

                rows.append({
                    'user_id': uid,
                    'name': user_info.get('name', '未知用户'),
                    'company': user_info.get('company', ''),
                    'course_scores': course_scores,
                    'passed_count': passed_count,
                    'total_count': len(course_ids),
                })

            # 按完成度降序排列
            rows.sort(key=lambda r: r['passed_count'], reverse=True)

            return jsonify({
                'success': True,
                'data': {
                    'view': 'syllabus',
                    'syllabus': {
                        'id': syl_dict['id'],
                        'name': syl_dict['name'],
                    },
                    'courses': courses_info,
                    'rows': rows,
                }
            })

        else:
            # === 全部概览视图 ===
            total_courses_with_quiz = len(course_map)

            rows = []
            for uid, badges in user_badges.items():
                user_info = user_map.get(uid, {})

                completed = 0
                total_score_sum = 0
                total_max_sum = 0

                for cid, badge in badges.items():
                    if cid not in course_map:
                        continue
                    course = course_map[cid]
                    pass_score = course.quiz_pass_score or 60
                    if badge['percentage'] >= pass_score:
                        completed += 1
                    total_score_sum += badge['score']
                    total_max_sum += badge['max_score']

                rows.append({
                    'user_id': uid,
                    'name': user_info.get('name', '未知用户'),
                    'company': user_info.get('company', ''),
                    'completed_courses': completed,
                    'total_courses': total_courses_with_quiz,
                    'avg_score': total_score_sum,
                    'avg_max_score': total_max_sum,
                })

            rows.sort(key=lambda r: r['completed_courses'], reverse=True)

            return jsonify({
                'success': True,
                'data': {
                    'view': 'overview',
                    'total_courses': total_courses_with_quiz,
                    'rows': rows,
                }
            })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/learning-analytics/syllabi', methods=['GET'])
@api_key_required
def get_analytics_syllabi():
    """获取所有已发布的课程表列表（用于前端 tab 展示）"""
    try:
        from app.models.syllabus import Syllabus
        syllabi = Syllabus.query.filter_by(is_published=True).all()
        result = [{'id': s.id, 'name': s.name} for s in syllabi]
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
```

需要在文件顶部确保 `db` 已导入。在 admin.py 顶部添加:

```python
from app.models.base import db
```

**Step 2: 验证后端启动无报错**

Run: `cd /Users/nijie/Documents/Stargirl/stargirl-reader/backend && python -c "from app import create_app; app = create_app(); print('OK')"`

**Step 3: Commit**

```
feat: add learning analytics admin API endpoints
```

---

## Task 2: 前端 adminApi 新增方法

**Files:**
- Modify: `frontend/src/services/adminApi.ts` (在 adminApi 对象末尾添加方法)

**Step 1: 添加 API 方法**

在 `adminApi` 对象的末尾（`issueCertificates` 方法之后），添加：

```typescript
  // ==================== Learning Analytics ====================

  // Get syllabi list for analytics tabs
  async getAnalyticsSyllabi(): Promise<{ id: string; name: string }[]> {
    const result = await adminRequest<{ success: boolean; data: { id: string; name: string }[] }>(
      '/api/admin/learning-analytics/syllabi'
    );
    return result.data || [];
  },

  // Get learning analytics data
  async getLearningAnalytics(syllabusId?: string): Promise<any> {
    const params = syllabusId ? `?syllabus_id=${syllabusId}` : '';
    const result = await adminRequest<{ success: boolean; data: any }>(
      `/api/admin/learning-analytics${params}`
    );
    return result.data;
  },
```

**Step 2: Commit**

```
feat: add learning analytics methods to adminApi
```

---

## Task 3: 前端 LearningAnalytics 页面组件

**Files:**
- Create: `frontend/src/pages/Admin/LearningAnalytics.tsx`

**Step 1: 创建组件文件**

```tsx
import { useState, useEffect, useMemo } from 'react';
import adminApi from '../../services/adminApi';

interface SyllabusTab {
  id: string;
  name: string;
}

interface OverviewRow {
  user_id: string;
  name: string;
  company: string;
  completed_courses: number;
  total_courses: number;
  avg_score: number;
  avg_max_score: number;
}

interface CourseScore {
  score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
}

interface SyllabusRow {
  user_id: string;
  name: string;
  company: string;
  course_scores: Record<string, CourseScore | null>;
  passed_count: number;
  total_count: number;
}

interface CourseInfo {
  course_id: string;
  title: string;
  pass_score: number;
}

interface OverviewData {
  view: 'overview';
  total_courses: number;
  rows: OverviewRow[];
}

interface SyllabusData {
  view: 'syllabus';
  syllabus: { id: string; name: string };
  courses: CourseInfo[];
  rows: SyllabusRow[];
}

export function LearningAnalytics() {
  const [syllabiTabs, setSyllabiTabs] = useState<SyllabusTab[]>([]);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewData | SyllabusData | null>(null);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load syllabi tabs on mount
  useEffect(() => {
    const loadSyllabi = async () => {
      try {
        const syllabi = await adminApi.getAnalyticsSyllabi();
        setSyllabiTabs(syllabi);
      } catch (err: any) {
        console.error('Failed to load syllabi:', err);
      }
    };
    loadSyllabi();
  }, []);

  // Load data when tab changes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const syllabusId = activeTab === 'overview' ? undefined : activeTab;
        const result = await adminApi.getLearningAnalytics(syllabusId);
        setData(result);
      } catch (err: any) {
        setError(err.message || '加载失败');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeTab]);

  // Filter rows by search text
  const filteredRows = useMemo(() => {
    if (!data) return [];
    const rows = data.rows as any[];
    if (!searchText.trim()) return rows;
    const lower = searchText.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        (r.company && r.company.toLowerCase().includes(lower))
    );
  }, [data, searchText]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          学习成绩
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          查看学员的课程完成情况和成绩得分
        </p>
      </div>

      {/* Syllabus Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          全部概览
        </button>
        {syllabiTabs.map((syl) => (
          <button
            key={syl.id}
            onClick={() => setActiveTab(syl.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === syl.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {syl.name}
          </button>
        ))}
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="搜索用户名或公司..."
          className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {/* Table */}
      {!loading && data && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
          {data.view === 'overview' ? (
            <OverviewTable rows={filteredRows as OverviewRow[]} />
          ) : (
            <SyllabusTable
              courses={(data as SyllabusData).courses}
              rows={filteredRows as SyllabusRow[]}
            />
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && data && filteredRows.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {searchText ? '未找到匹配的用户' : '暂无学习数据'}
        </div>
      )}
    </div>
  );
}

// === Overview Table ===
function OverviewTable({ rows }: { rows: OverviewRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
            用户名
          </th>
          <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
            公司
          </th>
          <th className="text-center px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
            已完成课程
          </th>
          <th className="text-center px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
            总课程数
          </th>
          <th className="text-center px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
            总得分
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.user_id}
            className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
          >
            <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
              {row.name}
            </td>
            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
              {row.company || '-'}
            </td>
            <td className="px-4 py-3 text-center">
              <span
                className={`font-semibold ${
                  row.completed_courses === row.total_courses && row.total_courses > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {row.completed_courses}
              </span>
            </td>
            <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
              {row.total_courses}
            </td>
            <td className="px-4 py-3 text-center text-gray-900 dark:text-white font-mono">
              {row.avg_max_score > 0
                ? `${row.avg_score}/${row.avg_max_score}`
                : '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// === Syllabus Detail Table ===
function SyllabusTable({
  courses,
  rows,
}: {
  courses: CourseInfo[];
  rows: SyllabusRow[];
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-900/50 z-10">
            用户名
          </th>
          <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
            公司
          </th>
          {courses.map((course) => (
            <th
              key={course.course_id}
              className="text-center px-4 py-3 font-medium text-gray-700 dark:text-gray-300 min-w-[100px]"
            >
              {course.title}
            </th>
          ))}
          <th className="text-center px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
            完成度
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.user_id}
            className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
          >
            <td className="px-4 py-3 text-gray-900 dark:text-white font-medium sticky left-0 bg-white dark:bg-gray-800 z-10">
              {row.name}
            </td>
            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
              {row.company || '-'}
            </td>
            {courses.map((course) => {
              const scoreData = row.course_scores[course.course_id];
              if (!scoreData) {
                return (
                  <td
                    key={course.course_id}
                    className="px-4 py-3 text-center text-gray-400"
                  >
                    -
                  </td>
                );
              }
              return (
                <td
                  key={course.course_id}
                  className={`px-4 py-3 text-center font-mono font-medium ${
                    scoreData.passed
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {scoreData.score}/{scoreData.max_score}
                </td>
              );
            })}
            <td className="px-4 py-3 text-center">
              <span
                className={`font-semibold ${
                  row.passed_count === row.total_count && row.total_count > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {row.passed_count}/{row.total_count}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default LearningAnalytics;
```

**Step 2: Commit**

```
feat: add LearningAnalytics page component
```

---

## Task 4: 接入管理后台导航

**Files:**
- Modify: `frontend/src/pages/Admin/AdminLayout.tsx` (添加新 tab 类型和按钮)
- Modify: `frontend/src/pages/Admin/index.tsx` (添加新 tab 渲染)

**Step 1: 更新 AdminLayout.tsx**

1. 修改 `AdminLayoutProps` 接口，在 `activeTab` 类型中添加 `'analytics'`：

```typescript
interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: 'courses' | 'surveys' | 'quiz' | 'syllabi' | 'groups' | 'analytics';
  onTabChange: (tab: 'courses' | 'surveys' | 'quiz' | 'syllabi' | 'groups' | 'analytics') => void;
  onLogout: () => void;
}
```

2. 在导航栏最后一个 `<button>` (用户组) 之后添加新按钮：

```tsx
            <button
              onClick={() => onTabChange('analytics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'analytics'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              📊 学习成绩
            </button>
```

**Step 2: 更新 index.tsx**

1. 添加 import：

```typescript
import { LearningAnalytics } from './LearningAnalytics';
```

2. 修改 `AdminTab` 类型：

```typescript
type AdminTab = 'courses' | 'surveys' | 'quiz' | 'syllabi' | 'groups' | 'analytics';
```

3. 在 `{activeTab === 'groups' && <UserGroupManager />}` 之后添加：

```tsx
      {activeTab === 'analytics' && <LearningAnalytics />}
```

**Step 3: Commit**

```
feat: wire LearningAnalytics into admin navigation
```

---

## Task 5: 验证

**Step 1: 前端编译检查**

Run: `cd /Users/nijie/Documents/Stargirl/stargirl-reader/frontend && npx tsc --noEmit`

**Step 2: 修复编译错误（如果有的话）**

**Step 3: Final commit**

```
feat: complete HR learning analytics feature
```
