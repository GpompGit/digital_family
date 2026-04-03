# React Frontend — UI Style Guide & Patterns

> This file defines the visual and structural patterns used across the Digital Family
> React frontend. ALL new pages and components MUST follow these conventions to ensure
> a consistent, polished look and feel.

## Layout Containers

- **List/dashboard pages:** `max-w-5xl mx-auto` (wide, set by Layout.tsx)
- **Form pages** (upload, edit, account): `max-w-lg mx-auto`
- **Cards/panels:** `bg-white rounded-xl shadow-sm p-6`
- **Filter bars:** `bg-white rounded-xl shadow-sm p-4 mb-4`

## Typography

- **Page headings:** `text-xl font-bold mb-4`
- **Card titles:** `font-medium text-gray-900`
- **Section labels:** `text-sm font-medium text-gray-700 mb-1` (form labels)
- **Subtle text:** `text-sm text-gray-500` or `text-xs text-gray-400`
- **Error messages:** `text-red-500 text-xs mt-1`

## Color System

| Purpose | Classes | Hex |
|---------|---------|-----|
| **Primary action** | `bg-blue-600 text-white hover:bg-blue-700` | #2563EB |
| **Secondary action** | `border border-gray-300 text-gray-700 hover:bg-gray-50` | — |
| **Danger action** | `border border-red-300 text-red-600 hover:bg-red-50` | — |
| **Category badge** | `bg-blue-50 text-blue-700` | — |
| **Asset badge** | `bg-amber-50 text-amber-700` | — |
| **Tag badge** | Use tag's own `color` field | — |
| **Admin role badge** | `bg-purple-50 text-purple-700` | — |
| **Success badge** | `bg-green-50 text-green-700` | — |
| **Warning badge** | `bg-amber-50 text-amber-700` | — |
| **Error alert** | `bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm mb-4` | — |
| **Page background** | `bg-gray-50` | — |
| **Card background** | `bg-white` | — |

## Buttons

- **Primary (submit, save):**
  `w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50`
- **Secondary (cancel, back):**
  `border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 font-medium`
- **Danger (delete):**
  `border border-red-300 text-red-600 py-2.5 rounded-lg hover:bg-red-50 font-medium disabled:opacity-50`
- **Small button (in tables/lists):**
  `text-blue-600 hover:underline text-xs` (edit), `text-red-600 hover:underline text-xs` (delete)
- **Disabled state:** always add `disabled:opacity-50`

## Form Inputs

- **Text input / select:**
  `w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`
- **Textarea:** same as text input + `resize-none`
- **File input:**
  `w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100`
- **Label:** `block text-sm font-medium text-gray-700 mb-1`
- **Small label (admin):** `block text-xs text-gray-500 mb-1`
- **Form spacing:** `space-y-4` between form groups
- **Admin form grid:** `grid grid-cols-1 sm:grid-cols-2 gap-3`

## Badges & Pills

- **Generic badge:** `inline-flex items-center px-2 py-0.5 rounded-full text-xs`
- **Category:** add `bg-blue-50 text-blue-700`
- **Asset:** add `bg-amber-50 text-amber-700`
- **Role (admin):** add `bg-purple-50 text-purple-700`
- **Attribute pill:** `text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded`

## Tables (Admin)

- **Table wrapper:** `bg-white rounded-xl shadow-sm overflow-hidden`
- **Table:** `w-full text-sm`
- **Header row:** `bg-gray-50 text-left text-xs text-gray-500 uppercase`
- **Header cell:** `px-4 py-3`
- **Body row:** `hover:bg-gray-50`
- **Body cell:** `px-4 py-3`
- **Row divider:** `divide-y divide-gray-100` on `<tbody>`

## Document List Items

- **Card wrapper:** `block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow`
- **Title:** `font-medium text-gray-900 truncate`
- **Metadata row:** `flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500`
- **Chevron:** `text-gray-300 text-lg shrink-0` → `›`

## Filter Grids

- **Primary filters (row 1):** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`
- **Secondary filters (row 2):** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100`
- **Toggle link:** `text-xs text-gray-400 hover:text-blue-600`

## Loading States

- **Skeleton screens** (not "Loading..." text) for document lists and detail pages
- Use `animate-pulse` + `bg-gray-200 rounded` for skeleton elements
- Import from `@/components/Skeleton.tsx`

## Navigation

- **Top nav:** `bg-white shadow-sm border-b border-gray-200`
- **Brand link:** `text-lg font-bold text-blue-600`
- **Nav button (upload):** `text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700`
- **Nav link (settings):** `text-sm text-gray-600 hover:text-gray-900`
- **Language switcher:** pill buttons with `bg-blue-600 text-white` for active, `text-gray-500 hover:bg-gray-100` for inactive
- **Admin tabs:** `px-3 py-1.5 text-sm rounded-lg` with same active/inactive pattern

## Responsive Design

- All pages must work on iPhone (375px viewport minimum)
- Use Tailwind breakpoints: `sm:` (640px), `lg:` (1024px)
- Hide secondary info on mobile: `hidden sm:table-cell` for table columns
- Stack grids on mobile: always start with `grid-cols-1`

## i18n / Translations

- **Never hardcode English text** — always use `t('key')` from `useTranslation()`
- **Keys follow dot notation:** `section.subsection.key` (e.g., `document.institution`)
- **Plurals:** `key_one` / `key_other` with `{{ count }}` interpolation
- **All 3 locales** (en.json, de.json, es.json) must be updated together

## Component Patterns

- **Page components** go in `src/pages/` (one per route)
- **Reusable UI** goes in `src/components/`
- **Admin pages** go in `src/pages/admin/`
- **All pages** use `useTranslation()` for text
- **Data fetching** in `useEffect` with loading/error states
- **Forms** use `react-hook-form` with `register()` and `formState.errors`
- **API calls** through `src/services/api.ts` (never call axios directly from pages)

## Back Links

- Pattern: `<Link to="..." className="text-sm text-blue-600 hover:underline mb-4 inline-block">{t('common.back')}</Link>`
- Always use the `← Back` pattern from translations

## Empty States

- Centered: `text-center py-12`
- Message: `text-gray-400 mb-4`
- Action link: `text-blue-600 hover:underline`
