---
name: react-frontend
description: React frontend development skill for component creation, state management, and build validation
---

# React Frontend Development

Use this skill when building or modifying React frontend components.

## Tech Stack
- React 18+ with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- React Hook Form for form management
- Axios or fetch for API calls

## Component Creation Checklist

### Structure
- Functional components with hooks (no class components)
- One component per file, PascalCase naming (`UserProfile.tsx`)
- Props interface defined and exported: `interface UserProfileProps { ... }`
- Co-locate styles, tests, and types with the component

### TypeScript
- No `any` types — define proper interfaces for all data structures
- Use `React.FC<Props>` or explicit return types
- Shared types in a `types/` directory
- API response types match backend schemas

### State Management
- Local state (`useState`) for component-specific data
- Context API for shared app state (auth, theme, user)
- Avoid prop drilling beyond 2 levels — use Context or composition
- Custom hooks (`useAuth`, `useApi`) for reusable logic

### Forms
- Use React Hook Form for complex forms
- Validate on submit and on blur for critical fields
- Show inline error messages below fields
- Disable submit button while processing
- Handle API errors gracefully with user-friendly messages

### API Integration
- API calls in custom hooks or service files, not in components
- Loading states for all async operations
- Error boundaries for unexpected failures
- Optimistic updates where appropriate

## Styling Rules (Tailwind CSS)
- Mobile-first responsive design
- Use Tailwind utility classes, avoid custom CSS unless necessary
- Consistent spacing scale (p-2, p-4, p-6, p-8)
- Dark mode support with `dark:` variants
- Accessible color contrast ratios

## Testing
- Test files co-located: `ComponentName.test.tsx`
- Use React Testing Library (not Enzyme)
- Test user interactions, not implementation details
- Test accessibility with `@testing-library/jest-dom`
- Mock API calls with MSW (Mock Service Worker)

## File Structure
```
src/
├── components/          # Reusable UI components
│   ├── Button.tsx
│   └── Button.test.tsx
├── pages/               # Route-level components
├── hooks/               # Custom hooks
├── services/            # API service functions
├── context/             # React Context providers
├── types/               # Shared TypeScript types
├── utils/               # Helper functions
└── App.tsx
```

## Build Validation
After any changes:
1. `npx tsc --noEmit` — no TypeScript errors
2. `npx eslint src/` — no lint errors
3. `npm run build` — production build succeeds
4. `npm test` — all tests pass
5. Visual check in browser at multiple viewport sizes
