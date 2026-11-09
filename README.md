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

4. **Birthday Photo Collage Studio (A4 300 DPI - Zero Action Required) 🎂🎉**
   - **Zero Photoshop Action Dependency:** 100% standalone automated collage engine built right into the studio.
   - **2 to 20 Photos Dynamic Auto-Arrangement:** Automatically computes balanced mosaic layouts, hero spotlight layouts, or polaroid photo walls based on how many photos the customer provides.
   - **Exact A4 300 DPI Output:** Standard 210 × 297 mm print dimensions (**2480 × 3508 px** Portrait, **3508 × 2480 px** Landscape).
   - **Design Templates:** *Hero Spotlight* (large central photo + surrounding moments), *Balanced Mosaic* (harmonious auto-sized grid), and *Polaroid Cards* (tilted cards with white borders and tape accents).
   - **Typography & Greetings:** Fully customizable Birthday Greeting header, Celebrant Name, Subtitle message, Windows TrueType Font selection (Georgia, Arial, Times New Roman, Segoe UI, Impact, Comic Sans), and font scale control.
   - **Festive Color Themes:** Royal Gold & Black, Midnight Navy, Studio White, Rose Gold / Pink, Sky Blue Party, and Festive Carnival with optional party confetti accents.
   - **Print-Shop Ready:** Auto smart-cropping, rounded corners, drop shadows, and high-res print export.

5. **PSD Template Automation Studio (700+ Templates in `C:\photodesings`) 🎨🖼️**
   - **Direct Integration with `C:\photodesings`:** Automatically discovers and categorizes over **700+ commercial PSD design templates** (Birthday Frames, Anniversary Collages, Wedding Days-to-Go, Instagram Stories & Posts, and Multi-Photo Wall Frames).
   - **Automatic Layer Discovery:** Instantly extracts photo placeholder slots, mask shapes, and editable typography text layers (names, months, dates, quotes).
   - **Zero-Crash Standalone Engine (`psd-tools` + Pillow):** High-speed 300 DPI compositing in **under 1 second** without relying on external plugins or hanging Photoshop modal dialogs.
   - **Interactive Visual Studio:** Browse by category with live web thumbnails, search by name, assign customer photos to slots with 1-click, edit celebrant names/wishes, and download high-res print outputs.

6. **Modern Printing Shop Dashboard UI**
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

### Mode 5: Birthday Photo Collage Studio (A4 Size)
1. Navigate to **Birthday Collage** in the top navigation bar.
2. Select between **2 to 20 photos** from the customer's uploaded pictures.
3. Choose a **Design Template**:
   - **Hero Spotlight:** Highlights 1 main photo large with all other moments arranged neatly around it (click the Star icon on any photo to designate it as Hero).
   - **Balanced Mosaic:** Harmonious layout with auto-balanced rows and columns.
   - **Polaroid Cards:** Retro photo cards with white borders, soft drop shadows, and subtle festive card tilts.
4. Customize the **Birthday Typography & Greeting**:
   - Title Header (e.g., *"Happy Birthday!"*, *"Celebrating 25 Wonderful Years"*)
   - Celebrant Name (e.g., *"Sarah Jenkins"*)
   - Subtitle / Wishes (e.g., *"May your day be filled with joy and laughter!"*)
   - Font Family (Georgia, Arial, Times New Roman, Segoe UI, Impact, Comic Sans) & Size Slider.
5. Pick a **Theme** (Royal Gold, Midnight Navy, Studio White, Rose Pink, Sky Party, Festive Carnival) and toggle festive Confetti.
6. Click **"Generate A4 Collage (300 DPI)"** to produce a 2480 × 3508 px high-resolution poster ready for immediate framing or photo paper printing!

### Mode 6: PSD Template Studio (700+ Master Templates in `C:\photodesings`)
1. Navigate to **PSD Templates** in the top navigation bar (or click the quick launch card on the Dashboard).
2. Filter by Category (e.g., *Birthday & Anniversary Frames*, *Insta Collage Kit*, *Instagram Stories*, *Days to Go Wedding*, *Mix Size Frames*) or search for any template by name.
3. Click any template card to open the **Customization Drawer**:
   - The system inspects the template layers and displays the exact photo slots and editable text fields.
   - Assign customer photos to Slot 1, Slot 2, etc. with 1 click from your uploaded library.
   - Type the customer's name, event date, or custom wishes into the detected text fields (e.g., replacing *"Monika"* with *"PJK Customer"*).
4. Click **"Generate Ready-To-Print Poster (300 DPI)"**.
5. In **under 1 second**, the system generates the finished print output at exact template dimensions (e.g. 2400 × 3600 px @ 300 DPI), ready for immediate printing and framing!

---

## 🔌 Adobe Photoshop CS6 Compatibility (No Plugins Required)

### 1. Photoshop CS6 Native Studio Engine (Recommended)
On many print shop workstations, third-party plugins like **SkinFiner cannot be installed** in Photoshop CS6 due to licensing, OS architecture, or compatibility limitations.

**PJK Studio includes a dedicated Photoshop CS6 Native Engine:**
- Operates directly inside Adobe Photoshop CS6 (32-bit & 64-bit).
- Uses Photoshop's native **Surface Blur** bilateral filter (`Radius: 4.0px, Threshold: 15`).
- Produces clean, professional skin softening that preserves eyes, eyelashes, lips, hair, and clothing sharpness.
- Performs center-weighted smart passport cropping (35×45 mm @ 300 DPI).
- Adds a crisp 1px/2px print border stroke.
- **Zero third-party plugins needed.** No more "SkinFiner is not available" dialogs!

### 2. Multi-System Automatic Discovery (Registry & Drives)
When copied to other computers:
- Automatically queries the Windows Registry (`HKLM` and `HKCU` under `SOFTWARE\Adobe\Photoshop`) to find the exact Photoshop executable location.
- Scans `C:`, `D:`, and `E:` drives for 64-bit and 32-bit CS6 installations.
- All paths are relative and self-healing: moving the project folder to `D:\` or a desktop folder will never break the app.

### 3. Optional SkinFiner Action (`PJK.atn`)
- If a machine does have SkinFiner installed in `Plug-ins\SkinFiner.8bf`, you can switch the engine mode in **Settings** to **"Photoshop Action (PJK.atn with SkinFiner)"**.
- If SkinFiner is absent, the system automatically falls back to the Native CS6 Engine or Studio Engine so customer orders are never blocked.

---

## 🛡️ Reliability & Safety Guarantees

- **Non-Destructive:** Original uploaded photographs are stored in `backend/uploads/` and are **never** modified or overwritten.
- **Unique Output Identifiers:** Every processed photo and sheet receives a unique UUID filename (e.g., `passport_a1b2c3d4...jpg`) preventing file collisions.
- **Photoshop Concurrency Lock:** Photoshop operations are queued using an asynchronous mutex lock (`asyncio.Lock`), preventing concurrent execution conflicts.
- **EXIF Transposition & Normalization:** All images sent to Photoshop are pre-normalized to standard baseline sRGB JPEGs via Pillow, completely avoiding legacy Photoshop CS6 progressive JPEG crashes.
- **100% Offline Processing:** No internet connection or cloud service is used for processing.

---

## 🧪 Running Automated Test Suites

To verify all backend modules, Photoshop CS6 discovery, layout engines, and the Birthday Collage studio, run:

```bash
# Core passport & Photoshop automation tests
python backend/tests/test_backend.py

# Birthday A4 collage engine tests (2-20 slots, templates, fonts, orientations)
python backend/tests/test_collage.py

# PSD Template Studio automation tests (700+ templates in C:\photodesings)
python backend/tests/test_templates.py

# End-to-end REST API & async job lifecycle tests
python backend/tests/test_e2e_api.py
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

