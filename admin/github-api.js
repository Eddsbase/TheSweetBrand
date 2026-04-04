/* ============================================================
   The Sweet Brand - GitHub API Layer (github-api.js)
   Handles authentication, content CRUD via GitHub REST API,
   and local dev server fallback.
   ============================================================ */

(function () {
    'use strict';

    const OWNER = 'Eddsbase';
    const REPO = 'TheSweetBrand';
    const BRANCH = 'master';
    const API_BASE = 'https://api.github.com';
    const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);

    // SHA cache for conflict prevention
    const shaCache = {};

    // Session keys
    const SESSION_KEY = 'tsb_admin_session';
    const TOKEN_KEY = 'tsb_github_token';

    /* --------------------------------------------------
       Utility: UTF-8 safe Base64
    -------------------------------------------------- */
    function utf8ToBase64(str) {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToUtf8(b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    }

    /* --------------------------------------------------
       Password Hashing (SHA-256)
    -------------------------------------------------- */
    async function hashPassword(email, password) {
        const raw = email.toLowerCase() + ':' + password;
        const data = new TextEncoder().encode(raw);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /* --------------------------------------------------
       GitHub REST helpers
    -------------------------------------------------- */
    function authHeaders() {
        const token = getStoredToken();
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        return headers;
    }

    async function ghFetch(url, opts = {}) {
        opts.headers = Object.assign(authHeaders(), opts.headers || {});
        const resp = await fetch(url, opts);
        if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            throw new Error(body.message || `GitHub API error ${resp.status}`);
        }
        return resp;
    }

    /* --------------------------------------------------
       Token management
    -------------------------------------------------- */
    function setToken(token) {
        sessionStorage.setItem(TOKEN_KEY, token);
    }

    function getStoredToken() {
        return sessionStorage.getItem(TOKEN_KEY);
    }

    function saveApiToken(token) {
        setToken(token);
    }

    /* --------------------------------------------------
       Session management
    -------------------------------------------------- */
    function saveSession(user) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }

    function restoreSession() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function clearAuth() {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
    }

    function getUser() {
        return restoreSession();
    }

    function getRole() {
        const u = getUser();
        return u ? u.role : null;
    }

    function isAuthenticated() {
        return !!getUser();
    }

    function isSuperAdmin() {
        return getRole() === 'superAdmin';
    }

    /* --------------------------------------------------
       Authentication
    -------------------------------------------------- */
    async function authenticate(email, password) {
        const hash = await hashPassword(email, password);
        let users;

        if (IS_LOCAL) {
            const resp = await fetch('/api/users');
            if (!resp.ok) throw new Error('Failed to load users');
            users = await resp.json();
        } else {
            const data = await readFile('admin-users.json');
            users = JSON.parse(data.content);
        }

        if (!users || !users.users) {
            throw new Error('Invalid users data');
        }

        const found = users.users.find(u =>
            u.email.toLowerCase() === email.toLowerCase() && u.hash === hash
        );

        if (!found) {
            throw new Error('Invalid email or password');
        }

        if (found.disabled) {
            throw new Error('Account is disabled');
        }

        const session = {
            email: found.email,
            name: found.name || found.email.split('@')[0],
            role: found.role || 'editor',
            loginTime: Date.now()
        };

        saveSession(session);

        if (found.githubToken) {
            setToken(found.githubToken);
        }

        return session;
    }

    /* --------------------------------------------------
       File operations - GitHub mode
    -------------------------------------------------- */
    async function readFileGitHub(path) {
        const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}&t=${Date.now()}`;
        const resp = await ghFetch(url);
        const data = await resp.json();

        // Cache SHA for writes
        shaCache[path] = data.sha;

        // Decode content
        const content = base64ToUtf8(data.content.replace(/\n/g, ''));
        return { content, sha: data.sha };
    }

    async function writeFileGitHub(path, content, message, sha) {
        const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${path}`;
        const fileSha = sha || shaCache[path];

        const body = {
            message: message || `Update ${path}`,
            content: utf8ToBase64(content),
            branch: BRANCH
        };

        if (fileSha) {
            body.sha = fileSha;
        }

        const resp = await ghFetch(url, {
            method: 'PUT',
            body: JSON.stringify(body)
        });

        const data = await resp.json();
        shaCache[path] = data.content.sha;
        return data;
    }

    async function uploadImageGitHub(path, base64data, message) {
        const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${path}`;
        let fileSha = shaCache[path];

        // Check if file exists to get SHA
        if (!fileSha) {
            try {
                const checkUrl = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`;
                const checkResp = await ghFetch(checkUrl);
                const checkData = await checkResp.json();
                fileSha = checkData.sha;
            } catch {
                // File doesn't exist, that's fine
            }
        }

        const body = {
            message: message || `Upload ${path}`,
            content: base64data,
            branch: BRANCH
        };

        if (fileSha) {
            body.sha = fileSha;
        }

        const resp = await ghFetch(url, {
            method: 'PUT',
            body: JSON.stringify(body)
        });

        const data = await resp.json();
        shaCache[path] = data.content.sha;
        return data;
    }

    async function listFilesGitHub(path) {
        const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`;
        const resp = await ghFetch(url);
        const data = await resp.json();
        if (Array.isArray(data)) {
            data.forEach(f => { shaCache[f.path] = f.sha; });
        }
        return data;
    }

    async function deleteFileGitHub(path, sha, message) {
        const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${path}`;
        const fileSha = sha || shaCache[path];

        if (!fileSha) {
            throw new Error('SHA required for delete. Read the file first.');
        }

        const body = {
            message: message || `Delete ${path}`,
            sha: fileSha,
            branch: BRANCH
        };

        const resp = await ghFetch(url, {
            method: 'DELETE',
            body: JSON.stringify(body)
        });

        delete shaCache[path];
        return await resp.json();
    }

    /* --------------------------------------------------
       File operations - Local mode
    -------------------------------------------------- */
    async function readFileLocal(path) {
        const resp = await fetch(`/api/content?path=${encodeURIComponent(path)}`);
        if (!resp.ok) throw new Error('Failed to read file locally');
        const data = await resp.json();
        return { content: typeof data === 'string' ? data : JSON.stringify(data, null, 2), sha: null };
    }

    async function writeFileLocal(path, content, message) {
        const resp = await fetch('/api/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content, message })
        });
        if (!resp.ok) throw new Error('Failed to write file locally');
        return await resp.json();
    }

    async function uploadImageLocal(path, base64data, message) {
        const resp = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, data: base64data, message })
        });
        if (!resp.ok) throw new Error('Failed to upload locally');
        return await resp.json();
    }

    async function listFilesLocal(path) {
        const resp = await fetch(`/api/assets?path=${encodeURIComponent(path)}`);
        if (!resp.ok) throw new Error('Failed to list files locally');
        return await resp.json();
    }

    async function deleteFileLocal(path) {
        const resp = await fetch(`/api/content?path=${encodeURIComponent(path)}`, {
            method: 'DELETE'
        });
        if (!resp.ok) throw new Error('Failed to delete file locally');
        return await resp.json();
    }

    /* --------------------------------------------------
       Unified file operations
    -------------------------------------------------- */
    async function readFile(path) {
        return IS_LOCAL ? readFileLocal(path) : readFileGitHub(path);
    }

    async function writeFile(path, content, message, sha) {
        return IS_LOCAL ? writeFileLocal(path, content, message) : writeFileGitHub(path, content, message, sha);
    }

    async function uploadImage(path, base64data, message) {
        return IS_LOCAL ? uploadImageLocal(path, base64data, message) : uploadImageGitHub(path, base64data, message);
    }

    async function listFiles(path) {
        return IS_LOCAL ? listFilesLocal(path) : listFilesGitHub(path);
    }

    async function deleteFile(path, sha, message) {
        return IS_LOCAL ? deleteFileLocal(path) : deleteFileGitHub(path, sha, message);
    }

    /* --------------------------------------------------
       Content helpers
    -------------------------------------------------- */
    async function getContent() {
        const result = await readFile('content.json');
        return {
            data: JSON.parse(result.content),
            sha: result.sha
        };
    }

    async function saveContent(data) {
        const content = JSON.stringify(data, null, 2);
        const sha = shaCache['content.json'] || null;
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const user = getUser();
        const message = `Update content.json via admin panel - ${user ? user.email : 'unknown'} - ${timestamp}`;
        return await writeFile('content.json', content, message, sha);
    }

    /* --------------------------------------------------
       Asset helpers
    -------------------------------------------------- */
    async function uploadAsset(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function () {
                try {
                    const base64 = reader.result.split(',')[1];
                    const path = `assets/${file.name}`;
                    const message = `Upload asset: ${file.name}`;
                    const result = await uploadImage(path, base64, message);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    async function getAssets() {
        try {
            return await listFiles('assets');
        } catch {
            return [];
        }
    }

    /* --------------------------------------------------
       User management helpers
    -------------------------------------------------- */
    async function getUsers() {
        const result = await readFile('admin-users.json');
        return JSON.parse(result.content);
    }

    async function saveUsers(data) {
        const content = JSON.stringify(data, null, 2);
        const sha = shaCache['admin-users.json'] || null;
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const message = `Update admin-users.json - ${timestamp}`;
        return await writeFile('admin-users.json', content, message, sha);
    }

    /* --------------------------------------------------
       Public API
    -------------------------------------------------- */
    window.SiteAPI = {
        OWNER,
        REPO,
        BRANCH,
        IS_LOCAL,

        // Auth
        authenticate,
        restoreSession,
        clearAuth,
        hashPassword,

        // Token
        setToken,
        getStoredToken,
        saveApiToken,

        // User
        getUser,
        getRole,
        isAuthenticated,
        isSuperAdmin,

        // File ops
        readFile,
        writeFile,
        uploadImage,
        listFiles,
        deleteFile,

        // Content
        getContent,
        saveContent,

        // Assets
        uploadAsset,
        getAssets,

        // Users
        getUsers,
        saveUsers
    };

})();
