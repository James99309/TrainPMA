import { useState, useEffect } from 'react';
import { AdminLayout, AdminLogin } from './AdminLayout';
import { CourseManager } from './CourseManager';
import { SurveyManager } from './SurveyManager';
import { QuizImporter } from './QuizImporter';
import { SyllabusManager } from './SyllabusManager';
import { UserGroupManager } from './UserGroupManager';
import adminApi from '../../services/adminApi';

type AdminTab = 'courses' | 'surveys' | 'quiz' | 'syllabi' | 'groups';

export function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('courses');
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      if (adminApi.isLoggedIn()) {
        // Verify the stored API key is still valid
        const apiKey = localStorage.getItem('admin_api_key') || '';
        const isValid = await adminApi.verifyApiKey(apiKey);
        setIsLoggedIn(isValid);
        if (!isValid) {
          adminApi.logout();
        }
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    adminApi.logout();
    setIsLoggedIn(false);
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isLoggedIn) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  // Show admin panel
  return (
    <AdminLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
    >
      {activeTab === 'courses' && <CourseManager />}
      {activeTab === 'surveys' && <SurveyManager />}
      {activeTab === 'quiz' && <QuizImporter />}
      {activeTab === 'syllabi' && <SyllabusManager />}
      {activeTab === 'groups' && <UserGroupManager />}
    </AdminLayout>
  );
}

export default AdminPage;
