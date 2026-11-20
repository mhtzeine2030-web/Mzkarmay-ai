
import { useState } from 'react';
import {
  Sparkles, Plus, Globe2, Smartphone, LayoutDashboard,
  Settings, ChevronDown, Send, Paperclip, Eye, Code2,
  Rocket, WandSparkles, Monitor
} from 'lucide-react';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const ar = language === 'ar';

  const submit = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResult('');
    setError('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt.trim()
        })
      });

      const responseText = await response.text();

      let data: any;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `رد الخادم غير صالح (${response.status}): ${responseText.slice(0, 250)}`
        );
      }

      if (!response.ok) {
        const errorMessage =
          typeof data.error === 'string'
            ? data.error
            : data.error?.message ||
              JSON.stringify(data.error || data) ||
              `خطأ في الخادم: ${response.status}`;

        throw new Error(errorMessage);
      }

      if (typeof data.result !== 'string' || !data.result.trim()) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : 'لم تصل نتيجة من Gemini'
        );
      }

      setResult(data.result);
      setTab('code');

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setLoading(false);
    }
  };

  const templates = [
    {
      icon: <Globe2 />,
      title: ar ? 'موقع شركة' : 'Business website',
      desc: ar ? 'موقع تعريفي احترافي' : 'Professional company site',
      tag: 'WEBSITE',
      arPrompt: 'أنشئ موقعاً احترافياً لشركة مع صفحة رئيسية وخدمات وتواصل.',
      enPrompt: 'Build a professional company website with home, services and contact pages.'
    },
    {
      icon: <LayoutDashboard />,
      title: ar ? 'متجر إلكتروني' : 'Online store',
      desc: ar ? 'منتجات وسلة مشتريات' : 'Products and shopping cart',
      tag: 'E-COMMERCE',
      arPrompt: 'أنشئ متجراً إلكترونياً مع المنتجات وسلة المشتريات.',
      enPrompt: 'Build an online store with products and shopping cart.'
    },
    {
      icon: <Smartphone />,
      title: ar ? 'تطبيق جوال' : 'Mobile app',
      desc: ar ? 'تجربة تطبيق للهواتف' : 'Mobile app experience',
      tag: 'APP',
      arPrompt: 'أنشئ واجهة تطبيق جوال حديثة مع تسجيل الدخول والصفحة الرئيسية.',
      enPrompt: 'Build a modern mobile app UI with login and home screen.'
    }
  ];

  return (
    <div className="app" dir={ar ? 'rtl' : 'ltr'}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={19} />
          </div>
          <span>MZKarmay <b>AI</b></span>
          <span className="beta">BETA</span>
        </div>

        <div className="top-actions">
          <button
            className="lang"
            onClick={() => setLanguage(ar ? 'en' : 'ar')}
          >
            {ar ? 'English' : 'العربية'}
            <ChevronDown size={14} />
          </button>
          <button className="avatar">M</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <button
            className="new-project"
            onClick={() => {
              setPrompt('');
              setResult('');
              setError('');
              setTab('preview');
            }}
          >
            <Plus size={17} />
            {ar ? 'مشروع جديد' : 'New project'}
          </button>

          <div className="nav-label">
            {ar ? 'مساحة العمل' : 'WORKSPACE'}
          </div>

          <a className="nav active">
            <LayoutDashboard size={17} />
            {ar ? 'المشاريع' : 'Projects'}
          </a>

          <a className="nav">
            <Globe2 size={17} />
            {ar ? 'المواقع المنشورة' : 'Published sites'}
          </a>

          <a className="nav">
            <Smartphone size={17} />
            {ar ? 'التطبيقات' : 'Apps'}
          </a>

          <div className="side-bottom">
            <a className="nav">
              <Settings size={17} />
              {ar ? 'الإعدادات' : 'Settings'}
            </a>

            <div className="plan">
              <div className="plan-icon">
                <Sparkles size={16} />
              </div>
              <div>
                <b>{ar ? 'الخطة المجانية' : 'Free plan'}</b>
                <small>{ar ? 'ابدأ ببناء مشروعك' : 'Start building'}</small>
              </div>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="welcome">
            <div className="eyebrow">
              <span className="pulse"></span>
              {ar ? 'استوديو البناء بالذكاء الاصطناعي' : 'AI BUILD STUDIO'}
            </div>

            <h1>
              {ar ? 'ماذا تريد أن تبني اليوم؟' : 'What do you want to build today?'}
            </h1>

            <p>
              {ar
                ? 'صف فكرتك، وسنساعدك على تحويلها إلى موقع أو تطبيق.'
                : 'Describe your idea and turn it into a website or app.'}
            </p>
          </div>

          <section className="builder">
            <div className="prompt-head">
              <div className="spark-circle">
                <WandSparkles size={18} />
              </div>

              <div>
                <b>{ar ? 'ابدأ بوصف فكرتك' : 'Describe your idea'}</b>
                <small>
                  {ar ? 'اكتب ما تريد إنشاءه بالتفصيل' : 'Tell us what you want to create'}
                </small>
              </div>

              <span className="model">
                AI <ChevronDown size={13} />
              </span>
            </div>

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={
                ar
                  ? 'مثال: أنشئ متجراً إلكترونياً للأزياء، بتصميم عصري، مع صفحة للمنتجات وسلة مشتريات...'
                  : 'Example: Build a modern fashion store with product pages and a shopping cart...'
              }
            />

            <div className="prompt-footer">
              <button className="attach" type="button">
                <Paperclip size={16} />
                {ar ? 'إرفاق' : 'Attach'}
              </button>

              <span className="hint">
                {ar
                  ? 'Enter للإرسال · Shift + Enter لسطر جديد'
                  : 'Enter to send · Shift + Enter for new line'}
              </span>

              <button
                className="send"
                onClick={submit}
                disabled={loading || !prompt.trim()}
              >
                <Send size={16} />
                {loading
                  ? (ar ? 'جارٍ الإنشاء...' : 'Generating...')
                  : (ar ? 'إنشاء' : 'Build')}
              </button>
            </div>
          </section>

          <div className="section-title">
            {ar ? 'ابدأ بقالب جاهز' : 'START WITH A TEMPLATE'}
            <span>{ar ? 'أو اكتب فكرتك' : 'or describe your idea'}</span>
          </div>

          <div className="templates">
            {templates.map((t, i) => (
              <button
                className="template"
                key={i}
                onClick={() => setPrompt(ar ? t.arPrompt : t.enPrompt)}
              >
                <div className="template-icon">{t.icon}</div>
                <span className="tag">{t.tag}</span>
                <b>{t.title}</b>
                <small>{t.desc}</small>
              </button>
            ))}
          </div>

          {loading && (
            <div className="notice">
              <Sparkles size={16} />
              {ar
                ? 'يتصل MZKarmay AI بمحرك Gemini، يرجى الانتظار...'
                : 'Connecting to Gemini, please wait...'}
            </div>
          )}

          {error && (
            <div className="notice">
              {ar ? 'حدث خطأ: ' : 'Error: '}
              {error}
            </div>
          )}

          {result && (
            <div className="notice">
              <Sparkles size={16} />
              {ar
                ? 'وصلت نتيجة الذكاء الاصطناعي بنجاح.'
                : 'AI response received successfully.'}
            </div>
          )}

          <div className="workspace">
            <div className="workspace-bar">
              <div>
                <span className="dot"></span>
                <b>{ar ? 'معاينة المشروع' : 'Project preview'}</b>
                <small> / {ar ? 'مشروع جديد' : 'New project'}</small>
              </div>

              <div className="tabs">
                <button
                  className={tab === 'preview' ? 'selected' : ''}
                  onClick={() => setTab('preview')}
                >
                  <Eye size={14} />
                  {ar ? 'معاينة' : 'Preview'}
                </button>

                <button
                  className={tab === 'code' ? 'selected' : ''}
                  onClick={() => setTab('code')}
                >
                  <Code2 size={14} />
                  {ar ? 'النتيجة' : 'Result'}
                </button>
              </div>

              <button className="publish" type="button">
                <Rocket size={14} />
                {ar ? 'نشر' : 'Publish'}
              </button>
            </div>

            <div className="canvas">
              {loading ? (
                <div className="empty-preview">
                  <Sparkles size={27} />
                  <b>{ar ? 'الذكاء الاصطناعي يعمل...' : 'AI is working...'}</b>
                  <p>{ar ? 'يرجى الانتظار قليلاً.' : 'Please wait.'}</p>
                </div>
              ) : result && tab === 'code' ? (
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    textAlign: 'start',
                    direction: ar ? 'rtl' : 'ltr',
                    padding: '20px',
                    maxHeight: '600px',
                    overflowY: 'auto',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  {result}
                </pre>
              ) : result ? (
                <div className="empty-preview">
                  <div className="preview-icon">
                    <Monitor size={27} />
                  </div>
                  <b>
                    {ar ? 'تم استلام نتيجة Gemini' : 'Gemini response received'}
                  </b>
                  <p>
                    {ar
                      ? 'اضغط على تبويب النتيجة لقراءة الرد.'
                      : 'Select Result to read the response.'}
                  </p>
                  <button onClick={() => setTab('code')}>
                    {ar ? 'عرض النتيجة' : 'View result'}
                  </button>
                </div>
              ) : (
                <div className="empty-preview">
                  <div className="preview-icon">
                    <Monitor size={27} />
                  </div>
                  <b>
                    {ar ? 'ستظهر معاينة موقعك هنا' : 'Your preview will appear here'}
                  </b>
                  <p>
                    {ar
                      ? 'اكتب وصف مشروعك في الأعلى لبدء البناء.'
                      : 'Describe your project above to get started.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <footer>
            © 2026 MZKarmay AI
            <span>{ar ? 'صُنع لبناء أفكارك' : 'Built for your ideas'}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
