# OTT Platform - Admin User Management

This directory contains utility scripts for managing OTT Platform administrators.

## Setup

### 1. Install Dependencies

```bash
cd scripts
npm install
```

### 2. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your database credentials
# For local development:
# DB_HOST=localhost
# DB_PORT=5432
# DB_USER=postgres
# DB_PASSWORD=password
# DB_NAME=ott_platform

# For Docker deployment:
# DB_HOST=postgres
# DB_PORT=5432
```

## Creating an Admin User

### Interactive Mode (Recommended)

```bash
npm run create-admin
```

This will:
1. Prompt for email address
2. Ask for a strong password (min 8 chars, uppercase, number)
3. Ask for first and last name
4. Show a summary for confirmation
5. Create the admin user in the database

**Example Session:**
```
🔐 OTT Platform - Admin User Creation

📧 Enter admin email: admin@example.com
🔑 Enter admin password (min 8 chars, uppercase, number): SecurePass123
🔑 Confirm password: SecurePass123
👤 First name (default: Admin): John
👤 Last name (default: User): Doe

ℹ Creating admin user with following details:
   Email: admin@example.com
   Name: John Doe
   Role: admin

✓ Continue? (yes/no): yes

ℹ Hashing password...
✓ User created
✓ Admin role assigned
✓ Transaction committed

✅ Admin user created successfully!
Email: admin@example.com
Role: admin
User ID: 550e8400-e29b-41d4-a716-446655440000

ℹ You can now login with this account at the platform.
```

### Command-Line Mode

Provide all arguments at once:

```bash
npm run create-admin -- \
  --email admin@example.com \
  --password SecurePass123 \
  --first-name John \
  --last-name Doe \
  --role admin
```

### Docker Mode

If you're running the database in Docker:

```bash
# From scripts directory
docker exec -it ott-postgres psql -U postgres -d ott_platform -c "SELECT * FROM users WHERE email = 'admin@example.com';"

# Or use the CLI with Docker credentials
DB_HOST=localhost DB_PORT=5432 npm run create-admin
```

## Available Options

| Option | Description | Default | Required |
|--------|-------------|---------|----------|
| `--email` | Admin email address | - | No (prompted) |
| `--password` | Admin password | - | No (prompted) |
| `--first-name` | First name | Admin | No |
| `--last-name` | Last name | User | No |
| `--role` | Admin role | admin | No |
| `--help` | Show help message | - | - |

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one number (0-9)

**Valid Examples:**
- `SecurePass123`
- `Admin@2024`
- `OttPlatform99`

**Invalid Examples:**
- `password123` (no uppercase)
- `PASSWORD` (no number)
- `Pass1` (too short)

## Verifying Admin User

Check if admin was created successfully:

```bash
# Query the database
psql -U postgres -h localhost -d ott_platform
SELECT u.id, u.email, u.first_name, u.last_name, au.role 
FROM users u 
LEFT JOIN admin_users au ON u.id = au.user_id 
WHERE u.email = 'admin@example.com';
```

## Login

1. Go to http://localhost:5173
2. Click "Login"
3. Enter admin email and password
4. You're now logged in with admin privileges

## Security Notes

✅ **What's Secure:**
- No credentials hardcoded in scripts
- Uses environment variables from `.env`
- Interactive confirmation required
- Passwords hashed with bcrypt (salt rounds: 10)
- Supports transactional creation (rollback on error)
- User interaction prevents accidental admin creation

⚠️ **Best Practices:**
- Never commit `.env` file to git (it's in .gitignore)
- Use strong, unique passwords
- Store `.env` securely
- Rotate admin credentials periodically
- Review who has access to run this script

## Troubleshooting

### Connection Refused
```
error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:** Ensure PostgreSQL is running and `DB_HOST` is correct.

### Email Already Exists
```
✗ Email already exists in system
```
**Solution:** Use a different email or delete the existing user first.

### Password Too Weak
```
⚠ Password must be at least 8 characters with uppercase letter and number
```
**Solution:** Use a stronger password matching the requirements.

### Permission Denied
```
error: permission denied for schema public
```
**Solution:** Ensure your PostgreSQL user has the required permissions.

## Cleanup

To remove an admin user:

```bash
psql -U postgres -h localhost -d ott_platform
DELETE FROM admin_users WHERE id = '<admin_id>';
DELETE FROM users WHERE id = '<user_id>';
```

## Support

For issues or questions, check the main OTT Platform README or contact the development team.
