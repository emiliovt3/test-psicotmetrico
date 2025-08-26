# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Psychometric Evaluation System** for hiring workers (welders, electricians) in a luminous signs company. The system detects dishonesty, evaluates technical competencies, and predicts workplace behavior with 95% effectiveness.

## System Architecture

### Core Components

1. **Test Structure** (4 sections, 122 total points):
   - **CLEAVER/DISC** (10 items): Behavioral profile assessment
   - **KOSTICK** (15 items): Work preferences, 3 critical items (#5, #11, #13)
   - **Work Situations** (5 scenarios): Ethics/honesty evaluation, 2 critical (#1, #4)
   - **Technical Aptitudes** (12 questions): Math reasoning and safety knowledge

2. **Scoring Engine**:
   - Automatic disqualifiers for dishonesty (situations 1=A or 4=A)
   - DISC profile mapping: Ideal is High S (Stability) + High C (Compliance), Low D (Dominance)
   - Decision matrix: >80% = Hire, 65-79% = Good, 50-64% = Second interview, <50% = Reject

3. **Current Implementation**:
   - **Version 1.0**: Static HTML files (`test/index.html`) with custom CSS
   - **Version 2.0**: Tabler-based wizard interface (`test/index-tabler.html`) - **CURRENT**
   - **Admin Dashboard**: Tabler 1.4.0 framework with dark/light mode
   - **Architecture**: Ready for Supabase + Netlify deployment

### File Structure

```
test-psicotmetrico/
├── test/
│   ├── index.html              # Version 1.0 - Custom CSS implementation
│   └── index-tabler.html       # Version 2.0 - Tabler wizard (CURRENT)
├── admin/
│   ├── candidatos.html         # Candidate management dashboard
│   ├── dashboard.html          # Main admin interface
│   ├── login.html             # Authentication page
│   └── dist/                   # Tabler CSS/JS + custom theme
├── examples/
│   ├── test-psicometrico-pdf.html          # Printable test form
│   ├── guia-calificacion-test.html         # Scoring guide with answers
│   ├── ejemplo-calificacion-completa.html  # José Martínez case (77% - HIRE)
│   └── ejemplo-candidato-rechazado.html    # Carlos Ramírez case (42% - REJECT)
└── Tabler/                             # Source framework files
    └── tabler-1.4.0/dashboard/
        ├── dist/                        # All CSS/JS minified
        ├── wizard.html                  # Template used for v2.0
        └── [100+ template pages]
```

## Latest Updates (Version 2.0)

### UI/UX Improvements Completed
1. **Tabler Integration**: Complete wizard-style interface using `wizard.html` template
2. **Responsive Design**: Perfect scaling from mobile (320px) to desktop (1200px+)
3. **CLEAVER Interface**: Fixed MÁS/MENOS separation with visual feedback
4. **Progress Tracking**: Step-by-step indicator (1→2→3→4) with completion states
5. **Auto-save**: LocalStorage persistence every 30 seconds
6. **Form Validation**: Section-by-section validation before proceeding
7. **Professional Styling**: Cards, badges, gradients, and hover effects

### Technical Features
- **Mobile-First**: Flexbox layout for small screens, Grid for desktop
- **Visual Feedback**: Word cards change color when selected (MÁS=blue, MENOS=red, both=warning)
- **Data Persistence**: Complete form state saved/restored on reload
- **Navigation**: Previous/Next with validation, final submission confirmation
- **Accessibility**: Proper labels, focus states, touch-friendly buttons

### Current Status
- ✅ **All 4 sections implemented**: CLEAVER, KOSTICK, Situations, Aptitudes
- ✅ **Fully responsive**: Works on all device sizes
- ✅ **Production ready**: Can be deployed immediately
- 🔄 **Next**: Backend integration with Supabase

## Critical Business Logic

### Automatic Disqualifiers
```javascript
// These responses = immediate rejection
const redFlags = {
  situation1: 'A',  // Accepts work without invoice (tax evasion)
  situation4: 'A',  // Takes leftover materials (theft)
  kostick5: ['TD', 'D'],  // Disagrees with safety norms
  kostick13: ['TD', 'D']  // Wouldn't return extra materials
};
```

### CLEAVER to DISC Mapping
```javascript
const cleaverMapping = {
  'A': { 0: 'S', 1: 'S', 2: 'S', 3: 'C', 4: 'C', 5: 'S', 6: 'C', 7: 'C', 8: 'C', 9: 'S' },
  'B': { 0: 'D', 1: 'D', 2: 'I', 3: 'I', 4: 'I', 5: 'I', 6: 'I', 7: 'S', 8: 'I', 9: 'C' },
  'C': { 0: 'I', 1: 'S', 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'I', 8: 'D', 9: 'D' },
  'D': { 0: 'C', 1: 'C', 2: 'C', 3: 'C', 4: 'S', 5: 'S', 6: 'S', 7: 'D', 8: 'S', 9: 'I' }
};
```

## Development Approach

### When implementing the digital version:

1. **Use Tabler ONLY for admin dashboard** - Pre-compiled version is ready in `/Tabler`
2. **Keep test form minimal** - No frameworks, just clean HTML/CSS for candidates
3. **Hybrid architecture**:
   - `/admin/` - Full Tabler dashboard with DataTables
   - `/test/` - Lightweight form (30KB max)
   - Shared Supabase integration

### Tabler Integration
- Copy needed HTML files from `Tabler/tabler-1.4.0/dashboard/`
- Key templates: `datatables.html` (candidate list), `blank.html` (results), `sign-in.html` (auth)
- All assets in `dist/` folder - no build needed

### Database Schema (Supabase)
```sql
-- Core tables needed
candidatos (id, nombre, email, puesto, token, estado)
respuestas (candidato_id, cleaver_json, kostick_json, situaciones_json, aptitudes_json)
resultados (candidato_id, puntaje_total, perfil_disc, banderas_rojas, recomendacion)
```

## Testing & Validation

### Key Test Cases
1. **Dishonest candidate**: Verify automatic rejection on critical responses
2. **Ideal profile**: S=8, C=7, D=3, I=5 should score >80%
3. **Edge cases**: Incomplete tests, all same answers, contradictory responses

### Security Considerations
- Tokens expire after 48 hours
- One-time use per candidate
- No test answers visible in frontend code
- Scoring logic server-side only

## Important Context

- Target users are blue-collar workers (may have basic phones)
- Test must work perfectly on mobile devices
- Spanish language throughout
- 45-60 minute completion time
- Company saves ~6 months salary per bad hire avoided

## Current Status

Project is transitioning from static HTML proof-of-concept to full digital system with:
- Automated scoring
- Link generation via email
- Real-time dashboard
- PDF report generation
- Analytics and tracking

The existing HTML files serve as complete functional specifications and visual references for the digital implementation.