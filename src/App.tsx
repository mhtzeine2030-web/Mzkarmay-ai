
import { useEffect, useState } from 'react';
import {
  Sparkles, Plus, Globe2, Smartphone, LayoutDashboard,
  Settings, ChevronDown, Send, Paperclip, Eye, Code2,
  Rocket, WandSparkles, Monitor
} from 'lucide-react';

function extractHtml(text: string): string {
  const blocks = [...text.matchAll(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/g)];

  const htmlBlock = blocks
    .map(match => match[1].trim())
    .find(block => /<!doctype\s+html|<html[\s>]/i.test(block));

  if (htmlBlock) return htmlBlock;

  const start = text.search(/<!doctype\s+html|<html[\s>]/i);

  if (start !== -1) {
    return text.slice(start).trim();
  }

  return '';
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState('');
  const [publishedSites, setPublishedSites] = useState<Array<{
    url: string;
    pathname: string;
    uploadedAt: string;
    size: number;
  }>>([]);
  const [showPublished, setShowPublished] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editing, setEditing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; title: string; html: string; prompt: string; updatedAt: string }>>([]);
  const [currentProjectId, setCurrentProjectId] = useState('');
  const [showProjects, setShowProjects] = useState(false);

  useEffect(() => {
    try {
      const savedProjects = localStorage.getItem('mzkarmay-ai-projects');
      if (savedProjects) {
        const parsedProjects = JSON.parse(savedProjects);
        if (Array.isArray(parsedProjects)) {
          setProjects(parsedProjects);
          if (parsedProjects[0]?.id) setCurrentProjectId(parsedProjects[0].id);
        }
      }
      const saved = localStorage.getItem('mzkarmay-ai-draft');
      if (saved) {
        const draft = JSON.parse(saved);
        if (typeof draft.html === 'string' && draft.html.trim()) {
          setHtml(draft.html);
          setPrompt(typeof draft.prompt === 'string' ? draft.prompt : '');
          setResult(draft.html);
          setTab('preview');
          setDraftSaved(true);
        }
      }
    } catch (error) {
      console.error('Could not restore local draft:', error);
    }
  }, []);

  const ar = language === 'ar';

  const submit = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResult('');
    setHtml('');
    setError('');
    setTab('preview');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          prompt: `${prompt.trim()}

IMPORTANT: Create a complete, standalone, responsive website.
Return the complete HTML document, including CSS and JavaScript.
Put the HTML inside one html code block.
Do not provide explanations before or after the code.
The result must start with <!DOCTYPE html> and include all necessary HTML, CSS and JavaScript.

E-COMMERCE AND WHATSAPP CHECKOUT REQUIREMENTS:
If the requested website is an online store or includes a shopping cart, implement a complete working cart and checkout.
The checkout must send the order to WhatsApp using https://wa.me/ with a URL-encoded order message containing the store name, each product name, quantity, unit price, and grand total.
IMPORTANT: Every store owner must be able to enter and save THEIR OWN WhatsApp number, including country code, in a clearly visible Store Settings / إعدادات المتجر section. Save this setting in localStorage so it remains after refresh. Do not hardcode the platform owner's phone number into generated stores and do not reuse another store's number. If no WhatsApp number has been configured, show a clear prompt asking the store owner to add their number before checkout; do not silently send to a default number.
When the customer clicks checkout, validate the cart and configured number, open WhatsApp in a new tab/window with the order details, and KEEP the cart unchanged. Never clear the cart or navigate back to the home page as part of checkout. Only clear the cart after the customer explicitly chooses to clear it.
All cart, quantity, total, settings, and checkout controls must work on mobile and desktop.`
        })
      });

      const responseText = await response.text();

      let data: any;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Invalid server response (${response.status}): ${responseText.slice(0, 250)}`
        );
      }

      if (!response.ok) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || `Server error: ${response.status}`
        );
      }

      if (typeof data.result !== 'string' || !data.result.trim()) {
        throw new Error('Gemini returned an empty response');
      }

      const generatedHtml = extractHtml(data.result);

      setResult(data.result);
      setHtml(generatedHtml);
      setTab(generatedHtml ? 'preview' : 'code');

    } catch (err) {
      setError(
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setLoading(false);
    }
  };

  const editWebsite = async () => {
    if (!html || !editPrompt.trim() || editing) return;

    setEditing(true);
    setError('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          prompt: `You are editing an existing website. Apply the user's requested changes to the current HTML.
Return the COMPLETE updated standalone HTML document inside one html code block.
Preserve all existing pages, content, styling, functionality, shopping cart, WhatsApp checkout, and responsive behavior unless the user explicitly asks to change them.
Do not remove working features. Do not explain anything outside the HTML code block.

USER REQUEST:
${editPrompt.trim()}

CURRENT WEBSITE HTML:
${html}`
        })
      });

      const responseText = await response.text();
      let data: any;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Invalid server response (${response.status}): ${responseText.slice(0, 250)}`);
      }

      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Website editing failed.');
      }

      const updatedHtml = extractHtml(data.result || '');
      if (!updatedHtml) {
        throw new Error(ar ? 'لم يرجع الذكاء الاصطناعي كود HTML صالحاً. لم يتغير موقعك.' : 'AI did not return valid HTML. Your website was not changed.');
      }

      setHtml(updatedHtml);
      setResult(data.result);
      setEditPrompt('');
      setTab('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditing(false);
    }
  };

  const loadPublishedSites = async () => {
    setShowPublished(true);
    setPublishError('');

    try {
      const response = await fetch('/api/publish', {
        headers: { Accept: 'application/json' }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not load published sites.');
      }

      setPublishedSites(Array.isArray(data.sites) ? data.sites : []);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    }
  };

  const saveDraft = () => {
    if (!html.trim()) return;
    try {
      const now = new Date().toISOString();
      const id = currentProjectId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `project-${Date.now()}`);
      const project = { id, title: prompt.trim().slice(0, 80) || (ar ? 'مشروع بدون عنوان' : 'Untitled project'), html, prompt, updatedAt: now };
      const nextProjects = [project, ...projects.filter(item => item.id !== id)];
      localStorage.setItem('mzkarmay-ai-projects', JSON.stringify(nextProjects));
      localStorage.setItem('mzkarmay-ai-draft', JSON.stringify({ html, prompt, savedAt: now }));
      setProjects(nextProjects);
      setCurrentProjectId(id);
      setDraftSaved(true);
      setPublishError('');
    } catch (error) {
      setDraftSaved(false);
      setPublishError(ar
        ? 'تعذر حفظ المسودة. قد تكون مساحة التخزين ممتلئة.'
        : 'Could not save the draft. Browser storage may be full.');
    }
  };

  const openProject = (project: typeof projects[number]) => {
    setCurrentProjectId(project.id);
    setHtml(project.html);
    setPrompt(project.prompt);
    setResult(project.html);
    setTab('preview');
    setDraftSaved(true);
    setShowProjects(false);
    setError('');
  };

  const deleteProject = (id: string) => {
    const nextProjects = projects.filter(project => project.id !== id);
    try {
      localStorage.setItem('mzkarmay-ai-projects', JSON.stringify(nextProjects));
      setProjects(nextProjects);
      if (currentProjectId === id) {
        setCurrentProjectId('');
        setDraftSaved(false);
      }
    } catch {
      setPublishError(ar ? 'تعذر حذف المشروع من التخزين.' : 'Could not delete the project.');
    }
  };

  const publishSite = async () => {
    if (!html || publishing) return;

    setPublishing(true);
    setPublishError('');
    setPublishedUrl('');

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          html,
          title: prompt.trim().slice(0, 80)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Publishing failed.');
      }

      setPublishedUrl(data.url);
      await loadPublishedSites();
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
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
              localStorage.removeItem('mzkarmay-ai-draft');
              setCurrentProjectId('');
              setShowProjects(false);
              setDraftSaved(false);
              setPrompt('');
              setResult('');
              setHtml('');
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

          <a className={showProjects ? 'nav active' : 'nav'} href="#my-projects" onClick={e => { e.preventDefault(); setShowProjects(true); }}>
            <LayoutDashboard size={17} />
            {ar ? 'المشاريع' : 'Projects'}
          </a>

          <a
            className={showPublished ? 'nav active' : 'nav'}
            href="#published-sites"
            onClick={e => {
              e.preventDefault();
              void loadPublishedSites();            }}
          >
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
              {html
                ? (ar
                    ? 'تم إنشاء الموقع بنجاح، ويمكنك معاينته الآن.'
                    : 'Website generated successfully. Preview it now.')
                : (ar
                    ? 'وصل الرد، لكنه لا يحتوي على كود HTML قابل للمعاينة.'
                    : 'Response received, but no previewable HTML was found.')}
            </div>
          )}

          {publishedUrl && (
            <div className="notice" style={{ display: 'block' }}>
              <b>{ar ? 'تم نشر موقعك!' : 'Your website is published!'}</b>
              <div style={{ marginTop: 8, overflowWrap: 'anywhere' }}>
                <a href={publishedUrl} target="_blank" rel="noreferrer">{publishedUrl}</a>
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(publishedUrl)}
                style={{ marginTop: 10 }}
              >
                {ar ? 'نسخ الرابط' : 'Copy link'}
              </button>
            </div>
          )}

          {publishError && (
            <div className="notice">
              {ar ? 'تعذر النشر: ' : 'Publishing error: '}
              {publishError}
            </div>
          )}

          {showProjects && (
            <section id="my-projects" className="workspace" style={{ marginBottom: 20 }}>
              <div className="workspace-bar">
                <div><LayoutDashboard size={16} /><b>{ar ? 'مشاريعي المحفوظة' : 'My saved projects'}</b><small> / {projects.length}</small></div>
                <button type="button" onClick={() => setShowProjects(false)}>{ar ? 'إغلاق' : 'Close'}</button>
              </div>
              <div style={{ padding: 18 }}>
                {projects.length === 0 ? (
                  <p>{ar ? 'لا توجد مشاريع محفوظة. افتح مشروعاً واضغط «حفظ التعديلات» لإضافته هنا.' : 'No saved projects yet. Open a project and click Save changes to add it here.'}</p>
                ) : projects.map(project => (
                  <div key={project.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 0', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ minWidth: 0, flex: '1 1 180px' }}>
                      <b style={{ display: 'block', overflowWrap: 'anywhere' }}>{project.title}</b>
                      <small>{ar ? 'آخر حفظ: ' : 'Last saved: '}{new Date(project.updatedAt).toLocaleString(ar ? 'ar' : 'en')}</small>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => openProject(project)}>{ar ? 'فتح وتعديل' : 'Open & edit'}</button>
                      <button type="button" onClick={() => { if (window.confirm(ar ? 'هل تريد حذف هذا المشروع المحفوظ؟' : 'Delete this saved project?')) deleteProject(project.id); }}>{ar ? 'حذف' : 'Delete'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showPublished && (
            <section id="published-sites" className="workspace" style={{ marginBottom: 20 }}>
              <div className="workspace-bar">
                <div>
                  <Globe2 size={16} />
                  <b>{ar ? 'المواقع المنشورة' : 'Published sites'}</b>
                  <small> / {publishedSites.length}</small>
                </div>
                <button type="button" onClick={() => setShowPublished(false)}>
                  {ar ? 'إغلاق' : 'Close'}
                </button>
              </div>
              <div style={{ padding: 18 }}>
                {publishedSites.length === 0 ? (
                  <p>{ar ? 'لا توجد مواقع منشورة حتى الآن.' : 'No published sites yet.'}</p>
                ) : publishedSites.map(site => (
                  <div
                    key={site.pathname}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '12px 0',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    <a href={site.url} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>
                      {site.url}
                    </a>
                    <small>
                      {new Date(site.uploadedAt).toLocaleString(ar ? 'ar' : 'en')}
                    </small>
                  </div>
                ))}
              </div>
            </section>
          )}

          {html && (
            <section className="builder" style={{ marginBottom: 20 }}>
              <div className="prompt-head">
                <div className="spark-circle"><WandSparkles size={18} /></div>
                <div>
                  <b>{ar ? 'عدّل موقعك بالمحادثة' : 'Edit your website with AI'}</b>
                  <small>{ar ? 'اكتب التعديل الذي تريده دون إنشاء موقع جديد' : 'Describe a change without creating a new site'}</small>
                </div>
              </div>
              <textarea
                value={editPrompt}
                onChange={e => setEditPrompt(e.target.value)}
                placeholder={ar ? 'مثال: غيّر الألوان إلى الأزرق وأضف قسماً للعروض...' : 'Example: Change the colors to blue and add a promotions section...'}
                disabled={editing}
              />
              <div className="prompt-footer">
                <span className="hint">{ar ? 'سيتم الحفاظ على الموقع الحالي وميزاته.' : 'Your current website and its features will be preserved.'}</span>
                <button className="send" type="button" onClick={editWebsite} disabled={editing || !editPrompt.trim()}>
                  <WandSparkles size={16} />
                  {editing ? (ar ? 'جارٍ التعديل...' : 'Editing...') : (ar ? 'تطبيق التعديل' : 'Apply changes')}
                </button>
              </div>
            </section>
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
                  {ar ? 'الكود' : 'Code'}
                </button>
              </div>

              <button
                type="button"
                onClick={saveDraft}
                disabled={!html}
                style={{
                  padding: '9px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#374151',
                  cursor: html ? 'pointer' : 'not-allowed'
                }}
              >
                {ar ? (draftSaved ? 'تم حفظ المسودة' : 'حفظ التعديلات') : (draftSaved ? 'Draft saved' : 'Save changes')}
              </button>
              <button
                className="publish"
                type="button"
                onClick={publishSite}
                disabled={!html || publishing}
                title={!html ? (ar ? 'أنشئ موقعاً أولاً' : 'Generate a website first') : ''}
              >
                <Rocket size={14} />
                {publishing
                  ? (ar ? 'جارٍ النشر...' : 'Publishing...')
                  : (ar ? 'نشر' : 'Publish')}
              </button>
            </div>

            <div className="canvas">
              {loading ? (
                <div className="empty-preview">
                  <Sparkles size={27} />
                  <b>{ar ? 'الذكاء الاصطناعي يعمل...' : 'AI is working...'}</b>
                  <p>{ar ? 'يرجى الانتظار قليلاً.' : 'Please wait.'}</p>
                </div>
              ) : html && tab === 'code' ? (
                <textarea
                  aria-label={ar ? 'محرر كود الموقع' : 'Website code editor'}
                  value={html}
                  onChange={e => setHtml(e.target.value)}
                  spellCheck={false}
                  style={{
                    display: 'block',
                    width: '100%',
                    minHeight: '700px',
                    padding: '20px',
                    boxSizing: 'border-box',
                    border: 'none',
                    outline: 'none',
                    resize: 'vertical',
                    background: '#111018',
                    color: '#e5e7eb',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    direction: 'ltr',
                    textAlign: 'left'
                  }}
                />
              ) : result && tab === 'code' ? (
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    textAlign: 'start',
                    direction: 'ltr',
                    padding: '20px',
                    maxHeight: '600px',
                    overflowY: 'auto',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  {result}
                </pre>
              ) : html ? (
                <iframe
                  title="Generated website preview"
                  srcDoc={html}
                  sandbox="allow-scripts allow-forms"
                  referrerPolicy="no-referrer"
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '700px',
                    border: 'none',
                    background: '#ffffff'
                  }}
                />
              ) : result ? (
                <div className="empty-preview">
                  <div className="preview-icon">
                    <Monitor size={27} />
                  </div>
                  <b>
                    {ar ? 'لم يتم العثور على كود HTML' : 'No HTML code found'}
                  </b>
                  <p>
                    {ar
                      ? 'افتح تبويب النتيجة لمشاهدة رد Gemini.'
                      : 'Open Result to view the Gemini response.'}
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
            <a
              href="https://wa.me/23568670101"
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginInlineStart: 12 }}
            >
              {ar ? 'تواصل معنا عبر واتساب' : 'Contact us on WhatsApp'}
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}