// Cloudflare Workers Environment Variables & Secrets
// Configure these in Cloudflare Dashboard > Workers > Settings > Variables and Secrets
// Or define them in wrangler.toml for auto-deploy
//
// [Secrets] — Set as "Secret" type in dashboard:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, DESTINATION_FOLDER_ID
//
// [Variables] — Set as "Text" type in dashboard (all optional):
//   PAGE_TITLE, PAGE_LOGO, META_TITLE, META_DESCRIPTION, META_KEYWORD, META_URL,
//   HOME_PAGE_FORM_COLOR, UPLOAD_PAGE_FORM_COLOR, EXPIRED_PAGE_FORM_COLOR,
//   ERROR_404_PAGE_FORM_COLOR, ERROR_404_FILE_FORM_COLOR,
//   ERROR_501_UPLOAD_FORM_COLOR, ERROR_501_DOWNLOAD_FORM_COLOR,
//   HOME_PAGE_BACKGROUND, UPLOAD_PAGE_BACKGROUND, EXPIRED_PAGE_BACKGROUND,
//   ERROR_404_PAGE_BACKGROUND, ERROR_404_FILE_BACKGROUND,
//   ERROR_501_UPLOAD_BACKGROUND, ERROR_501_DOWNLOAD_BACKGROUND

// Begin Script
export default {
    async fetch(request, env) {
        return handleRequest(request, env);
    },
};

async function handleRequest(request, env) {
    const url = new URL(request.url);
    const host = request.headers.get("host");

    if (url.pathname === "/") {
        return new Response(uploadPage(env), {
            headers: { 'content-type': 'text/html; charset=utf-8' },
        });
    } else if (url.pathname === "/result") {
        const fileId = url.searchParams.get("id");
        const fileName = url.searchParams.get("name");

        // Check if the file exists in Google Drive
        const fileExists = await checkFileExists(fileId, env);

        if (fileExists) {
            const encodedFileName = decodeURIComponent(fileName);
            const fileLink = `https://${host}/download?id=${fileId}&name=${encodeURIComponent(encodedFileName)}`;
            return new Response(downloadPage(fileLink, encodedFileName, env), {
                headers: { 'content-type': 'text/html; charset=utf-8' },
            });
        } else {
            return new Response(notFoundFile(env), {
                status: 404,
                headers: { 'content-type': 'text/html; charset=utf-8' },
            });
        }
    } else if (url.pathname === "/download") {
        const fileId = url.searchParams.get("id");
        const fileName = url.searchParams.get("name");
        const decodedFileName = decodeURIComponent(fileName);

        // Detect link preview bots (WhatsApp, Telegram, Facebook, Twitter, Discord, etc.)
        // These bots auto-fetch URLs to generate previews, which would trigger file deletion
        const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
        const isBot = /whatsapp|telegrambot|facebookexternalhit|facebot|twitterbot|discordbot|slackbot|linkedinbot|pinterestbot|redditbot|applebot|line-poker|kakaotalk|viber|skypeuripreview|embedly|quora|showyoubot|outbrain|semrushbot|baiduspider|duckduckbot|yandex|sogou|exabot|ia_archiver|archive\.org_bot|preview/i.test(userAgent);

        if (isBot) {
            // Return a lightweight HTML page with meta tags for link preview
            // This prevents bots from triggering file download + deletion
            return new Response(`<!DOCTYPE html><html><head>
                <meta charset="utf-8">
                <title>${decodedFileName} - ${env.PAGE_TITLE || "Temporary File Sharing"}</title>
                <meta property="og:title" content="${decodedFileName}">
                <meta property="og:description" content="Click to download this temporary shared file.">
                <meta property="og:image" content="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
                <meta property="og:type" content="website">
                <meta name="twitter:card" content="summary">
                <meta name="twitter:title" content="${decodedFileName}">
                <meta name="twitter:description" content="Click to download this temporary shared file.">
                <meta name="twitter:image" content="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
            </head><body></body></html>`, {
                headers: { 'content-type': 'text/html; charset=utf-8' },
            });
        }

        const file = await downloadFile(fileId, env);

        if (file) {
            // Delete the file from Google Drive after downloading
            const deleted = await deleteFile(fileId, env);
            if (deleted) {
                // RFC 5987/6266: Use filename* for proper Unicode support
                // ASCII fallback replaces non-ASCII chars with underscores
                const asciiFallback = decodedFileName.replace(/[^\x20-\x7E]/g, '_');
                const utf8Encoded = encodeURIComponent(decodedFileName).replace(/'/g, '%27');
                return new Response(file, {
                    headers: {
                        "content-type": "application/octet-stream",
                        "content-disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`,
                    },
                });
            } else {
                return new Response(errordownloadPage(env), {
                    status: 500,
                    headers: { 'content-type': 'text/html; charset=utf-8' },
                });
            }
        } else {
            // Download failed — check if file actually exists before declaring expired
            const stillExists = await checkFileExists(fileId, env);
            if (stillExists) {
                // File exists but download failed (transient API error / cold start)
                return new Response(errordownloadPage(env), {
                    status: 500,
                    headers: { 'content-type': 'text/html; charset=utf-8' },
                });
            } else {
                return new Response(expired(env), {
                    status: 404,
                    headers: { 'content-type': 'text/html; charset=utf-8' },
                });
            }
        }
    } else if (url.pathname === "/upload" && request.method === "POST") {
        try {
            const formData = await request.formData();
            const file = formData.get("file");
            const fileName = file.name;

            // Upload file to Google Drive and get file ID
            const fileId = await uploadFileToDrive(file, env);

            if (fileId) {
                const redirectUrl = `https://${host}/result?id=${fileId}&name=${encodeURIComponent(fileName)}`;
                return Response.redirect(redirectUrl);
            } else {
                return new Response(errorPage(env), {
                    status: 500,
                    headers: { 'content-type': 'text/html; charset=utf-8' },
                });
            }
        } catch (error) {
            const jsonResponse = JSON.stringify({ success: false });
            return new Response(jsonResponse, {
                status: 500,
                headers: { 'content-type': 'application/json' },
            });
        }
    }

    return new Response(notFoundPage(env), {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
    });
}

async function uploadFileToDrive(file, env) {
    const accessToken = await getAccessToken(env);
    const metadata = {
        name: file.name,
        mimeType: file.type,
        parents: [env.DESTINATION_FOLDER_ID],
    };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        body: form,
    });

    const data = await response.json();
    return data.id;
}

async function downloadFile(fileId, env) {
    const accessToken = await getAccessToken(env);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    } else {
        return null;
    }
}

async function deleteFile(fileId, env) {
    const accessToken = await getAccessToken(env);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    return response.ok;
}

async function checkFileExists(fileId, env) {
    const accessToken = await getAccessToken(env);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    return response.ok;
}

async function getAccessToken(env) {
    const tokenResponse = await fetch("https://www.googleapis.com/oauth2/v4/token", {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            refresh_token: env.GOOGLE_REFRESH_TOKEN,
            grant_type: "refresh_token",
        }),
    });

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
}

// ===========================
// Shared UI Components
// ===========================

function pageMeta(title, env) {
    return `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
    <title>${title}</title>
    <meta name="description" content="${env.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
    <meta name="theme-color" content="#6C63FF">
    <meta name="application-name" content="${env.PAGE_TITLE || "YTemp Sharing"}">
    <meta name="robots" content="index, follow">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:image" content="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
    <meta name="twitter:description" content="${env.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
    <meta name="keywords" content="${env.META_KEYWORD || "YTemp Sharing, google, drive, temporary, file-sharing, cloudflare-workers"}">
    <meta name="twitter:title" content="${env.META_TITLE || "Temporary File Sharing by Yuuki0"}">
    <meta name="twitter:url" content="${env.META_URL || "https://yuuki0.net"}">
    <link rel="shortcut icon" href="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
    <meta property="og:site_name" content="${env.META_TITLE || "Temporary File Sharing by Yuuki0"}">
    <meta property="og:type" content="website">
    <meta property="og:image" content="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
    <meta property="og:description" content="${env.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
    <meta property="og:title" content="${env.META_TITLE || "Temporary File Sharing by Yuuki0"}">
    <meta property="og:url" content="${env.META_URL || "https://yuuki0.net"}">
    <link rel="apple-touch-icon" href="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
    <link rel="icon" type="image/png" sizes="32x32" href="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">`;
}

const sharedCSS = `
    :root {
        --color-primary: #6C63FF;
        --color-secondary: #00D2FF;
        --color-accent: #7DD3E8;
        --text-dark: #1e2a3a;
        --text-muted: #6b7c93;
        --bounce: cubic-bezier(0.175, 0.885, 0.32, 1.275);
        --smooth: cubic-bezier(0.25, 1, 0.5, 1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html {
        min-height: 100%; width: 100%;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        overflow-x: hidden; color: var(--text-dark);
    }

    /* Body Wrapper */
    .body-wrapper {
        position: relative; width: 100%;
        min-height: 100vh; min-height: 100dvh;
        display: flex; justify-content: center; align-items: center;
        padding: clamp(15px, 3vh, 30px) 15px;
        z-index: 10;
    }

    /* Background Layer */
    .bg-layer {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        z-index: 1;
        animation: zoomLoop 25s linear infinite alternate;
        filter: brightness(0.85);
    }
    .bg-gradient {
        background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
    }
    @keyframes zoomLoop {
        0% { transform: scale(1); }
        100% { transform: scale(1.08); }
    }

    /* Animated Background Orbs */
    .bg-orb {
        position: fixed; border-radius: 50%;
        filter: blur(100px); opacity: 0.4;
        z-index: 2; pointer-events: none;
    }
    .bg-orb-1 {
        width: 500px; height: 500px; top: -150px; left: -150px;
        background: #6C63FF;
        animation: orbFloat1 20s ease-in-out infinite alternate;
    }
    .bg-orb-2 {
        width: 400px; height: 400px; bottom: -120px; right: -120px;
        background: #00D2FF;
        animation: orbFloat2 18s ease-in-out infinite alternate;
    }
    .bg-orb-3 {
        width: 300px; height: 300px; top: 40%; left: 60%;
        background: #ff6b9d; opacity: 0.25;
        animation: orbFloat3 22s ease-in-out infinite alternate;
    }
    @keyframes orbFloat1 {
        0% { transform: translate(0, 0) scale(1); }
        100% { transform: translate(80px, 100px) scale(1.15); }
    }
    @keyframes orbFloat2 {
        0% { transform: translate(0, 0) scale(1); }
        100% { transform: translate(-60px, -80px) scale(1.1); }
    }
    @keyframes orbFloat3 {
        0% { transform: translate(0, 0) scale(1); }
        100% { transform: translate(-100px, 50px) scale(0.9); }
    }

    /* Cinematic Intro: Dip Fade */
    .dip-white {
        position: fixed; top: 0; left: 0;
        width: 100vw; height: 100vh;
        background: #0f0c29; z-index: 9999; pointer-events: none;
        animation: dipFade 1.5s var(--smooth) forwards;
    }
    @keyframes dipFade {
        0%, 40% { opacity: 1; }
        100% { opacity: 0; visibility: hidden; }
    }

    /* Cinematic Intro: Splash Ripple */
    .splash-overlay {
        position: fixed; top: 50%; left: 50%;
        width: 10vw; height: 10vw;
        background: rgba(108, 99, 255, 0.4);
        border-radius: 50%;
        transform: translate(-50%, -50%) scale(0);
        z-index: 9998; pointer-events: none;
        animation: splashRipple 1.2s cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
    }
    @keyframes splashRipple {
        0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(35); opacity: 0; visibility: hidden; }
    }

    /* Frosted Glass Card */
    .glass-card {
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 24px;
        padding: clamp(20px, 4vh, 40px);
        width: 100%; max-width: 480px;
        box-shadow:
            0 20px 40px rgba(0, 0, 0, 0.08),
            0 0 30px rgba(108, 99, 255, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
        opacity: 0; transform: scale(0.85) translateY(40px);
        animation: gsapPop 1s var(--bounce) 0.5s forwards;
        z-index: 15;
    }
    @keyframes gsapPop {
        0% { opacity: 0; transform: scale(0.85) translateY(40px); }
        60% { opacity: 1; transform: scale(1.02) translateY(-5px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* Logo Container */
    .logo-container {
        text-align: center; margin-bottom: clamp(8px, 2vh, 15px);
        opacity: 0; transform: translateY(20px);
        animation: slideUpFade 0.8s var(--smooth) 0.8s forwards, floatSway 4s ease-in-out 1.6s infinite;
    }
    .logo-container img {
        max-width: clamp(50px, 10vh, 80px); height: auto;
        filter: drop-shadow(0 8px 20px rgba(108, 99, 255, 0.35));
    }
    @keyframes floatSway {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        25% { transform: translateY(-8px) rotate(-2deg); }
        75% { transform: translateY(5px) rotate(2deg); }
    }

    /* Stagger Entrance Animations */
    .stagger-1 { opacity: 0; transform: translateY(20px); animation: slideUpFade 0.8s var(--bounce) 0.9s forwards; }
    .stagger-2 { opacity: 0; transform: translateX(-20px); animation: slideSideFade 0.8s var(--smooth) 1.05s forwards; }
    .stagger-3 { opacity: 0; transform: translateY(20px); animation: slideUpFade 0.8s var(--bounce) 1.2s forwards; }
    .stagger-4 { opacity: 0; transform: translateY(20px); animation: slideUpFade 0.8s var(--bounce) 1.35s forwards; }
    .stagger-5 { opacity: 0; transform: translateY(20px); animation: slideUpFade 0.8s var(--bounce) 1.5s forwards; }
    .stagger-6 { opacity: 0; transform: translateY(10px); animation: slideFadeScale 0.8s var(--smooth) 1.65s forwards; }
    @keyframes slideUpFade { to { opacity: 1; transform: translateY(0); } }
    @keyframes slideSideFade { to { opacity: 1; transform: translateX(0); } }
    @keyframes slideFadeScale { to { opacity: 1; transform: translateY(0) scale(1); } }

    /* Typography */
    .card-title {
        text-align: center;
        font-size: clamp(1.3rem, 4vh, 1.8rem);
        font-weight: 800; color: var(--text-dark);
        margin-bottom: 5px;
        text-shadow: 0 2px 8px rgba(255, 255, 255, 0.6);
    }
    .card-subtitle {
        text-align: center;
        font-size: clamp(0.85rem, 3vw, 0.95rem);
        color: var(--text-muted); font-weight: 500;
        margin-bottom: clamp(12px, 3vh, 25px);
    }

    /* Gradient Button */
    .btn-gradient {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        width: 100%; padding: clamp(12px, 2vh, 16px) 24px;
        background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
        border: none; border-radius: 16px;
        color: #fff; font-size: clamp(0.95rem, 3.5vw, 1.1rem);
        font-weight: 700; font-family: 'Inter', sans-serif;
        cursor: pointer; text-decoration: none;
        transition: all 0.4s var(--bounce);
        box-shadow: 0 4px 18px rgba(108, 99, 255, 0.35);
        text-transform: uppercase; letter-spacing: 1px;
    }
    .btn-gradient:hover {
        transform: translateY(-4px) scale(1.03);
        box-shadow: 0 12px 30px rgba(108, 99, 255, 0.45);
        background: linear-gradient(135deg, var(--color-secondary), var(--color-accent));
    }
    .btn-gradient:active { transform: translateY(2px) scale(0.98); }

    /* Error Code Number */
    .error-code {
        font-size: clamp(60px, 15vw, 100px);
        font-weight: 900; line-height: 1;
        background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    /* Footer */
    .footer-text {
        text-align: center; font-size: 0.8rem;
        color: var(--text-muted); margin-top: clamp(10px, 2vh, 18px);
        font-weight: 500;
    }

    /* Countdown */
    .countdown-num {
        font-size: clamp(2rem, 8vw, 3rem);
        font-weight: 900; line-height: 1.2;
        background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(108, 99, 255, 0.3); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(108, 99, 255, 0.5); }

    /* Links */
    a { color: var(--color-primary); text-decoration: none; font-weight: 600; transition: all 0.3s ease; }
    a:hover { color: var(--text-dark); text-shadow: 0 0 8px var(--color-accent); }
`;

function bgLayerHTML(bgUrl) {
    if (bgUrl) {
        return `<div class="bg-layer" style="background-image:url('${bgUrl}')"></div>`;
    }
    return `<div class="bg-layer bg-gradient"></div>
    <div class="bg-orb bg-orb-1"></div>
    <div class="bg-orb bg-orb-2"></div>
    <div class="bg-orb bg-orb-3"></div>`;
}

// ===========================
// Page Templates
// ===========================

function uploadPage(env) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    ${pageMeta(env.PAGE_TITLE || "Temporary File Sharing", env)}
    <style>
        ${sharedCSS}
        .glass-card { background: rgba(${env.HOME_PAGE_FORM_COLOR || "255, 255, 255"}, 0.82); }

        /* Drop Zone */
        .drop-zone {
            border: 2px dashed rgba(108, 99, 255, 0.35);
            border-radius: 16px; padding: clamp(25px, 4vh, 40px) 20px;
            text-align: center; cursor: pointer;
            transition: all 0.4s var(--bounce);
            background: rgba(108, 99, 255, 0.03);
            position: relative; overflow: hidden;
        }
        .drop-zone:hover, .drop-zone.drag-over {
            border-color: var(--color-primary);
            background: rgba(108, 99, 255, 0.08);
            transform: scale(1.02);
        }
        .drop-zone-icon {
            font-size: 2.5rem; color: var(--color-primary);
            margin-bottom: 10px; opacity: 0.7;
            transition: all 0.3s ease;
        }
        .drop-zone:hover .drop-zone-icon { opacity: 1; transform: translateY(-3px); }
        .drop-zone-text {
            font-size: clamp(0.85rem, 3vw, 0.95rem);
            color: var(--text-muted); font-weight: 500;
        }

        /* Preview */
        .preview-media { max-width: 100%; max-height: 200px; border-radius: 12px; }
        .preview-icon { font-size: 3rem; color: var(--color-primary); opacity: 0.8; }
        .preview-name {
            font-size: 0.9rem; color: var(--text-dark);
            font-weight: 600; margin-top: 8px; word-break: break-all;
        }

        /* Loading */
        .loading-overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255, 255, 255, 0.85);
            display: flex; justify-content: center; align-items: center;
            z-index: 100; border-radius: 16px;
        }
        .spinner {
            width: 36px; height: 36px;
            border: 3px solid rgba(108, 99, 255, 0.15);
            border-top-color: var(--color-primary);
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <!-- Cinematic Entrance -->
    <div class="dip-white"></div>
    <div class="splash-overlay"></div>

    <!-- Background -->
    ${bgLayerHTML(env.HOME_PAGE_BACKGROUND)}

    <div class="body-wrapper">
        <div class="glass-card">
            <div class="logo-container">
                <img src="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}" alt="Logo">
            </div>

            <h1 class="card-title stagger-1">${env.PAGE_TITLE || "Temporary File Sharing"}</h1>
            <p class="card-subtitle stagger-2">Upload and share files securely</p>

            <form enctype="multipart/form-data" method="POST" action="/upload" id="uploadForm">
                <div class="stagger-3">
                    <div class="drop-zone" id="dropBox">
                        <input type="file" name="file" id="fileInput" style="display:none;">
                        <div id="previewContainer"></div>
                        <div class="loading-overlay" id="loadingOverlay" style="display:none;">
                            <div class="spinner"></div>
                        </div>
                        <div id="dragDropMessage">
                            <div class="drop-zone-icon"><i class="fas fa-cloud-arrow-up"></i></div>
                            <p class="drop-zone-text">Drag and drop a file here or click to choose</p>
                        </div>
                    </div>
                </div>
                <div class="stagger-4" style="margin-top: clamp(12px, 2vh, 20px);">
                    <button type="button" class="btn-gradient" onclick="uploadFile()">
                        <i class="fas fa-upload"></i> Upload File
                    </button>
                </div>
            </form>

            <p class="footer-text stagger-6">Powered by Yuuki0</p>
        </div>
    </div>

    <script>
        var dropBox = document.getElementById('dropBox');
        var fileInput = document.getElementById('fileInput');
        var previewContainer = document.getElementById('previewContainer');
        var dragDropMessage = document.getElementById('dragDropMessage');
        var loadingOverlay = document.getElementById('loadingOverlay');
        var uploading = false;

        dropBox.addEventListener('dragover', function(e) {
            if (!uploading) { e.preventDefault(); dropBox.classList.add('drag-over'); }
        });
        dropBox.addEventListener('dragleave', function(e) {
            if (!uploading) { e.preventDefault(); dropBox.classList.remove('drag-over'); }
        });
        dropBox.addEventListener('drop', function(e) {
            if (!uploading) {
                e.preventDefault(); dropBox.classList.remove('drag-over');
                var file = e.dataTransfer.files[0];
                fileInput.files = e.dataTransfer.files;
                previewFile(file);
            }
        });
        dropBox.addEventListener('click', function() {
            if (!uploading) fileInput.click();
        });
        fileInput.addEventListener('change', function() {
            if (!uploading) previewFile(fileInput.files[0]);
        });

        function previewFile(file) {
            previewContainer.innerHTML = '';
            if (!file) { dragDropMessage.style.display = 'block'; return; }
            loadingOverlay.style.display = 'none';
            dragDropMessage.style.display = 'none';

            if (file.type.startsWith('image/')) {
                var img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.classList.add('preview-media');
                previewContainer.appendChild(img);
            } else if (file.type.startsWith('video/')) {
                var video = document.createElement('video');
                video.src = URL.createObjectURL(file);
                video.classList.add('preview-media');
                video.controls = true;
                previewContainer.appendChild(video);
            } else if (file.type.startsWith('audio/')) {
                var audio = document.createElement('audio');
                audio.src = URL.createObjectURL(file);
                audio.controls = true;
                previewContainer.appendChild(audio);
            } else {
                var icon = document.createElement('i');
                var ext = file.name.split('.').pop().toLowerCase();
                var archives = ['zip','iso','tar','gz','rar','7z','xz','bz2','cab','lzh'];
                var execs = ['exe','apk','deb','rpm','msi','dmg','pkg','bat','sh','bin','app'];
                if (archives.indexOf(ext) > -1) {
                    icon.className = 'fas fa-file-zipper preview-icon';
                } else if (execs.indexOf(ext) > -1) {
                    icon.className = 'fas fa-gear preview-icon';
                } else {
                    icon.className = 'fas fa-file preview-icon';
                }
                previewContainer.appendChild(icon);
                var br = document.createElement('br');
                previewContainer.appendChild(br);
                var name = document.createElement('span');
                name.className = 'preview-name';
                name.textContent = file.name;
                previewContainer.appendChild(name);
            }
        }

        function uploadFile() {
            if (!uploading) {
                var file = fileInput.files[0];
                if (file) {
                    uploading = true;
                    loadingOverlay.style.display = 'flex';
                    dragDropMessage.style.display = 'none';
                    document.getElementById('uploadForm').submit();
                } else {
                    alert('Please select the file you want to upload.');
                }
            }
        }
    </script>
</body>
</html>
`;
}

function downloadPage(fileLink, fileName, env) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    ${pageMeta("File Shared", env)}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <style>
        ${sharedCSS}
        .glass-card { background: rgba(${env.UPLOAD_PAGE_FORM_COLOR || "255, 255, 255"}, 0.82); }

        .success-icon {
            font-size: 2.8rem; margin-bottom: 8px;
            background: linear-gradient(135deg, #00c853, #00D2FF);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .qr-wrapper {
            display: inline-block; padding: 12px;
            background: white; border-radius: 16px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
            transition: all 0.3s var(--bounce);
        }
        .qr-wrapper:hover { transform: scale(1.03); box-shadow: 0 12px 35px rgba(108, 99, 255, 0.15); }
        .section-label {
            font-size: clamp(0.85rem, 3vw, 0.95rem);
            color: var(--text-muted); font-weight: 500;
            margin-bottom: 10px;
        }
        .input-row {
            display: flex; width: 100%; border-radius: 12px;
            overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.06);
        }
        .link-input {
            flex: 1; padding: 12px 14px;
            background: rgba(255, 255, 255, 0.9);
            border: 2px solid rgba(108, 99, 255, 0.15);
            border-right: none; border-radius: 12px 0 0 12px;
            font-family: 'Inter', sans-serif; font-size: 0.85rem;
            color: var(--text-dark); outline: none;
            transition: all 0.3s ease;
        }
        .link-input:focus { border-color: var(--color-primary); }
        .copy-btn {
            padding: 12px 18px;
            background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
            border: none; border-radius: 0 12px 12px 0;
            color: white; font-weight: 700; font-family: 'Inter', sans-serif;
            cursor: pointer; transition: all 0.3s ease;
            white-space: nowrap; font-size: 0.85rem;
        }
        .copy-btn:hover { filter: brightness(1.1); }
        .copy-btn.copied { background: linear-gradient(135deg, #00c853, #00D2FF); }
        .file-name-badge {
            display: inline-block; padding: 8px 16px;
            background: rgba(108, 99, 255, 0.08);
            border-radius: 10px; font-size: 0.9rem;
            font-weight: 600; color: var(--text-dark);
            word-break: break-all; margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="dip-white"></div>
    <div class="splash-overlay" style="background: rgba(0, 200, 83, 0.3);"></div>
    ${bgLayerHTML(env.UPLOAD_PAGE_BACKGROUND)}

    <div class="body-wrapper">
        <div class="glass-card">
            <div class="logo-container">
                <img src="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}" alt="Logo">
            </div>

            <div class="stagger-1" style="text-align:center;">
                <div class="success-icon"><i class="fas fa-circle-check"></i></div>
            </div>
            <h1 class="card-title stagger-1">Upload Successful!</h1>
            <p class="card-subtitle stagger-2">Your file is ready to be shared</p>

            <div class="stagger-2" style="text-align:center; margin-bottom: 5px;">
                <div class="file-name-badge"><i class="fas fa-file" style="margin-right:6px; opacity:0.6;"></i>${fileName}</div>
            </div>

            <div class="stagger-3" style="text-align:center; margin-bottom: clamp(12px, 2vh, 20px);">
                <p class="section-label">Scan QR Code to download</p>
                <div class="qr-wrapper"><div id="qrcode"></div></div>
            </div>

            <div class="stagger-4" style="margin-bottom: clamp(12px, 2vh, 20px);">
                <p class="section-label">Or copy the download link</p>
                <div class="input-row">
                    <input type="text" value="${fileLink}" id="fileLink" class="link-input" readonly>
                    <button onclick="copyLink()" class="copy-btn" id="copyBtn">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
            </div>

            <div class="stagger-5">
                <a href="${fileLink}" class="btn-gradient" style="text-align:center;">
                    <i class="fas fa-download"></i> Download File
                </a>
            </div>

            <p class="footer-text stagger-6">
                <i class="fas fa-triangle-exclamation" style="color:#ffb347; margin-right:4px;"></i>
                This is a one-time download. File will be deleted after download.
            </p>
        </div>
    </div>

    <script>
        function copyLink() {
            var input = document.getElementById("fileLink");
            var btn = document.getElementById("copyBtn");
            input.select(); input.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(input.value).then(function() {
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                btn.classList.add('copied');
                setTimeout(function() {
                    btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                    btn.classList.remove('copied');
                }, 2000);
            }).catch(function() {
                document.execCommand("copy");
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(function() { btn.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 2000);
            });
        }
        new QRCode(document.getElementById("qrcode"), {
            text: "${fileLink}",
            width: 200, height: 200,
            colorDark: "#1e2a3a", colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
    </script>
</body>
</html>
    `;
}

function notFoundFile(env) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    ${pageMeta("File Not Found", env)}
    <style>
        ${sharedCSS}
        .glass-card { background: rgba(${env.ERROR_404_FILE_FORM_COLOR || "255, 255, 255"}, 0.82); }
        .icon-wrap {
            font-size: 3rem; margin-bottom: 10px;
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text;
        }
    </style>
</head>
<body>
    <div class="dip-white"></div>
    <div class="splash-overlay" style="background: rgba(255, 100, 100, 0.3);"></div>
    ${bgLayerHTML(env.ERROR_404_FILE_BACKGROUND)}

    <div class="body-wrapper">
        <div class="glass-card" style="text-align:center;">
            <div class="logo-container">
                <img src="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}" alt="Logo">
            </div>
            <div class="stagger-1"><div class="error-code">404</div></div>
            <h1 class="card-title stagger-1">File Not Found</h1>
            <p class="card-subtitle stagger-2">The requested file was not found or the URL has expired.</p>
            <div class="stagger-3">
                <a href="/" class="btn-gradient" style="text-align:center;">
                    <i class="fas fa-arrow-left"></i> Return to Upload
                </a>
            </div>
            <p class="footer-text stagger-6">Powered by Yuuki0</p>
        </div>
    </div>
</body>
</html>
    `;
}

function expired(env) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    ${pageMeta("File Expired", env)}
    <style>
        ${sharedCSS}
        .glass-card { background: rgba(${env.EXPIRED_PAGE_FORM_COLOR || "255, 255, 255"}, 0.82); }
        .icon-wrap {
            font-size: 3rem; margin-bottom: 10px;
            background: linear-gradient(135deg, #ffb347, #ff6b6b);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text;
        }
    </style>
</head>
<body>
    <div class="dip-white"></div>
    <div class="splash-overlay" style="background: rgba(255, 179, 71, 0.3);"></div>
    ${bgLayerHTML(env.EXPIRED_PAGE_BACKGROUND)}

    <div class="body-wrapper">
        <div class="glass-card" style="text-align:center;">
            <div class="logo-container">
                <img src="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}" alt="Logo">
            </div>
            <div class="stagger-1"><div class="icon-wrap"><i class="fas fa-hourglass-end"></i></div></div>
            <h1 class="card-title stagger-1">File Expired</h1>
            <p class="card-subtitle stagger-2">The requested file has expired or already been downloaded.</p>
            <div class="stagger-3">
                <a href="/" class="btn-gradient" style="text-align:center;">
                    <i class="fas fa-arrow-left"></i> Return to Upload
                </a>
            </div>
            <p class="footer-text stagger-6">Powered by Yuuki0</p>
        </div>
    </div>
</body>
</html>
    `;
}

function errorPage(env) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    ${pageMeta("Unexpected Error", env)}
    <style>
        ${sharedCSS}
        .glass-card { background: rgba(${env.ERROR_501_UPLOAD_FORM_COLOR || "255, 255, 255"}, 0.82); }
        .icon-wrap {
            font-size: 3rem; margin-bottom: 10px;
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .error-list {
            text-align: left; padding: 0; margin: 0 0 15px 0;
            list-style: none;
        }
        .error-list li {
            padding: 8px 12px; margin-bottom: 6px;
            background: rgba(108, 99, 255, 0.05);
            border-radius: 10px; font-size: 0.85rem;
            color: var(--text-dark); font-weight: 500;
            display: flex; align-items: flex-start; gap: 8px;
        }
        .error-list li i { color: var(--color-primary); margin-top: 2px; flex-shrink: 0; }
        .error-list li a {
            color: var(--color-primary); text-decoration: underline;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="dip-white"></div>
    <div class="splash-overlay" style="background: rgba(255, 100, 100, 0.3);"></div>
    ${bgLayerHTML(env.ERROR_501_UPLOAD_BACKGROUND)}

    <div class="body-wrapper">
        <div class="glass-card" style="text-align:center;">
            <div class="logo-container">
                <img src="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}" alt="Logo">
            </div>
            <div class="stagger-1"><div class="icon-wrap"><i class="fas fa-triangle-exclamation"></i></div></div>
            <h1 class="card-title stagger-1">Unexpected Error</h1>
            <p class="card-subtitle stagger-2">Error when uploading files. Don't panic!</p>

            <div class="stagger-3">
                <ul class="error-list">
                    <li><i class="fas fa-bolt"></i><span>Cloudflare Worker cold start (<a href="https://blog.cloudflare.com/eliminating-cold-starts-with-cloudflare-workers/" target="_blank">Learn more</a>)</span></li>
                    <li><i class="fas fa-gauge-high"></i><span>Worker API request limitations (<a href="https://developers.cloudflare.com/workers/platform/limits/" target="_blank">Learn more</a>)</span></li>
                    <li><i class="fas fa-clock"></i><span>Google Drive API request timeout</span></li>
                </ul>
            </div>

            <div class="stagger-4" style="margin-bottom: 12px;">
                <p style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">Auto reload in</p>
                <div class="countdown-num" id="countdown">5</div>
            </div>

            <div class="stagger-5">
                <button onclick="location.reload();" class="btn-gradient">
                    <i class="fas fa-rotate-right"></i> Reload Now
                </button>
            </div>
            <p class="footer-text stagger-6">Powered by Yuuki0</p>
        </div>
    </div>

    <script>
        (function() {
            var count = 5;
            var el = document.getElementById("countdown");
            var timer = setInterval(function() {
                count--;
                el.textContent = count;
                if (count <= 0) { clearInterval(timer); location.reload(); }
            }, 1000);
        })();
    </script>
</body>
</html>
    `;
}

function errordownloadPage(env) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    ${pageMeta("Download Error", env)}
    <style>
        ${sharedCSS}
        .glass-card { background: rgba(${env.ERROR_501_DOWNLOAD_FORM_COLOR || "255, 255, 255"}, 0.82); }
        .icon-wrap {
            font-size: 3rem; margin-bottom: 10px;
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .error-list {
            text-align: left; padding: 0; margin: 0 0 15px 0;
            list-style: none;
        }
        .error-list li {
            padding: 8px 12px; margin-bottom: 6px;
            background: rgba(108, 99, 255, 0.05);
            border-radius: 10px; font-size: 0.85rem;
            color: var(--text-dark); font-weight: 500;
            display: flex; align-items: flex-start; gap: 8px;
        }
        .error-list li i { color: var(--color-primary); margin-top: 2px; flex-shrink: 0; }
        .error-list li a {
            color: var(--color-primary); text-decoration: underline;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="dip-white"></div>
    <div class="splash-overlay" style="background: rgba(255, 100, 100, 0.3);"></div>
    ${bgLayerHTML(env.ERROR_501_DOWNLOAD_BACKGROUND)}

    <div class="body-wrapper">
        <div class="glass-card" style="text-align:center;">
            <div class="logo-container">
                <img src="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}" alt="Logo">
            </div>
            <div class="stagger-1"><div class="icon-wrap"><i class="fas fa-triangle-exclamation"></i></div></div>
            <h1 class="card-title stagger-1">Download Error</h1>
            <p class="card-subtitle stagger-2">Error when downloading file. Don't panic!</p>

            <div class="stagger-3">
                <ul class="error-list">
                    <li><i class="fas fa-bolt"></i><span>Cloudflare Worker cold start (<a href="https://blog.cloudflare.com/eliminating-cold-starts-with-cloudflare-workers/" target="_blank">Learn more</a>)</span></li>
                    <li><i class="fas fa-gauge-high"></i><span>Worker API request limitations (<a href="https://developers.cloudflare.com/workers/platform/limits/" target="_blank">Learn more</a>)</span></li>
                    <li><i class="fas fa-clock"></i><span>Google Drive API request timeout</span></li>
                </ul>
            </div>

            <div class="stagger-4" style="margin-bottom: 12px;">
                <p style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">Auto reload in</p>
                <div class="countdown-num" id="countdown">5</div>
            </div>

            <div class="stagger-5">
                <button onclick="location.reload();" class="btn-gradient">
                    <i class="fas fa-rotate-right"></i> Reload Now
                </button>
            </div>
            <p class="footer-text stagger-6">Powered by Yuuki0</p>
        </div>
    </div>

    <script>
        (function() {
            var count = 5;
            var el = document.getElementById("countdown");
            var timer = setInterval(function() {
                count--;
                el.textContent = count;
                if (count <= 0) { clearInterval(timer); location.reload(); }
            }, 1000);
        })();
    </script>
</body>
</html>
    `;
}

function notFoundPage(env) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    ${pageMeta("Page Not Found", env)}
    <style>
        ${sharedCSS}
        .glass-card { background: rgba(${env.ERROR_404_PAGE_FORM_COLOR || "255, 255, 255"}, 0.82); }
    </style>
</head>
<body>
    <div class="dip-white"></div>
    <div class="splash-overlay" style="background: rgba(255, 100, 100, 0.3);"></div>
    ${bgLayerHTML(env.ERROR_404_PAGE_BACKGROUND)}

    <div class="body-wrapper">
        <div class="glass-card" style="text-align:center;">
            <div class="logo-container">
                <img src="${env.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}" alt="Logo">
            </div>
            <div class="stagger-1"><div class="error-code">404</div></div>
            <h1 class="card-title stagger-1">Page Not Found</h1>
            <p class="card-subtitle stagger-2">The requested page does not exist.</p>

            <div class="stagger-3" style="margin-bottom: 12px;">
                <p style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">Auto redirecting in</p>
                <div class="countdown-num" id="countdown">5</div>
            </div>

            <div class="stagger-4">
                <a href="/" class="btn-gradient" style="text-align:center;">
                    <i class="fas fa-house"></i> Go to Main Page
                </a>
            </div>
            <p class="footer-text stagger-6">Powered by Yuuki0</p>
        </div>
    </div>

    <script>
        (function() {
            var count = 5;
            var el = document.getElementById("countdown");
            var timer = setInterval(function() {
                count--;
                el.textContent = count;
                if (count <= 0) { clearInterval(timer); window.location.href = '/'; }
            }, 1000);
        })();
    </script>
</body>
</html>
    `;
}
