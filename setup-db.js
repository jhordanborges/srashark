const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:6%40p!GNXJzp%232@db.frafbpvdlqxwailymtra.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Conectado ao Supabase!');

    const schemaSql = fs.readFileSync(path.join(__dirname, 'supabase', 'schema.sql'), 'utf-8');
    console.log('Executando schema.sql...');
    await client.query(schemaSql);
    console.log('Schema aplicado com sucesso!');

    const seedSql = fs.readFileSync(path.join(__dirname, 'supabase', 'seed.sql'), 'utf-8');
    console.log('Executando seed.sql...');
    await client.query(seedSql);
    console.log('Seed aplicado com sucesso!');

  } catch (err) {
    console.error('Erro ao executar o banco de dados:', err);
  } finally {
    await client.end();
  }
}

run();
