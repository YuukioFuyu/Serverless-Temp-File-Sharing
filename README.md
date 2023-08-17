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

![Yuuki0 Temporary File Sharing](https://github.com/YuukioFuyu/Serverless-Temp-File-Sharing/assets/79379934/c564b9c3-d89d-4d1d-9a5d-e8ead2696389)
![File Shared](https://github.com/YuukioFuyu/Serverless-Temp-File-Sharing/assets/79379934/6fcf20ed-dea5-4830-b7f2-5d6d4372c8d3)

<hr>

# Installation
## Getting Google Drive API Credentials for Cloudflare Worker Project
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

5. **Use the Credentials in Your Cloudflare Worker:**
   - Store the client ID, client secret, and refresh token securely as environment variables or secrets in your Cloudflare Worker.


## Deploying `worker.js` from GitHub to Cloudflare Worker with Free Plan
1. **Prerequisites:**
   - Make sure you have a Cloudflare account. If not, sign up at [https://www.cloudflare.com](https://www.cloudflare.com).

3. **Create a Cloudflare Worker:**
   - Log in to your Cloudflare account.
   - Go to the "Workers" section from the Cloudflare dashboard.
   - Click the "Create a Worker" button.

3. **Configure GitHub Repository:**
   - Fork the repository "Serverless-Temp-File-Sharing" on [Yuukio Fuyu Github Page](https://github.com/YuukioFuyu/Serverless-Temp-File-Sharing).
   - Go to your forked repository.
   - Navigate to the `worker.js` file in the repository.

4. **Modify the Script:**
   - Open the `worker.js` file in your forked repository.
   - Make any necessary configuration changes or adjustments as needed for your deployment.
   - Edit this object in the script with the details you generated above.
```
GOOGLE_CLIENT_ID: "",
GOOGLE_CLIENT_SECRET: "",
GOOGLE_REFRESH_TOKEN: "",
DESTINATION_FOLDER_ID: "",
```
> The Destination Folder ID can be found at the back of the Google Drive URL when you open one of your folders.
> Example: `https://drive.google.com/drive/u/0/folders/`[YOUR_DESTINATION_FOLDER_ID]

5. **Deploy to Cloudflare:**
   - Copy the content of the `worker.js` file in your forked repository.

7. **Create a New Cloudflare Worker:**
   - Go back to your Cloudflare Workers dashboard.
   - In the "Script" section, paste the content of the `worker.js` file.

7. **Deploy and Test:**
   - Click the "Save and Deploy" button to deploy the worker.
   - Once the deployment is successful, you'll receive a worker URL.

8. **Configure Routes:**
   - To route incoming requests to your Cloudflare Worker, configure the routes.
   - Go to the "Routes" section in the Cloudflare Workers dashboard.
   - Add a new route (e.g., `https://your-subdomain.your-domain.com/*`) and associate it with the deployed worker.

9. **Testing:**
    - Access the URL of your worker (e.g., `https://your-subdomain.your-domain.com/`) to test the deployed script.
