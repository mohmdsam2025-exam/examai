
import React, { useState, useEffect, useRef } from 'react';
import { AppStep, UserState, Semester, Question, QuizResult, QuizHistoryItem, AppUser, UserRole, AppConfig, ResourceType, Notification } from './types';
import { searchTopics, generateQuiz } from './services/geminiService';
import { Button } from './components/Button';

const SAVE_KEY = 'examiai_quiz_progress';

const INITIAL_USER_STATE: UserState = {
  name: '', grade: '', semester: Semester.FIRST, subject: '', selectedTopic: '', quizCount: 10,
};

const INITIAL_CONFIG: AppConfig = {
  minPassingScore: 50, fontFamily: 'Cairo', themeColor: 'indigo', logoUrl: ''
};

const GRADE_OPTIONS = [
  'الصف الأول الابتدائي', 'الصف الثاني الابتدائي', 'الصف الثالث الابتدائي', 
  'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي',
  'الصف الأول المتوسط', 'الصف الثاني المتوسط', 'الصف الثالث المتوسط',
  'الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'
];

const SUBJECT_OPTIONS = [
  'الرياضيات', 'العلوم', 'اللغة العربية', 'اللغة الإنجليزية', 
  'الدراسات الاجتماعية', 'التربية الإسلامية', 'الفيزياء', 'الكيمياء', 
  'الأحياء', 'الحاسب الآلي', 'التربية الفنية', 'المهارات الحياتية'
];

const INITIAL_USERS: AppUser[] = [
  { 
    id: 'admin_1', 
    name: 'admin', 
    role: UserRole.ADMIN, 
    password: '123', 
    mustChangePassword: true,
    permissions: { canCreateTests: true, canViewReports: true, canManageUsers: true } 
  }
];

export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  const [userState, setUserState] = useState<UserState>(INITIAL_USER_STATE);
  const [appConfig, setAppConfig] = useState<AppConfig>(INITIAL_CONFIG);
  const [resourceType, setResourceType] = useState<ResourceType>(ResourceType.QUIZ);
  
  const [appUsers, setAppUsers] = useState<AppUser[]>(INITIAL_USERS);
  const [loggedInUser, setLoggedInUser] = useState<AppUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  
  const [topics, setTopics] = useState<string[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationText, setNotificationText] = useState('');
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loginForm, setLoginForm] = useState({ name: '', password: '' });
  const [newUserForm, setNewUserForm] = useState({ name: '', password: '', role: UserRole.TEACHER });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);

  const [hasSavedProgress, setHasSavedProgress] = useState(false);

  // Timer States
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial settings and check for saved progress
  useEffect(() => {
    document.body.style.fontFamily = `'${appConfig.fontFamily}', sans-serif`;
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    
    checkSavedProgress();
  }, [appConfig.fontFamily, isDarkMode]);

  // Persistent Save Effect
  useEffect(() => {
    if (step === AppStep.QUIZ && loggedInUser) {
      const progress = {
        studentName: loggedInUser.name,
        quizQuestions,
        currentQuestionIndex,
        selectedAnswers,
        timeLeft,
        userState,
        resourceType,
        timestamp: Date.now()
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    }
  }, [currentQuestionIndex, selectedAnswers, timeLeft, step]);

  // Quiz Timer Effect
  useEffect(() => {
    if (step === AppStep.QUIZ && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            submitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, timeLeft]);

  const checkSavedProgress = () => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          setHasSavedProgress(true);
        } else {
          localStorage.removeItem(SAVE_KEY);
          setHasSavedProgress(false);
        }
      } catch (e) {
        localStorage.removeItem(SAVE_KEY);
      }
    }
  };

  const handleResumeProgress = () => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      setQuizQuestions(data.quizQuestions);
      setCurrentQuestionIndex(data.currentQuestionIndex);
      setSelectedAnswers(data.selectedAnswers);
      setTimeLeft(data.timeLeft);
      setUserState(data.userState);
      setResourceType(data.resourceType);
      setStep(AppStep.QUIZ);
    }
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleUniversalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const user = appUsers.find(u => u.name === loginForm.name && u.password === loginForm.password);
    if (user) {
      setLoggedInUser(user);
      if (user.mustChangePassword) setStep(AppStep.CHANGE_PASSWORD_REQUIRED);
      else proceedToUserDashboard(user);
    } else setError('خطأ في اسم المستخدم أو كلمة المرور');
  };

  const proceedToUserDashboard = (user: AppUser) => {
    if (user.role === UserRole.ADMIN) setStep(AppStep.ADMIN_DASHBOARD);
    else if (user.role === UserRole.TEACHER) setStep(AppStep.TEACHER_DASHBOARD);
    else {
      setUserState({ ...userState, name: user.name });
      checkSavedProgress();
      setStep(AppStep.SELECTION);
    }
  };

  const handlePasswordChange = (newPass: string) => {
    if (!loggedInUser) return;
    const updatedUsers = appUsers.map(u => u.id === loggedInUser.id ? { ...u, password: newPass, mustChangePassword: false } : u);
    setAppUsers(updatedUsers);
    const updatedUser = { ...loggedInUser, password: newPass, mustChangePassword: false };
    setLoggedInUser(updatedUser);
    alert('تم تغيير كلمة المرور بنجاح');
    proceedToUserDashboard(updatedUser);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.password) return;
    
    const permissions = {
      canCreateTests: newUserForm.role !== UserRole.STUDENT,
      canViewReports: newUserForm.role !== UserRole.STUDENT,
      canManageUsers: newUserForm.role === UserRole.ADMIN
    };

    const newUser: AppUser = {
      id: Date.now().toString(),
      name: newUserForm.name,
      password: newUserForm.password,
      role: newUserForm.role,
      mustChangePassword: true,
      permissions
    };
    
    setAppUsers(prev => [...prev, newUser]);
    setNewUserForm({ name: '', password: '', role: UserRole.TEACHER });
    alert(`تمت إضافة ${newUserForm.role} بنجاح.`);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      setAppUsers(appUsers.filter(u => u.id !== userToDelete.id));
      setUserToDelete(null);
    }
  };

  const sendNotification = () => {
    if (!notificationText.trim()) return;
    const newNotif: Notification = {
      id: Date.now().toString(),
      sender: loggedInUser?.name || 'المعلم',
      text: notificationText,
      date: new Date().toLocaleTimeString('ar-SA')
    };
    setNotifications([newNotif, ...notifications]);
    setNotificationText('');
    alert('تم إرسال الإشعار للطلاب');
  };

  const handleTopicSelect = async (topic: string) => {
    setUserState(prev => ({ ...prev, selectedTopic: topic }));
    setIsLoading(true);
    try {
      const questions = await generateQuiz(topic, userState.grade, userState.subject, userState.quizCount, resourceType);
      setQuizQuestions(questions);
      setSelectedAnswers(new Array(questions.length).fill(-1));
      setCurrentQuestionIndex(0);
      setTimeLeft(questions.length * 60); 
      setStep(AppStep.QUIZ);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const submitQuiz = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    localStorage.removeItem(SAVE_KEY);
    setHasSavedProgress(false);
    
    let score = 0;
    quizQuestions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctAnswerIndex) score++;
    });
    setQuizResult({ score, total: quizQuestions.length, answers: selectedAnswers });
    setQuizHistory(prev => [{
      id: Date.now().toString(),
      date: new Date().toLocaleString('ar-SA'),
      studentName: loggedInUser?.name || 'طالب مجهول',
      subject: userState.subject,
      topic: userState.selectedTopic,
      grade: userState.grade,
      score,
      total: quizQuestions.length,
      type: resourceType
    }, ...prev]);
    setStep(AppStep.RESULTS);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const layoutProps = { 
    user: loggedInUser || { name: 'زائر' }, 
    config: appConfig, 
    onHome: () => {
      if (loggedInUser?.role === UserRole.ADMIN) setStep(AppStep.ADMIN_DASHBOARD);
      else if (loggedInUser?.role === UserRole.TEACHER) setStep(AppStep.TEACHER_DASHBOARD);
      else {
        checkSavedProgress();
        setStep(AppStep.SELECTION);
      }
    }, 
    onLogout: () => { 
      setStep(AppStep.LOGIN); 
      setLoggedInUser(null); 
      setLoginForm({name:'', password:''}); 
    }, 
    isDarkMode, 
    toggleTheme 
  };

  const DashboardHeader = ({ title }: { title: string }) => (
    <header className="bg-white dark:bg-slate-800 p-4 border-b flex justify-between items-center sticky top-0 z-20 shadow-sm px-8">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xl bg-${appConfig.themeColor}-600 shadow-lg`}>E</div>
        <span className="font-black text-xl tracking-tight dark:text-white">{title}</span>
      </div>
      <div className="flex gap-3">
        {loggedInUser?.role !== UserRole.STUDENT && (
           <button onClick={() => setStep(loggedInUser?.role === UserRole.ADMIN ? AppStep.ADMIN_DASHBOARD : AppStep.TEACHER_DASHBOARD)} className="px-5 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl text-sm font-black flex items-center gap-2 transition-all">🏠 <span>لوحة التحكم</span></button>
        )}
        <button onClick={() => setStep(AppStep.REPORTS)} className="px-5 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl text-sm font-black flex items-center gap-2 transition-all">📊 <span>التقارير</span></button>
        <Button variant="danger" onClick={layoutProps.onLogout} className="px-6 py-2 text-sm rounded-2xl">خروج</Button>
      </div>
    </header>
  );

  if (step === AppStep.LOGIN) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-${appConfig.themeColor}-500 to-indigo-700 transition-all duration-500`}>
        <div className="absolute top-4 left-4 flex gap-2">
          <button onClick={toggleTheme} className="bg-white/20 p-2 rounded-xl backdrop-blur-md hover:bg-white/30 transition-all">{isDarkMode ? '☀️' : '🌙'}</button>
        </div>
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center border border-white/20">
          <div className="mb-6 flex justify-center">
             <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-4xl shadow-lg font-black">E</div>
          </div>
          <h1 className="text-4xl font-black mb-2 dark:text-white tracking-tighter">ExamiAI</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-bold">تسجيل الدخول للمنصة الذكية</p>
          <form onSubmit={handleUniversalLogin} className="space-y-3">
            <input type="text" required placeholder="اسم المستخدم" className="w-full p-4 rounded-2xl border dark:bg-slate-700 outline-none text-center focus:ring-4 focus:ring-indigo-100 transition-all font-bold" value={loginForm.name} onChange={e => setLoginForm({...loginForm, name: e.target.value})} />
            <input type="password" required placeholder="كلمة المرور" className="w-full p-4 rounded-2xl border dark:bg-slate-700 outline-none text-center focus:ring-4 focus:ring-indigo-100 transition-all font-bold" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
            {error && <p className="text-red-500 text-xs font-black">{error}</p>}
            <Button type="submit" className="w-full py-4 text-lg" themeColor={appConfig.themeColor}>دخول</Button>
          </form>
        </div>
      </div>
    );
  }

  if (step === AppStep.CHANGE_PASSWORD_REQUIRED) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-xl w-full max-w-sm border">
           <div className="text-center mb-6">
              <div className="text-4xl mb-2">🛡️</div>
              <h2 className="text-2xl font-black">تغيير كلمة المرور</h2>
              <p className="text-xs text-slate-500 mt-2">يجب عليك تغيير كلمة المرور عند أول دخول.</p>
           </div>
           <form onSubmit={(e) => {
              e.preventDefault();
              const pass = (e.currentTarget.elements.namedItem('new_pass') as HTMLInputElement).value;
              if(pass.length < 3) return alert('كلمة المرور قصيرة جداً');
              handlePasswordChange(pass);
           }} className="space-y-4">
              <input name="new_pass" type="password" required placeholder="كلمة المرور الجديدة" className="w-full p-4 rounded-2xl border dark:bg-slate-700 text-center font-bold outline-none focus:ring-4 focus:ring-indigo-100" />
              <Button type="submit" className="w-full py-4" themeColor={appConfig.themeColor}>حفظ ومتابعة</Button>
           </form>
        </div>
      </div>
    );
  }

  if (step === AppStep.ADMIN_DASHBOARD) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <DashboardHeader title="لوحة المشرف" />
        <main className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border">
             <h3 className="text-xl font-black mb-6 flex items-center gap-2">👥 إدارة المستخدمين</h3>
             <form onSubmit={handleAddUser} className="grid grid-cols-1 gap-3 mb-8 bg-slate-50 dark:bg-slate-700/50 p-6 rounded-2xl">
                <input type="text" placeholder="اسم المستخدم" required className="p-3 rounded-xl border dark:bg-slate-800" value={newUserForm.name} onChange={e => setNewUserForm({...newUserForm, name: e.target.value})} />
                <input type="text" placeholder="كلمة المرور" required className="p-3 rounded-xl border dark:bg-slate-800" value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} />
                <select className="p-3 rounded-xl border dark:bg-slate-800 font-bold" value={newUserForm.role} onChange={e => setNewUserForm({...newUserForm, role: e.target.value as any})}>
                   {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <Button type="submit" themeColor={appConfig.themeColor}>إضافة</Button>
             </form>
             <div className="max-h-60 overflow-y-auto space-y-2">
                {appUsers.map(u => (
                  <div key={u.id} className="flex justify-between items-center p-3 border-b dark:border-slate-700">
                    <div>
                      <span className="font-bold">{u.name}</span>
                      <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-2 py-1 rounded-lg mr-2 font-black">{u.role}</span>
                    </div>
                    {u.id !== loggedInUser?.id && (
                       <button onClick={() => setUserToDelete(u)} className="text-red-500 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-lg transition-all">حذف</button>
                    )}
                  </div>
                ))}
             </div>
           </div>

           <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border">
             <h3 className="font-black mb-6 flex items-center gap-2">🎨 تخصيص الهوية</h3>
             <div className="space-y-6">
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">لون السمة</label>
                 <div className="flex gap-3 flex-wrap">
                   {['indigo', 'emerald', 'rose', 'amber'].map(c => (
                     <div key={c} onClick={() => setAppConfig({...appConfig, themeColor: c as any})} className={`w-10 h-10 rounded-full cursor-pointer border-4 ${appConfig.themeColor === c ? 'border-indigo-200 ring-2 ring-indigo-500' : 'border-white dark:border-slate-600'} bg-${c}-600 transition-all`} />
                   ))}
                 </div>
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">نوع الخط</label>
                 <select className="w-full p-4 border rounded-2xl dark:bg-slate-700 text-sm outline-none font-bold" value={appConfig.fontFamily} onChange={e => setAppConfig({...appConfig, fontFamily: e.target.value as any})}>
                   <option value="Cairo">خط كاييرو</option>
                   <option value="Tajawal">خط تجول</option>
                   <option value="Almarai">خط المراعي</option>
                 </select>
               </div>
             </div>
           </div>
        </main>

        {/* Delete Confirmation Modal */}
        {userToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full border dark:border-slate-700 animate-in zoom-in-95 duration-200">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
                <h3 className="text-xl font-black mb-2 dark:text-white">تأكيد حذف المستخدم</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                  هل أنت متأكد من رغبتك في حذف المستخدم <span className="font-black text-red-500">"{userToDelete.name}"</span>؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
                <div className="flex gap-3">
                  <Button variant="danger" onClick={confirmDeleteUser} className="flex-1 py-3 rounded-2xl">تأكيد الحذف</Button>
                  <Button variant="outline" onClick={() => setUserToDelete(null)} className="flex-1 py-3 rounded-2xl">تراجع</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === AppStep.TEACHER_DASHBOARD) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <DashboardHeader title="لوحة المعلم" />
        <main className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-8">
             <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border">
               <h3 className="text-xl font-black mb-6 flex items-center gap-2">📝 إنشاء محتوى تعليمي</h3>
               <div className="flex flex-col gap-3 mb-8">
                  {Object.values(ResourceType).map(type => (
                    <div key={type} onClick={() => setResourceType(type)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${resourceType === type ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-50 dark:border-slate-700 hover:border-indigo-100'}`}>
                      <div className="text-3xl bg-white dark:bg-slate-700 p-2 rounded-xl">{type === ResourceType.QUIZ ? '📝' : type === ResourceType.ASSIGNMENT ? '🏠' : '📄'}</div>
                      <span className="font-bold text-lg">{type}</span>
                    </div>
                  ))}
               </div>
               <div className="grid grid-cols-1 gap-4">
                 <select className="w-full p-4 rounded-2xl border dark:bg-slate-700 outline-none font-bold" value={userState.grade} onChange={e => setUserState({...userState, grade: e.target.value})}>
                   <option value="">اختر الصف...</option>
                   {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                 </select>
                 <select className="w-full p-4 rounded-2xl border dark:bg-slate-700 outline-none font-bold" value={userState.semester} onChange={e => setUserState({...userState, semester: e.target.value as Semester})}>
                   {Object.values(Semester).map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
                 <select className="w-full p-4 rounded-2xl border dark:bg-slate-700 outline-none font-bold" value={userState.subject} onChange={e => setUserState({...userState, subject: e.target.value})}>
                   <option value="">اختر المادة...</option>
                   {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 mr-3">عدد الأسئلة المطلوبة</label>
                   <input 
                      type="number" 
                      min="5" 
                      max="30" 
                      className="w-full p-4 rounded-2xl border dark:bg-slate-700 outline-none font-bold"
                      value={userState.quizCount}
                      onChange={e => setUserState({...userState, quizCount: parseInt(e.target.value) || 5})}
                   />
                 </div>
                 <Button 
                   onClick={async () => {
                     if(!userState.grade || !userState.subject) return alert('يرجى اختيار الصف والمادة');
                     setIsLoading(true);
                     try {
                        const { topics } = await searchTopics(userState.grade, userState.semester, userState.subject);
                        setTopics(topics);
                        setStep(AppStep.TOPICS);
                     } catch(e) { alert('فشل الاتصال بالإنترنت'); }
                     setIsLoading(false);
                   }} 
                   className="w-full py-5 text-xl mt-4" 
                   themeColor={appConfig.themeColor} 
                   isLoading={isLoading}
                 >
                   البحث وتوليد {userState.quizCount} سؤال
                 </Button>
               </div>
             </div>
           </div>
           <div className="space-y-8">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border">
                <h3 className="text-xl font-black mb-4 flex items-center gap-2">📢 إرسال إشعار</h3>
                <textarea className="w-full p-4 rounded-2xl border dark:bg-slate-700 h-28 mb-4 outline-none font-bold resize-none" placeholder="تنبيه للطلاب.." value={notificationText} onChange={e => setNotificationText(e.target.value)} />
                <Button onClick={sendNotification} themeColor={appConfig.themeColor} className="w-full">إرسال</Button>
              </div>
           </div>
        </main>
      </div>
    );
  }

  if (step === AppStep.SELECTION) {
    return (
      <Layout title="استكشف دروسك اليوم" {...layoutProps}>
        <div className="max-w-xl mx-auto bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-sm border">
             {hasSavedProgress && (
               <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-3xl animate-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-3xl">📝</span>
                    <div className="text-right">
                      <p className="font-black text-amber-800 dark:text-amber-200">لديك اختبار غير مكتمل!</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">يمكنك العودة وإكماله من حيث توقفت.</p>
                    </div>
                  </div>
                  <Button onClick={handleResumeProgress} className="w-full py-4 bg-amber-600 hover:bg-amber-700 shadow-amber-200">استئناف الاختبار السابق</Button>
               </div>
             )}
             
             <div className="flex justify-center mb-6">
                <div className="text-6xl p-6 bg-slate-50 dark:bg-slate-700/50 rounded-full">📚</div>
             </div>
             <p className="mb-8 font-black text-center text-slate-400 uppercase tracking-widest text-xs">حدد المنهج وعدد الأسئلة</p>
             <div className="space-y-5 mb-10">
               <select className="w-full p-4 rounded-2xl border dark:bg-slate-700 outline-none font-bold" value={userState.grade} onChange={e => setUserState({...userState, grade: e.target.value})}>
                 <option value="">اختر صفك...</option>
                 {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
               </select>
               <select className="w-full p-4 rounded-2xl border dark:bg-slate-700 outline-none font-bold" value={userState.semester} onChange={e => setUserState({...userState, semester: e.target.value as Semester})}>
                 {Object.values(Semester).map(s => <option key={s} value={s}>{s}</option>)}
               </select>
               <select className="w-full p-4 rounded-2xl border dark:bg-slate-700 outline-none font-bold" value={userState.subject} onChange={e => setUserState({...userState, subject: e.target.value})}>
                 <option value="">اختر المادة...</option>
                 {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 mr-3 uppercase">عدد أسئلة الاختبار</label>
                 <input 
                    type="number" 
                    min="5" 
                    max="30" 
                    className="w-full p-4 rounded-2xl border dark:bg-slate-700 outline-none font-bold"
                    value={userState.quizCount}
                    onChange={e => setUserState({...userState, quizCount: parseInt(e.target.value) || 5})}
                 />
                 <p className="text-[9px] text-slate-400 mr-3 mt-1 font-bold italic">* يمكنك اختيار من 5 إلى 30 سؤالاً</p>
               </div>
             </div>
             <Button onClick={async () => {
               if(!userState.grade || !userState.subject) return alert('يرجى اختيار الصف والمادة');
               setIsLoading(true);
               try {
                  const { topics } = await searchTopics(userState.grade, userState.semester, userState.subject);
                  setTopics(topics);
                  setStep(AppStep.TOPICS);
               } catch(e) { alert('عذراً، حدث خطأ أثناء البحث'); }
               setIsLoading(false);
             }} className="w-full py-5 text-xl" themeColor={appConfig.themeColor} isLoading={isLoading}>البحث عن الدروس المتاحة</Button>
        </div>
      </Layout>
    );
  }

  if (step === AppStep.TOPICS) {
    return (
      <Layout title="اختر موضوعاً لنبدأ!" {...layoutProps}>
        <div className="max-w-3xl mx-auto space-y-4">
          {topics.length > 0 ? topics.map((t, idx) => (
            <div key={idx} onClick={() => handleTopicSelect(t)} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500 cursor-pointer transition-all flex justify-between items-center group shadow-sm hover:shadow-xl">
              <div className="flex items-center gap-4">
                <span className="w-10 h-10 flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl font-black">{idx + 1}</span>
                <span className="font-black text-lg text-slate-700 dark:text-slate-200">{t}</span>
              </div>
              <span className="text-2xl group-hover:translate-x-[-15px] transition-transform">🎯</span>
            </div>
          )) : <div className="p-20 text-center text-slate-400 font-bold italic">عذراً، لم نتمكن من العثور على دروس..</div>}
          <div className="flex justify-center mt-12">
            <Button variant="outline" onClick={() => {
              checkSavedProgress();
              setStep(AppStep.SELECTION);
            }} className="px-12 py-3 rounded-2xl">الرجوع</Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (step === AppStep.QUIZ) {
    const q = quizQuestions[currentQuestionIndex];
    if (!q) return null;
    
    const totalTime = quizQuestions.length * 60;
    const timePercentage = (timeLeft / totalTime) * 100;

    return (
      <Layout title={userState.selectedTopic} {...layoutProps}>
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-sm border relative">
          <div className="absolute top-[-20px] left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-700 border-2 border-indigo-500 rounded-full px-6 py-2 shadow-xl flex items-center gap-3 z-10">
            <span className="text-xl">⏱️</span>
            <span className={`text-xl font-black tracking-widest ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-indigo-600'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>

          <div className="flex justify-between items-center mb-10 mt-4 text-xs font-black text-slate-400 uppercase">
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
               <span>تقدم محفوظ</span>
            </div>
            <span>سؤال {currentQuestionIndex + 1} من {quizQuestions.length}</span>
            <div className="w-32 bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-500 bg-indigo-600`} style={{width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%`}} />
            </div>
          </div>

          <h2 className="text-2xl font-black mb-12 leading-relaxed text-right text-slate-800 dark:text-white">{q.text}</h2>
          
          <div className="grid grid-cols-1 gap-4 mb-12">
            {q.type === 'OPEN' ? (
              <textarea placeholder="اكتب إجابتك هنا.." className="w-full p-6 rounded-3xl border dark:bg-slate-700 min-h-[150px] outline-none font-bold" />
            ) : (
              q.options.map((opt, i) => (
                <div key={i} onClick={() => {
                  const newAns = [...selectedAnswers];
                  newAns[currentQuestionIndex] = i;
                  setSelectedAnswers(newAns);
                }} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${selectedAnswers[currentQuestionIndex] === i ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 font-black text-indigo-700 shadow-inner' : 'hover:border-indigo-100 dark:hover:border-slate-600 border-slate-50 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  <span className="flex-1 text-right">{opt}</span>
                  {selectedAnswers[currentQuestionIndex] === i && <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] mr-4">✔</span>}
                </div>
              ))
            )}
          </div>

          <div className="flex gap-4">
            <Button variant="outline" disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex(p => p - 1)} className="flex-1 rounded-2xl py-4">السابق</Button>
            {currentQuestionIndex === quizQuestions.length - 1 ? (
              <Button onClick={submitQuiz} className="flex-1 rounded-2xl py-4" themeColor={appConfig.themeColor}>تسليم الاختبار</Button>
            ) : (
              <Button onClick={() => setCurrentQuestionIndex(p => p + 1)} className="flex-1 rounded-2xl py-4" themeColor={appConfig.themeColor}>التالي</Button>
            )}
          </div>

          <div className="mt-10 h-1 w-full bg-slate-50 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${timeLeft < 60 ? 'bg-red-500' : 'bg-indigo-500'}`} 
              style={{ width: `${timePercentage}%` }}
            />
          </div>
        </div>
      </Layout>
    );
  }

  if (step === AppStep.RESULTS && quizResult) {
    const isPassed = (quizResult.score / quizResult.total) * 100 >= appConfig.minPassingScore;
    return (
      <Layout title="نتيجة الاختبار" {...layoutProps}>
        <div className="max-w-md mx-auto bg-white dark:bg-slate-800 p-12 rounded-[3rem] shadow-2xl text-center border-t-8 border-indigo-600">
           <div className="text-7xl mb-8">{isPassed ? '🏆' : '📚'}</div>
           <h2 className="text-3xl font-black mb-2 dark:text-white tracking-tighter">{isPassed ? 'بطل خارق!' : 'أداء جيد'}</h2>
           <p className="text-slate-400 font-bold mb-8">لقد أجبت على {quizResult.score} من أصل {quizResult.total} سؤالاً.</p>
           <div className="text-6xl font-black text-indigo-600 mb-12 flex justify-center items-end gap-2">
             <span>{quizResult.score}</span>
             <span className="text-slate-300 text-2xl font-bold mb-2">/ {quizResult.total}</span>
           </div>
           <Button onClick={layoutProps.onHome} className="w-full py-5 text-xl rounded-2xl" themeColor={appConfig.themeColor}>العودة للرئيسية</Button>
        </div>
      </Layout>
    );
  }

  if (step === AppStep.REPORTS) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <DashboardHeader title="تقارير الأداء" />
        <main className="max-w-6xl mx-auto p-10">
           <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm overflow-hidden border">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b">
                  <tr>
                    <th className="p-6 font-black text-xs text-slate-400">الطالب</th>
                    <th className="p-6 font-black text-xs text-slate-400">النوع</th>
                    <th className="p-6 font-black text-xs text-slate-400">الموضوع</th>
                    <th className="p-6 font-black text-xs text-slate-400">الدرجة</th>
                    <th className="p-6 font-black text-xs text-slate-400">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quizHistory.map(h => (
                    <tr key={h.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="p-6 font-black text-slate-700 dark:text-slate-200">{h.studentName}</td>
                      <td className="p-6 text-xs font-black text-indigo-500">{h.type}</td>
                      <td className="p-6 text-sm text-slate-600 dark:text-slate-400">{h.topic}</td>
                      <td className="p-6 font-black text-xl text-indigo-600">{h.score} / {h.total}</td>
                      <td className="p-6 text-[10px] opacity-40 font-black">{h.date}</td>
                    </tr>
                  ))}
                  {quizHistory.length === 0 && <tr><td colSpan={5} className="p-24 text-center opacity-30 font-black text-2xl italic">لا توجد سجلات</td></tr>}
                </tbody>
              </table>
           </div>
        </main>
      </div>
    );
  }

  return null;
}

const Layout: React.FC<any> = ({ children, user, title, config, onHome, onLogout, isDarkMode, toggleTheme }) => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 transition-colors duration-300">
    <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-10 border-b dark:border-slate-700 px-8">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onHome}>
           <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-lg bg-${config.themeColor}-600 shadow-md`}>E</div>
           <span className="font-black text-2xl dark:text-white tracking-tighter">ExamiAI</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="hidden md:flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 px-4 py-1.5 rounded-full border dark:border-slate-600">
             <span className="text-lg">👤</span>
             <span className="dark:text-slate-300 font-black">{user.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all shadow-sm">{isDarkMode ? '☀️' : '🌙'}</button>
            <button onClick={onLogout} className="text-red-500 font-black hover:bg-red-50 dark:hover:bg-red-900/20 px-6 py-2 rounded-2xl transition-all">خروج</button>
          </div>
        </div>
      </div>
    </header>
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h2 className="text-4xl font-black mb-12 text-center text-slate-800 dark:text-white tracking-tight">{title}</h2>
      {children}
    </main>
  </div>
);
