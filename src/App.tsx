
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
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


function createPreviewDocument(sourceHtml: string, storage: Record<string, string>, projectKey: string): string {
  const safeStorage = JSON.stringify(storage).replace(/</g, '\\u003c');
  const safeProjectKey = JSON.stringify(projectKey).replace(/</g, '\\u003c');
  const bridge = `<script>
  (function () {
    const values = ${safeStorage};
    const projectKey = ${safeProjectKey};
    const data = values && typeof values === 'object' ? { ...values } : {};
    const notify = () => parent.postMessage({
      type: 'MZKARMAY_PREVIEW_STORAGE',
      projectKey,
      storage: data
    }, '*');
    const storageApi = {
      get length() { return Object.keys(data).length; },
      key(index) { return Object.keys(data)[index] ?? null; },
      getItem(key) { key = String(key); return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
      setItem(key, value) { data[String(key)] = String(value); notify(); },
      removeItem(key) { delete data[String(key)]; notify(); },
      clear() { Object.keys(data).forEach(key => delete data[key]); notify(); }
    };
    try {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: storageApi
      });
    } catch (error) {}
    const sendHeight = () => {
      const root = document.documentElement;
      const body = document.body;
      const height = Math.max(
        root ? root.scrollHeight : 0,
        root ? root.offsetHeight : 0,
        body ? body.scrollHeight : 0,
        body ? body.offsetHeight : 0
      );
      parent.postMessage({ type: 'MZKARMAY_PREVIEW_HEIGHT', projectKey, height }, '*');
    };
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(sendHeight);
      if (document.documentElement) resizeObserver.observe(document.documentElement);
      if (document.body) resizeObserver.observe(document.body);
    }
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      const mutationObserver = new MutationObserver(() => {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(sendHeight);
        else sendHeight();
      });
      mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
    }
    window.addEventListener('load', sendHeight);
    window.addEventListener('resize', sendHeight);
    document.addEventListener('DOMContentLoaded', sendHeight);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(sendHeight);
    setTimeout(sendHeight, 0);
    setTimeout(sendHeight, 250);
    setTimeout(sendHeight, 700);
  })();
  <\/script>`;
  if (/<head(?:[ \t\r\n][^>]*)?>/i.test(sourceHtml)) {
    return sourceHtml.replace(/<head(?:[ \t\r\n][^>]*)?>/i, match => match + bridge);
  }
  return sourceHtml.replace(/<html(?:[ \t\r\n][^>]*)?>/i, match => match + '<head>' + bridge + '</head>');
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
  const [showApps, setShowApps] = useState(false);
  const [appCreationMode, setAppCreationMode] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editing, setEditing] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [publishError, setPublishError] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; cloudId?: string; title: string; html: string; prompt: string; updatedAt: string; publishedPathname?: string }>>([]);
  const [currentProjectId, setCurrentProjectId] = useState('');
  const [showProjects, setShowProjects] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [importingSite, setImportingSite] = useState('');
  const [currentPublishedPathname, setCurrentPublishedPathname] = useState('');
  const [updatingPublished, setUpdatingPublished] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  const [siteAnalytics, setSiteAnalytics] = useState<Array<{ project_id: string; title: string; pathname: string; visits: number }>>([]);
  const [selectedAnalyticsSite, setSelectedAnalyticsSite] = useState<{ project_id: string; title: string; pathname: string } | null>(null);
  const [siteVisitHistory, setSiteVisitHistory] = useState<Array<{ visit_date: string; visits: number }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const previewStorageRef = useRef<Record<string, Record<string, string>>>({});
  const [previewHeight, setPreviewHeight] = useState(700);
  const previewProjectKey = currentProjectId || 'draft';
  const previewDocument = useMemo(
    () => createPreviewDocument(html, previewStorageRef.current[previewProjectKey] || {}, previewProjectKey),
    [html, previewProjectKey]
  );

  useEffect(() => {
    const handlePreviewMessage = (event: MessageEvent) => {
      if (event.source !== previewFrameRef.current?.contentWindow) return;
      const message = event.data;
      if (!message || typeof message !== 'object' || message.projectKey !== previewProjectKey) return;
      if (message.type === 'MZKARMAY_PREVIEW_STORAGE' && message.storage && typeof message.storage === 'object') {
        previewStorageRef.current[previewProjectKey] = message.storage as Record<string, string>;
      }
      if (message.type === 'MZKARMAY_PREVIEW_HEIGHT' && Number.isFinite(message.height)) {
        setPreviewHeight(Math.max(320, Math.min(12000, Math.ceil(message.height))));
      }
    };
    window.addEventListener('message', handlePreviewMessage);
    return () => window.removeEventListener('message', handlePreviewMessage);
  }, [previewProjectKey]);

  useEffect(() => {
    setPreviewHeight(700);
  }, [html, previewProjectKey]);

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
          const restoredPrompt = typeof draft.prompt === 'string' ? draft.prompt : '';
          setPrompt(restoredPrompt);
          const savedProjectsNow = JSON.parse(localStorage.getItem('mzkarmay-ai-projects') || '[]');
          const matchingProject = Array.isArray(savedProjectsNow) ? savedProjectsNow.find((project: any) => project.html === draft.html) : null;
          if (!matchingProject) {
            const migratedProject = { id: `restored-${Date.now()}`, title: restoredPrompt.trim().slice(0, 80) || 'مشروع محفوظ', html: draft.html, prompt: restoredPrompt, updatedAt: draft.savedAt || new Date().toISOString() };
            const nextProjects = [migratedProject, ...(Array.isArray(savedProjectsNow) ? savedProjectsNow : [])];
            localStorage.setItem('mzkarmay-ai-projects', JSON.stringify(nextProjects));
            setProjects(nextProjects);
            setCurrentProjectId(migratedProject.id);
          } else {
            setCurrentProjectId(matchingProject.id);
          }
          setResult(draft.html);
          setTab('preview');
          setDraftSaved(true);
        }
      }
    } catch (error) {
      console.error('Could not restore local draft:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthMessage(error.message);
      const user = data.session?.user;
      setAuthUser(user ? { id: user.id, email: user.email || '' } : null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setAuthUser(user ? { id: user.id, email: user.email || '' } : null);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    const loadAccountProjects = async () => {
      setPublishError('');
      const { data, error } = await supabase
        .from('user_projects')
        .select('id, title, html, prompt, published_pathname')
        .eq('user_id', authUser.id)
        .order('id', { ascending: false });
      if (!active) return;
      if (error) {
        setPublishError(ar ? 'تعذر تحميل مشاريع الحساب: ' + error.message : 'Could not load account projects: ' + error.message);
        return;
      }
      const accountProjects = (data || []).map((row: any) => ({
        id: row.id,
        cloudId: row.id,
        title: row.title || (ar ? 'مشروع بدون عنوان' : 'Untitled project'),
        html: row.html || '',
        prompt: row.prompt || '',
        updatedAt: new Date().toISOString(),
        publishedPathname: row.published_pathname || undefined
      }));
      setProjects(accountProjects);
      localStorage.setItem('mzkarmay-ai-projects', JSON.stringify(accountProjects));
      if (currentProjectId && !accountProjects.some(project => project.id === currentProjectId)) {
        setCurrentProjectId('');
      }
    };
    void loadAccountProjects();
    return () => { active = false; };
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser) {
      setSiteAnalytics([]);
      return;
    }
    let active = true;
    const loadSiteAnalytics = async () => {
      const { data, error } = await supabase.rpc('get_my_site_analytics');
      if (!active) return;
      if (error) {
        console.error('Could not load website analytics:', error);
        return;
      }
      setSiteAnalytics((data || []).map((row: any) => ({
        project_id: row.project_id,
        title: row.title || (ar ? 'موقع بدون عنوان' : 'Untitled website'),
        pathname: row.pathname,
        visits: Number(row.visits || 0)
      })));
    };
    void loadSiteAnalytics();
    return () => { active = false; };
  }, [authUser?.id, projects, showDashboard]);

  const handleAuth = async () => {
    if (!authEmail.trim() || !authPassword || authBusy) return;
    setAuthBusy(true);
    setAuthMessage('');
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        if (!data.session) {
          setAuthMessage(ar ? 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده، ثم سجّل الدخول.' : 'Account created. Check your email to confirm it, then sign in.');
        } else {
          setAuthMessage(ar ? 'تم إنشاء الحساب وتسجيل الدخول بنجاح.' : 'Account created and signed in successfully.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword
        });
        if (error) throw error;
        setAuthMessage(ar ? 'تم تسجيل الدخول بنجاح.' : 'Signed in successfully.');
      }
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    setAuthMessage(error ? error.message : (ar ? 'تم تسجيل الخروج.' : 'Signed out.'));
    if (!error) {
      setAuthPassword('');
      setAuthOpen(false);
      setProjects([]);
      setCurrentProjectId('');
      setCurrentPublishedPathname('');
      setHtml('');
      setResult('');
      setPrompt('');
      setDraftSaved(false);
      localStorage.removeItem('mzkarmay-ai-projects');
      localStorage.removeItem('mzkarmay-ai-draft');
    }
  };

  const ar = language === 'ar';

  const openSection = (section: 'home' | 'dashboard' | 'projects' | 'published' | 'apps') => {
    setShowDashboard(section === 'dashboard');
    setShowProjects(section === 'projects');
    setShowPublished(section === 'published');
    setShowApps(section === 'apps');
    setSelectedAnalyticsSite(null);
    setSiteVisitHistory([]);
    setHistoryError('');
  };

  const loadSiteVisitHistory = async (project: { id: string; title: string; publishedPathname?: string }) => {
    if (!project.publishedPathname) return;
    setSelectedAnalyticsSite({
      project_id: project.id,
      title: project.title,
      pathname: project.publishedPathname
    });
    setHistoryLoading(true);
    setHistoryError('');
    setSiteVisitHistory([]);
    const { data, error } = await supabase.rpc('get_my_site_visit_history', {
      p_project_id: project.id
    });
    if (error) {
      setHistoryError(error.message);
    } else {
      setSiteVisitHistory((data || []).map((row: any) => ({
        visit_date: row.visit_date,
        visits: Number(row.visits || 0)
      })));
    }
    setHistoryLoading(false);
  };

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
          prompt: `${appCreationMode ? 'Create a mobile-first web application, not a marketing website. Make it feel like a polished native app with touch-friendly navigation and controls, responsive screens, and fully working core interactions. Include iOS home-screen metadata and an app icon using an inline SVG data URI where possible. Keep the complete app self-contained in this single HTML file. ' : ''}${prompt.trim()}

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
All cart, quantity, total, settings, and checkout controls must work on mobile and desktop.

CRITICAL PREVIEW STORAGE COMPATIBILITY:
The website may run inside a sandboxed iframe preview where window.localStorage access throws a SecurityError because the document has an opaque origin. NEVER access localStorage directly during startup or application logic.
Create a safe storage adapter at the very beginning of the script. Its getItem, setItem, and removeItem methods must each try window.localStorage inside try/catch and use an in-memory object/Map fallback when storage is blocked. Route EVERY read/write/remove operation through this adapter, including tasks, settings, cart, WhatsApp number, and saved preferences. Initialize the adapter before any app code that reads saved data. Guard JSON.parse with try/catch and sensible defaults so corrupt or unavailable stored data cannot stop the script.
Do not let storage errors prevent event listeners, form submission handlers, buttons, rendering, or other app interactions from being initialized. - For list-based features such as tasks, products, notes, messages, or cart items, store records in an array and render the ENTIRE array every time. On add: validate input, append a new record, save the full array, then re-render. The render function must clear the list container and loop over every array item; never render only the first item or replace the array with a single item. Give each record a stable unique id. Do not clear the input until the item has been saved and rendered.
- Make the page vertically scrollable on phones and desktops. Use min-height rather than fixed height for page content; keep html and body at min-height: 100%, allow body overflow-y: auto, and use -webkit-overflow-scrolling: touch. Do not apply overflow: hidden or fixed positioning to page/root containers in a way that prevents scrolling. Avoid trapping the whole app inside a fixed 100vh container; use internal scrolling only for intentionally bounded panels.
In preview, fallback data may last only until the preview reloads; on a normal published website, browser storage should persist normally.`
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
      setDraftSaved(false);
      setTab(generatedHtml ? 'preview' : 'code');

    } catch (err) {
      setError(
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setLoading(false);
    }
  };

  const editWebsite = async (requestedPrompt?: string) => {
    const requestedChange = (requestedPrompt ?? editPrompt).trim();
    if (!html || !requestedChange || editing) return;

    setEditing(true);
    setError('');
    setEditStatus(ar ? 'جارٍ تطبيق التعديل...' : 'Applying changes...');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          prompt: `You are making a MINIMAL PATCH to an existing website, not generating a replacement website.
Treat the CURRENT WEBSITE HTML below as the source of truth. Make only the smallest code changes needed to satisfy the user's latest request.
Return the COMPLETE updated standalone HTML document inside one html code block.
MANDATORY CHANGE-PRESERVATION RULES:
- Preserve every previous user-requested change exactly, including colors, typography, layout, text, sections, and behavior, unless the latest request explicitly changes that same item.
- Do not restore defaults, undo earlier edits, redesign, rewrite, simplify, or regenerate unrelated parts of the website.
- Preserve all existing pages, content, styling, IDs, CSS rules, JavaScript functions, event listeners, data, and functionality, including shopping cart, WhatsApp checkout, and responsive behavior.
- Do not remove or rename working elements, functions, selectors, storage keys, or event handlers.
- If the request affects one element, edit only that element and its directly necessary supporting code.
- Before returning, mentally compare the updated HTML with the current HTML and verify that all unrelated code and all earlier changes remain intact.
- Keep any safe storage adapter and its memory fallback intact. Never replace safe storage access with direct localStorage calls; preview may run in a sandbox where localStorage throws SecurityError.
- When the requested change involves a list or repeated records, trace the full add, save, and render flow. Ensure every item is appended rather than replacing the array, and ensure rendering loops over all items after each addition. Preserve existing records and IDs.
- When the requested change involves scrolling or a long page, inspect html/body and ancestor containers for fixed heights, overflow:hidden, or fixed positioning that blocks vertical scrolling. Correct only the responsible styles; preserve the visual design and intentional panel scrolling.
- Return complete HTML, not a diff or partial snippet. Do not explain anything outside the HTML code block.

USER REQUEST:
${requestedChange}

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
      setDraftSaved(false);
      setResult(data.result);
      setEditPrompt('');
      setTab('preview');
      setEditStatus(ar ? 'تم تطبيق التعديل بنجاح.' : 'Changes applied successfully.');
      if (requestedPrompt) await saveDraft(updatedHtml);
    } catch (err) {
      setEditStatus('');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditing(false);
    }
  };

  const applyWebsiteChanges = async () => {
    await editWebsite(editPrompt);
  };

  const repairCurrentWebsite = async () => {
    const repairPrompt = ar
      ? 'أصلح هذا التطبيق الحالي دون إعادة تصميمه أو حذف أي ميزة أو بيانات. افحص كود HTML وJavaScript الحالي. أصلح جميع مشاكل القوائم المتكررة بحيث تُضاف كل مهمة أو عنصر إلى المصفوفة ولا تستبدل العناصر السابقة، واحفظ المصفوفة كاملة ثم أعد عرض جميع العناصر بعد كل إضافة. افحص كذلك أخطاء التخزين الآمن وحافظ على مفاتيح التخزين والبيانات الحالية. اجعل الصفحة قابلة للتمرير عموديًا على الهاتف والكمبيوتر، وأزل فقط قيود الارتفاع الثابت أو overflow:hidden التي تمنع التمرير من الحاويات الرئيسية. حافظ على التصميم والألوان والنصوص والأقسام والوظائف الحالية كما هي. لا تحذف بيانات المستخدم ولا تغيّر أسماء المعرفات أو مفاتيح التخزين. أعد ملف HTML كاملًا صالحًا.'
      : 'Repair this existing app without redesigning it or removing any feature or data. Inspect its current HTML and JavaScript. Fix repeated lists so each task or item is appended to the array rather than replacing previous items, save the complete array, and render every item after each addition. Check safe storage handling while preserving existing storage keys and data. Make the page vertically scrollable on phones and desktops; remove only fixed-height or overflow:hidden constraints on root containers that block scrolling. Preserve the current design, colors, text, sections, and functionality. Do not delete user data or rename IDs or storage keys. Return the complete valid HTML document.';
    await editWebsite(repairPrompt);
  };

  const loadPublishedSites = async () => {
    openSection('published');
    setPublishError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error(ar ? 'سجّل الدخول لعرض مواقعك المنشورة.' : 'Sign in to view your published websites.');
      const response = await fetch('/api/publish', {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` }
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

  const saveDraft = async (htmlOverride?: string) => {
    const htmlToSave = htmlOverride ?? html;
    if (!htmlToSave.trim() || savingDraft) return;
    setSavingDraft(true);
    setPublishError('');
    try {
      const now = new Date().toISOString();
      const id = currentProjectId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `project-${Date.now()}`);
      const existing = projects.find(item => item.id === id);
      const cloudId = existing?.cloudId || (authUser ? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : id) : undefined);
      const savedPrompt = appCreationMode ? `[MZKARMAY_APP]\n${prompt}` : prompt;
      const project = { id, cloudId, title: prompt.trim().slice(0, 80) || (ar ? 'مشروع بدون عنوان' : 'Untitled project'), html: htmlToSave, prompt: savedPrompt, updatedAt: now, publishedPathname: currentPublishedPathname || undefined };
      const nextProjects = [project, ...projects.filter(item => item.id !== id)];
      if (authUser && cloudId) {
        const { error } = await supabase.from('user_projects').upsert({
          id: cloudId,
          user_id: authUser.id,
          title: project.title,
          html: project.html,
          prompt: project.prompt,
          published_pathname: project.publishedPathname || null
        }, { onConflict: 'id' });
        if (error) throw error;
      }
      localStorage.setItem('mzkarmay-ai-projects', JSON.stringify(nextProjects));
      localStorage.setItem('mzkarmay-ai-draft', JSON.stringify({ html: htmlToSave, prompt, savedAt: now }));
      setProjects(nextProjects);
      setCurrentProjectId(id);
      setDraftSaved(true);
      setPublishError('');
    } catch (error) {
      setDraftSaved(false);
      setPublishError(ar
        ? 'تعذر حفظ المسودة: ' + (error instanceof Error ? error.message : String(error))
        : 'Could not save the draft: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSavingDraft(false);
    }
  };

  const importPublishedSite = async (site: typeof publishedSites[number]) => {
    if (importingSite) return;
    setImportingSite(site.pathname);
    setPublishError('');
    try {
      const response = await fetch(site.url, { headers: { Accept: 'text/html' } });
      if (!response.ok) throw new Error(ar ? 'تعذر تحميل الموقع المنشور.' : 'Could not load the published website.');
      const importedHtml = await response.text();
      const normalizedHtml = importedHtml.trimStart().replace(/^\uFEFF/, '').toLowerCase();
      if (!normalizedHtml.includes('<html') && !normalizedHtml.startsWith('<!doctype html')) {
        throw new Error(ar ? 'لم يصل كود الموقع. تحقق من رابط الموقع المنشور.' : 'Website HTML was not returned. Check the published site URL.');
      }
      const now = new Date().toISOString();
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `imported-${Date.now()}`;
      const title = ar ? 'موقع مستورد ' + new Date(now).toLocaleDateString('ar') : 'Imported website ' + new Date(now).toLocaleDateString('en');
      const project = { id, title, html: importedHtml, prompt: title, updatedAt: now, publishedPathname: site.pathname };
      const nextProjects = [project, ...projects];
      localStorage.setItem('mzkarmay-ai-projects', JSON.stringify(nextProjects));
      localStorage.setItem('mzkarmay-ai-draft', JSON.stringify({ html: importedHtml, prompt: title, savedAt: now }));
      setProjects(nextProjects);
      setCurrentProjectId(id);
      setCurrentPublishedPathname(site.pathname);
      setHtml(importedHtml);
      setPrompt(title);
      setResult(importedHtml);
      setTab('preview');
      setDraftSaved(true);
      setShowPublished(false);
      setPublishError('');
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportingSite('');
    }
  };

  const openProject = (project: typeof projects[number]) => {
    setCurrentProjectId(project.id);
    setCurrentPublishedPathname(project.publishedPathname || '');
    setHtml(project.html);
    const isApp = project.prompt.startsWith('[MZKARMAY_APP]');
    setAppCreationMode(isApp);
    setPrompt(isApp ? project.prompt.slice('[MZKARMAY_APP]'.length).replace(/^\s*/, '') : project.prompt);
    setResult(project.html);
    setTab('preview');
    setDraftSaved(true);
    setShowProjects(false);
    setError('');
  };

  const updatePublishedSite = async () => {
    if (!html.trim() || !currentPublishedPathname || updatingPublished) return;
    const currentProject = projects.find(project => project.id === currentProjectId);
    const projectId = currentProject?.cloudId;
    if (!authUser || !projectId) {
      setPublishError(ar ? 'احفظ المشروع في حسابك أولاً قبل تحديث الموقع المنشور.' : 'Save this project to your account before updating its published website.');
      return;
    }

    setUpdatingPublished(true);
    setPublishError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error(ar ? 'انتهت جلسة الدخول. سجّل الدخول مجدداً.' : 'Your session expired. Please sign in again.');

      const response = await fetch('/api/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ projectId, pathname: currentPublishedPathname, html })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Website update failed.');

      const now = new Date().toISOString();
      const updatedProjects = projects.map(project => project.id === currentProjectId
        ? { ...project, html, prompt: appCreationMode ? `[MZKARMAY_APP]\n${prompt}` : prompt, updatedAt: now, publishedPathname: currentPublishedPathname }
        : project);
      localStorage.setItem('mzkarmay-ai-projects', JSON.stringify(updatedProjects));
      setProjects(updatedProjects);
      setPublishedUrl('');
      setPublishError(ar ? 'تم تحديث موقعك المنشور وحفظ التعديلات في حسابك.' : 'Your published website and account project have been updated.');
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingPublished(false);
    }
  };

  const deleteProject = async (id: string) => {
    const target = projects.find(project => project.id === id);
    try {
      if (authUser && target?.cloudId) {
        const { error } = await supabase.from('user_projects').delete().eq('id', target.cloudId).eq('user_id', authUser.id);
        if (error) throw error;
      }
      const nextProjects = projects.filter(project => project.id !== id);
      localStorage.setItem('mzkarmay-ai-projects', JSON.stringify(nextProjects));
      setProjects(nextProjects);
      if (currentProjectId === id) {
        setCurrentProjectId('');
        setDraftSaved(false);
      }
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : (ar ? 'تعذر حذف المشروع.' : 'Could not delete project.'));
    }
  };

  const publishSite = async () => {
    if (!html || publishing) return;
    if (!authUser) {
      setPublishError(ar ? 'سجّل الدخول أولاً حتى يُربط الموقع المنشور بحسابك.' : 'Please sign in first so the published website can be linked to your account.');
      setAuthOpen(true);
      return;
    }

    setPublishing(true);
    setPublishError('');
    setPublishedUrl('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error(ar ? 'انتهت جلسة الدخول. سجّل الدخول مجدداً.' : 'Your session expired. Please sign in again.');

      const currentProject = projects.find(project => project.id === currentProjectId);
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          html,
          title: prompt.trim().slice(0, 80),
          prompt: appCreationMode ? `[MZKARMAY_APP]\n${prompt}` : prompt,
          projectId: currentProject?.cloudId
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Publishing failed.');

      setPublishedUrl(data.url);
      if (typeof data.pathname === 'string' && typeof data.projectId === 'string') {
        const now = new Date().toISOString();
        const localId = currentProject?.id || data.projectId;
        const project = {
          id: localId,
          cloudId: data.projectId,
          title: prompt.trim().slice(0, 80) || (ar ? 'موقع منشور' : 'Published website'),
          html,
          prompt: appCreationMode ? `[MZKARMAY_APP]\n${prompt}` : prompt,
          updatedAt: now,
          publishedPathname: data.pathname
        };
        const updatedProjects = [project, ...projects.filter(item => item.id !== localId)];
        localStorage.setItem('mzkarmay-ai-projects', JSON.stringify(updatedProjects));
        setProjects(updatedProjects);
        setCurrentProjectId(localId);
        setCurrentPublishedPathname(data.pathname);
        setDraftSaved(true);
      }
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
          <button className="avatar" type="button" onClick={() => { setAuthOpen(true); setAuthMessage(''); }}>
            {authUser ? (authUser.email.charAt(0).toUpperCase() || 'U') : 'M'}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <button
            className="new-project"
            onClick={() => {
              localStorage.removeItem('mzkarmay-ai-draft');
              setCurrentProjectId('');
              setCurrentPublishedPathname('');
              setAppCreationMode(false);
              openSection('home');
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

          <a className={showDashboard ? 'nav active' : 'nav'} href="#dashboard" onClick={e => { e.preventDefault(); openSection('dashboard'); }}>
            <LayoutDashboard size={17} />
            {ar ? 'لوحة التحكم' : 'Dashboard'}
          </a>

          <a className={showProjects ? 'nav active' : 'nav'} href="#my-projects" onClick={e => { e.preventDefault(); openSection('projects'); }}>
            <LayoutDashboard size={17} />
            {ar ? 'المشاريع' : 'Projects'}
          </a>

          <a
            className={showPublished ? 'nav active' : 'nav'}
            href="#published-sites"
            onClick={e => {
              e.preventDefault();
              void loadPublishedSites();
            }}
          >
            <Globe2 size={17} />
            {ar ? 'المواقع المنشورة' : 'Published sites'}
          </a>

          <a className={showApps ? 'nav active' : 'nav'} href="#apps" onClick={e => { e.preventDefault(); openSection('apps'); }}>
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
          {showDashboard && (
            <section id="dashboard" style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 22 }}>
                <div className="eyebrow"><span className="pulse"></span>{ar ? 'مساحة حسابك' : 'YOUR ACCOUNT'}</div>
                <h1 style={{ marginBottom: 8 }}>{ar ? 'لوحة التحكم' : 'Dashboard'}</h1>
                <p style={{ margin: 0, color: '#64748b' }}>{authUser ? authUser.email : (ar ? 'سجّل الدخول لمزامنة مشاريعك عبر أجهزتك.' : 'Sign in to sync your projects across devices.')}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
                <div className="workspace" style={{ padding: 20 }}><small style={{ color: '#64748b' }}>{ar ? 'إجمالي المشاريع' : 'Total projects'}</small><div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{projects.length}</div></div>
                <div className="workspace" style={{ padding: 20 }}><small style={{ color: '#64748b' }}>{ar ? 'المواقع المنشورة' : 'Published websites'}</small><div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{projects.filter(project => !!project.publishedPathname).length}</div></div>
                <div className="workspace" style={{ padding: 20 }}><small style={{ color: '#64748b' }}>{ar ? 'الحساب' : 'Account'}</small><div style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>{authUser ? (ar ? 'متصل' : 'Connected') : (ar ? 'غير مسجل' : 'Guest')}</div></div>
                <div className="workspace" style={{ padding: 20 }}><small style={{ color: '#64748b' }}>{ar ? 'إجمالي الزيارات' : 'Total visits'}</small><div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>{siteAnalytics.reduce((total, site) => total + site.visits, 0).toLocaleString(ar ? 'ar' : 'en')}</div></div>
              </div>
              <div className="workspace" style={{ marginBottom: 18 }}>
                <div className="workspace-bar"><div><LayoutDashboard size={16} /><b>{ar ? 'أحدث مشاريعك' : 'Recent projects'}</b><small> / {projects.length}</small></div><button type="button" onClick={() => openSection('projects')}>{ar ? 'كل المشاريع' : 'All projects'}</button></div>
                <div style={{ padding: 18 }}>
                  {projects.length === 0 ? <p>{ar ? 'لا توجد مشاريع محفوظة حتى الآن. ابدأ بإنشاء مشروع جديد.' : 'No saved projects yet. Start by creating a new project.'}</p> : projects.slice(0, 5).map(project => (
                    <div key={project.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ minWidth: 0, flex: '1 1 180px' }}><b style={{ display: 'block', overflowWrap: 'anywhere' }}>{project.title}</b><small style={{ color: '#64748b' }}>{project.publishedPathname ? (ar ? 'موقع منشور' : 'Published website') : (ar ? 'مشروع محفوظ' : 'Saved project')}</small></div>
                      <button type="button" onClick={() => { openProject(project); openSection('home'); }}>{ar ? 'فتح المشروع' : 'Open project'}</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="workspace">
                <div className="workspace-bar"><div><Globe2 size={16} /><b>{ar ? 'مواقعك المنشورة' : 'Your published websites'}</b></div><button type="button" onClick={() => void loadPublishedSites()}>{ar ? 'عرض المواقع' : 'View websites'}</button></div>
                <div style={{ padding: 18 }}>
                  {projects.filter(project => !!project.publishedPathname).length === 0 ? <p>{ar ? 'لم تنشر أي موقع بعد.' : 'You have not published a website yet.'}</p> : projects.filter(project => !!project.publishedPathname).slice(0, 5).map(project => (
                    <div key={project.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}><b style={{ overflowWrap: 'anywhere' }}>{project.title}</b><small style={{ color: '#64748b' }}>{ar ? 'الزيارات: ' : 'Visits: '}{(siteAnalytics.find(item => item.pathname === project.publishedPathname)?.visits || 0).toLocaleString(ar ? 'ar' : 'en')}</small></div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button type="button" onClick={() => { openProject(project); setShowDashboard(false); }}>{ar ? 'إدارة الموقع' : 'Manage website'}</button>
                        <button type="button" onClick={() => void loadSiteVisitHistory(project)}>{ar ? 'الإحصائيات' : 'Analytics'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {selectedAnalyticsSite && (
                <div className="workspace" style={{ marginTop: 18 }}>
                  <div className="workspace-bar">
                    <div><LayoutDashboard size={16} /><b>{ar ? 'إحصائيات الموقع' : 'Website analytics'}</b></div>
                    <button type="button" onClick={() => { setSelectedAnalyticsSite(null); setSiteVisitHistory([]); setHistoryError(''); }}>{ar ? 'إغلاق' : 'Close'}</button>
                  </div>
                  <div style={{ padding: 18 }}>
                    <b style={{ display: 'block', overflowWrap: 'anywhere', marginBottom: 6 }}>{selectedAnalyticsSite.title}</b>
                    <small style={{ color: '#64748b', overflowWrap: 'anywhere' }}>{selectedAnalyticsSite.pathname}</small>
                    <p style={{ color: '#64748b', marginTop: 10 }}>{ar ? 'عدد الزيارات اليومية خلال آخر 30 يوماً (حسب توقيت UTC).' : 'Daily visits for the last 30 days (UTC).'}</p>
                    {historyLoading ? (
                      <p>{ar ? 'جارٍ تحميل سجل الزيارات...' : 'Loading visit history...'}</p>
                    ) : historyError ? (
                      <p role="alert" style={{ color: '#b91c1c' }}>{ar ? 'تعذر تحميل السجل: ' : 'Could not load history: '}{historyError}</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                          <thead><tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '10px 8px' }}>{ar ? 'التاريخ' : 'Date'}</th>
                            <th style={{ padding: '10px 8px' }}>{ar ? 'عدد الزيارات' : 'Visits'}</th>
                          </tr></thead>
                          <tbody>
                            {siteVisitHistory.slice().reverse().map(day => (
                              <tr key={day.visit_date} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '9px 8px' }}>{new Date(day.visit_date + 'T00:00:00Z').toLocaleDateString(ar ? 'ar' : 'en')}</td>
                                <td style={{ padding: '9px 8px', fontWeight: 700 }}>{day.visits.toLocaleString(ar ? 'ar' : 'en')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <button type="button" style={{ marginTop: 12 }} onClick={() => {
                      const project = projects.find(item => item.id === selectedAnalyticsSite.project_id);
                      if (project) void loadSiteVisitHistory(project);
                    }}>{ar ? 'تحديث السجل' : 'Refresh history'}</button>
                  </div>
                </div>
              )}
              <button type="button" className="send" style={{ marginTop: 18 }} onClick={() => { setShowDashboard(false); localStorage.removeItem('mzkarmay-ai-draft'); setCurrentProjectId(''); setCurrentPublishedPathname(''); setPrompt(''); setResult(''); setHtml(''); setError(''); setTab('preview'); }}>{ar ? '＋ إنشاء مشروع جديد' : '＋ Create new project'}</button>
            </section>
          )}
          {showApps && (
            <section id="apps" className="workspace" style={{ marginBottom: 24, padding: 22 }}>
              <div className="workspace-bar" style={{ marginBottom: 18 }}>
                <div><Smartphone size={18} /><b>{ar ? 'تطبيقاتي' : 'My apps'}</b><small> / {projects.filter(project => project.prompt.startsWith('[MZKARMAY_APP]')).length}</small></div>
                <button type="button" className="send" onClick={() => {
                  setAppCreationMode(true); setCurrentProjectId(''); setCurrentPublishedPathname('');
                  setPrompt(''); setHtml(''); setResult(''); setError(''); setPublishError('');
                  setDraftSaved(false); setTab('preview'); openSection('home');
                }}><Plus size={15} />{ar ? 'إنشاء تطبيق جديد' : 'Create new app'}</button>
              </div>
              <p style={{ color: '#64748b', margin: '0 0 18px' }}>{ar ? 'أنشئ تطبيق ويب بتصميم مناسب للهاتف، ثم احفظه وانشره برابط مستقل. يمكنك فتح الرابط وإضافته إلى الشاشة الرئيسية من المتصفح.' : 'Build a mobile-first web app, save it, and publish it at its own link. You can open the link and add it to your home screen from your browser.'}</p>
              {projects.filter(project => project.prompt.startsWith('[MZKARMAY_APP]')).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '38px 16px', border: '1px dashed #cbd5e1', borderRadius: 14 }}>
                  <Smartphone size={32} style={{ color: '#64748b', marginBottom: 10 }} />
                  <b style={{ display: 'block', marginBottom: 8 }}>{ar ? 'لا توجد تطبيقات محفوظة بعد' : 'No saved apps yet'}</b>
                  <p style={{ color: '#64748b', margin: '0 0 16px' }}>{ar ? 'ابدأ بإنشاء أول تطبيق ويب لك.' : 'Start by creating your first web app.'}</p>
                  <button type="button" className="send" onClick={() => {
                    setAppCreationMode(true); setCurrentProjectId(''); setCurrentPublishedPathname('');
                    setPrompt(''); setHtml(''); setResult(''); setError(''); setDraftSaved(false);
                    setTab('preview'); openSection('home');
                  }}><Plus size={15} />{ar ? 'إنشاء أول تطبيق' : 'Create your first app'}</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                  {projects.filter(project => project.prompt.startsWith('[MZKARMAY_APP]')).map(project => (
                    <article key={project.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, background: '#fff', minWidth: 0 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 12, background: '#eef2ff', color: '#4f46e5', display: 'grid', placeItems: 'center', marginBottom: 12 }}><Smartphone size={23} /></div>
                      <b style={{ display: 'block', overflowWrap: 'anywhere', marginBottom: 5 }}>{project.title}</b>
                      <small style={{ color: '#64748b' }}>{ar ? 'آخر حفظ: ' : 'Last saved: '}{new Date(project.updatedAt).toLocaleDateString(ar ? 'ar' : 'en')}</small>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                        <button type="button" onClick={() => { openProject(project); openSection('home'); }}>{ar ? 'فتح وتعديل' : 'Open & edit'}</button>
                        {project.publishedPathname && <button type="button" onClick={() => window.open('/api/site?pathname=' + encodeURIComponent(project.publishedPathname!), '_blank', 'noopener,noreferrer')}>{ar ? 'فتح التطبيق' : 'Open app'}</button>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          {showProjects && (
            <section id="my-projects" className="workspace" style={{ marginBottom: 20 }}>
              <div className="workspace-bar">
                <div><LayoutDashboard size={16} /><b>{ar ? 'مشاريعي المحفوظة' : 'My saved projects'}</b><small> / {projects.length}</small></div>
                <button type="button" onClick={() => openSection('home')}>{ar ? 'إغلاق' : 'Close'}</button>
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
                <button type="button" onClick={() => openSection('home')}>
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      <small>
                        {new Date(site.uploadedAt).toLocaleString(ar ? 'ar' : 'en')}
                      </small>
                      <button
                        type="button"
                        onClick={() => void importPublishedSite(site)}
                        disabled={!!importingSite}
                      >
                        {importingSite === site.pathname
                          ? (ar ? 'جارٍ الاستيراد...' : 'Importing...')
                          : (ar ? 'استيراد إلى مشاريعي وتعديل' : 'Import to projects & edit')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div style={{ display: showDashboard || showProjects || showPublished || showApps ? 'none' : 'block' }}>
          <div className="welcome">
            <div className="eyebrow">
              <span className="pulse"></span>
              {ar ? 'استوديو البناء بالذكاء الاصطناعي' : 'AI BUILD STUDIO'}
            </div>

            <h1>
              {appCreationMode ? (ar ? 'أنشئ تطبيقك الجديد' : 'Build your new app') : (ar ? 'ماذا تريد أن تبني اليوم؟' : 'What do you want to build today?')}
            </h1>

            <p>
              {appCreationMode
                ? (ar ? 'صف التطبيق الذي تريده، وسننشئ تجربة مناسبة للهاتف.' : 'Describe your app and we will create a mobile-first experience.')
                : (ar ? 'صف فكرتك، وسنساعدك على تحويلها إلى موقع أو تطبيق.' : 'Describe your idea and turn it into a website or app.')}
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
              {ar ? 'رسالة: ' : 'Message: '}
              {publishError}
            </div>
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
                <button className="send" type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); void applyWebsiteChanges(); }} disabled={editing || !editPrompt.trim()}>
                  <WandSparkles size={16} />
                  {editing ? (ar ? 'جارٍ التعديل...' : 'Editing...') : (ar ? 'تطبيق التعديل' : 'Apply changes')}
                </button>
                <button className="send" type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); void repairCurrentWebsite(); }} disabled={editing || !html}>
                  <WandSparkles size={16} />
                  {editing ? (ar ? 'جارٍ الإصلاح...' : 'Repairing...') : (ar ? 'إصلاح التطبيق الحالي' : 'Repair current app')}
                </button>
              </div>
              {editStatus && <div className="notice" role="status" aria-live="polite">{editStatus}</div>}
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
                onClick={() => void saveDraft()}
                disabled={!html || savingDraft}
                style={{
                  padding: '9px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#374151',
                  cursor: html && !savingDraft ? 'pointer' : 'not-allowed',
                  opacity: savingDraft ? 0.7 : 1
                }}
              >
                {savingDraft
                  ? (ar ? 'جارٍ الحفظ...' : 'Saving...')
                  : ar
                    ? (draftSaved ? 'تم حفظ المسودة' : 'حفظ التعديلات')
                    : (draftSaved ? 'Draft saved' : 'Save changes')}
              </button>
              {currentPublishedPathname && (
                <button type="button" className="publish" onClick={updatePublishedSite} disabled={!html || updatingPublished}>
                  <Rocket size={14} />
                  {updatingPublished ? (ar ? 'جارٍ التحديث...' : 'Updating...') : (ar ? 'تحديث الموقع المنشور' : 'Update published site')}
                </button>
              )}
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
                  onChange={e => { setHtml(e.target.value); setDraftSaved(false); }}
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
                  ref={previewFrameRef}
                  title="Generated website preview"
                  srcDoc={previewDocument}
                  sandbox="allow-scripts allow-forms"
                  referrerPolicy="no-referrer"
                  style={{
                    display: 'block',
                    width: '100%',
                    height: `${previewHeight}px`,
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

          {authOpen && (
            <div role="dialog" aria-modal="true" aria-label={ar ? 'حساب المستخدم' : 'User account'} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <section style={{ width: '100%', maxWidth: 420, background: '#fff', color: '#111827', borderRadius: 16, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <b style={{ fontSize: 19 }}>{ar ? 'حساب MZKarmay AI' : 'MZKarmay AI account'}</b>
                  <button type="button" onClick={() => setAuthOpen(false)} aria-label={ar ? 'إغلاق' : 'Close'}>✕</button>
                </div>
                {authUser ? (
                  <>
                    <p style={{ overflowWrap: 'anywhere', marginBottom: 16 }}>{ar ? 'تم تسجيل الدخول بالبريد:' : 'Signed in as:'} <b>{authUser.email}</b></p>
                    <button type="button" onClick={handleSignOut} style={{ width: '100%', padding: 12, borderRadius: 9, border: 0, background: '#111827', color: '#fff', cursor: 'pointer' }}>{ar ? 'تسجيل الخروج' : 'Sign out'}</button>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <button type="button" onClick={() => { setAuthMode('login'); setAuthMessage(''); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: authMode === 'login' ? '#eef2ff' : '#fff' }}>{ar ? 'تسجيل الدخول' : 'Sign in'}</button>
                      <button type="button" onClick={() => { setAuthMode('signup'); setAuthMessage(''); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: authMode === 'signup' ? '#eef2ff' : '#fff' }}>{ar ? 'إنشاء حساب' : 'Create account'}</button>
                    </div>
                    <label style={{ display: 'block', marginBottom: 6 }}>{ar ? 'البريد الإلكتروني' : 'Email address'}</label>
                    <input type="email" autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="name@example.com" style={{ width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, marginBottom: 12, direction: 'ltr' }} />
                    <label style={{ display: 'block', marginBottom: 6 }}>{ar ? 'كلمة المرور' : 'Password'}</label>
                    <input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder={ar ? '6 أحرف على الأقل' : 'At least 6 characters'} style={{ width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, marginBottom: 14, direction: 'ltr' }} />
                    <button type="button" onClick={handleAuth} disabled={authBusy || !authEmail.trim() || authPassword.length < 6} style={{ width: '100%', padding: 12, borderRadius: 9, border: 0, background: '#4f46e5', color: '#fff', cursor: 'pointer', opacity: authBusy || !authEmail.trim() || authPassword.length < 6 ? .6 : 1 }}>
                      {authBusy ? (ar ? 'جارٍ المعالجة...' : 'Please wait...') : authMode === 'signup' ? (ar ? 'إنشاء الحساب' : 'Create account') : (ar ? 'تسجيل الدخول' : 'Sign in')}
                    </button>
                  </>
                )}
                {authMessage && <p role="status" style={{ marginTop: 14, padding: 10, borderRadius: 8, background: '#f3f4f6', overflowWrap: 'anywhere' }}>{authMessage}</p>}
              </section>
            </div>
          )}

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