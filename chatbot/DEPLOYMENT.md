# 🚀 Professional Deployment Guide: Cloudflare + GitHub Pages

This guide explains how to use **Cloudflare Tunnel** to securely connect your local n8n instance to a frontend hosted on **GitHub Pages**. This setup is free, provides a secure HTTPS connection, and bypasses "Mixed Content" issues.

---

## 🛠️ Step 1: Install Cloudflare Tunnel (`cloudflared`)

Cloudflare provides a tool called `cloudflared` to create a secure tunnel.

1.  **Download**: Go to the [Cloudflare Downloads page](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) and download the **Windows executable (.exe)**.
2.  **Install**: 
    *   Place the `cloudflared.exe` in a folder (e.g., `C:\cloudflare\`).
    *   *Optional:* Add this folder to your system's PATH environment variable so you can run it from any terminal.

---

## 🌩️ Step 2: Start a Free Quick Tunnel

Cloudflare allows you to start a tunnel without even having an account (Quick Tunnels).

1.  **Open Terminal** (PowerShell or CMD).
2.  **Run the command**:
    ```powershell
    .\cloudflared.exe tunnel --url http://localhost:5678
    ```
    *(If you added it to PATH, just use `cloudflared tunnel --url http://localhost:5678`)*.
3.  **Capture the URL**: Look for a line in the terminal that looks like this:
    ```text
    +-------------------------------------------------------------+
    |  Your quick tunnel has been created! Visit it at:           |
    |  https://unique-words-generated-by-cloudflare.trycloudflare.com |
    +-------------------------------------------------------------+
    ```
4.  **Copy the `.trycloudflare.com` URL**. This is now your public, secure backend address.

---

## 🐙 Step 3: Deploy Frontend to GitHub Pages

1.  **Push your code**: Upload your `index.html`, `script.js`, and `styles.css` to a GitHub repository.
2.  **Activate Pages**:
    *   Go to **Settings** > **Pages** in your GitHub repo.
    *   Select `main` branch and click **Save**.
    *   Wait ~1 minute for your site to go live (e.g., `https://yourname.github.io/repo/`).

---

## ⚙️ Step 4: Final Connection (Secure UI Input)

1.  **Open your Live App** (the GitHub Pages URL).
2.  The **Configuration Menu** should pop up automatically (or click the ⚙️ icon).
3.  **Webhook URL**: Paste your Cloudflare URL and append the path to your chat webhook.
    *   Example: `https://your-words.trycloudflare.com/webhook/your-uuid/chat`
4.  **Credentials**: Enter the **Basic Auth** Username and Password you set in your n8n Webhook node.
5.  **Save**: Click "Save Configuration".

---

## 💡 Important Tips

*   **Persistence**: Quick Tunnels (`trycloudflare.com`) last as long as the terminal is open. If you restart it, you will get a **new** URL and must update it in the App Settings.
*   **Pro Tip (Custom Domain)**: If you own a domain on Cloudflare, you can create a "Named Tunnel" in the Cloudflare Dashboard. This gives you a **permanent** URL (e.g., `api.yourdomain.com`) that never changes!
*   **n8n Security**: Always ensure your n8n Webhook node is set to **Basic Auth** to prevent unauthorized access via the public tunnel.
