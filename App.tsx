import { useState } from 'react';
import { Sparkles, Plus, Globe2, Smartphone, LayoutDashboard, MessageSquare, Settings, ChevronDown, Send, Paperclip, Eye, Code2, Rocket, Menu, WandSparkles, Monitor, PanelLeftClose } from 'lucide-react';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [sent, setSent] = useState(false);
  const [language, setLanguage] = useState<'ar'|'en'>('ar');
  const [tab, setTab] = useState<'preview'|'code'>('preview');
  const ar = language === 'ar';
  const submit = () => { if (prompt.trim()) { setSent(true); setPrompt(''); } };
  return <div className="app" dir={ar ? 'rtl' : 'ltr'}>
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><span>MZKarmay <b>AI</b></span><span className="beta">BETA</span></div>
      <div className="top-actions"><button className="lang" onClick={()=>setLanguage(ar?'en':'ar')}>{ar?'English':'العربية'} <ChevronDown size={14}/></button><button className="avatar">M</button></div>
    </header>
    <div className="layout">
      <aside className="sidebar">
        <button className="new-project"><Plus size={17}/>{ar?'مشروع جديد':'New project'}</button>
        <div className="nav-label">{ar?'مساحة العمل':'WORKSPACE'}</div>
        <a className="nav active"><LayoutDashboard size={17}/>{ar?'المشاريع':'Projects'}</a>
        <a className="nav"><Globe2 size={17}/>{ar?'المواقع المنشورة':'Published sites'}</a>
        <a className="nav"><Smartphone size={17}/>{ar?'التطبيقات':'Apps'}</a>
        <div className="side-bottom"><a className="nav"><Settings size={17}/>{ar?'الإعدادات':'Settings'}</a><div className="plan"><div className="plan-icon"><Sparkles size={16}/></div><div><b>{ar?'الخطة المجانية':'Free plan'}</b><small>{ar?'ابدأ ببناء مشروعك':'Start building'}</small></div></div></div>
      </aside>
      <main className="main">
        <div className="welcome"><div className="eyebrow"><span className="pulse"></span>{ar?'استوديو البناء بالذكاء الاصطناعي':'AI BUILD STUDIO'}</div><h1>{ar?'ماذا تريد أن تبني اليوم؟':'What do you want to build today?'}</h1><p>{ar?'صف فكرتك، وسنساعدك على تحويلها إلى موقع أو تطبيق.':'Describe your idea and turn it into a website or app.'}</p></div>
        <section className="builder">
          <div className="prompt-head"><div className="spark-circle"><WandSparkles size={18}/></div><div><b>{ar?'ابدأ بوصف فكرتك':'Describe your idea'}</b><small>{ar?'اكتب ما تريد إنشاءه بالتفصيل':'Tell us what you want to create'}</small></div><span className="model">AI <ChevronDown size={13}/></span></div>
          <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit();}}} placeholder={ar?'مثال: أنشئ متجراً إلكترونياً للأزياء، بتصميم عصري، مع صفحة للمنتجات وسلة مشتريات...':'Example: Build a modern fashion store with product pages and a shopping cart...'} />
          <div className="prompt-footer"><button className="attach"><Paperclip size={16}/>{ar?'إرفاق':'Attach'}</button><span className="hint">{ar?'Enter للإرسال · Shift + Enter لسطر جديد':'Enter to send · Shift + Enter for new line'}</span><button className="send" onClick={submit}><Send size={16}/>{ar?'إنشاء':'Build'}</button></div>
        </section>
        <div className="section-title">{ar?'ابدأ بقالب جاهز':'START WITH A TEMPLATE'}<span>{ar?'أو اكتب فكرتك':'or describe your idea'}</span></div>
        <div className="templates">
          {[{icon:<Globe2/>,title:ar?'موقع شركة':'Business website',desc:ar?'موقع تعريفي احترافي':'Professional company site',tag:'WEBSITE'},{icon:<LayoutDashboard/>,title:ar?'متجر إلكتروني':'Online store',desc:ar?'منتجات وسلة مشتريات':'Products and shopping cart',tag:'E-COMMERCE'},{icon:<Smartphone/>,title:ar?'تطبيق جوال':'Mobile app',desc:ar?'تجربة تطبيق للهواتف':'Mobile app experience',tag:'APP'}].map((t,i)=><button className="template" key={i} onClick={()=>setPrompt(ar?['أنشئ موقعاً احترافياً لشركة مع صفحة رئيسية وخدمات وتواصل.','أنشئ متجراً إلكترونياً مع المنتجات وسلة المشتريات.','أنشئ واجهة تطبيق جوال حديثة مع تسجيل الدخول والصفحة الرئيسية.'][i]:['Build a professional company website with home, services and contact pages.','Build an online store with products and shopping cart.','Build a modern mobile app UI with login and home screen.'][i])}><div className="template-icon">{t.icon}</div><span className="tag">{t.tag}</span><b>{t.title}</b><small>{t.desc}</small></button>)}
        </div>
        {sent && <div className="notice"><Sparkles size={16}/>{ar?'تم استلام وصفك في النموذج الأولي. الخطوة التالية هي ربط محرك الذكاء الاصطناعي لتوليد المشروع فعلياً.':'Prompt captured in this prototype. Next, connect an AI engine to generate the project.'}</div>}
        <div className="workspace">
          <div className="workspace-bar"><div><span className="dot"></span><b>{ar?'معاينة المشروع':'Project preview'}</b><small> / {ar?'مشروع جديد':'New project'}</small></div><div className="tabs"><button className={tab==='preview'?'selected':''} onClick={()=>setTab('preview')}><Eye size={14}/>{ar?'معاينة':'Preview'}</button><button className={tab==='code'?'selected':''} onClick={()=>setTab('code')}><Code2 size={14}/>{ar?'الكود':'Code'}</button></div><button className="publish"><Rocket size={14}/>{ar?'نشر':'Publish'}</button></div>
          <div className="canvas">{tab==='preview'?<div className="empty-preview"><div className="preview-icon"><Monitor size={27}/></div><b>{ar?'ستظهر معاينة موقعك هنا':'Your preview will appear here'}</b><p>{ar?'اكتب وصف مشروعك في الأعلى لبدء البناء.':'Describe your project above to get started.'}</p></div>:<div className="code-placeholder"><Code2 size={22}/><b>{ar?'محرر الأكواد':'Code editor'}</b><p>{ar?'سيظهر كود المشروع هنا بعد ربط محرك التوليد.':'Generated project code will appear here after connecting the AI engine.'}</p></div>}</div>
        </div>
        <footer>© 2026 MZKarmay AI <span>{ar?'صُنع لبناء أفكارك':'Built for your ideas'}</span></footer>
      </main>
    </div>
  </div>;
}