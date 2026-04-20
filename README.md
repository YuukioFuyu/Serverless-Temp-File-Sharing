<h2 align="center">Happy 78th Indonesian Independence Day</h2>
<p align="center" valign="top">
  <a href="https://en.wikipedia.org/wiki/Independence_Day_(Indonesia)"><img src="https://upload.wikimedia.org/wikipedia/commons/6/6f/78_RI_2023.svg" width="20%" alt="Indonesian Independence Day Image"/></a>
</p>
<h4 align="center">In honor of Indonesia's Independence Day, we present a special project that embodies the spirit of unity and progress.</h4>
<hr />

# Serverless Temporary File Sharing using Cloudflare Worker and Google Drive API
**Exploring Free and Unlimited Sharing Platforms**

Discover the world of streamlined and costless file sharing through our innovative Serverless Temporary File Sharing solution. Utilizing Cloudflare Worker and the Google Drive API, this platform empowers you to share files without constraints. Uploaded files find a home on Google Drive without an expiration date, ensuring they're available until you decide to download. Once downloaded, files are automatically removed, maintaining your drive's tidiness. Simplify cross-platform sharing with our built-in QR code generator. Experience efficient, worry-free, and secure file sharing at its best.

<hr>

<img width="auto" alt="Upload Page" src="https://github.com/user-attachments/assets/d9b54eff-af3e-488a-a68d-d8ffa08e0787" />
<img width="auto" alt="Download Page" src="https://github.com/user-attachments/assets/5ed6bcf5-f881-42b8-abf8-c88f3b823246" />

<hr>

# Getting Started

## Deploying `worker.js` from GitHub to Cloudflare Worker with Free Plan

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YuukioFuyu/Serverless-Temp-File-Sharing)

Click the button above to automatically deploy this project to your Cloudflare Workers account. During the deployment process, you will be prompted to enter the required **Secrets** and optional **Variables**.

<hr>

## Getting Google Drive API Credentials
1. **Create a Google Cloud Platform Project:**
   - Go to the Google Cloud Console: [https://console.cloud.google.com/](https://console.cloud.google.com/)
   - Create a new project or select an existing project.

2. **Enable the Google Drive API:**
   - In your Google Cloud Console project, navigate to the API Library.
   - Search for "Google Drive API" and enable it.

3. **Create OAuth 2.0 Credentials:**
   - In the Google Cloud Console, go to the "Credentials" section.
   - Click the "Create Credentials" button and select "OAuth client ID."
   - Choose "Web application" as the application type.
   - Provide a name for your OAuth 2.0 client ID.
   - Add the following redirect URIs:
     - `https://your-worker-subdomain.your-subdomain.workers.dev/_oauth`
     - `https://your-worker-subdomain.your-subdomain.workers.dev/oauth2callback`
     Replace `your-worker-subdomain` and `your-subdomain` with your actual Cloudflare Worker subdomain and domain.
   - Click "Create" to generate your OAuth 2.0 client ID and client secret.

4. **Obtain the Refresh Token:**
   - Use the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) to obtain the refresh token.
   - Click on the gear icon in the top right corner and check "Use your own OAuth credentials."
   - Enter your OAuth client ID and client secret created in the previous steps.
   - Scroll down and find "Drive API v3" in the list of APIs. Select the scope(s) you need.
   - Click the "Authorize APIs" button.
   - Follow the steps to authorize the Playground to access your Google Drive.
   - Once authorized, exchange the authorization code for tokens.
   - The refresh token will be included in the response. Make sure to note it down.

<hr>

## Configuring Variables and Secrets

After deployment, configure your worker's environment in the Cloudflare Dashboard:

**Workers & Pages → Your Worker → Settings → Variables and Secrets**

### Required Secrets
Set these as **Secret** type in the dashboard:

| Variable Name | Type | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Secret | Google OAuth 2.0 Client ID (e.g. `1234567890.apps.googleusercontent.com`) |
| `GOOGLE_CLIENT_SECRET` | Secret | Google OAuth 2.0 Client Secret |
| `GOOGLE_REFRESH_TOKEN` | Secret | Google OAuth 2.0 Refresh Token (prefix `1//`) |
| `DESTINATION_FOLDER_ID` | Secret | Google Drive Folder ID for uploaded files |

> **Destination Folder ID** can be found at the end of the Google Drive URL when you open one of your folders:
> `https://drive.google.com/drive/u/0/folders/`**YOUR_DESTINATION_FOLDER_ID**

### Optional Variables
Set these as **Text** type in the dashboard to customize the UI:

| Variable Name | Type | Description | Default |
|---|---|---|---|
| `PAGE_TITLE` | Text | Page title displayed on the header | `Temporary File Sharing` |
| `PAGE_LOGO` | Text | Logo image URL | Yuuki0 icon |
| `META_TITLE` | Text | SEO meta title | `Temporary File Sharing by Yuuki0` |
| `META_DESCRIPTION` | Text | SEO meta description | Default description |
| `META_KEYWORD` | Text | SEO keywords (comma-separated) | Default keywords |
| `META_URL` | Text | Your custom domain URL | `https://yuuki0.net` |
| `HOME_PAGE_FORM_COLOR` | Text | Upload page card color (RGB) | `255, 255, 255` |
| `UPLOAD_PAGE_FORM_COLOR` | Text | Result page card color (RGB) | `255, 255, 255` |
| `EXPIRED_PAGE_FORM_COLOR` | Text | Expired page card color (RGB) | `255, 255, 255` |
| `ERROR_404_PAGE_FORM_COLOR` | Text | 404 page card color (RGB) | `255, 255, 255` |
| `ERROR_404_FILE_FORM_COLOR` | Text | File not found card color (RGB) | `255, 255, 255` |
| `ERROR_501_UPLOAD_FORM_COLOR` | Text | Upload error card color (RGB) | `255, 255, 255` |
| `ERROR_501_DOWNLOAD_FORM_COLOR` | Text | Download error card color (RGB) | `255, 255, 255` |
| `HOME_PAGE_BACKGROUND` | Text | Upload page background image URL | Animated Gradient |
| `UPLOAD_PAGE_BACKGROUND` | Text | Result page background image URL | Animated Gradient |
| `EXPIRED_PAGE_BACKGROUND` | Text | Expired page background image URL | Animated Gradient |
| `ERROR_404_PAGE_BACKGROUND` | Text | 404 page background image URL | Animated Gradient |
| `ERROR_404_FILE_BACKGROUND` | Text | File not found background image URL | Animated Gradient |
| `ERROR_501_UPLOAD_BACKGROUND` | Text | Upload error background image URL | Animated Gradient |
| `ERROR_501_DOWNLOAD_BACKGROUND` | Text | Download error background image URL | Animated Gradient |

> [!TIP]
> You can also bulk-configure variables using **JSON** type in the dashboard. Copy and paste the JSON below, then modify the values as needed:
> ```json
> {
>   "PAGE_TITLE": "",
>   "PAGE_LOGO": "",
>   "META_TITLE": "",
>   "META_DESCRIPTION": "",
>   "META_KEYWORD": "",
>   "META_URL": "",
>   "HOME_PAGE_FORM_COLOR": "",
>   "UPLOAD_PAGE_FORM_COLOR": "",
>   "EXPIRED_PAGE_FORM_COLOR": "",
>   "ERROR_404_PAGE_FORM_COLOR": "",
>   "ERROR_404_FILE_FORM_COLOR": "",
>   "ERROR_501_UPLOAD_FORM_COLOR": "",
>   "ERROR_501_DOWNLOAD_FORM_COLOR": "",
>   "HOME_PAGE_BACKGROUND": "",
>   "UPLOAD_PAGE_BACKGROUND": "",
>   "EXPIRED_PAGE_BACKGROUND": "",
>   "ERROR_404_PAGE_BACKGROUND": "",
>   "ERROR_404_FILE_BACKGROUND": "",
>   "ERROR_501_UPLOAD_BACKGROUND": "",
>   "ERROR_501_DOWNLOAD_BACKGROUND": ""
> }
> ```

<hr>

## Configure Routes (Optional)

If you want to use a custom domain instead of the default `*.workers.dev` subdomain:

1. Go to the **Routes** section in the Cloudflare Workers dashboard.
2. Add a new route (e.g., `https://your-subdomain.your-domain.com/*`) and associate it with the deployed worker.

## Testing

Access the URL of your worker (e.g., `https://your-subdomain.your-domain.com/` or `https://your-worker.workers.dev/`) to test the deployed script.
