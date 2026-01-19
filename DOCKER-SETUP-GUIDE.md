# Docker Setup - Complete Step-by-Step Guide

## 🎯 What We're Going to Do

1. Install Docker Desktop
2. Download all the code files
3. Create the environment file
4. Run the setup script
5. Test that everything works

**Total time:** About 15-20 minutes

Let's go! 🚀

---

## Step 1: Install Docker Desktop

### For Mac Users:

#### 1.1 Download Docker
1. Open your web browser
2. Go to: **https://www.docker.com/products/docker-desktop**
3. Click the big blue button "**Download for Mac**"
   - If you have an M1/M2/M3 Mac (Apple Silicon): Choose "Mac with Apple chip"
   - If you have an older Intel Mac: Choose "Mac with Intel chip"
   - Not sure? Click the Apple menu → "About This Mac" to check

#### 1.2 Install Docker
1. Once downloaded, open your **Downloads** folder
2. Double-click the **Docker.dmg** file
3. Drag the **Docker** icon to the **Applications** folder
4. Open your **Applications** folder
5. Double-click **Docker** to start it

#### 1.3 First Time Setup
1. You'll see a pop-up asking for permissions
2. Click "**OK**" or "**Allow**"
3. Enter your Mac password if asked
4. Docker Desktop will start (you'll see a whale icon in your menu bar)
5. Wait for the whale icon to stop animating (means it's ready)
6. You might see a tutorial - you can skip it

#### 1.4 Verify It's Working
1. Open **Terminal** (Applications → Utilities → Terminal)
2. Type this and press Enter:
```bash
docker --version
```

You should see something like:
```
Docker version 24.0.7, build afdd53b
```

If you see this, **Docker is installed!** ✅

---

### For Windows Users:

#### 1.1 Check Windows Version
1. Press **Windows Key + R**
2. Type `winver` and press Enter
3. Make sure you have Windows 10 version 2004 or higher, or Windows 11
4. If not, update Windows first

#### 1.2 Enable WSL 2 (Required)
1. Open **PowerShell** as Administrator:
   - Right-click Start button
   - Click "Windows PowerShell (Admin)" or "Terminal (Admin)"
2. Run this command:
```powershell
wsl --install
```
3. Restart your computer when prompted
4. After restart, WSL will finish installing automatically

#### 1.3 Download Docker
1. Open your web browser
2. Go to: **https://www.docker.com/products/docker-desktop**
3. Click the big blue button "**Download for Windows**"

#### 1.4 Install Docker
1. Once downloaded, open the installer (Docker Desktop Installer.exe)
2. Check the box "**Use WSL 2 instead of Hyper-V**" (recommended)
3. Click "**Ok**"
4. Wait for installation (takes 3-5 minutes)
5. Click "**Close and restart**" when done
6. Your computer will restart

#### 1.5 Start Docker Desktop
1. After restart, Docker Desktop should open automatically
2. If not, search for "Docker Desktop" in Start menu and open it
3. Accept the service agreement
4. You can skip the tutorial
5. Wait for Docker to say "Engine running" (bottom left corner)

#### 1.6 Verify It's Working
1. Open **PowerShell** or **Command Prompt**
2. Type this and press Enter:
```bash
docker --version
```

You should see something like:
```
Docker version 24.0.7, build afdd53b
```

If you see this, **Docker is installed!** ✅

---

## Step 2: Download All the Code Files

Now we need to get all the files I created for you.

### 2.1 Create a Folder
1. **Mac:** Open Finder → Documents → Create new folder called `forever-stories`
2. **Windows:** Open File Explorer → Documents → Create new folder called `forever-stories`

### 2.2 Download Files
Go back to our conversation and download these files into your `forever-stories` folder:

**Required Files:**
- [ ] `server.js`
- [ ] `database-schema.sql`
- [ ] `package.json`
- [ ] `.env.example`
- [ ] `docker-compose.yml`
- [ ] `Dockerfile`
- [ ] `.dockerignore`
- [ ] `setup.sh`
- [ ] `middleware.js`
- [ ] `aiService.js`
- [ ] `frontend` folder (download the whole folder)

### 2.3 Verify Your Folder
Your `forever-stories` folder should look like this:

```
forever-stories/
├── server.js
├── database-schema.sql
├── package.json
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── setup.sh
├── middleware.js
├── aiService.js
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   └── main.jsx
    ├── package.json
    ├── vite.config.js
    └── index.html
```

**Quick check:** You should have about 10-12 files in the main folder, plus the `frontend` folder.

---

## Step 3: Create the Environment File

We need to create a `.env` file with your settings.

### 3.1 Open Terminal/Command Prompt

**Mac:**
1. Open **Terminal** (Applications → Utilities → Terminal)
2. Navigate to your folder:
```bash
cd ~/Documents/forever-stories
```

**Windows:**
1. Open **PowerShell** or **Command Prompt**
2. Navigate to your folder:
```bash
cd Documents\forever-stories
```

### 3.2 Copy the Environment Template

Type this command:

**Mac/Linux:**
```bash
cp .env.example .env
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**Windows (Command Prompt):**
```cmd
copy .env.example .env
```

### 3.3 Edit the .env File

Now we need to edit this file:

**Mac:**
```bash
nano .env
```

**Windows:**
```bash
notepad .env
```

You'll see something like this:
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=your-super-secret-jwt-key-change-this
ANTHROPIC_API_KEY=
```

### 3.4 Update the Values

**Required changes:**

1. **JWT_SECRET** - Change to any random string:
```env
JWT_SECRET=my-super-secret-key-abc123xyz789
```
   (You can use any random text here - just make it long and random)

2. **ENCRYPTION_KEY** - Change to a 32-character string:
```env
ENCRYPTION_KEY=abcdef1234567890abcdef1234567890
```
   (Needs to be exactly 32 characters - letters and numbers)

**Optional (for AI features):**

3. **ANTHROPIC_API_KEY** - If you have one:
```env
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```
   (Don't have one? Leave it blank - login will still work!)

### 3.5 Save the File

**Mac (nano):**
- Press `Control + X`
- Press `Y` to confirm
- Press `Enter`

**Windows (notepad):**
- File → Save
- Close notepad

**Your .env file is ready!** ✅

---

## Step 4: Run the Setup Script

Now for the magic! This one script starts everything.

### 4.1 Make Script Executable (Mac/Linux only)

**Mac/Linux:**
```bash
chmod +x setup.sh
```

**Windows:** Skip this step

### 4.2 Run the Setup Script

**Mac/Linux:**
```bash
./setup.sh
```

**Windows (PowerShell):**
```bash
bash setup.sh
```

**Windows (If bash not found):**

If you get "bash: command not found", you need Git Bash:
1. Download Git for Windows: https://git-scm.com/download/win
2. Install it
3. Open "Git Bash" from Start menu
4. Navigate to your folder:
   ```bash
   cd /c/Users/YourUsername/Documents/forever-stories
   ```
5. Run:
   ```bash
   ./setup.sh
   ```

### 4.3 What You'll See

The script will output something like this:

```
🚀 Forever Stories - Setup Script
==================================

✓ Docker and Docker Compose are installed

📁 Creating necessary directories...
✓ Directories created

🏗️  Building Docker containers...
[+] Building 45.2s (18/18) FINISHED
 => [internal] load build definition
 => => transferring dockerfile: 450B
 => [internal] load .dockerignore
 ...

🚀 Starting services...
[+] Running 4/4
 ✔ Network forever-stories-network  Created
 ✔ Container forever-stories-db      Started
 ✔ Container forever-stories-redis   Started
 ✔ Container forever-stories-api     Started
 ✔ Container forever-stories-frontend Started

⏳ Waiting for database to be ready...
✓ All services are running!

🎉 Setup complete!

==================================
Service URLs:
==================================
🔹 Frontend:    http://localhost:5173
🔹 API Server:  http://localhost:3001
🔹 Database:    localhost:5432

==================================
Useful Commands:
==================================
📊 View logs:         docker-compose logs -f
🔄 Restart services:  docker-compose restart
🛑 Stop services:     docker-compose down
🗑️  Clean everything:  docker-compose down -v

==================================
Testing the API:
==================================
curl http://localhost:3001/health

Happy coding! 🚀
```

**This means everything is running!** 🎉

**Note:** The first time you run this, it takes 3-5 minutes because Docker needs to download and build everything. After that, it only takes 10-20 seconds.

---

## Step 5: Test That Everything Works

Let's verify all three pieces are running!

### 5.1 Test the Health Endpoint

In your terminal, type:
```bash
curl http://localhost:3001/health
```

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-10T...",
  "uptime": 15.234,
  "environment": "development",
  "database": "connected",
  "anthropicApiKey": "missing"
}
```

If you see this, **the API is working!** ✅

### 5.2 Open the Frontend

1. Open your web browser
2. Go to: **http://localhost:5173**

You should see the **Forever Stories** login page! 🎉

### 5.3 Test Registration

Let's create a test account:

1. Click "**Sign Up**" (at the bottom)
2. Fill in:
   - **Full Name:** Test User
   - **Email:** test@test.com
   - **Password:** password123
3. Click "**Create Account**"

You should see a success message and be redirected to the intake form!

### 5.4 Check the Database

Let's verify your data was saved to the database:

```bash
docker exec -it forever-stories-db psql -U postgres -d forever_stories
```

This opens the PostgreSQL console. Now type:

```sql
SELECT email, full_name FROM users;
```

You should see:
```
     email      | full_name 
----------------+-----------
 test@test.com  | Test User
(1 row)
```

**Your data is in the database!** ✅

Type `\q` and press Enter to exit.

### 5.5 Test Login

1. Go back to browser: http://localhost:5173
2. Refresh the page
3. Enter:
   - **Email:** test@test.com
   - **Password:** password123
4. Click "**Sign In**"

You should be logged in successfully!

**Everything is working!** 🎉🎉🎉

---

## 🎛️ Managing Your App

### Check What's Running
```bash
docker-compose ps
```

You should see 4 containers running:
- `forever-stories-api` (port 3001)
- `forever-stories-db` (port 5432)
- `forever-stories-redis` (port 6379)
- `forever-stories-frontend` (port 5173)

### View Logs (See What's Happening)
```bash
# All services
docker-compose logs -f

# Just API
docker-compose logs -f api

# Just Database
docker-compose logs -f postgres
```

Press `Control + C` to stop viewing logs.

### Stop Everything
```bash
docker-compose down
```

Everything stops, but your data is saved!

### Start Again (After Stopping)
```bash
docker-compose up -d
```

Starts in about 10-20 seconds (much faster after first time).

### Restart a Single Service
```bash
docker-compose restart api
# or
docker-compose restart frontend
```

### Complete Reset (Delete Everything)
```bash
docker-compose down -v
```

⚠️ **Warning:** This deletes all data including users you created!

### Stop and Remove Containers But Keep Data
```bash
docker-compose down
```

Data stays in Docker volumes. Next `docker-compose up` will use the same data.

---

## 🐛 Troubleshooting

### Problem: "Cannot connect to the Docker daemon"

**Solution:**
1. Open Docker Desktop app
2. Wait for it to say "Engine running" (bottom left)
3. Try again

### Problem: "Port 5173 is already in use"

**Solution:**
```bash
# Stop the containers
docker-compose down

# Kill whatever is using the port
# Mac/Linux:
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill

# Windows:
netstat -ano | findstr :5173
# Note the PID number
taskkill /PID <number> /F

# Start again
docker-compose up -d
```

### Problem: "Database connection failed"

**Solution:**
```bash
# Database takes 10-20 seconds to fully start
# Wait a bit, then restart the API
docker-compose restart api
```

### Problem: "Permission denied: ./setup.sh"

**Solution:**
```bash
chmod +x setup.sh
./setup.sh
```

### Problem: "No space left on device"

**Solution:**
```bash
# Clean up old Docker data
docker system prune -a

# This removes unused images/containers
```

### Problem: Can't access http://localhost:5173

**Solution:**
1. Check services are running:
   ```bash
   docker-compose ps
   ```
2. If frontend is not running:
   ```bash
   docker-compose restart frontend
   docker-compose logs frontend
   ```

---

## 📍 Where You Are Now

**Congratulations!** 🎉 You now have:

✅ Docker Desktop installed
✅ All code files downloaded
✅ Environment configured
✅ Database running (PostgreSQL)
✅ API server running (Node.js)
✅ Frontend running (React)
✅ Login/Register working
✅ Data saving to real database

**You can:**
- Create accounts
- Login
- See data in database
- Everything is connected!

---

## 🎯 Next Steps

Now that everything is running, you can:

### Option 1: Keep Testing
- Create multiple accounts
- Try wrong passwords (see error handling)
- Look at database to see hashed passwords
- Check the API logs

### Option 2: Continue Building
Ready to move on to the next feature?
- Intake Form (profile questionnaire)
- File uploads
- AI personalization
- Daily prompts

### Option 3: Understand Deeper
- Explore the code files
- See how frontend talks to backend
- Learn how Docker containers work
- Study the database schema

**What would you like to do next?**
- A) Continue explaining the Intake Form
- B) Explore what we just built
- C) Fix any issues you're having
- D) Something else

Let me know and I'll help you with the next step! 🚀
