# PostgreSQL Setup Guide

## 1. Install Dependencies

Run the following command to install all new dependencies:

```bash
npm install
```

## 2. Set up PostgreSQL Database

### Option A: Local PostgreSQL Installation

1. Install PostgreSQL on your system
2. Create a new database:
   ```sql
   CREATE DATABASE testas_db;
   CREATE USER testas_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE testas_db TO testas_user;
   ```

### Option B: Using Docker

```bash
docker run --name testas-postgres \
  -e POSTGRES_DB=testas_db \
  -e POSTGRES_USER=testas_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:15
```

### Option C: Cloud Database (Recommended for production)

Use services like:
- **Railway** (Free tier available)
- **Neon** (Free tier available)
- **AWS RDS**
- **Google Cloud SQL**
- **PlanetScale** (Free tier available)

## 3. Environment Configuration

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your database credentials:
   ```env
   DATABASE_URL="postgresql://testas_user:your_password@localhost:5432/testas_db?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-here"
   NEXTAUTH_SECRET="your-nextauth-secret-here"
   NEXTAUTH_URL="http://localhost:3000"
   ```

## 4. Initialize Prisma

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# (Optional) Seed the database
npx prisma db seed
```

## 5. Verify Setup

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Test the authentication:
   - Go to `http://localhost:3000/en/login`
   - Create a new account
   - Sign in with your credentials

## 6. Database Management

### View Database with Prisma Studio
```bash
npx prisma studio
```

### Reset Database (Development only)
```bash
npx prisma db push --force-reset
```

### Generate Migration Files
```bash
npx prisma migrate dev --name init
```

## Features Implemented

✅ **User Authentication**
- Registration with email/password
- Login with JWT tokens
- Session management
- Secure password hashing with bcrypt

✅ **Database Schema**
- Users table with roles
- Sessions table for token management
- Test results table (ready for future features)

✅ **API Routes**
- `/api/auth` - Login/Register
- `/api/auth/logout` - Logout
- `/api/user` - User profile management

✅ **Security Features**
- JWT token validation
- Password hashing
- Session cleanup on logout
- Automatic token validation on app load

## Next Steps

1. **Add Test Management**: Create APIs for test creation and management
2. **Add Dashboard**: Build user dashboard with test results
3. **Add Admin Panel**: Create admin interface for user management
4. **Add Email Verification**: Implement email verification for new users
5. **Add Password Reset**: Implement forgot password functionality