# Deploy Pixelium on Azure Windows VM

Azure Education often only offers **Windows** VMs. Use **WSL2 + Docker** inside Windows.

---

## 1. Create the Windows VM on Azure

1. **Machines virtuelles** → **Créer**
2. **Image:** Windows Server 2022 or Windows 11
3. **Size:** Standard_B2s (2 vCPU, 4 GB RAM) — OK with $100 credit
4. **Ports:** allow **3389** (RDP), **80** (HTTP), **22** (optional, for SSH later)
5. Create and **Connect** via RDP (Remote Desktop)

---

## 2. On the VM — install WSL2 + Ubuntu

Open **PowerShell as Administrator** on the VM:

```powershell
wsl --install -d Ubuntu-22.04
```

Restart if asked. After reboot, Ubuntu opens — create a username/password.

Update Ubuntu:

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 3. Install Docker inside Ubuntu (WSL)

In the **Ubuntu** terminal:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Close Ubuntu and reopen, then:

```bash
docker --version
docker compose version
```

---

## 4. Copy project to the VM

**Option A — from your PC (PowerShell):**

```powershell
scp -r "c:\Users\Aloulouu\Desktop\Nouveau dossier\pixelium-consent-commerce" YOUR_USER@VM_PUBLIC_IP:/home/YOUR_USER/pixelium
```

(Install OpenSSH on Windows VM if needed, or use RDP + copy/paste via shared folder)

**Option B — via RDP:**

1. In Azure VM settings, enable **Clipboard** / shared drive
2. Zip the `pixelium-consent-commerce` folder on your PC
3. Copy to the VM Desktop
4. In Ubuntu (WSL):

```bash
mkdir -p ~/pixelium
# If zip is on Windows Desktop, from WSL:
cp /mnt/c/Users/YourWindowsUser/Desktop/pixelium-consent-commerce.zip ~/
cd ~ && unzip pixelium-consent-commerce.zip
cd pixelium-consent-commerce
```

**Option C — Git:**

```bash
cd ~
git clone YOUR_REPO_URL pixelium-consent-commerce
cd pixelium-consent-commerce
```

---

## 5. Configure environment

```bash
cp .env.production.example .env
nano .env
```

Set (replace `YOUR_VM_IP` with Azure public IP):

```env
MYSQL_ROOT_PASSWORD=ChangeMeRoot123!
MYSQL_PASSWORD=ChangeMeApp123!
JWT_SECRET=change-to-long-random-string
GROQ_API_KEY=gsk_your_key_here
BROKER_URL=http://YOUR_VM_IP/broker
PUBLIC_HTTP_PORT=80
```

Save: `Ctrl+O`, Enter, `Ctrl+X`

---

## 6. Start the app

```bash
docker compose up -d --build
```

First run: **10–20 minutes**. Check:

```bash
docker compose ps
docker compose logs -f broker
```

---

## 7. Open Windows firewall for port 80

Back in **PowerShell (Administrator)** on Windows:

```powershell
New-NetFirewallRule -DisplayName "Pixelium HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

Also confirm Azure **Network Security Group** allows inbound **80** (same as when creating VM).

---

## 8. Open in browser

```
http://YOUR_VM_PUBLIC_IP
```

Login: `demo@pixelium.com` / `demo123`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| WSL won't install | Enable virtualization in Azure VM size; run `dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart` |
| Docker permission denied | `sudo usermod -aG docker $USER` then reopen Ubuntu |
| Port 80 blocked | Azure NSG + Windows firewall rule above |
| Out of memory | Use B2s (4 GB) not B1s; or add swap in WSL |
| Can't copy files | Use Git clone or zip via RDP |

---

## Without Docker (fallback)

If WSL/Docker fails, on Windows install manually:

1. **XAMPP** (MySQL) or MySQL Installer
2. **Node.js 22** LTS
3. **Python 3.12**
4. In project folder:

```powershell
npm install
pip install -r services/agents/requirements.txt
npm run build
npm run dev
```

Then expose port 80 with **nginx for Windows** or use tunnel from your PC — harder to keep running 24/7.

**WSL + Docker is strongly recommended.**
