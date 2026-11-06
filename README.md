# PJK Passport Photo Automation Studio 📷⚡

**Professional Windows Desktop-Web Automation System for PJK Xerox Printing Shop**

Designed and built for high-throughput daily printing shop operations, automating passport photograph processing, offline AI background replacement, Adobe Photoshop Action execution (`PJK.atn`), and multi-photo 4×6 inch print sheet layout generation.

---

## 🌟 Key Features

1. **Adobe Photoshop Automation (`PJK.atn`)**
   - Direct ExtendScript (JSX) automation with Adobe Photoshop CS6 / CC (x64).
   - Automatically loads and executes the `passport` action from the `PJK` action set.
   - Runs in silent headless mode (`DialogModes.NO`) without modal popup interruptions.
   - Automatic image normalization with Pillow to eliminate legacy Photoshop EXIF/JPEG decoding crashes.
   - Includes **Built-in Studio Passport Engine Fallback** if the third-party `SkinFiner` plugin is not installed on the operator's PC, guaranteeing non-stop shop operations.

2. **100% Local AI Background Replacement**
   - Offline neural network segmentation (`rembg` / ONNX Runtime).
   - Zero cloud uploads; customer photographs remain strictly private on the local computer.
   - Solid background replacement with **PJK Signature Blue (`#0080FF`)**, Indian Passport White (`#FFFFFF`), Studio Grey (`#E2E8F0`), or any custom HEX/RGB color.
   - Fine hair edge preservation without color bleeding or identity distortion.

3. **4×6 Inch Photo Sheet Layout Engine**
   - Exact physical printing dimensions: **4 × 6 inches at 300 DPI (1200 × 1800 px / 1800 × 1200 px)**.
   - Supports 8 photos in Landscape (4×2 grid) or 6 photos in Portrait (3×2 grid).
   - Mix multiple customers or photos on a single sheet with individual copy counts (e.g. 4 copies of Person A + 4 copies of Person B).
   - Real-time interactive canvas preview with cutting guide tick marks and spacing sliders.
   - High-quality 300 DPI JPEG output with print-ready borders.

4. **Modern Printing Shop Dashboard UI**
   - Built with React, TypeScript, Vite, and Tailwind CSS.
   - Instant drag-and-drop batch upload with rotation controls (90° CW/CCW).
   - Live Photoshop and SkinFiner connectivity status badge on the navigation bar.
   - Real-time job stepper tracking (Preparing → Background → Photoshop/Engine → Layout → Complete).
   - Processing history with one-click re-download and print shop daily metrics.
   - Comprehensive Settings panel to configure dimensions, DPI, margins, and paths with local JSON persistence.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, Pillow (PIL), OpenCV, SciPy |
| **AI Segmentation** | ONNX Runtime, `rembg` (u2net offline model) |
| **Photoshop Automation** | Adobe Photoshop CS6 64-bit, ExtendScript (JSX), ActionDescriptor API |
| **Runtime Environment** | Windows 10 / 11 64-bit (100% Localhost) |

---

## 📂 Project Structure

```
passportphotoapp/
├── backend/
│   ├── app/
│   │   ├── api/                 # REST API endpoints (photos, sheets, jobs, history, settings)
│   │   ├── config/              # Local settings loader & JSON persistence
│   │   ├── image_processing/    # Rembg offline background segmentation & color blending
│   │   ├── photo_layout/        # 4x6 inch 300 DPI Pillow photo sheet generator
│   │   ├── photoshop/           # Photoshop JSX runner, concurrency lock & engine fallback
│   │   ├── schemas/             # Pydantic request and response models
│   │   ├── services/            # Async job manager & processing history
│   │   └── main.py              # FastAPI server entry point & static file mounts
│   ├── tests/
│   │   └── test_backend.py      # Automated backend test suite
│   ├── uploads/                 # Storage for uploaded original photographs
│   ├── outputs/                 # Storage for processed passport photos & 4x6 sheets
│   └── temp/                    # Temporary scratch folder for JSX automation
├── frontend/
│   ├── src/
│   │   ├── components/          # Navbar, PhotoUploader, UI widgets
│   │   ├── pages/               # Dashboard, PassportStudio, SheetStudio, BackgroundStudio, History, Settings
│   │   ├── services/            # API client with automatic job polling
│   │   ├── types/               # TypeScript definitions
│   │   └── App.tsx              # Main routing and studio tab state
│   ├── dist/                    # Compiled production build
│   └── package.json
├── photoshop/
│   └── jsx/
│       ├── run_action.jsx       # ExtendScript to load PJK.atn and execute passport action
│       └── probe_status.jsx     # Diagnostic ExtendScript to check Photoshop & plugins
├── PJK.atn                      # Customer's original Photoshop Action file (PJK > passport)
├── install.bat                  # One-click dependency installation script
├── start.bat                    # One-click launcher for backend & frontend
├── stop.bat                     # Clean shutdown script
├── requirements.txt             # Python backend dependencies
└── README.md                    # Technical documentation & user manual
```

---

## 🚀 Quick Start Guide (Printing Shop Operator)

### Step 1: Install Dependencies
Double-click `install.bat` in the project root.
This script will:
- Verify Python and Node.js.
- Install backend Python packages (`pip install -r requirements.txt`).
- Install frontend packages (`npm install` inside `frontend/`).
- Build the production frontend assets (`npm run build`).
- Create `uploads/`, `outputs/`, and `temp/` folders.

### Step 2: Start the Application
Double-click `start.bat`.
This will:
- Start the FastAPI backend on `http://127.0.0.1:8000`.
- Start the Vite frontend on `http://localhost:5173`.
- Automatically open your default web browser to the PJK Studio Dashboard.

### Step 3: Stop the Application
Double-click `stop.bat` to gracefully terminate all backend and frontend background processes.

---

## 📸 Processing Modes

### Mode 1: Passport Action Only (Photoshop / Fallback)
1. Select a photo in **Passport Photo Studio**.
2. Select **"Mode 1: Passport Action Only"**.
3. Click **"Run Passport Action"**.
4. The system opens the photo in Adobe Photoshop CS6, runs the `PJK > passport` action, crops to standard passport proportions, applies skin smoothing and border stroke, and saves the result to `backend/outputs/`.

### Mode 2: Background Replacement Only
1. In **Passport Photo Studio** or **Background Studio**, choose your desired background color:
   - **PJK Passport Blue** (`#0080FF`)
   - **Indian Passport White** (`#FFFFFF`)
   - **Studio Grey** (`#E2E8F0`)
   - **Custom HEX / RGB Picker**
2. Click **"Replace Background"**.
3. The local AI model isolates the portrait subject and composites the solid color background while preserving hair strands.

### Mode 3: Complete Passport Processing (Recommended)
1. Replaces the background with the selected color first.
2. Passes the clean photo into the Photoshop `passport` action (or Studio Engine) for final sizing, skin optimization, and border stroke.
3. Produces a ready-to-print passport photo.

### Mode 4: 4×6 Inch Sheet Layout
1. Navigate to **4×6 Photo Sheet**.
2. Add one or multiple processed photos from the studio tray.
3. Set copy counts (e.g., 4 copies of Photo A, 4 copies of Photo B = 8 total).
4. Choose **Landscape** (8 photos: 4 cols × 2 rows) or **Portrait** (6 photos: 3 cols × 2 rows).
5. Toggle cutting guide tick marks and adjust spacing if desired.
6. Click **"Generate Complete 4×6 Sheet"**.
7. Download and print directly on standard 4×6 inch photo glossy paper!

---

## 🔌 Adobe Photoshop & SkinFiner Setup

### Adobe Photoshop CS6 Configuration
- The app automatically detects Photoshop at:
  `C:\Program Files\Adobe\Adobe Photoshop CS6 (x64)\Photoshop.exe`
- If Photoshop is installed at a different path, navigate to the **Settings** tab in the web interface and enter the custom path.

### Photoshop Action (`PJK.atn`)
- Action Set: `PJK`
- Action Name: `passport`
- File Location: `c:\FreePro\passportphotoapp\PJK.atn`
- The application automatically verifies that `PJK.atn` exists. During execution, it loads the action set into Photoshop via ExtendScript if it is not already loaded.

### SkinFiner Plugin Integration & Built-in Fallback
- The `PJK.atn` action was recorded using the **SkinFiner** Photoshop plugin (`SkinFiner.8bf`).
- **If SkinFiner is installed:** The Photoshop action executes with full SkinFiner skin smoothing.
- **If SkinFiner is missing:** Photoshop actions will throw a runtime error (`The command "SkinFiner" is not currently available`).
  - **PJK Studio automatically detects this state** and displays an informative banner.
  - The system activates the **Built-in Studio Passport Engine** fallback, performing:
    1. Aspect-ratio center-weighted passport crop (35mm × 45mm @ 300 DPI).
    2. Edge-preserving bilateral skin softening filter.
    3. Facial contrast and brightness optimization.
    4. Crisp 1-pixel border stroke.
- **To Install SkinFiner into Photoshop CS6:**
  1. Download or locate your `SkinFiner.8bf` (64-bit) plugin file.
  2. Copy `SkinFiner.8bf` into:
     `C:\Program Files\Adobe\Adobe Photoshop CS6 (x64)\Plug-ins\`
  3. Restart Photoshop. The status indicator on the PJK Studio dashboard will turn green.

---

## 🛡️ Reliability & Safety Guarantees

- **Non-Destructive:** Original uploaded photographs are stored in `backend/uploads/` and are **never** modified or overwritten.
- **Unique Output Identifiers:** Every processed photo and sheet receives a unique UUID filename (e.g., `passport_a1b2c3d4...jpg`) preventing file collisions.
- **Photoshop Concurrency Lock:** Photoshop operations are queued using an asynchronous mutex lock (`asyncio.Lock`), preventing concurrent execution conflicts.
- **EXIF Transposition & Normalization:** All images sent to Photoshop are pre-normalized to standard baseline sRGB JPEGs via Pillow, completely avoiding legacy Photoshop CS6 progressive JPEG crashes.
- **100% Offline Processing:** No internet connection or cloud service is used for processing.

---

## 🧪 Running Backend Unit Tests

To verify the installation and backend modules independently, run:

```bash
python backend/tests/test_backend.py
```

Expected output:
```
--- Running PJK Studio Backend Tests ---
[PASS] Settings test passed
[PASS] Hex to RGB test passed
[PASS] Grid calculation passed: cols=3, rows=2, total_slots=6
[PASS] Photoshop status probe passed: PS Installed=True, SkinFiner=False, Action Exists=True
[PASS] Native studio passport enhancement passed: size=(413, 531)
[PASS] 4x6 Sheet generation passed: size=(1800, 1200), photos_placed=6
[PASS] Job manager test passed
--- ALL BACKEND TESTS PASSED ---
```

---

## 📞 Support & Maintenance
Developed for **PJK Xerox Printing Shop**.
For technical inquiries or configuration updates, check the built-in **Settings** and **Diagnostics** panels within the application dashboard.

