# 📚 Documentation Index

## Quick Links

### 🚀 Getting Started
- **[API_SETUP_GUIDE.md](./API_SETUP_GUIDE.md)** - Complete setup instructions
  - Backend & frontend setup steps
  - Test credentials
  - API endpoint documentation
  - Troubleshooting guide

### 🧪 Testing
- **[TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md)** - Comprehensive test cases
  - Phase 1: Backend API testing
  - Phase 2: Frontend testing
  - Phase 3: Role-based access control
  - Phase 4: Error handling
  - Phase 5: Verification of removed hardcoded data

### 📊 Project Overview
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - What was changed
  - Summary of all modifications
  - Key features implemented
  - Database schema
  - Next steps for future work
  - Verification checklist

### 🔄 Comparison
- **[BEFORE_AFTER_COMPARISON.md](./BEFORE_AFTER_COMPARISON.md)** - Visual comparison
  - Authentication flow comparison
  - Architecture diagrams
  - Password security comparison
  - Session management comparison
  - Deployment readiness metrics

---

## File Structure

```
SWP391-G4-FE/
├── .env                              ✨ NEW - API configuration
├── API_SETUP_GUIDE.md                ✨ NEW - Setup instructions
├── TESTING_CHECKLIST.md              ✨ NEW - Test cases
├── IMPLEMENTATION_SUMMARY.md         ✨ NEW - What was done
├── BEFORE_AFTER_COMPARISON.md        ✨ NEW - Comparison
│
├── src/
│   ├── services/
│   │   └── userService.ts            ✏️ NEW - API functions
│   │
│   ├── pages/public/
│   │   └── Login.tsx                 ✏️ UPDATED - Uses API
│   │
│   └── App.tsx                       ✏️ UPDATED - Session management
│
└── SWP391-G4-BE-main/.../
    └── server.js                     ✏️ UPDATED - Database seeding
```

---

## Quick Reference

### Test Credentials
```
driver@example.com / 123456        → Driver Dashboard
staff@example.com / 123456         → Driver Dashboard
manager@example.com / 123456       → Manager Dashboard
admin@example.com / 123456         → Admin Dashboard
```

### API Endpoints
```
GET  http://localhost:4000/api/health
GET  http://localhost:4000/api/users
POST http://localhost:4000/api/auth/login
POST http://localhost:4000/api/auth/register
```

### Database
```
Server:   localhost
Database: parking_management
User:     sa
Password: 12345
Table:    dbo.users
```

---

## Step-by-Step Start

### 1️⃣ Backend
```bash
cd SWP391-G4-BE-main/SWP391-G4-BE-main
npm run dev
# Expected: "Server running on http://0.0.0.0:4000"
```

### 2️⃣ Frontend
```bash
cd SWP391-G4-FE
npm run dev
# Open: http://localhost:5173
```

### 3️⃣ Test
- Navigate to http://localhost:5173#/login
- Enter: driver@example.com / 123456
- Should redirect to Driver Dashboard

### 4️⃣ Verify
- Open DevTools (F12)
- Application → LocalStorage → parkflow_user
- Session should be persisted

---

## Documentation Map

```
📚 DOCUMENTATION
│
├── 🚀 SETUP & DEPLOYMENT
│   ├── API_SETUP_GUIDE.md
│   │   ├── Prerequisites
│   │   ├── Backend Setup
│   │   ├── Frontend Setup
│   │   ├── Test Credentials
│   │   └── Troubleshooting
│   │
│   └── .env (Configuration)
│       └── VITE_PARKING_API_URL=...
│
├── 🧪 TESTING & QA
│   └── TESTING_CHECKLIST.md
│       ├── Phase 1: Backend API (8 tests)
│       ├── Phase 2: Frontend (6 tests)
│       ├── Phase 3: RBAC (6 tests)
│       ├── Phase 4: Error Handling (3 tests)
│       └── Phase 5: Security (3 tests)
│
├── 📝 IMPLEMENTATION DETAILS
│   ├── IMPLEMENTATION_SUMMARY.md
│   │   ├── What Changed
│   │   ├── Features Implemented
│   │   ├── Database Schema
│   │   └── Verification Checklist
│   │
│   └── BEFORE_AFTER_COMPARISON.md
│       ├── Login Flow Comparison
│       ├── Architecture Comparison
│       ├── Password Security
│       └── Deployment Readiness
│
└── 💻 SOURCE CODE
    ├── Backend (server.js)
    │   ├── seedDatabase()
    │   ├── POST /api/auth/login
    │   └── GET /api/users
    │
    ├── Frontend (React/TypeScript)
    │   ├── userService.ts (API layer)
    │   ├── Login.tsx (UI)
    │   └── App.tsx (Session)
    │
    └── Config
        └── .env (Environment)
```

---

## Decision Tree

```
❓ Where do I...

└─ Start the application?
   └─ Read: API_SETUP_GUIDE.md → "Bước 1-2"

└─ Test login functionality?
   └─ Read: TESTING_CHECKLIST.md → "Phase 2"

└─ Understand what changed?
   └─ Read: BEFORE_AFTER_COMPARISON.md → "Overview"

└─ Fix a problem?
   └─ Read: API_SETUP_GUIDE.md → "Troubleshooting"

└─ Add a new API endpoint?
   └─ Read: IMPLEMENTATION_SUMMARY.md → "Next Steps"

└─ Deploy to production?
   └─ Read: API_SETUP_GUIDE.md → "Production" (TODO)
```

---

## Key Metrics

| Metric | Value |
|--------|-------|
| **Documentation Files** | 5 |
| **Setup Time** | ~10 minutes |
| **Test Cases** | 26 |
| **API Endpoints** | 4 |
| **Test Users** | 4 |
| **Code Files Modified** | 3 |
| **Code Files Created** | 1 |
| **Security Issues Fixed** | 5+ |

---

## Checklist Before Proceeding

- [ ] Read API_SETUP_GUIDE.md
- [ ] Start backend server
- [ ] Start frontend server  
- [ ] Test login with provided credentials
- [ ] Verify session persistence
- [ ] Run TESTING_CHECKLIST.md tests
- [ ] Review BEFORE_AFTER_COMPARISON.md
- [ ] Understand the changes
- [ ] Plan next steps

---

## Support & Questions

### Common Questions

**Q: How do I add a new user?**
- A: Use backend SQL or create register API call

**Q: How do I change a password?**
- A: Directly in database (for now) - TODO: Password change API

**Q: Can I use this in production?**
- A: Almost - needs JWT tokens instead of localStorage

**Q: How do I deploy?**
- A: See "Next Steps" in IMPLEMENTATION_SUMMARY.md

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-16 | Initial API integration |
| - | TBD | JWT authentication |
| - | TBD | Production deployment |

---

## Document Maintenance

| Document | Last Updated | Maintainer | Status |
|----------|--------------|------------|--------|
| API_SETUP_GUIDE.md | 2026-06-16 | Dev Team | ✅ Current |
| TESTING_CHECKLIST.md | 2026-06-16 | QA Team | ✅ Current |
| IMPLEMENTATION_SUMMARY.md | 2026-06-16 | Dev Team | ✅ Current |
| BEFORE_AFTER_COMPARISON.md | 2026-06-16 | Dev Team | ✅ Current |
| README (This File) | 2026-06-16 | Dev Team | ✅ Current |

---

## Navigation

**Start Here:** [API_SETUP_GUIDE.md](./API_SETUP_GUIDE.md)  
**Test Here:** [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md)  
**Learn Here:** [BEFORE_AFTER_COMPARISON.md](./BEFORE_AFTER_COMPARISON.md)  
**Details Here:** [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

---

*Last Updated: 2026-06-16*  
*Status: ✅ Complete and Ready*  
*Next: Follow API_SETUP_GUIDE.md to get started*
