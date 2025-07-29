const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'postgres',
});

async function testConnection() {
  try {
    console.log('Attempting to connect to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT current_database(), current_user, version()');
    console.log('📊 Connection details:', result.rows[0]);
    
    // Check if auth_service database exists
    const dbCheck = await client.query("SELECT datname FROM pg_database WHERE datname = 'auth_service'");
    console.log('🔍 auth_service database exists:', dbCheck.rows.length > 0);
    
    await client.end();
    console.log('✅ Connection closed successfully');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Full error:', error);
  }
}

// Wait a bit for PostgreSQL to initialize
setTimeout(testConnection, 5000); 