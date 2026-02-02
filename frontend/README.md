# OTT Platform Frontend

Modern React-based frontend application for the OTT streaming platform.

## Features

- 🔐 User authentication (Login/Signup)
- 🎬 Browse and search content
- ❤️ Watchlist management
- 👤 User profile management
- 📱 Responsive design
- 🎨 Beautiful Tailwind CSS UI

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **React Router v6** - Navigation
- **Axios** - API client
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **Vite** - Build tool

## Getting Started

### Prerequisites

- Node.js 16+ installed
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The frontend will be available at `http://localhost:5173`

## API Integration

The frontend connects to the API Gateway at `http://localhost:3000/api`

Make sure the OTT platform backend is running:
```bash
docker compose -f docker-compose-prod.yml up -d
```

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── Navbar.tsx
│   └── ProtectedRoute.tsx
├── pages/              # Page components
│   ├── HomePage.tsx
│   ├── LoginPage.tsx
│   ├── SignupPage.tsx
│   ├── BrowsePage.tsx
│   └── ProfilePage.tsx
├── services/           # API client
│   └── api.ts
├── stores/             # State management
│   └── auth.ts
├── App.tsx             # Main app component
├── main.tsx            # Entry point
└── index.css           # Global styles
```

## Features Overview

### Authentication
- User signup with validation
- User login with JWT token storage
- Protected routes requiring authentication
- Logout functionality

### Content Browsing
- Browse all available content
- Search functionality
- Content cards with ratings and metadata
- Add content to watchlist

### User Profile
- View user information
- View watchlist
- Logout functionality

## API Endpoints Used

- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /content/videos` - Get all videos
- `GET /content/search` - Search videos
- `GET /users/profile` - Get user profile
- `GET /users/watchlist` - Get watchlist
- `POST /users/watchlist` - Add to watchlist
- `DELETE /users/watchlist/:id` - Remove from watchlist

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run linter

## Future Enhancements

- Video player component
- Advanced search and filtering
- Payment/subscription management
- Video recommendations
- User notifications
- Comments and ratings
- Social sharing
- Dark/light theme toggle

## License

MIT
