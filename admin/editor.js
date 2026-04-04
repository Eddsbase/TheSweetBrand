/* ============================================================
   The Sweet Brand - Editor Logic (editor.js)
   Full panel rendering, form handling, dirty tracking,
   repeater management, media upload, and all admin panels.
   ============================================================ */

(function () {
    'use strict';

    const API = window.SiteAPI;

    /* --------------------------------------------------
       State
    -------------------------------------------------- */
    let contentData = null;       // Current working copy
    let savedData = null;         // Last saved snapshot
    let isDirty = false;
    let currentPanel = 'dashboard';
    let assetsCache = [];

    /* --------------------------------------------------
       DOM references
    -------------------------------------------------- */
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const loginScreen = $('#loginScreen');
    const adminShell = $('#adminShell');
    const loginForm = $('#loginForm');
    const loginError = $('#loginError');
    const mainContent = $('#mainContent');
    const panelTitle = $('#panelTitle');
    const saveBtn = $('#saveBtn');
    const revertBtn = $('#revertBtn');
    const dirtyIndicator = $('#dirtyIndicator');
    const logoutBtn = $('#logoutBtn');
    const menuToggle = $('#menuToggle');
    const sidebar = $('#sidebar');
    const sidebarClose = $('#sidebarClose');
    const userDisplay = $('#userDisplay');
    const userRole = $('#userRole');
    const navUserMgmt = $('#navUserMgmt');

    /* --------------------------------------------------
       Toast notifications
    -------------------------------------------------- */
    function showToast(msg, type = 'info', duration = 3500) {
        const container = $('#toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    window.showToast = showToast;

    /* --------------------------------------------------
       Dirty tracking
    -------------------------------------------------- */
    function markDirty() {
        isDirty = true;
        dirtyIndicator.style.display = 'inline';
        revertBtn.style.display = 'inline-block';
    }

    function markClean() {
        isDirty = false;
        dirtyIndicator.style.display = 'none';
        revertBtn.style.display = 'none';
    }

    window.addEventListener('beforeunload', function (e) {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    /* --------------------------------------------------
       Helpers
    -------------------------------------------------- */
    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function ensureObj(obj, key, def) {
        if (!obj[key]) obj[key] = def;
        return obj[key];
    }

    function ensureArr(obj, key) {
        return ensureObj(obj, key, []);
    }

    function escHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function uid() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }

    /* --------------------------------------------------
       Form field builders
    -------------------------------------------------- */
    function fieldText(label, value, key, opts = {}) {
        const id = uid();
        const ph = opts.placeholder || '';
        const maxLen = opts.maxLength ? `maxlength="${opts.maxLength}"` : '';
        const counter = opts.counter ? `<span class="char-counter" data-max="${opts.counter}" data-for="${id}">${(value || '').length}/${opts.counter}</span>` : '';
        return `
        <div class="form-group">
            <label for="${id}">${escHtml(label)}${counter}</label>
            <input type="text" id="${id}" class="form-control" value="${escHtml(value || '')}" data-key="${key}" placeholder="${escHtml(ph)}" ${maxLen}>
        </div>`;
    }

    function fieldTextarea(label, value, key, opts = {}) {
        const id = uid();
        const rows = opts.rows || 4;
        const counter = opts.counter ? `<span class="char-counter" data-max="${opts.counter}" data-for="${id}">${(value || '').length}/${opts.counter}</span>` : '';
        return `
        <div class="form-group">
            <label for="${id}">${escHtml(label)}${counter}</label>
            <textarea id="${id}" class="form-control" rows="${rows}" data-key="${key}" placeholder="${opts.placeholder || ''}">${escHtml(value || '')}</textarea>
        </div>`;
    }

    function fieldToggle(label, checked, key) {
        const id = uid();
        return `
        <div class="form-group form-toggle">
            <label>
                <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} data-key="${key}">
                <span class="toggle-slider"></span>
                ${escHtml(label)}
            </label>
        </div>`;
    }

    function fieldImage(label, value, key) {
        const id = uid();
        const preview = value ? `<img src="${escHtml(value)}" class="img-preview" alt="preview">` : '<div class="img-placeholder">No image</div>';
        return `
        <div class="form-group">
            <label>${escHtml(label)}</label>
            <div class="image-field" data-key="${key}">
                <div class="img-preview-wrap">${preview}</div>
                <div class="image-field-actions">
                    <input type="text" class="form-control img-url-input" value="${escHtml(value || '')}" placeholder="Image URL or upload" data-key="${key}">
                    <label class="btn btn-sm btn-outline upload-btn">
                        Upload
                        <input type="file" accept="image/*" class="file-input" style="display:none;" data-key="${key}">
                    </label>
                </div>
            </div>
        </div>`;
    }

    function fieldVideo(label, value, key) {
        const id = uid();
        const preview = value
            ? `<video src="${escHtml(value)}" class="video-preview" controls muted style="width:100%;max-height:200px;border-radius:8px;background:#000;"></video>`
            : '<div class="img-placeholder">No video</div>';
        return `
        <div class="form-group">
            <label>${escHtml(label)}</label>
            <div class="image-field" data-key="${key}">
                <div class="img-preview-wrap">${preview}</div>
                <div class="image-field-actions">
                    <input type="text" class="form-control img-url-input" value="${escHtml(value || '')}" placeholder="Video URL or path" data-key="${key}">
                    <label class="btn btn-sm btn-outline upload-btn">
                        Upload
                        <input type="file" accept="video/*" class="file-input" style="display:none;" data-key="${key}">
                    </label>
                </div>
            </div>
        </div>`;
    }

    function fieldWebsitePreview(label, value, key) {
        const id = uid();
        const preview = value
            ? `<div class="site-preview-wrap"><iframe src="${escHtml(value)}" class="site-preview-iframe" sandbox="allow-scripts allow-same-origin" loading="lazy"></iframe><div class="site-preview-overlay"></div></div>`
            : '<div class="img-placeholder">Enter a URL to preview</div>';
        return `
        <div class="form-group">
            <label>${escHtml(label)}</label>
            <div class="image-field" data-key="${key}">
                <div class="img-preview-wrap">${preview}</div>
                <div class="image-field-actions">
                    <input type="url" class="form-control img-url-input site-url-input" value="${escHtml(value || '')}" placeholder="https://example.com" data-key="${key}">
                </div>
            </div>
        </div>`;
    }

    function fieldSelect(label, value, key, options) {
        const id = uid();
        const optionsHtml = options.map(o => {
            const val = typeof o === 'object' ? o.value : o;
            const text = typeof o === 'object' ? o.label : o;
            return `<option value="${escHtml(val)}" ${val === value ? 'selected' : ''}>${escHtml(text)}</option>`;
        }).join('');
        return `
        <div class="form-group">
            <label for="${id}">${escHtml(label)}</label>
            <select id="${id}" class="form-control" data-key="${key}">${optionsHtml}</select>
        </div>`;
    }

    function fieldColor(label, value, key) {
        const id = uid();
        return `
        <div class="form-group">
            <label for="${id}">${escHtml(label)}</label>
            <div class="color-field">
                <input type="color" id="${id}" value="${value || '#ff6b6b'}" data-key="${key}">
                <input type="text" class="form-control color-text" value="${escHtml(value || '#ff6b6b')}" data-key="${key}">
            </div>
        </div>`;
    }

    function fieldRichText(label, value, key) {
        const id = uid();
        return `
        <div class="form-group">
            <label>${escHtml(label)}</label>
            <div class="rich-editor-toolbar">
                <button type="button" class="rte-btn" data-cmd="bold" title="Bold"><b>B</b></button>
                <button type="button" class="rte-btn" data-cmd="italic" title="Italic"><i>I</i></button>
                <button type="button" class="rte-btn" data-cmd="underline" title="Underline"><u>U</u></button>
                <button type="button" class="rte-btn" data-cmd="insertUnorderedList" title="Bullet List">&#8226;</button>
                <button type="button" class="rte-btn" data-cmd="insertOrderedList" title="Numbered List">1.</button>
                <button type="button" class="rte-btn" data-cmd="createLink" title="Insert Link">&#128279;</button>
                <button type="button" class="rte-btn" data-cmd="formatBlock-h2" title="Heading">H2</button>
                <button type="button" class="rte-btn" data-cmd="formatBlock-h3" title="Heading">H3</button>
                <button type="button" class="rte-btn" data-cmd="removeFormat" title="Clear Format">&times;</button>
            </div>
            <div id="${id}" class="rich-editor" contenteditable="true" data-key="${key}">${value || ''}</div>
        </div>`;
    }

    /* --------------------------------------------------
       Repeater builder
    -------------------------------------------------- */
    function repeaterSection(label, items, key, fieldBuilder) {
        const itemsHtml = (items || []).map((item, idx) => {
            return `
            <div class="repeater-item" data-index="${idx}" data-key="${key}">
                <div class="repeater-item-header">
                    <span class="repeater-item-title">${escHtml(label)} #${idx + 1}</span>
                    <div class="repeater-item-actions">
                        <button type="button" class="btn btn-xs btn-outline repeater-move-up" title="Move up">&uarr;</button>
                        <button type="button" class="btn btn-xs btn-outline repeater-move-down" title="Move down">&darr;</button>
                        <button type="button" class="btn btn-xs btn-danger repeater-remove" title="Remove">&times;</button>
                    </div>
                </div>
                <div class="repeater-item-body">
                    ${fieldBuilder(item, idx, key)}
                </div>
            </div>`;
        }).join('');

        return `
        <div class="repeater-section" data-repeater-key="${key}">
            <div class="repeater-header">
                <h4>${escHtml(label)}</h4>
                <button type="button" class="btn btn-sm btn-primary repeater-add" data-key="${key}">+ Add ${escHtml(label)}</button>
            </div>
            <div class="repeater-items">${itemsHtml}</div>
        </div>`;
    }

    /* --------------------------------------------------
       Section wrapper
    -------------------------------------------------- */
    function sectionCard(title, content, sectionKey) {
        const data = contentData || {};
        const vis = data.sectionVisibility || {};
        const visible = vis[sectionKey] !== false;
        const toggleHtml = sectionKey ? fieldToggle('Section visible on site', visible, `visibility.${sectionKey}`) : '';
        return `
        <div class="panel-card">
            <div class="panel-card-header">
                <h3>${escHtml(title)}</h3>
                ${toggleHtml}
            </div>
            <div class="panel-card-body">${content}</div>
        </div>`;
    }

    /* --------------------------------------------------
       PANEL RENDERERS
    -------------------------------------------------- */

    const panelRenderers = {};

    // Dashboard
    panelRenderers.dashboard = function () {
        const user = API.getUser();
        const sections = contentData ? Object.keys(contentData).length : 0;
        return `
        <div class="dashboard-grid">
            <div class="dash-card">
                <div class="dash-card-icon">&#128100;</div>
                <div class="dash-card-info">
                    <h4>Welcome</h4>
                    <p>${escHtml(user ? user.name : 'Admin')}</p>
                </div>
            </div>
            <div class="dash-card">
                <div class="dash-card-icon">&#128196;</div>
                <div class="dash-card-info">
                    <h4>Content Sections</h4>
                    <p>${sections} configured</p>
                </div>
            </div>
            <div class="dash-card">
                <div class="dash-card-icon">&#127760;</div>
                <div class="dash-card-info">
                    <h4>Mode</h4>
                    <p>${API.IS_LOCAL ? 'Local Dev' : 'GitHub'}</p>
                </div>
            </div>
            <div class="dash-card">
                <div class="dash-card-icon">&#128274;</div>
                <div class="dash-card-info">
                    <h4>Role</h4>
                    <p>${escHtml(user ? user.role : 'N/A')}</p>
                </div>
            </div>
        </div>
        <div class="panel-card" style="margin-top:1.5rem;">
            <div class="panel-card-header"><h3>Quick Actions</h3></div>
            <div class="panel-card-body">
                <div class="quick-actions">
                    <button class="btn btn-primary" onclick="window.editorNav('hero')">Edit Hero</button>
                    <button class="btn btn-primary" onclick="window.editorNav('blog')">Manage Blog</button>
                    <button class="btn btn-primary" onclick="window.editorNav('mediaLibrary')">Media Library</button>
                    <button class="btn btn-primary" onclick="window.editorNav('seo')">SEO Settings</button>
                </div>
            </div>
        </div>
        ${!API.getStoredToken() && !API.IS_LOCAL ? `
        <div class="panel-card" style="margin-top:1.5rem;">
            <div class="panel-card-header"><h3>GitHub Token</h3></div>
            <div class="panel-card-body">
                <p style="color:#9ca3af;margin-bottom:.75rem;">Enter your GitHub Personal Access Token to enable saving.</p>
                <div class="form-group">
                    <input type="password" id="ghTokenInput" class="form-control" placeholder="ghp_xxxxxxxxxxxx">
                </div>
                <button class="btn btn-primary btn-sm" id="saveTokenBtn">Save Token</button>
            </div>
        </div>` : ''}`;
    };

    // Site Settings
    panelRenderers.siteSettings = function () {
        const s = ensureObj(contentData, 'siteSettings', {});
        return sectionCard('Site Settings', `
            ${fieldText('Site Name', s.siteName, 'siteSettings.siteName')}
            ${fieldText('Tagline', s.tagline, 'siteSettings.tagline')}
            ${fieldTextarea('Description', s.description, 'siteSettings.description')}
            ${fieldImage('Logo', s.logo, 'siteSettings.logo')}
            ${fieldImage('Favicon', s.favicon, 'siteSettings.favicon')}
            ${fieldColor('Primary Color', s.primaryColor, 'siteSettings.primaryColor')}
            ${fieldColor('Secondary Color', s.secondaryColor, 'siteSettings.secondaryColor')}
            ${fieldText('Phone', s.phone, 'siteSettings.phone')}
            ${fieldText('Email', s.email, 'siteSettings.email')}
            ${fieldText('Address', s.address, 'siteSettings.address')}
            ${fieldText('Copyright Text', s.copyright, 'siteSettings.copyright')}
            <h4 style="margin-top:1rem;">Social Links</h4>
            ${fieldText('Facebook', (s.social || {}).facebook, 'siteSettings.social.facebook')}
            ${fieldText('Instagram', (s.social || {}).instagram, 'siteSettings.social.instagram')}
            ${fieldText('Twitter / X', (s.social || {}).twitter, 'siteSettings.social.twitter')}
            ${fieldText('LinkedIn', (s.social || {}).linkedin, 'siteSettings.social.linkedin')}
            ${fieldText('YouTube', (s.social || {}).youtube, 'siteSettings.social.youtube')}
            ${fieldText('TikTok', (s.social || {}).tiktok, 'siteSettings.social.tiktok')}
        `);
    };

    // Hero
    panelRenderers.hero = function () {
        const h = ensureObj(contentData, 'hero', {});
        return sectionCard('Hero Section', `
            ${fieldText('Headline', h.headline, 'hero.headline')}
            ${fieldText('Subheadline', h.subheadline, 'hero.subheadline')}
            ${fieldTextarea('Description', h.description, 'hero.description')}
            ${fieldText('Button Text', h.buttonText, 'hero.buttonText')}
            ${fieldText('Button Link', h.buttonLink, 'hero.buttonLink')}
            ${fieldText('Secondary Button Text', h.secondaryButtonText, 'hero.secondaryButtonText')}
            ${fieldText('Secondary Button Link', h.secondaryButtonLink, 'hero.secondaryButtonLink')}
            ${fieldImage('Background Image', h.backgroundImage, 'hero.backgroundImage')}
            ${fieldImage('Hero Image', h.image, 'hero.image')}
            ${fieldVideo('Hero Video', h.video, 'hero.video')}
            ${fieldSelect('Layout', h.layout, 'hero.layout', ['centered', 'left-aligned', 'split', 'fullscreen'])}
            ${fieldToggle('Show overlay', h.overlay, 'hero.overlay')}
        `, 'hero');
    };

    // Growth / Video Section
    panelRenderers.growth = function () {
        const g = ensureObj(contentData, 'growth', {});
        return sectionCard('Growth Section', `
            ${fieldText('Tag', g.tag, 'growth.tag')}
            ${fieldText('Title', g.title, 'growth.title')}
            ${fieldTextarea('Description', g.description, 'growth.description')}
            ${fieldText('CTA Text', g.ctaText, 'growth.ctaText')}
            ${fieldText('CTA Link', g.ctaLink, 'growth.ctaLink')}
            ${fieldVideo('Section Video', g.video, 'growth.video')}
            ${fieldImage('Video Poster', g.videoPoster, 'growth.videoPoster')}
            ${fieldToggle('Show Section', g.visible !== false, 'growth.visible')}
        `, 'growth');
    };

    // Services
    panelRenderers.services = function () {
        const sec = ensureObj(contentData, 'services', {});
        const items = ensureArr(sec, 'items');
        return sectionCard('Services', `
            ${fieldText('Section Title', sec.title, 'services.title')}
            ${fieldText('Subtitle', sec.subtitle, 'services.subtitle')}
            ${repeaterSection('Service', items, 'services.items', (item, idx) => `
                ${fieldText('Title', item.title, `services.items.${idx}.title`)}
                ${fieldText('Slug', item.slug, `services.items.${idx}.slug`)}
                ${fieldTextarea('Description', item.description, `services.items.${idx}.description`)}
                ${fieldImage('Icon / Image', item.icon, `services.items.${idx}.icon`)}
                ${fieldImage('Detail Image', item.image, `services.items.${idx}.image`)}
                ${fieldRichText('Detail Body', item.body, `services.items.${idx}.body`)}
                ${fieldText('Link', item.link, `services.items.${idx}.link`)}
            `)}
        `, 'services');
    };

    // Projects
    panelRenderers.projects = function () {
        const sec = ensureObj(contentData, 'projects', {});
        const items = ensureArr(sec, 'items');
        return sectionCard('Projects / Work', `
            ${fieldText('Section Title', sec.title, 'projects.title')}
            ${fieldText('Subtitle', sec.subtitle, 'projects.subtitle')}
            ${repeaterSection('Project', items, 'projects.items', (item, idx) => `
                ${fieldText('Title', item.title, `projects.items.${idx}.title`)}
                ${fieldText('Slug', item.slug, `projects.items.${idx}.slug`)}
                ${fieldTextarea('Description', item.description, `projects.items.${idx}.description`)}
                ${fieldWebsitePreview('Live Site URL', item.link, `projects.items.${idx}.link`)}
                ${fieldImage('Screenshot Image', item.image, `projects.items.${idx}.image`)}
                ${fieldText('Category', item.category, `projects.items.${idx}.category`)}
                ${fieldText('Client', item.client, `projects.items.${idx}.client`)}
                ${fieldText('Date', item.date, `projects.items.${idx}.date`)}
            `)}
        `, 'projects');
    };

    // About
    panelRenderers.about = function () {
        const a = ensureObj(contentData, 'about', {});
        return sectionCard('About', `
            ${fieldText('Title', a.title, 'about.title')}
            ${fieldText('Subtitle', a.subtitle, 'about.subtitle')}
            ${fieldTextarea('Content', a.content, 'about.content', { rows: 8 })}
            ${fieldImage('Image', a.image, 'about.image')}
            ${fieldText('Mission Statement', a.mission, 'about.mission')}
            ${fieldText('Vision Statement', a.vision, 'about.vision')}
            <h4 style="margin-top:1rem;">Stats</h4>
            ${fieldText('Stat 1 Number', (a.stats || [])[0]?.value, 'about.stats.0.value')}
            ${fieldText('Stat 1 Label', (a.stats || [])[0]?.label, 'about.stats.0.label')}
            ${fieldText('Stat 2 Number', (a.stats || [])[1]?.value, 'about.stats.1.value')}
            ${fieldText('Stat 2 Label', (a.stats || [])[1]?.label, 'about.stats.1.label')}
            ${fieldText('Stat 3 Number', (a.stats || [])[2]?.value, 'about.stats.2.value')}
            ${fieldText('Stat 3 Label', (a.stats || [])[2]?.label, 'about.stats.2.label')}
        `, 'about');
    };

    // Blog
    panelRenderers.blog = function () {
        const sec = ensureObj(contentData, 'blog', {});
        const posts = ensureArr(sec, 'posts');
        return sectionCard('Blog', `
            ${fieldText('Section Title', sec.title, 'blog.title')}
            ${fieldText('Subtitle', sec.subtitle, 'blog.subtitle')}
            ${fieldText('Posts Per Page', sec.postsPerPage, 'blog.postsPerPage')}
            ${repeaterSection('Post', posts, 'blog.posts', (item, idx) => `
                ${fieldText('Title', item.title, `blog.posts.${idx}.title`)}
                ${fieldText('Slug', item.slug, `blog.posts.${idx}.slug`)}
                ${fieldText('Author', item.author, `blog.posts.${idx}.author`)}
                ${fieldText('Date', item.date, `blog.posts.${idx}.date`, { placeholder: 'YYYY-MM-DD' })}
                ${fieldText('Category', item.category, `blog.posts.${idx}.category`)}
                ${fieldText('Tags (comma separated)', (item.tags || []).join(', '), `blog.posts.${idx}.tags`)}
                ${fieldTextarea('Excerpt', item.excerpt, `blog.posts.${idx}.excerpt`)}
                ${fieldImage('Featured Image', item.image, `blog.posts.${idx}.image`)}
                ${fieldRichText('Body', item.body, `blog.posts.${idx}.body`)}
                ${fieldToggle('Published', item.published !== false, `blog.posts.${idx}.published`)}
            `)}
        `, 'blog');
    };

    // FAQ
    panelRenderers.faq = function () {
        const sec = ensureObj(contentData, 'faq', {});
        const items = ensureArr(sec, 'items');
        return sectionCard('FAQ', `
            ${fieldText('Section Title', sec.title, 'faq.title')}
            ${fieldText('Subtitle', sec.subtitle, 'faq.subtitle')}
            ${repeaterSection('FAQ Item', items, 'faq.items', (item, idx) => `
                ${fieldText('Question', item.question, `faq.items.${idx}.question`)}
                ${fieldTextarea('Answer', item.answer, `faq.items.${idx}.answer`, { rows: 3 })}
            `)}
        `, 'faq');
    };

    // Contact
    panelRenderers.contact = function () {
        const c = ensureObj(contentData, 'contact', {});
        return sectionCard('Contact', `
            ${fieldText('Section Title', c.title, 'contact.title')}
            ${fieldText('Subtitle', c.subtitle, 'contact.subtitle')}
            ${fieldTextarea('Description', c.description, 'contact.description')}
            ${fieldText('Email', c.email, 'contact.email')}
            ${fieldText('Phone', c.phone, 'contact.phone')}
            ${fieldText('Address', c.address, 'contact.address')}
            ${fieldText('Map Embed URL', c.mapUrl, 'contact.mapUrl')}
            ${fieldText('Form Action URL', c.formAction, 'contact.formAction')}
            ${fieldToggle('Show Map', c.showMap, 'contact.showMap')}
            ${fieldToggle('Show Form', c.showForm !== false, 'contact.showForm')}
            <h4 style="margin-top:1rem;">Business Hours</h4>
            ${fieldText('Hours Line 1', (c.hours || [])[0], 'contact.hours.0')}
            ${fieldText('Hours Line 2', (c.hours || [])[1], 'contact.hours.1')}
            ${fieldText('Hours Line 3', (c.hours || [])[2], 'contact.hours.2')}
        `, 'contact');
    };

    // CTA
    panelRenderers.cta = function () {
        const c = ensureObj(contentData, 'cta', {});
        return sectionCard('CTA Section', `
            ${fieldText('Headline', c.headline, 'cta.headline')}
            ${fieldTextarea('Description', c.description, 'cta.description')}
            ${fieldText('Button Text', c.buttonText, 'cta.buttonText')}
            ${fieldText('Button Link', c.buttonLink, 'cta.buttonLink')}
            ${fieldImage('Background Image', c.backgroundImage, 'cta.backgroundImage')}
            ${fieldSelect('Style', c.style, 'cta.style', ['default', 'banner', 'centered', 'split'])}
        `, 'cta');
    };

    // Marquee
    panelRenderers.marquee = function () {
        const m = ensureObj(contentData, 'marquee', {});
        const items = ensureArr(m, 'items');
        return sectionCard('Marquee', `
            ${fieldText('Speed (px/s)', m.speed, 'marquee.speed')}
            ${fieldSelect('Direction', m.direction, 'marquee.direction', ['left', 'right'])}
            ${fieldToggle('Pause on hover', m.pauseOnHover !== false, 'marquee.pauseOnHover')}
            ${repeaterSection('Item', items, 'marquee.items', (item, idx) => `
                ${fieldText('Text', item.text, `marquee.items.${idx}.text`)}
                ${fieldImage('Image', item.image, `marquee.items.${idx}.image`)}
            `)}
        `, 'marquee');
    };

    // Newsletter
    panelRenderers.newsletter = function () {
        const n = ensureObj(contentData, 'newsletter', {});
        return sectionCard('Newsletter', `
            ${fieldText('Title', n.title, 'newsletter.title')}
            ${fieldTextarea('Description', n.description, 'newsletter.description')}
            ${fieldText('Placeholder Text', n.placeholder, 'newsletter.placeholder')}
            ${fieldText('Button Text', n.buttonText, 'newsletter.buttonText')}
            ${fieldText('Form Action URL', n.formAction, 'newsletter.formAction')}
            ${fieldText('Success Message', n.successMessage, 'newsletter.successMessage')}
            ${fieldImage('Background Image', n.backgroundImage, 'newsletter.backgroundImage')}
        `, 'newsletter');
    };

    // Gallery
    panelRenderers.gallery = function () {
        const g = ensureObj(contentData, 'gallery', {});
        const items = ensureArr(g, 'items');
        return sectionCard('Gallery', `
            ${fieldText('Section Title', g.title, 'gallery.title')}
            ${fieldText('Subtitle', g.subtitle, 'gallery.subtitle')}
            ${fieldSelect('Layout', g.layout, 'gallery.layout', ['grid', 'masonry', 'carousel'])}
            ${fieldText('Columns', g.columns, 'gallery.columns')}
            ${repeaterSection('Image', items, 'gallery.items', (item, idx) => `
                ${fieldImage('Image', item.image, `gallery.items.${idx}.image`)}
                ${fieldText('Caption', item.caption, `gallery.items.${idx}.caption`)}
                ${fieldText('Alt Text', item.alt, `gallery.items.${idx}.alt`)}
                ${fieldText('Category', item.category, `gallery.items.${idx}.category`)}
            `)}
        `, 'gallery');
    };

    // Testimonials
    panelRenderers.testimonials = function () {
        const sec = ensureObj(contentData, 'testimonials', {});
        const items = ensureArr(sec, 'items');
        return sectionCard('Testimonials', `
            ${fieldText('Section Title', sec.title, 'testimonials.title')}
            ${fieldText('Subtitle', sec.subtitle, 'testimonials.subtitle')}
            ${fieldSelect('Layout', sec.layout, 'testimonials.layout', ['carousel', 'grid', 'list'])}
            ${repeaterSection('Testimonial', items, 'testimonials.items', (item, idx) => `
                ${fieldText('Name', item.name, `testimonials.items.${idx}.name`)}
                ${fieldText('Title / Role', item.role, `testimonials.items.${idx}.role`)}
                ${fieldText('Company', item.company, `testimonials.items.${idx}.company`)}
                ${fieldTextarea('Quote', item.quote, `testimonials.items.${idx}.quote`)}
                ${fieldImage('Avatar', item.avatar, `testimonials.items.${idx}.avatar`)}
                ${fieldText('Rating (1-5)', item.rating, `testimonials.items.${idx}.rating`)}
            `)}
        `, 'testimonials');
    };

    // Pricing
    panelRenderers.pricing = function () {
        const sec = ensureObj(contentData, 'pricing', {});
        const plans = ensureArr(sec, 'plans');
        return sectionCard('Pricing', `
            ${fieldText('Section Title', sec.title, 'pricing.title')}
            ${fieldText('Subtitle', sec.subtitle, 'pricing.subtitle')}
            ${fieldToggle('Show toggle (monthly/yearly)', sec.showToggle, 'pricing.showToggle')}
            ${repeaterSection('Plan', plans, 'pricing.plans', (item, idx) => `
                ${fieldText('Plan Name', item.name, `pricing.plans.${idx}.name`)}
                ${fieldText('Price', item.price, `pricing.plans.${idx}.price`)}
                ${fieldText('Period', item.period, `pricing.plans.${idx}.period`, { placeholder: '/month' })}
                ${fieldText('Yearly Price', item.yearlyPrice, `pricing.plans.${idx}.yearlyPrice`)}
                ${fieldTextarea('Features (one per line)', (item.features || []).join('\\n'), `pricing.plans.${idx}.features`)}
                ${fieldText('Button Text', item.buttonText, `pricing.plans.${idx}.buttonText`)}
                ${fieldText('Button Link', item.buttonLink, `pricing.plans.${idx}.buttonLink`)}
                ${fieldToggle('Featured / Popular', item.featured, `pricing.plans.${idx}.featured`)}
                ${fieldText('Badge Text', item.badge, `pricing.plans.${idx}.badge`)}
            `)}
        `, 'pricing');
    };

    // Team
    panelRenderers.team = function () {
        const sec = ensureObj(contentData, 'team', {});
        const members = ensureArr(sec, 'members');
        return sectionCard('Team', `
            ${fieldText('Section Title', sec.title, 'team.title')}
            ${fieldText('Subtitle', sec.subtitle, 'team.subtitle')}
            ${repeaterSection('Member', members, 'team.members', (item, idx) => `
                ${fieldText('Name', item.name, `team.members.${idx}.name`)}
                ${fieldText('Role', item.role, `team.members.${idx}.role`)}
                ${fieldTextarea('Bio', item.bio, `team.members.${idx}.bio`)}
                ${fieldImage('Photo', item.photo, `team.members.${idx}.photo`)}
                ${fieldText('LinkedIn', item.linkedin, `team.members.${idx}.linkedin`)}
                ${fieldText('Twitter', item.twitter, `team.members.${idx}.twitter`)}
                ${fieldText('Email', item.email, `team.members.${idx}.email`)}
            `)}
        `, 'team');
    };

    // Process
    panelRenderers.process = function () {
        const sec = ensureObj(contentData, 'process', {});
        const steps = ensureArr(sec, 'steps');
        return sectionCard('Process', `
            ${fieldText('Section Title', sec.title, 'process.title')}
            ${fieldText('Subtitle', sec.subtitle, 'process.subtitle')}
            ${repeaterSection('Step', steps, 'process.steps', (item, idx) => `
                ${fieldText('Step Number', item.number || (idx + 1), `process.steps.${idx}.number`)}
                ${fieldText('Title', item.title, `process.steps.${idx}.title`)}
                ${fieldTextarea('Description', item.description, `process.steps.${idx}.description`)}
                ${fieldImage('Icon / Image', item.icon, `process.steps.${idx}.icon`)}
            `)}
        `, 'process');
    };

    // Partners
    panelRenderers.partners = function () {
        const sec = ensureObj(contentData, 'partners', {});
        const items = ensureArr(sec, 'items');
        return sectionCard('Partners', `
            ${fieldText('Section Title', sec.title, 'partners.title')}
            ${fieldText('Subtitle', sec.subtitle, 'partners.subtitle')}
            ${repeaterSection('Partner', items, 'partners.items', (item, idx) => `
                ${fieldText('Name', item.name, `partners.items.${idx}.name`)}
                ${fieldImage('Logo', item.logo, `partners.items.${idx}.logo`)}
                ${fieldText('Website', item.url, `partners.items.${idx}.url`)}
            `)}
        `, 'partners');
    };

    // SEO (per-page)
    panelRenderers.seo = function () {
        const seo = ensureObj(contentData, 'seo', {});
        const pages = ['home', 'about', 'services', 'projects', 'blog', 'contact', 'faq', 'pricing', 'gallery'];
        let html = '<p class="panel-description">Set SEO metadata per page. Titles should be under 60 characters, descriptions under 160.</p>';

        pages.forEach(page => {
            const p = ensureObj(seo, page, {});
            html += `
            <div class="panel-card" style="margin-bottom:1rem;">
                <div class="panel-card-header"><h4>${page.charAt(0).toUpperCase() + page.slice(1)} Page</h4></div>
                <div class="panel-card-body">
                    ${fieldText('Meta Title', p.title, `seo.${page}.title`, { counter: 60, maxLength: 60 })}
                    ${fieldTextarea('Meta Description', p.description, `seo.${page}.description`, { counter: 160, rows: 3 })}
                    ${fieldText('Canonical URL', p.canonical, `seo.${page}.canonical`)}
                    ${fieldImage('OG Image', p.ogImage, `seo.${page}.ogImage`)}
                    ${fieldText('OG Title', p.ogTitle, `seo.${page}.ogTitle`)}
                    ${fieldTextarea('OG Description', p.ogDescription, `seo.${page}.ogDescription`, { rows: 2 })}
                    ${fieldText('Keywords', p.keywords, `seo.${page}.keywords`)}
                    ${fieldToggle('No Index', p.noIndex, `seo.${page}.noIndex`)}
                </div>
            </div>`;
        });

        return sectionCard('SEO Settings', html);
    };

    // Integrations
    panelRenderers.integrations = function () {
        const ig = ensureObj(contentData, 'integrations', {});
        return sectionCard('Integrations', `
            <p class="panel-description">Configure third-party service integrations.</p>
            <h4>Analytics</h4>
            ${fieldText('Google Analytics 4 ID', ig.ga4, 'integrations.ga4', { placeholder: 'G-XXXXXXXXXX' })}
            ${fieldText('Google Tag Manager ID', ig.gtm, 'integrations.gtm', { placeholder: 'GTM-XXXXXXX' })}
            ${fieldText('Facebook Pixel ID', ig.fbPixel, 'integrations.fbPixel')}
            ${fieldText('Hotjar Site ID', ig.hotjar, 'integrations.hotjar')}
            <h4 style="margin-top:1.5rem;">E-Commerce</h4>
            ${fieldText('Snipcart API Key', ig.snipcart, 'integrations.snipcart')}
            ${fieldText('Stripe Public Key', ig.stripe, 'integrations.stripe')}
            <h4 style="margin-top:1.5rem;">Forms &amp; Email</h4>
            ${fieldText('Formspree Form ID', ig.formspree, 'integrations.formspree')}
            ${fieldText('Mailchimp List URL', ig.mailchimp, 'integrations.mailchimp')}
        `);
    };

    // Custom Code
    panelRenderers.customCode = function () {
        const cc = ensureObj(contentData, 'customCode', {});
        return sectionCard('Custom Code', `
            <p class="panel-description">Add custom code to be injected in the site head or before closing body tag.</p>
            ${fieldTextarea('Head Code', cc.head, 'customCode.head', { rows: 10, placeholder: '<!-- Custom head code -->' })}
            ${fieldTextarea('Body End Code', cc.bodyEnd, 'customCode.bodyEnd', { rows: 10, placeholder: '<!-- Custom body end code -->' })}
        `);
    };

    // Media Library
    panelRenderers.mediaLibrary = function () {
        return `
        <div class="panel-card">
            <div class="panel-card-header">
                <h3>Media Library</h3>
                <div class="media-actions">
                    <input type="text" id="mediaSearch" class="form-control" placeholder="Search assets..." style="width:200px;display:inline-block;">
                    <label class="btn btn-primary btn-sm upload-btn" style="margin-left:.5rem;">
                        Upload File
                        <input type="file" accept="image/*,video/*,.pdf,.svg" id="mediaUploadInput" style="display:none;" multiple>
                    </label>
                </div>
            </div>
            <div class="panel-card-body">
                <div id="mediaGrid" class="media-grid">
                    <div class="loading-text">Loading assets...</div>
                </div>
            </div>
        </div>`;
    };

    // User Management (superAdmin only)
    panelRenderers.userManagement = function () {
        if (!API.isSuperAdmin()) {
            return '<div class="panel-card"><div class="panel-card-body"><p>Access denied. Super Admin only.</p></div></div>';
        }
        return `
        <div class="panel-card">
            <div class="panel-card-header">
                <h3>User Management</h3>
                <button class="btn btn-primary btn-sm" id="addUserBtn">+ Add User</button>
            </div>
            <div class="panel-card-body">
                <div id="usersTable">
                    <div class="loading-text">Loading users...</div>
                </div>
            </div>
        </div>
        <div id="addUserModal" class="modal" style="display:none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add User</h3>
                    <button class="modal-close" id="closeUserModal">&times;</button>
                </div>
                <div class="modal-body">
                    ${fieldText('Name', '', 'newUser.name')}
                    ${fieldText('Email', '', 'newUser.email')}
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="newUserPassword" class="form-control" placeholder="Enter password">
                    </div>
                    ${fieldSelect('Role', 'editor', 'newUser.role', ['editor', 'admin', 'superAdmin'])}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline btn-sm" id="cancelUserBtn">Cancel</button>
                    <button class="btn btn-primary btn-sm" id="confirmAddUserBtn">Create User</button>
                </div>
            </div>
        </div>`;
    };

    // Domain Settings
    panelRenderers.domainSettings = function () {
        const d = ensureObj(contentData, 'domain', {});
        return sectionCard('Domain Settings', `
            <p class="panel-description">Configure your custom domain by setting up a CNAME record pointing to your GitHub Pages URL.</p>
            ${fieldText('Custom Domain', d.customDomain, 'domain.customDomain', { placeholder: 'www.thesweetbrand.com' })}
            <div class="info-box">
                <h4>CNAME Setup Instructions</h4>
                <ol>
                    <li>Go to your domain registrar's DNS settings</li>
                    <li>Create a <strong>CNAME</strong> record:</li>
                    <li>Host: <code>www</code> (or your subdomain)</li>
                    <li>Points to: <code>${API.OWNER}.github.io</code></li>
                    <li>For apex domain (no www), create an <strong>A</strong> record pointing to GitHub's IPs:
                        <ul>
                            <li><code>185.199.108.153</code></li>
                            <li><code>185.199.109.153</code></li>
                            <li><code>185.199.110.153</code></li>
                            <li><code>185.199.111.153</code></li>
                        </ul>
                    </li>
                    <li>Enable "Enforce HTTPS" in your GitHub repo's Pages settings</li>
                    <li>DNS changes can take up to 48 hours to propagate</li>
                </ol>
            </div>
            ${fieldToggle('Force HTTPS', d.forceHttps !== false, 'domain.forceHttps')}
            ${fieldToggle('WWW Redirect', d.wwwRedirect, 'domain.wwwRedirect')}
        `);
    };

    // Account Settings
    panelRenderers.accountSettings = function () {
        const user = API.getUser();
        return `
        <div class="panel-card">
            <div class="panel-card-header"><h3>Account Settings</h3></div>
            <div class="panel-card-body">
                <div class="form-group">
                    <label>Email</label>
                    <input type="text" class="form-control" value="${escHtml(user ? user.email : '')}" disabled>
                </div>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" class="form-control" value="${escHtml(user ? user.name : '')}" disabled>
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <input type="text" class="form-control" value="${escHtml(user ? user.role : '')}" disabled>
                </div>
            </div>
        </div>
        <div class="panel-card" style="margin-top:1.5rem;">
            <div class="panel-card-header"><h3>Change Password</h3></div>
            <div class="panel-card-body">
                <div class="form-group">
                    <label for="currentPassword">Current Password</label>
                    <input type="password" id="currentPassword" class="form-control">
                </div>
                <div class="form-group">
                    <label for="newPassword">New Password</label>
                    <input type="password" id="newPassword" class="form-control">
                </div>
                <div class="form-group">
                    <label for="confirmPassword">Confirm New Password</label>
                    <input type="password" id="confirmPassword" class="form-control">
                </div>
                <button class="btn btn-primary btn-sm" id="changePasswordBtn">Change Password</button>
            </div>
        </div>
        ${!API.IS_LOCAL ? `
        <div class="panel-card" style="margin-top:1.5rem;">
            <div class="panel-card-header"><h3>GitHub Token</h3></div>
            <div class="panel-card-body">
                <p class="panel-description">Update your GitHub Personal Access Token.</p>
                <div class="form-group">
                    <input type="password" id="acctGhToken" class="form-control" placeholder="ghp_xxxxxxxxxxxx" value="${API.getStoredToken() ? '****' : ''}">
                </div>
                <button class="btn btn-primary btn-sm" id="acctSaveTokenBtn">Update Token</button>
            </div>
        </div>` : ''}`;
    };

    /* --------------------------------------------------
       Render panel
    -------------------------------------------------- */
    function renderPanel(name) {
        currentPanel = name;

        // Update nav
        $$('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.panel === name);
        });

        // Update title
        const titles = {
            dashboard: 'Dashboard', siteSettings: 'Site Settings', hero: 'Hero', services: 'Services',
            projects: 'Projects / Work', about: 'About', blog: 'Blog', faq: 'FAQ', contact: 'Contact',
            cta: 'CTA Section', marquee: 'Marquee', newsletter: 'Newsletter', gallery: 'Gallery',
            testimonials: 'Testimonials', pricing: 'Pricing', team: 'Team', process: 'Process',
            partners: 'Partners', seo: 'SEO', integrations: 'Integrations', customCode: 'Custom Code',
            mediaLibrary: 'Media Library', userManagement: 'User Management',
            domainSettings: 'Domain Settings', accountSettings: 'Account Settings'
        };
        panelTitle.textContent = titles[name] || name;

        // Render
        const renderer = panelRenderers[name];
        if (renderer) {
            mainContent.innerHTML = renderer();
        } else {
            mainContent.innerHTML = '<div class="panel-card"><div class="panel-card-body"><p>Panel not found.</p></div></div>';
        }

        // Close mobile sidebar
        sidebar.classList.remove('open');

        // Post-render hooks
        bindFormEvents();
        if (name === 'mediaLibrary') loadMediaLibrary();
        if (name === 'userManagement') loadUserManagement();
    }

    window.editorNav = function (panel) {
        renderPanel(panel);
    };

    /* --------------------------------------------------
       Form event binding
    -------------------------------------------------- */
    function bindFormEvents() {
        // Input change tracking
        mainContent.querySelectorAll('input, textarea, select').forEach(el => {
            el.addEventListener('input', () => markDirty());
            el.addEventListener('change', () => markDirty());
        });

        // Contenteditable change tracking
        mainContent.querySelectorAll('.rich-editor').forEach(el => {
            el.addEventListener('input', () => markDirty());
        });

        // Character counters
        mainContent.querySelectorAll('.char-counter').forEach(counter => {
            const inputId = counter.dataset.for;
            const max = parseInt(counter.dataset.max);
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', () => {
                    const len = input.value.length;
                    counter.textContent = `${len}/${max}`;
                    counter.classList.toggle('over-limit', len > max);
                });
            }
        });

        // Image upload
        mainContent.querySelectorAll('.file-input').forEach(input => {
            input.addEventListener('change', handleImageUpload);
        });

        // Image URL input => preview
        mainContent.querySelectorAll('.img-url-input').forEach(input => {
            input.addEventListener('change', function () {
                const wrap = this.closest('.image-field');
                const previewWrap = wrap.querySelector('.img-preview-wrap');
                if (this.classList.contains('site-url-input')) {
                    // Website URL preview — update iframe
                    if (this.value) {
                        previewWrap.innerHTML = `<div class="site-preview-wrap"><iframe src="${escHtml(this.value)}" class="site-preview-iframe" sandbox="allow-scripts allow-same-origin" loading="lazy"></iframe><div class="site-preview-overlay"></div></div>`;
                    } else {
                        previewWrap.innerHTML = '<div class="img-placeholder">Enter a URL to preview</div>';
                    }
                } else {
                    // Image URL preview
                    if (this.value) {
                        previewWrap.innerHTML = `<img src="${escHtml(this.value)}" class="img-preview" alt="preview">`;
                    } else {
                        previewWrap.innerHTML = '<div class="img-placeholder">No image</div>';
                    }
                }
            });
        });

        // Color field sync
        mainContent.querySelectorAll('.color-field').forEach(wrap => {
            const colorInput = wrap.querySelector('input[type="color"]');
            const textInput = wrap.querySelector('.color-text');
            colorInput.addEventListener('input', () => { textInput.value = colorInput.value; });
            textInput.addEventListener('input', () => { colorInput.value = textInput.value; });
        });

        // Rich text toolbar
        mainContent.querySelectorAll('.rte-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                const cmd = this.dataset.cmd;
                if (cmd.startsWith('formatBlock-')) {
                    document.execCommand('formatBlock', false, cmd.split('-')[1]);
                } else if (cmd === 'createLink') {
                    const url = prompt('Enter URL:');
                    if (url) document.execCommand('createLink', false, url);
                } else {
                    document.execCommand(cmd, false, null);
                }
            });
        });

        // Repeater add
        mainContent.querySelectorAll('.repeater-add').forEach(btn => {
            btn.addEventListener('click', function () {
                const key = this.dataset.key;
                addRepeaterItem(key);
            });
        });

        // Repeater remove
        mainContent.querySelectorAll('.repeater-remove').forEach(btn => {
            btn.addEventListener('click', function () {
                const item = this.closest('.repeater-item');
                const key = item.dataset.key;
                const idx = parseInt(item.dataset.index);
                removeRepeaterItem(key, idx);
            });
        });

        // Repeater move
        mainContent.querySelectorAll('.repeater-move-up').forEach(btn => {
            btn.addEventListener('click', function () {
                const item = this.closest('.repeater-item');
                const key = item.dataset.key;
                const idx = parseInt(item.dataset.index);
                moveRepeaterItem(key, idx, -1);
            });
        });

        mainContent.querySelectorAll('.repeater-move-down').forEach(btn => {
            btn.addEventListener('click', function () {
                const item = this.closest('.repeater-item');
                const key = item.dataset.key;
                const idx = parseInt(item.dataset.index);
                moveRepeaterItem(key, idx, 1);
            });
        });

        // Dashboard token save
        const saveTokenBtn = document.getElementById('saveTokenBtn');
        if (saveTokenBtn) {
            saveTokenBtn.addEventListener('click', () => {
                const token = document.getElementById('ghTokenInput').value.trim();
                if (token) {
                    API.saveApiToken(token);
                    showToast('GitHub token saved for this session', 'success');
                }
            });
        }

        // Account token save
        const acctSaveTokenBtn = document.getElementById('acctSaveTokenBtn');
        if (acctSaveTokenBtn) {
            acctSaveTokenBtn.addEventListener('click', () => {
                const token = document.getElementById('acctGhToken').value.trim();
                if (token && token !== '****') {
                    API.saveApiToken(token);
                    showToast('GitHub token updated', 'success');
                }
            });
        }

        // Change password
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', handleChangePassword);
        }

        // User management buttons
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                document.getElementById('addUserModal').style.display = 'flex';
            });
        }
        const closeUserModal = document.getElementById('closeUserModal');
        if (closeUserModal) {
            closeUserModal.addEventListener('click', () => {
                document.getElementById('addUserModal').style.display = 'none';
            });
        }
        const cancelUserBtn = document.getElementById('cancelUserBtn');
        if (cancelUserBtn) {
            cancelUserBtn.addEventListener('click', () => {
                document.getElementById('addUserModal').style.display = 'none';
            });
        }
        const confirmAddUserBtn = document.getElementById('confirmAddUserBtn');
        if (confirmAddUserBtn) {
            confirmAddUserBtn.addEventListener('click', handleAddUser);
        }

        // Media upload
        const mediaUploadInput = document.getElementById('mediaUploadInput');
        if (mediaUploadInput) {
            mediaUploadInput.addEventListener('change', handleMediaUpload);
        }

        // Media search
        const mediaSearch = document.getElementById('mediaSearch');
        if (mediaSearch) {
            mediaSearch.addEventListener('input', filterMediaGrid);
        }
    }

    /* --------------------------------------------------
       Image upload handler
    -------------------------------------------------- */
    async function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const field = e.target.closest('.image-field');
        const urlInput = field.querySelector('.img-url-input');
        const previewWrap = field.querySelector('.img-preview-wrap');

        previewWrap.innerHTML = '<div class="img-placeholder">Uploading...</div>';

        try {
            const result = await API.uploadAsset(file);
            let url;
            if (API.IS_LOCAL) {
                url = `assets/${file.name}`;
            } else {
                url = result.content ? result.content.download_url : `assets/${file.name}`;
            }
            urlInput.value = url;
            previewWrap.innerHTML = `<img src="${escHtml(url)}" class="img-preview" alt="preview">`;
            markDirty();
            showToast('Image uploaded', 'success');
        } catch (err) {
            previewWrap.innerHTML = '<div class="img-placeholder">Upload failed</div>';
            showToast('Upload failed: ' + err.message, 'error');
        }
    }

    /* --------------------------------------------------
       Repeater operations
    -------------------------------------------------- */
    function getNestedValue(obj, path) {
        return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
    }

    function setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            const next = keys[i + 1];
            if (current[k] === undefined) {
                current[k] = isNaN(parseInt(next)) ? {} : [];
            }
            current = current[k];
        }
        current[keys[keys.length - 1]] = value;
    }

    function addRepeaterItem(key) {
        collectFormData();
        const arr = getNestedValue(contentData, key);
        if (Array.isArray(arr)) {
            arr.push({});
            markDirty();
            renderPanel(currentPanel);
        }
    }

    function removeRepeaterItem(key, idx) {
        collectFormData();
        const arr = getNestedValue(contentData, key);
        if (Array.isArray(arr) && idx >= 0 && idx < arr.length) {
            arr.splice(idx, 1);
            markDirty();
            renderPanel(currentPanel);
        }
    }

    function moveRepeaterItem(key, idx, dir) {
        collectFormData();
        const arr = getNestedValue(contentData, key);
        if (!Array.isArray(arr)) return;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= arr.length) return;
        const temp = arr[idx];
        arr[idx] = arr[newIdx];
        arr[newIdx] = temp;
        markDirty();
        renderPanel(currentPanel);
    }

    /* --------------------------------------------------
       Collect form data from DOM into contentData
    -------------------------------------------------- */
    function collectFormData() {
        if (!contentData) return;

        // Text inputs and textareas
        mainContent.querySelectorAll('input[data-key], textarea[data-key], select[data-key]').forEach(el => {
            const key = el.dataset.key;
            if (!key) return;

            // Skip non-content keys
            if (key.startsWith('newUser.')) return;

            let value;

            if (el.type === 'checkbox') {
                if (key.startsWith('visibility.')) {
                    const sectionKey = key.replace('visibility.', '');
                    ensureObj(contentData, 'sectionVisibility', {});
                    contentData.sectionVisibility[sectionKey] = el.checked;
                    return;
                }
                value = el.checked;
            } else {
                value = el.value;
            }

            // Handle special fields
            if (key.includes('.tags') && typeof value === 'string') {
                value = value.split(',').map(t => t.trim()).filter(Boolean);
            }
            if (key.includes('.features') && typeof value === 'string') {
                value = value.split('\n').map(t => t.trim()).filter(Boolean);
            }
            if (key.includes('.hours.')) {
                // Array index in path
            }

            setNestedValue(contentData, key, value);
        });

        // Rich text editors
        mainContent.querySelectorAll('.rich-editor[data-key]').forEach(el => {
            setNestedValue(contentData, el.dataset.key, el.innerHTML);
        });

        // Color text inputs (use color-text value)
        mainContent.querySelectorAll('.color-text[data-key]').forEach(el => {
            setNestedValue(contentData, el.dataset.key, el.value);
        });
    }

    /* --------------------------------------------------
       Save handler
    -------------------------------------------------- */
    async function handleSave() {
        collectFormData();
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            await API.saveContent(contentData);
            savedData = deepClone(contentData);
            markClean();
            showToast('Content saved successfully!', 'success');
        } catch (err) {
            showToast('Save failed: ' + err.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    }

    /* --------------------------------------------------
       Revert handler
    -------------------------------------------------- */
    function handleRevert() {
        if (!savedData) return;
        if (!confirm('Revert all unsaved changes?')) return;
        contentData = deepClone(savedData);
        markClean();
        renderPanel(currentPanel);
        showToast('Changes reverted', 'info');
    }

    /* --------------------------------------------------
       Media Library
    -------------------------------------------------- */
    async function loadMediaLibrary() {
        const grid = document.getElementById('mediaGrid');
        if (!grid) return;

        try {
            assetsCache = await API.getAssets();
            renderMediaGrid(assetsCache);
        } catch (err) {
            grid.innerHTML = `<p style="color:#9ca3af;">No assets found or failed to load. ${err.message}</p>`;
        }
    }

    function renderMediaGrid(assets) {
        const grid = document.getElementById('mediaGrid');
        if (!grid) return;

        if (!assets || assets.length === 0) {
            grid.innerHTML = '<p style="color:#9ca3af;">No assets uploaded yet.</p>';
            return;
        }

        grid.innerHTML = assets.map(a => {
            const name = a.name || a.path || '';
            const isImage = /\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(name);
            const url = a.download_url || a.url || `assets/${name}`;
            const thumb = isImage ? `<img src="${escHtml(url)}" alt="${escHtml(name)}" class="media-thumb">` : `<div class="media-file-icon">&#128196;</div>`;

            return `
            <div class="media-item" data-name="${escHtml(name.toLowerCase())}">
                <div class="media-preview">${thumb}</div>
                <div class="media-info">
                    <span class="media-name" title="${escHtml(name)}">${escHtml(name)}</span>
                    <div class="media-item-actions">
                        <button class="btn btn-xs btn-outline media-copy" data-url="${escHtml(url)}" title="Copy path">Copy</button>
                        <button class="btn btn-xs btn-danger media-delete" data-path="${escHtml(a.path || `assets/${name}`)}" data-sha="${a.sha || ''}" title="Delete">&times;</button>
                    </div>
                </div>
            </div>`;
        }).join('');

        // Bind media actions
        grid.querySelectorAll('.media-copy').forEach(btn => {
            btn.addEventListener('click', function () {
                navigator.clipboard.writeText(this.dataset.url).then(() => {
                    showToast('Path copied!', 'success');
                });
            });
        });

        grid.querySelectorAll('.media-delete').forEach(btn => {
            btn.addEventListener('click', async function () {
                if (!confirm('Delete this file?')) return;
                try {
                    await API.deleteFile(this.dataset.path, this.dataset.sha, 'Delete asset via admin');
                    showToast('File deleted', 'success');
                    loadMediaLibrary();
                } catch (err) {
                    showToast('Delete failed: ' + err.message, 'error');
                }
            });
        });
    }

    function filterMediaGrid() {
        const query = document.getElementById('mediaSearch').value.toLowerCase();
        document.querySelectorAll('.media-item').forEach(item => {
            const name = item.dataset.name || '';
            item.style.display = name.includes(query) ? '' : 'none';
        });
    }

    async function handleMediaUpload(e) {
        const files = e.target.files;
        if (!files.length) return;

        for (const file of files) {
            try {
                showToast(`Uploading ${file.name}...`, 'info');
                await API.uploadAsset(file);
                showToast(`${file.name} uploaded`, 'success');
            } catch (err) {
                showToast(`Failed to upload ${file.name}: ${err.message}`, 'error');
            }
        }

        loadMediaLibrary();
        e.target.value = '';
    }

    /* --------------------------------------------------
       User Management
    -------------------------------------------------- */
    let usersData = null;

    async function loadUserManagement() {
        const container = document.getElementById('usersTable');
        if (!container) return;

        try {
            usersData = await API.getUsers();
            renderUsersTable(usersData);
        } catch (err) {
            container.innerHTML = `<p style="color:#ef4444;">Failed to load users: ${err.message}</p>`;
        }
    }

    function renderUsersTable(data) {
        const container = document.getElementById('usersTable');
        if (!container || !data || !data.users) return;

        const rows = data.users.map((u, idx) => `
            <tr>
                <td>${escHtml(u.name || '')}</td>
                <td>${escHtml(u.email)}</td>
                <td>
                    <select class="form-control form-control-sm user-role-select" data-idx="${idx}">
                        <option value="editor" ${u.role === 'editor' ? 'selected' : ''}>Editor</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="superAdmin" ${u.role === 'superAdmin' ? 'selected' : ''}>Super Admin</option>
                    </select>
                </td>
                <td>
                    <span class="badge ${u.disabled ? 'badge-danger' : 'badge-success'}">${u.disabled ? 'Disabled' : 'Active'}</span>
                </td>
                <td>
                    <button class="btn btn-xs btn-outline user-toggle" data-idx="${idx}">${u.disabled ? 'Enable' : 'Disable'}</button>
                    <button class="btn btn-xs btn-outline user-reset-pw" data-idx="${idx}" title="Force password reset">Reset PW</button>
                    <button class="btn btn-xs btn-danger user-delete" data-idx="${idx}">&times;</button>
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;

        // Bind user actions
        container.querySelectorAll('.user-role-select').forEach(sel => {
            sel.addEventListener('change', async function () {
                const idx = parseInt(this.dataset.idx);
                usersData.users[idx].role = this.value;
                await saveUsersData();
            });
        });

        container.querySelectorAll('.user-toggle').forEach(btn => {
            btn.addEventListener('click', async function () {
                const idx = parseInt(this.dataset.idx);
                usersData.users[idx].disabled = !usersData.users[idx].disabled;
                await saveUsersData();
                renderUsersTable(usersData);
            });
        });

        container.querySelectorAll('.user-reset-pw').forEach(btn => {
            btn.addEventListener('click', async function () {
                const idx = parseInt(this.dataset.idx);
                const newPw = prompt('Enter new password for ' + usersData.users[idx].email);
                if (!newPw) return;
                const hash = await API.hashPassword(usersData.users[idx].email, newPw);
                usersData.users[idx].hash = hash;
                usersData.users[idx].forceReset = true;
                await saveUsersData();
                showToast('Password reset', 'success');
            });
        });

        container.querySelectorAll('.user-delete').forEach(btn => {
            btn.addEventListener('click', async function () {
                const idx = parseInt(this.dataset.idx);
                if (!confirm(`Delete user ${usersData.users[idx].email}?`)) return;
                usersData.users.splice(idx, 1);
                await saveUsersData();
                renderUsersTable(usersData);
            });
        });
    }

    async function saveUsersData() {
        try {
            await API.saveUsers(usersData);
            showToast('Users updated', 'success');
        } catch (err) {
            showToast('Failed to save users: ' + err.message, 'error');
        }
    }

    async function handleAddUser() {
        const nameInput = mainContent.querySelector('[data-key="newUser.name"]');
        const emailInput = mainContent.querySelector('[data-key="newUser.email"]');
        const passwordInput = document.getElementById('newUserPassword');
        const roleInput = mainContent.querySelector('[data-key="newUser.role"]');

        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        const role = roleInput ? roleInput.value : 'editor';

        if (!email || !password) {
            showToast('Email and password are required', 'error');
            return;
        }

        try {
            const hash = await API.hashPassword(email, password);
            if (!usersData) usersData = { users: [] };
            usersData.users.push({ name, email, role, hash, disabled: false });
            await saveUsersData();
            document.getElementById('addUserModal').style.display = 'none';
            renderUsersTable(usersData);
            showToast('User created', 'success');
        } catch (err) {
            showToast('Failed to create user: ' + err.message, 'error');
        }
    }

    /* --------------------------------------------------
       Change password
    -------------------------------------------------- */
    async function handleChangePassword() {
        const currentPw = document.getElementById('currentPassword').value;
        const newPw = document.getElementById('newPassword').value;
        const confirmPw = document.getElementById('confirmPassword').value;

        if (!currentPw || !newPw) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (newPw !== confirmPw) {
            showToast('New passwords do not match', 'error');
            return;
        }

        if (newPw.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            const user = API.getUser();
            const currentHash = await API.hashPassword(user.email, currentPw);
            const userData = await API.getUsers();
            const found = userData.users.find(u => u.email.toLowerCase() === user.email.toLowerCase());

            if (!found || found.hash !== currentHash) {
                showToast('Current password is incorrect', 'error');
                return;
            }

            found.hash = await API.hashPassword(user.email, newPw);
            found.forceReset = false;
            await API.saveUsers(userData);
            showToast('Password changed successfully', 'success');

            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } catch (err) {
            showToast('Failed to change password: ' + err.message, 'error');
        }
    }

    /* --------------------------------------------------
       Initialization
    -------------------------------------------------- */
    async function initApp() {
        // Check for existing session
        const session = API.restoreSession();
        if (session) {
            showAdmin(session);
            return;
        }

        // Show login
        loginScreen.style.display = 'flex';
        adminShell.style.display = 'none';
    }

    async function showAdmin(session) {
        loginScreen.style.display = 'none';
        adminShell.style.display = 'flex';

        userDisplay.textContent = session.name || session.email;
        userRole.textContent = session.role;
        userRole.className = 'badge badge-' + (session.role === 'superAdmin' ? 'primary' : 'default');

        if (API.isSuperAdmin()) {
            navUserMgmt.style.display = '';
        }

        // Load content
        try {
            const result = await API.getContent();
            contentData = result.data;
            savedData = deepClone(contentData);
            renderPanel('dashboard');
        } catch (err) {
            // Content doesn't exist yet, start fresh
            contentData = {};
            savedData = {};
            renderPanel('dashboard');
            showToast('No content.json found. Starting fresh.', 'info');
        }
    }

    /* --------------------------------------------------
       Event listeners
    -------------------------------------------------- */

    // Login
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        loginError.style.display = 'none';
        const btn = document.getElementById('loginBtn');
        btn.disabled = true;
        btn.textContent = 'Signing in...';

        try {
            const session = await API.authenticate(email, password);
            showAdmin(session);
            showToast('Welcome, ' + session.name, 'success');
        } catch (err) {
            loginError.textContent = err.message;
            loginError.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    });

    // Logout
    logoutBtn.addEventListener('click', function () {
        if (isDirty && !confirm('You have unsaved changes. Sign out anyway?')) return;
        API.clearAuth();
        contentData = null;
        savedData = null;
        isDirty = false;
        loginScreen.style.display = 'flex';
        adminShell.style.display = 'none';
        showToast('Signed out', 'info');
    });

    // Save
    saveBtn.addEventListener('click', handleSave);

    // Revert
    revertBtn.addEventListener('click', handleRevert);

    // Sidebar navigation
    document.addEventListener('click', function (e) {
        const link = e.target.closest('.nav-link');
        if (link && link.dataset.panel) {
            e.preventDefault();
            if (isDirty) collectFormData();
            renderPanel(link.dataset.panel);
        }
    });

    // Mobile menu toggle
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));

    // Init
    initApp();

})();
