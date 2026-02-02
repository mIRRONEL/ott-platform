import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset}  ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  header: (msg: string) => console.log(`\n${colors.cyan}${msg}${colors.reset}\n`)
};

interface CreateAdminOptions {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  fromEnv?: boolean;
}

// Pool for database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ott_platform'
});

// Prompt for input
const question = (prompt: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

// Validate email
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength
const isStrongPassword = (password: string): boolean => {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
};

// Create admin user
const createAdminUser = async (options: CreateAdminOptions): Promise<void> => {
  let email = options.email;
  let password = options.password;
  let firstName = options.firstName || 'Admin';
  let lastName = options.lastName || 'User';
  let role = options.role || 'admin';
  const isNonInteractive = !!(email && password);

  try {
    log.header('🔐 OTT Platform - Admin User Creation');

    // Get email
    if (!isNonInteractive) {
      while (!email) {
        email = await question('📧 Enter admin email: ');
        
        if (!isValidEmail(email)) {
          log.error('Invalid email format');
          email = undefined;
          continue;
        }

        // Check if email already exists
        const existingUser = await pool.query(
          'SELECT id FROM users WHERE email = $1',
          [email]
        );

        if (existingUser.rows.length > 0) {
          log.error('Email already exists in system');
          email = undefined;
        }
      }

      // Get password
      while (!password) {
        password = await question('🔑 Enter admin password (min 8 chars, uppercase, number): ');

        if (!isStrongPassword(password)) {
          log.warn('Password must be at least 8 characters with uppercase letter and number');
          password = undefined;
          continue;
        }

        // Confirm password
        const confirmPassword = await question('🔑 Confirm password: ');
        if (password !== confirmPassword) {
          log.error('Passwords do not match');
          password = undefined;
        }
      }

      // Get first name (optional)
      if (!firstName || firstName === 'Admin') {
        const inputFirstName = await question('👤 First name (default: Admin): ');
        if (inputFirstName) firstName = inputFirstName;
      }

      // Get last name (optional)
      if (!lastName || lastName === 'User') {
        const inputLastName = await question('👤 Last name (default: User): ');
        if (inputLastName) lastName = inputLastName;
      }
    } else {
      // Validate non-interactive mode inputs
      if (!isValidEmail(email)) {
        throw new Error('Invalid email format');
      }

      if (!isStrongPassword(password)) {
        throw new Error('Password must be at least 8 characters with uppercase letter and number');
      }

      // Check if email already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Email already exists in system');
      }
    }

    // Display summary
    log.info('Creating admin user with following details:');
    console.log(`   Email: ${colors.cyan}${email}${colors.reset}`);
    console.log(`   Name: ${colors.cyan}${firstName} ${lastName}${colors.reset}`);
    console.log(`   Role: ${colors.cyan}${role}${colors.reset}`);
    
    // Skip confirmation in non-interactive mode
    if (!isNonInteractive) {
      const confirm = await question('\n✓ Continue? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
        log.warn('Admin user creation cancelled');
        await pool.end();
        process.exit(0);
      }
    } else {
      log.info('Proceeding with admin creation...');
    }

    // Hash password
    log.info('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Begin transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create user
      await client.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, status, email_verified, email_verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, email, hashedPassword, firstName, lastName, 'active', true, new Date()]
      );

      log.success('User created');

      // Create admin record
      const adminId = uuidv4();
      await client.query(
        `INSERT INTO admin_users (id, user_id, role, status)
         VALUES ($1, $2, $3, $4)`,
        [adminId, userId, role, 'active']
      );

      log.success('Admin role assigned');

      await client.query('COMMIT');
      log.success('Transaction committed');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    log.header('✅ Admin user created successfully!');
    console.log(`${colors.green}Email:${colors.reset} ${email}`);
    console.log(`${colors.green}Role:${colors.reset} ${role}`);
    console.log(`${colors.green}User ID:${colors.reset} ${userId}\n`);

    log.info('You can now login with this account at the platform.');

  } catch (error) {
    log.error(`Failed to create admin user: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Parse command line arguments
const parseArgs = (): CreateAdminOptions => {
  const args = process.argv.slice(2);
  const options: CreateAdminOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--email':
        options.email = args[++i];
        break;
      case '--password':
        options.password = args[++i];
        break;
      case '--first-name':
        options.firstName = args[++i];
        break;
      case '--last-name':
        options.lastName = args[++i];
        break;
      case '--role':
        options.role = args[++i];
        break;
      case '--help':
        console.log(`
OTT Platform - Admin User Creation Tool

Usage:
  npm run create-admin [options]

Options:
  --email <email>           Admin email address
  --password <password>     Admin password (min 8 chars, uppercase, number)
  --first-name <name>       First name (default: Admin)
  --last-name <name>        Last name (default: User)
  --role <role>             Admin role (default: admin)
  --help                    Show this help message

Examples:
  # Interactive mode
  npm run create-admin

  # With all arguments
  npm run create-admin --email admin@example.com --password SecurePass123 --first-name John --last-name Doe

Environment Variables:
  DB_HOST                   PostgreSQL host (default: localhost)
  DB_PORT                   PostgreSQL port (default: 5432)
  DB_USER                   PostgreSQL user (default: postgres)
  DB_PASSWORD               PostgreSQL password (default: password)
  DB_NAME                   Database name (default: ott_platform)
        `);
        process.exit(0);
        break;
    }
  }

  return options;
};

// Main execution
const main = async () => {
  const options = parseArgs();
  await createAdminUser(options);
};

main().catch((error) => {
  log.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
