# EHR System Frontend

Next.js frontend application for the Electronic Health Records system.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file:
```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your API URL:
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- User authentication (register, login, email verification)
- Appointment booking and management
- Intake form submission with file uploads
- Dashboard for patients, doctors, and admins
- Redux state management
- Form validation with Zod
- Responsive UI with Tailwind CSS

## Project Structure

```
frontend/
├── app/              # Next.js app directory
│   ├── dashboard/   # Dashboard page
│   ├── login/       # Login page
│   ├── register/    # Registration page
│   └── appointments/# Appointment pages
├── store/           # Redux store and slices
├── lib/             # Utility functions
└── components/      # Reusable components
```
