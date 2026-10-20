# SAGE Frontend — Architecture, Components & Implementation Guide

> **SAGE (Student Assistant & Goal Engine)** is a personal productivity and progress assistant designed specifically for students. It combines academic timetables, task deadlines, exams, Google Calendar commitments, competitive coding contests, and long-term learning goals into a unified decision engine.

---

## 1. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | React 18 (`react`, `react-dom`) | Component architecture and state lifecycle |
| **Bundler & Tooling** | Vite 5 (`vite`, `@vitejs/plugin-react`) | Sub-second HMR and optimized production bundling |
| **Language** | TypeScript 5 (`tsc`) | Strict type definitions, interfaces, and contracts |
| **Styling** | Tailwind CSS 3.4 (`postcss`, `autoprefixer`) | Utility-first styling with design system tokens |
| **Icons** | Lucide React (`lucide-react`) | 100% stroke-based iconography (`1.75px` stroke weight) |
| **Animations & Shaders** | Framer Motion & Paper Design Shaders | Smooth page transitions and fluid WebGL liquid shaders |
| **Primitives** | Radix UI (`@radix-ui/react-tooltip`, `@radix-ui/react-dialog`) | Accessible headless UI dialogs and tooltips |

---

## 2. Design System & Aesthetics

### Visual Philosophy
- **Dark Midnight Palette**: Primary surface colors `#050c24`, `#070e28`, and `#090a0f`.
- **Atmospheric Lighting**: Global animated fluid gradient canvas (`AnimatedGradient`) with ambient deep-blue radial blur glow orbs (`blur-[150px]`).
- **Curved Surface Hierarchy** (configured in `tailwind.config.js`):
  - Sections: `rounded-[28px]` to `rounded-[36px]` (`rounded-section`)
  - Cards: `rounded-[20px]` (`rounded-card`)
  - Buttons: `rounded-[14px]` (`rounded-btn`)
  - Controls & Badges: `rounded-[10px]` (`rounded-ctrl`)
- **Button Styling**:
  - Primary CTAs: Fluid WebGL shader button (`LiquidMetalButton`).
  - Secondary & Action Buttons: Sleek dark glass styling with subtle white borders (`bg-white/10 hover:bg-white/15 border border-white/20 text-white`).
- **Icon Standardization**:
  - Exclusively uses `lucide-react`.
  - Zero raw emojis in UI controls or buttons.
  - Global `svg.lucide` CSS rule enforcing `stroke-width: 1.75px` and `flex-shrink: 0`.

---

## 3. Application Architecture & Routing

The application router in `src/App.tsx` renders a **3-stage reactive lifecycle** governed by `AuthContext`:

```
                    ┌─────────────────────────┐
                    │      App Launches       │
                    └────────────┬────────────┘
                                 │
                     [ Is Authenticated? ]
                                 │
                 No ─────────────┴───────────── Yes
                 │                               │
                 ▼                               ▼
       ┌──────────────────┐          [ Onboarding Completed? ]
       │   LandingPage    │                      │
       │ (Public Product  │          No ─────────┴───────── Yes
       │   Story & Intro) │          │                       │
       └──────────────────┘          ▼                       ▼
                           ┌──────────────────┐    ┌──────────────────┐
                           │  OnboardingPage  │    │  DashboardPage   │
                           │  (7-Step Student │    │  (Authenticated  │
                           │   Setup Wizard)  │    │  Real Dashboard) │
                           └──────────────────┘    └──────────────────┘
```

### State Management (`src/context/AuthContext.tsx`)
- **JWT Handling**: Automatically intercepts URL token parameters on OAuth2 redirect (`/auth/callback?token=...`), stores credentials in `localStorage` under `sage_auth_token`, and decodes user payload claims.
- **Backend Verification**: Synchronizes user profile with `GET /api/auth/me`.
- **Development Sandbox**: Features a non-production `loginAsDevStudent` fallback enabling instant local testing of both onboarding and authenticated dashboard states without requiring live Google Cloud API keys.

---

## 4. Pages Overview

### 1. Landing Page (`src/pages/LandingPage.tsx`)
- **Continuous Editorial Story**: 
  1. **Brand & Navbar**: Logo `SAGE Student OS`, section links, and `LiquidMetalButton` CTA.
  2. **Hero Section**: Value proposition: *"Know what to work on next."* Supported by luminous fluid atmosphere and action buttons (zero fake dashboard mockups).
  3. **The Problem**: Visual convergence of 10 student channels (Classes, Assignments, Projects, Exams, Google Calendar, Contests, Courses, Goals, Email, Telegram) converging toward SAGE, revealing the central punchline: *"The hard part isn't knowing what you have to do. It's deciding what to do with the time you actually have."*
  4. **How SAGE Thinks**: Connected 4-stage pipeline (`CONTEXT` → `DECISION` → `ACTION` → `LEARNING`).
  5. **Modular Product Experience**: Scroll-based interactive modules (Focus Now with live timer, Tasks with completion and snooze, Goal Progress, Contest Sync with reminder alerts, Smart Reminders).
  6. **Ask SAGE**: Context-aware schedule reasoning dialogue with interactive `Plan This` confirmation.
  7. **Adaptive Planning**: Visual timeline showing SAGE's pattern recognition for repeatedly postponed tasks.
  8. **Your Data, Your Control**: Transparent data governance (1-click disconnect, read-only calendar bounds, quiet hours, AI context isolation, data export, account deletion).
  9. **Final Call to Action**: Direct entry point routing users into Google OAuth2.

---

### 2. Onboarding Wizard (`src/pages/OnboardingPage.tsx`)
A 7-step guided setup process that transforms a first-time user into an active student profile:
- **Step 1: Welcome & Profile**: Captures name, college/university, academic program/major, year of study, and local timezone.
- **Step 2: Core Focus Areas**: Selects priority domains (Assignments, DSA, Coding Contests, Projects, Exam Prep).
- **Step 3: Coding Platforms**: Connects student handles for Codeforces, LeetCode, CodeChef, and AtCoder.
- **Step 4: Academic & Long-Term Goals**: Allows students to define quantitative targets (e.g. *"Solve 5 LeetCode DP problems each week"*).
- **Step 5: Google Calendar Sync**: Connects class schedules and commitments to protect study windows.
- **Step 6: Smart Notifications**: Configures lead reminder alerts and quiet hours.
- **Step 7: Verification**: Submits profile data to `POST /api/auth/onboarding` and transitions directly to the workspace.

---

### 3. Authenticated Dashboard (`src/pages/DashboardPage.tsx`)
- **Strictly Data-Driven**: Zero hardcoded student scenarios or fake names; loads real tasks from `GET /api/tasks`.
- **Empty State**: When `tasks.length === 0`, renders a clean SaaS empty state with quick-action creation prompts (`+ Add Your First Task`).
- **Focus Decision Engine**: Evaluates scheduled tasks against the student's next commitment, highlighting the single highest-leverage task in the **Focus Now** card.
- **Task Management Modal**: Allows creating tasks with title, category, priority (`HIGH`, `MEDIUM`, `LOW`), estimated duration, and due date.
- **Reversible Actions**: Marking a task complete triggers a non-blocking toast notification with an **Undo** button that restores the task if clicked.
- **Snooze & Adaptive Feedback**: Postponing a task increments its snooze counter, prompting SAGE's adaptive engine to suggest better time slots.
- **Contest Tracker**: Displays upcoming rated rounds from Codeforces, LeetCode, and AtCoder with lead-time countdowns.
- **Goal Progress**: Live progress bars tracking milestone completion rates.
- **Ask SAGE Dialogue**: Schedule-aware AI reasoning assistant providing contextual answers to queries like *"I have two hours tonight. What should I work on?"*

---

## 5. UI Components Catalog (`src/components/ui/`)

### `LiquidMetalButton.tsx`
- Custom interactive button powered by WebGL fragment shaders (`@paper-design/shaders-react`).
- Generates a liquid-metal specular surface with interactive mouse-hover responsiveness, 3D transform depth, and dark metallic outer borders.

### `AnimatedGradient.tsx`
- Fluid WebGL canvas backdrop with customizable presets (`Prism`), variable swirl, scale, speed, and subtle film noise textures.
- Provides atmospheric blue illumination behind application surfaces without interfering with content contrast.

### `ai-prompt-box.tsx`
- Context-aware input box built on Radix UI primitives.
- Features auto-resizing textarea, paperclip attachment trigger, microphone voice input placeholder, and animated send action.

---

## 6. Microservices & API Gateway Contracts

The Vite development server is configured (`vite.config.ts`) to proxy API calls directly to the **Spring Cloud API Gateway** on port `8080`:

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/auth/me` | `GET` | `STUDENT` | Returns authenticated user profile and onboarding status |
| `/api/auth/onboarding` | `POST` | `STUDENT` | Persists student college, course, year, and focus preferences |
| `/api/tasks` | `GET` | `STUDENT` | Retrieves task backlog for the authenticated user |
| `/api/tasks` | `POST` | `STUDENT` | Creates a new task entity |
| `/api/tasks/{id}` | `PATCH` | `STUDENT` | Updates task status (`COMPLETED`, `SNOOZED`, `PENDING`) |
| `/api/tasks/{id}` | `DELETE` | `STUDENT` | Deletes a task from persistent storage |
| `/oauth2/authorization/google` | `GET` | Public | Initiates Google OAuth2 login via Spring Security |

---

## 7. Directory Structure

```
frontend/
├── index.html                  # HTML5 entry point with Outfit & Plus Jakarta Sans web fonts
├── package.json                # Dependencies and build scripts
├── postcss.config.js           # PostCSS Tailwind plugin configuration
├── tailwind.config.js          # Custom curved radius tokens, shadows, and color palette
├── tsconfig.json               # TypeScript path alias configuration (@/* -> src/*)
├── vite.config.ts              # Vite server & API Gateway proxy (:8080)
└── src/
    ├── main.tsx                # React DOM root render
    ├── App.tsx                 # 3-stage view router (Landing -> Onboarding -> Dashboard)
    ├── index.css               # Global typography, custom scrollbars, and Lucide SVG rules
    ├── context/
    │   └── AuthContext.tsx     # Authentication state, JWT decoder, and user session
    ├── lib/
    │   └── utils.ts            # Class name merger helper (`cn`)
    ├── components/
    │   └── ui/
    │       ├── liquid-metal-button.tsx  # Fluid shader primary CTA button
    │       ├── animated-gradient.tsx   # WebGL fluid ambient background canvas
    │       ├── ai-prompt-box.tsx       # Ask SAGE contextual prompt component
    │       └── feature-shader-cards.tsx# Shader-backed interactive feature cards
    └── pages/
        ├── LandingPage.tsx     # Public product story and feature capabilities
        ├── OnboardingPage.tsx  # 7-step student onboarding wizard
        └── DashboardPage.tsx   # Authenticated real-data student dashboard
```

---

## 8. Development & Build Commands

All commands are executed from the `frontend/` directory:

```bash
# Start local development server (http://localhost:5173/)
npm run dev

# Run TypeScript type check and compile production bundle
npm run build

# Preview production build locally
npm run preview
```
