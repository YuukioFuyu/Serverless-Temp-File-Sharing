// Start Main Configuration
const config = {
// Google API Config
GOOGLE_CLIENT_ID: "", // Required | It looks like => (1234567890.apps.googleusercontent.com)
GOOGLE_CLIENT_SECRET: "", // Required | Random code of upper and lower case letters, numbers and symbols
GOOGLE_REFRESH_TOKEN: "", // Required | Random code of upper and lower case letters, numbers, and symbols with the prefix 1/
DESTINATION_FOLDER_ID: "", // Required | Find this in the URL when you open your Google Drive Folder

// Site Config
PAGE_TITLE: "", // Optional
PAGE_LOGO: "", // Optional
META_TITLE: "", // Optional
META_DESCRIPTION: "", // Optional
META_KEYWORD: "", // Example => aweasome, myapp, best-app-ever
META_URL: "", // Example => your.domain.com

// Style and Theme Color
HOME_PAGE_FORM_COLOR: "", // Default => 0,0,0
UPLOAD_PAGE_FORM_COLOR: "", // Default => 0,0,0
EXPIRED_PAGE_FORM_COLOR: "", // Default => 0,0,0
ERROR_404_PAGE_FORM_COLOR: "", // Default => 0,0,0
ERROR_404_FILE_FORM_COLOR: "", // Default => 0,0,0
ERROR_501_UPLOAD_FORM_COLOR: "", // Default => 0,0,0
ERROR_501_DOWNLOAD_FORM_COLOR: "", // Default => 0,0,0

// Background URL
HOME_PAGE_BACKGROUND: "", // Default => None
UPLOAD_PAGE_BACKGROUND: "", // Default => None
EXPIRED_PAGE_BACKGROUND: "", // Default => None
ERROR_404_PAGE_BACKGROUND: "", // Default => None
ERROR_404_FILE_BACKGROUND: "", // Default => None
ERROR_501_UPLOAD_BACKGROUND: "", // Default => None
ERROR_501_DOWNLOAD_BACKGROUND: "", // Default => None
// End of Main Configuration
};
// Begin Script
addEventListener('fetch', (event) => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const host = request.headers.get("host");

    if (url.pathname === "/") {
        return new Response(uploadPage, {
            headers: { 'content-type': 'text/html' },
        });
    } else if (url.pathname === "/result") {
        const fileId = url.searchParams.get("id");
        const fileName = url.searchParams.get("name");
  
        // Check if the file exists in Google Drive
        const fileExists = await checkFileExists(fileId);
  
        if (fileExists) {
            const encodedFileName = decodeURIComponent(fileName);
            const fileLink = `https://${host}/download?id=${fileId}&name=${encodeURIComponent(encodedFileName)}`;
            return new Response(downloadPage(fileLink, encodedFileName), {
                headers: { 'content-type': 'text/html' },
            });
        } else {
            return new Response(notFoundFile(), {
                status: 404,
                headers: { 'content-type': 'text/html' },
            });
        }
    } else if (url.pathname === "/download") {
        const fileId = url.searchParams.get("id");
        const fileName = url.searchParams.get("name");
        const encodedFileName = decodeURIComponent(fileName);
  
        const file = await downloadFile(fileId);
  
        if (file) {
            // Delete the file from Google Drive after downloading
            const deleted = await deleteFile(fileId);
            if (deleted) {
                return new Response(file, {
                    headers: {
                        "content-type": "application/octet-stream",
                        "content-disposition": `attachment; filename="${encodedFileName}"`,
                    },
                });
            } else {
                return new Response(errordownloadPage(), {
                    status: 500,
                    headers: { 'content-type': 'text/html' },
                });
            }
        } else {
            return new Response(expired(), {
                status: 404,
                headers: { 'content-type': 'text/html' },
            });
        }
    } else if (url.pathname === "/upload" && request.method === "POST") {
        try {
            const formData = await request.formData();
            const file = formData.get("file");
            const fileName = file.name;
  
            // Upload file to Google Drive and get file ID
            const fileId = await uploadFileToDrive(file);
  
            if (fileId) {
                const redirectUrl = `https://${host}/result?id=${fileId}&name=${encodeURIComponent(fileName)}`;
                return Response.redirect(redirectUrl);
            } else {
                return new Response(errorPage(), {
                    status: 500,
                    headers: { 'content-type': 'text/html' },
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
  
    return new Response(notFoundPage(), {
        status: 404,
        headers: { 'content-type': 'text/html' },
    });
}
  
  async function uploadFileToDrive(file) {
    const accessToken = await getAccessToken();
    const metadata = {
        name: file.name,
        mimeType: file.type,
        parents: [config.DESTINATION_FOLDER_ID],
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
  
  async function downloadFile(fileId) {
    const accessToken = await getAccessToken();
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
  
  async function deleteFile(fileId) {
    const accessToken = await getAccessToken();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
  
    return response.ok;
  }
  
  async function checkFileExists(fileId) {
    const accessToken = await getAccessToken();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
  
    return response.ok;
  }
  
  async function getAccessToken() {
    const tokenResponse = await fetch("https://www.googleapis.com/oauth2/v4/token", {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: config.GOOGLE_CLIENT_ID,
            client_secret: config.GOOGLE_CLIENT_SECRET,
            refresh_token: config.GOOGLE_REFRESH_TOKEN,
            grant_type: "refresh_token",
        }),
    });
  
    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  }
  
  const uploadPage = `
  <!DOCTYPE html>
  <html>
  <head>
      <title>${config.PAGE_TITLE || "Yuuki0 Temporary File Sharing"}</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
      <meta name="description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
      <meta name="theme-color" content="#FF3300">
      <meta name="application-name" content="YTemp Sharing">
      <meta name="robots" content="index, follow">
      <meta name="twitter:card" content="summary">
      <meta name="twitter:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
      <meta name="twitter:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
      <meta name="keywords" content="${config.META_KEYWORD || "YTemp Sharing, google, drive, YTemp Sharing, gdtemp, classic, material, workers-script, oauth-consent-screen, google-drive, cloudflare-workers, themes"}">
      <meta name="twitter:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
      <meta name="twitter:url" content="${config.META_URL || "https://yuuki0.net"}">
      <link rel="shortcut icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
      <meta property="og:site_name" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
      <meta property="og:type" content="website">
      <meta property="og:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
      <meta property="og:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
      <meta property="og:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
      <meta property="og:url" content="${config.META_URL || "https://yuuki0.net"}">
      <link rel="apple-touch-icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
      <link rel="icon" type="image/png" sizes="32x32" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
      <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css">
      <style>
          body {
              background-image: url('${config.HOME_PAGE_BACKGROUND}');
              background-size: cover;
              background-position: center;
              background-repeat: no-repeat;
              height: 100vh;
              margin: 0;
              display: flex;
              justify-content: center;
              align-items: center;
          }
  
          .logo {
              text-align: center;
              margin-bottom: 20px;
          }

          .logo img {
              max-width: 35%;
              height: auto;
              display: block;
              margin: 0 auto;
          }

          .glass-effect {
              background-color: rgba(${config.HOME_PAGE_FORM_COLOR || "0, 0, 0"}, 0.5);
              backdrop-filter: blur(10px);
              border-radius: 10px;
              padding: 20px;
              color: white;
          }
  
          .drop-box {
              border: 2px dashed #ccc;
              padding: 20px;
              text-align: center;
              cursor: pointer;
              position: relative;
            }
    
          .preview-media {
              max-width: 100%;
              max-height: 200px;
          }
    
          .loading-overlay {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-color: rgba(255, 255, 255, 0.8);
              display: flex;
              justify-content: center;
              align-items: center;
              z-index: 1000;
          }
      </style>
  </head>
  <body>
      <div class="glass-effect">
          <div class="container">
            <div class="logo">
               <img src="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}" alt="Logo">
            </div>
              <h1 class="text-center">${config.PAGE_TITLE || "Temporary File Sharing"}</h1>
              <form enctype="multipart/form-data" method="POST" action="/upload" class="mt-3" id="uploadForm">
                  <div class="form-group col-md-12 mt-5">
                      <div class="drop-box position-relative" id="dropBox">
                          <input type="file" name="file" id="fileInput" style="display: none;">
                          <div id="previewContainer"></div>
                          <div class="loading-overlay" id="loadingOverlay" style="display: none;">
                              <div class="spinner-border text-primary" role="status">
                                  <span class="sr-only">Loading...</span>
                              </div>
                          </div>
                          <br>
                          <p id="dragDropMessage">Drag and drop a file here or click to choose a file</p>
                      </div>
                  </div>
                  <button type="button" class="btn btn-primary btn-block" onclick="uploadFile()">Upload File</button>
              </form>
          </div>
      </div>
      <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.3/dist/umd/popper.min.js"></script>
      <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
      <script>
          const dropBox = document.getElementById('dropBox');
          const fileInput = document.getElementById('fileInput');
          const previewContainer = document.getElementById('previewContainer');
          const dragDropMessage = document.getElementById('dragDropMessage');
          const loadingOverlay = document.getElementById('loadingOverlay');
          let uploading = false; // Flag to track upload status
  
          dropBox.addEventListener('dragover', (e) => {
              if (!uploading) {
                  e.preventDefault();
                  dropBox.style.border = '2px dashed #333';
              }
          });
  
          dropBox.addEventListener('dragleave', (e) => {
              if (!uploading) {
                  e.preventDefault();
                  dropBox.style.border = '2px dashed #ccc';
              }
          });
  
          dropBox.addEventListener('drop', (e) => {
            if (!uploading) {
                e.preventDefault();
                dropBox.style.border = '2px dashed #ccc';
                const file = e.dataTransfer.files[0];
                fileInput.files = e.dataTransfer.files; // Set the file input's files directly
                previewFile(file);
            }
          });
  
          dropBox.addEventListener('click', () => {
              if (!uploading) {
                  fileInput.click();
              }
          });
  
          fileInput.addEventListener('change', () => {
              if (!uploading) {
                  const file = fileInput.files[0];
                  previewFile(file);
              }
          });
  
          function previewFile(file) {
              previewContainer.innerHTML = '';
  
              if (file) {
                  loadingOverlay.style.display = 'none';
                  dragDropMessage.style.display = 'none';
  
                  if (file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(file);
                    img.classList.add('preview-media');
                    previewContainer.appendChild(img);
                } else if (file.type.startsWith('video/')) {
                    const video = document.createElement('video');
                    video.src = URL.createObjectURL(file);
                    video.classList.add('preview-media');
                    video.controls = true;
                    previewContainer.appendChild(video);
                } else if (file.type.startsWith('audio/')) {
                    const audio = document.createElement('audio');
                    audio.src = URL.createObjectURL(file);
                    audio.classList.add('preview-media');
                    audio.controls = true;
                    previewContainer.appendChild(audio);
                } else {
                    const icon = document.createElement('i');
                    if (file.name.endsWith('.zip') || file.name.endsWith('.iso') || file.name.endsWith('.tar') || file.name.endsWith('.gz') || file.name.endsWith('.rar') || file.name.endsWith('.7z') || file.name.endsWith('.xz') || file.name.endsWith('.bz2') || file.name.endsWith('.z') || file.name.endsWith('.rar5') || file.name.endsWith('.cab') || file.name.endsWith('.lzh') || file.name.endsWith('.arj') || file.name.endsWith('.arc')) {
                        icon.classList.add('fas', 'fa-file-archive', 'fa-5x', 'mr-2');
                    } else if (file.name.endsWith('.exe') || file.name.endsWith('.apk') || file.name.endsWith('.deb') || file.name.endsWith('.rpm') || file.name.endsWith('.msi') || file.name.endsWith('.dmg') || file.name.endsWith('.appx') || file.name.endsWith('.pkg') || file.name.endsWith('.zip') || file.name.endsWith('.jar') || file.name.endsWith('.ipa') || file.name.endsWith('.swf') || file.name.endsWith('.war') || file.name.endsWith('.ear') || file.name.endsWith('.xapk') || file.name.endsWith('.msp') || file.name.endsWith('.bat') || file.name.endsWith('.sh') || file.name.endsWith('.com') || file.name.endsWith('.bin') || file.name.endsWith('.elf') || file.name.endsWith('.app') || file.name.endsWith('.gem') || file.name.endsWith('.dapp')) {
                        icon.classList.add('fas', 'fa-cog', 'fa-5x', 'mr-2');
                    } else {
                        icon.classList.add('fas', 'fa-file', 'fa-5x', 'mr-2');
                    }
  
                    const fileName = document.createElement('span');
                    fileName.textContent = file.name;
  
                    const br = document.createElement('br');
                    previewContainer.appendChild(icon);
                    previewContainer.appendChild(br);
                    previewContainer.appendChild(fileName);
                }
              } else {
                  loadingOverlay.style.display = 'none';
                  dragDropMessage.style.display = 'block';
              }
          }
  
          function uploadFile() {
              if (!uploading) {
                  const file = fileInput.files[0];
                  if (file) {
                      uploading = true;
                      const form = document.getElementById('uploadForm');
                      const formData = new FormData(form);
  
                      loadingOverlay.style.display = 'flex';
                      dragDropMessage.style.display = 'none';
  
                      form.submit();
                  } else {
                      alert('Please select the file you want to upload.');
                  }
              }
          }
      </script>
  </body>
  </html>
`;

  function downloadPage(fileLink, fileName) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>File Shared</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
        <meta name="description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta name="theme-color" content="#FF3300">
        <meta name="application-name" content="YTemp Sharing">
        <meta name="robots" content="index, follow">
        <meta name="twitter:card" content="summary">
        <meta name="twitter:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta name="twitter:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta name="keywords" content="${config.META_KEYWORD || "YTemp Sharing, google, drive, YTemp Sharing, gdtemp, classic, material, workers-script, oauth-consent-screen, google-drive, cloudflare-workers, themes" || "YTemp Sharing, google, drive, YTemp Sharing, gdtemp, classic, material, workers-script, oauth-consent-screen, google-drive, cloudflare-workers, themes"}">
        <meta name="twitter:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta name="twitter:url" content="${config.META_URL || "https://yuuki0.net"}">
        <link rel="shortcut icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta property="og:site_name" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta property="og:type" content="website">
        <meta property="og:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta property="og:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta property="og:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta property="og:url" content="${config.META_URL || "https://yuuki0.net"}">
        <link rel="apple-touch-icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <link rel="icon" type="image/png" sizes="32x32" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <script src="https://cdn.rawgit.com/davidshimjs/qrcodejs/gh-pages/qrcode.min.js"></script>
        <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
        <style>
            body {
                background-image: url('${config.UPLOAD_PAGE_BACKGROUND}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                height: 100vh;
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
            }
    
            .glass-effect {
                background-color: rgba(${config.UPLOAD_PAGE_FORM_COLOR || "0, 0, 0"}, 0.5);
                backdrop-filter: blur(10px);
                border-radius: 10px;
                padding: 20px;
                color: white;
            }
            
            .qr-code {
            	border: 10px solid white;
            	border-radius: 10px;
            	padding: 0px;
            	background-color: rgba(${config.ERROR_404_PAGE_FORM_COLOR || "0, 0, 0"}, 0.5);
            	display: inline-block;
        	}
        </style>
    </head>
    <body>
        <div class="glass-effect">
            <div class="container">
                <h1 class="text-center">File Uploaded Successfully</h1>
                <!-- Disable Download Button
                <div class="row justify-content-center mt-5">
                    <div class="col-md-12">
                        <p class="text-center">Click the button below to download the file!</p>
                        <a href="${config.fileLink}" class="btn btn-primary btn-block">Download File</a>
                    </div>
                </div>
                -->
                <div class="row justify-content-center mt-4">
                    <div class="col-md-12 text-center">
                        <p class="text-center">Scan the QR code below to download the file!</p>
                        <div class="qr-code row justify-content-center" id="qrcode"></div>
                    </div>
                </div>
                <div class="row justify-content-center mt-4">
                    <div class="col-md-12">
                        <p class="text-center">Or copy the link below!</p>
                        <div class="input-group">
                            <input type="text" value="${config.fileLink}" id="fileLink" class="form-control" readonly>
                            <div class="input-group-append">
                                <button onclick="copyLink()" class="btn btn-secondary">Copy</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.3/dist/umd/popper.min.js"></script>
        <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
        <script>
            function copyLink() {
                var copyText = document.getElementById("fileLink");
                copyText.select();
                document.execCommand("copy");
                alert("Link copied to clipboard: " + copyText.value);
            }
    
            var qrcode = new QRCode(document.getElementById("qrcode"), {
                text: "${config.fileLink}",
                width: 256,
                height: 256,
            });
        </script>
    </body>
    </html> 
    `;
  }
  
  function notFoundFile() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>File Not Found</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
        <meta name="description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta name="theme-color" content="#FF3300">
        <meta name="application-name" content="YTemp Sharing">
        <meta name="robots" content="index, follow">
        <meta name="twitter:card" content="summary">
        <meta name="twitter:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta name="twitter:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta name="keywords" content="${config.META_KEYWORD || "YTemp Sharing, google, drive, YTemp Sharing, gdtemp, classic, material, workers-script, oauth-consent-screen, google-drive, cloudflare-workers, themes"}">
        <meta name="twitter:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta name="twitter:url" content="${config.META_URL || "https://yuuki0.net"}">
        <link rel="shortcut icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta property="og:site_name" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta property="og:type" content="website">
        <meta property="og:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta property="og:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta property="og:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta property="og:url" content="${config.META_URL || "https://yuuki0.net"}">
        <link rel="apple-touch-icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <link rel="icon" type="image/png" sizes="32x32" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
        <style>
            body {
                background-image: url('${config.ERROR_404_FILE_BACKGROUND}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                height: 100vh;
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
            }
    
            .glass-effect {
                background-color: rgba(${config.ERROR_404_FILE_FORM_COLOR || "0, 0, 0"}, 0.5);
                backdrop-filter: blur(10px);
                border-radius: 10px;
                padding: 20px;
                color: white;
            }
    
            .error-code {
                font-size: 100px;
                font-weight: bolder;
            }
        </style>
    </head>
    <body>
        <div class="glass-effect">
            <div class="container">
                <h1 class="error-code text-center">404</h1>
                <h1 class="text-center">File Not Found</h1>
                <p class="text-center">The requested file was not found or the URL has expired.</p>
                <div class="text-center mt-5">
                    <a href="/" class="btn btn-primary">Return to Upload Page</a>
                </div>
            </div>
        </div>
    </body>
    </html>    
    `;
  }

  function expired() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>File Expired</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
        <meta name="description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta name="theme-color" content="#FF3300">
        <meta name="application-name" content="YTemp Sharing">
        <meta name="robots" content="index, follow">
        <meta name="twitter:card" content="summary">
        <meta name="twitter:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta name="twitter:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta name="keywords" content="${config.META_KEYWORD || "YTemp Sharing, google, drive, YTemp Sharing, gdtemp, classic, material, workers-script, oauth-consent-screen, google-drive, cloudflare-workers, themes"}">
        <meta name="twitter:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta name="twitter:url" content="${config.META_URL || "https://yuuki0.net"}">
        <link rel="shortcut icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta property="og:site_name" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta property="og:type" content="website">
        <meta property="og:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta property="og:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta property="og:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta property="og:url" content="${config.META_URL || "https://yuuki0.net"}">
        <link rel="apple-touch-icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <link rel="icon" type="image/png" sizes="32x32" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
        <style>
            body {
                background-image: url('${config.EXPIRED_PAGE_BACKGROUND}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                height: 100vh;
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
            }
    
            .glass-effect {
                background-color: rgba(${config.EXPIRED_PAGE_FORM_COLOR || "0, 0, 0"}, 0.5);
                backdrop-filter: blur(10px);
                border-radius: 10px;
                padding: 20px;
                color: white;
            }
        </style>
    </head>
    <body>
        <div class="glass-effect">
            <div class="container">
                <h1 class="text-center">File Expired</h1>
                <p class="text-center">The requested file has expired.</p>
                <div class="text-center mt-5">
                    <a href="/" class="btn btn-primary">Return to Upload Page</a>
                </div>
            </div>
        </div>
    </body>
    </html>    
    `;
  }

  function errorPage() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Unexpected Error</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
        <meta name="description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta name="theme-color" content="#FF3300">
        <meta name="application-name" content="YTemp Sharing">
        <meta name="robots" content="index, follow">
        <meta name="twitter:card" content="summary">
        <meta name="twitter:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta name="twitter:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta name="keywords" content="${config.META_KEYWORD || "YTemp Sharing, google, drive, YTemp Sharing, gdtemp, classic, material, workers-script, oauth-consent-screen, google-drive, cloudflare-workers, themes"}">
        <meta name="twitter:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta name="twitter:url" content="${config.META_URL || "https://yuuki0.net"}">
        <link rel="shortcut icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta property="og:site_name" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta property="og:type" content="website">
        <meta property="og:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta property="og:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta property="og:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta property="og:url" content="${config.META_URL || "https://yuuki0.net"}">
        <link rel="apple-touch-icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <link rel="icon" type="image/png" sizes="32x32" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
        <style>
            body {
                background-image: url('${config.ERROR_501_UPLOAD_BACKGROUND}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                height: 100vh;
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
            }
    
            .glass-effect {
                background-color: rgba(${config.ERROR_501_UPLOAD_FORM_COLOR || "0, 0, 0"}, 0.5);
                backdrop-filter: blur(10px);
                border-radius: 10px;
                padding: 20px;
                color: white;
            }
            
            a {
                color: #3498db;
                font-weight: bolder;
            }
        </style>
        <script>
            // Function to refresh the page after a specified time
            function refreshPage(seconds) {
                setTimeout(function () {
                    location.reload();
                }, seconds * 1000);
            }
    
            // Function to display countdown and refresh the page
            function startCountdown(seconds) {
                var countdown = seconds;
                var countdownInterval = setInterval(function () {
                    document.getElementById("countdown").textContent = countdown;
                    countdown--;
    
                    if (countdown < 0) {
                        clearInterval(countdownInterval);
                        location.reload();
                    }
                }, 1000);
            }
    
            // Call the functions when the page loads
            document.addEventListener("DOMContentLoaded", function () {
                refreshPage(5);
                startCountdown(5);
            });
        </script>
    </head>
    <body>
        <div class="container glass-effect">
            <h1 class="text-center">Unexpected Error</h1>
            <p class="text-center">Error when uploading files, please reload this page.</p>
            <p class="text-center mt-5"><b>Don't Panic!</b> Errors may occur due to:</p>
            <ol>
                <li>Cloudflare Worker cold start (<a href="https://blog.cloudflare.com/eliminating-cold-starts-with-cloudflare-workers/" target="_blank">Learn more</a>)</li>
                <li>Cloudflare Worker API request limitations (<a href="https://developers.cloudflare.com/workers/platform/limits/" target="_blank">Learn more</a>)</li>
                <li>Forwarding file request to Google Drive API timeout</li>
            </ol>
            <div class="text-center">
                <b>Auto reload in:</b>
                <h1 id="countdown" class="mt-2">5</h1>
                <a href="#" class="mt-3 btn btn-primary" onclick="location.reload();">Reload</a>
            </div>
        </div>
    </body>
    </html>
    `;
  }
  
  function errordownloadPage() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Unexpected Error</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
        <meta name="description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta name="theme-color" content="#FF3300">
        <meta name="application-name" content="YTemp Sharing">
        <meta name="robots" content="index, follow">
        <meta name="twitter:card" content="summary">
        <meta name="twitter:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta name="twitter:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta name="keywords" content="${config.META_KEYWORD || "YTemp Sharing, google, drive, YTemp Sharing, gdtemp, classic, material, workers-script, oauth-consent-screen, google-drive, cloudflare-workers, themes"}">
        <meta name="twitter:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta name="twitter:url" content="${config.META_URL || "https://yuuki0.net"}">
        <link rel="shortcut icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta property="og:site_name" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta property="og:type" content="website">
        <meta property="og:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta property="og:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta property="og:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta property="og:url" content="${config.META_URL || "https://yuuki0.net"}">
        <link rel="apple-touch-icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <link rel="icon" type="image/png" sizes="32x32" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
        <style>
            body {
                background-image: url('${config.ERROR_501_DOWNLOAD_BACKGROUND}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                height: 100vh;
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
            }
    
            .glass-effect {
                background-color: rgba(${config.ERROR_501_DOWNLOAD_FORM_COLOR || "0, 0, 0"}, 0.5);
                backdrop-filter: blur(10px);
                border-radius: 10px;
                padding: 20px;
                color: white;
            }
            
            a {
                color: #3498db;
                font-weight: bolder;
            }
        </style>
        <script>
            // Function to refresh the page after a specified time
            function refreshPage(seconds) {
                setTimeout(function () {
                    location.reload();
                }, seconds * 1000);
            }
    
            // Function to display countdown and refresh the page
            function startCountdown(seconds) {
                var countdown = seconds;
                var countdownInterval = setInterval(function () {
                    document.getElementById("countdown").textContent = countdown;
                    countdown--;
    
                    if (countdown < 0) {
                        clearInterval(countdownInterval);
                        location.reload();
                    }
                }, 1000);
            }
    
            // Call the functions when the page loads
            document.addEventListener("DOMContentLoaded", function () {
                refreshPage(5);
                startCountdown(5);
            });
        </script>
    </head>
    <body>
        <div class="container glass-effect">
            <h1 class="text-center">Unexpected Error</h1>
            <p class="text-center">Error when downloading files, please reload this page.</p>
            <p class="text-center mt-5"><b>Don't Panic!</b> Errors may occur due to:</p>
            <ol>
                <li>Cloudflare Worker cold start (<a href="https://blog.cloudflare.com/eliminating-cold-starts-with-cloudflare-workers/" target="_blank">Learn more</a>)</li>
                <li>Cloudflare Worker API request limitations (<a href="https://developers.cloudflare.com/workers/platform/limits/" target="_blank">Learn more</a>)</li>
                <li>Forwarding file request to Google Drive API timeout</li>
            </ol>
            <div class="text-center">
                <b>Auto reload in:</b>
                <h1 id="countdown" class="mt-2">5</h1>
                <a href="#" class="mt-3 btn btn-primary" onclick="location.reload();">Reload</a>
            </div>
        </div>
    </body>
    </html>
    `;
  }
  
  function notFoundPage() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Page Not Found</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
        <meta name="description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta name="theme-color" content="#FF3300">
        <meta name="application-name" content="YTemp Sharing">
        <meta name="robots" content="index, follow">
        <meta name="twitter:card" content="summary">
        <meta name="twitter:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta name="twitter:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta name="keywords" content="${config.META_KEYWORD || "YTemp Sharing, google, drive, YTemp Sharing, gdtemp, classic, material, workers-script, oauth-consent-screen, google-drive, cloudflare-workers, themes"}">
        <meta name="twitter:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta name="twitter:url" content="${config.META_URL || "https://yuuki0.net"}">
        <link rel="shortcut icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta property="og:site_name" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta property="og:type" content="website">
        <meta property="og:image" content="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png"}">
        <meta property="og:description" content="${config.META_DESCRIPTION || "Yuuki0's temporary file sharing platform designed to provide a fast and secure way for users to upload and share files with others."}">
        <meta property="og:title" content="${config.META_TITLE || "Temporary File Sharing by Yuuki0"}">
        <meta property="og:url" content="${config.META_URL || "https://yuuki0.net"}">
        <link rel="apple-touch-icon" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png" || "https://yuuki0.net/assets/img/icon.png"}">
        <link rel="icon" type="image/png" sizes="32x32" href="${config.PAGE_LOGO || "https://yuuki0.net/assets/img/icon.png" || "https://yuuki0.net/assets/img/icon.png"}">
        <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
        <style>
            body {
                background-image: url('${config.ERROR_404_PAGE_BACKGROUND}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                height: 100vh;
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
            }
    
            .glass-effect {
                background-color: rgba(${config.ERROR_404_PAGE_FORM_COLOR || "0, 0, 0"}, 0.5);
                backdrop-filter: blur(10px);
                border-radius: 10px;
                padding: 20px;
                color: white;
            }
            
            .error-code {
                font-size: 100px;
                font-weight: bolder;
            }
            
            a {
                color: #3498db;
                font-weight: bolder;
            }
        </style>
        <script>
            // Function to refresh the page after a specified time
            function refreshPage(seconds) {
                setTimeout(function () {
                    location.reload();
                }, seconds * 1000);
            }
    
            // Function to display countdown and refresh the page
            function startCountdown(seconds) {
                var countdown = seconds;
                var countdownInterval = setInterval(function () {
                    document.getElementById("countdown").textContent = countdown;
                    countdown--;
    
                    if (countdown < 0) {
                        clearInterval(countdownInterval);
                        location.reload();
                    }
                }, 1000);
            }
    
            // Call the functions when the page loads
            document.addEventListener("DOMContentLoaded", function () {
                refreshPage(5);
                startCountdown(5);
            });
        </script>
    </head>
    <body>
        <div class="container glass-effect">
            <h1 class="error-code text-center">404</h1>
            <h1 class="text-center">File Not Found</h1>
            <p class="text-center">The requested page does not exist.</p>
            <div class="text-center">
                <b>Auto redirecting to main page in:</b>
                <h1 id="countdown" class="mt-2">5</h1>
                <a href="#" class="mt-3 btn btn-primary" onclick="location.reload();">Go to Main Page</a>
            </div>
        </div>
    </body>
    </html>
    `;
  }
