/**
 * Script de teste para a API de submissão de trabalhos
 * 
 * Uso: npx ts-node scripts/test-submission-api.ts
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN || 'seu_token_aqui';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  message: string;
  error?: any;
}

const results: TestResult[] = [];

async function testGetModalities() {
  try {
    console.log('\n📋 Testando GET /api/v1/events/modalities...');
    
    const response = await fetch(`${API_BASE_URL}/api/v1/events/modalities`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    const data = await response.json() as any;
    
    if (data.success && Array.isArray(data.data)) {
      results.push({
        name: 'GET /api/v1/events/modalities',
        status: 'PASS',
        message: `Retornou ${data.data.length} evento(s)`,
      });
      console.log('✅ Sucesso');
      return data.data[0]?._id;
    } else {
      throw new Error('Resposta inválida');
    }
  } catch (error) {
    results.push({
      name: 'GET /api/v1/events/modalities',
      status: 'FAIL',
      message: 'Erro ao buscar modalidades',
      error,
    });
    console.log('❌ Erro:', error);
    return null;
  }
}

async function testSubmitArticle(eventId: string) {
  try {
    console.log('\n📤 Testando POST /api/v1/articles/submit...');

    // Criar arquivo de teste
    const testFilePath = path.join('/tmp', 'test-article.txt');
    fs.writeFileSync(testFilePath, 'Conteúdo de teste do artigo científico');

    const formData = new FormData();
    formData.append('event_id', eventId);
    formData.append('modality', 'ART');
    formData.append('project_name', 'Teste de Submissão de Trabalho');
    formData.append('file', fs.createReadStream(testFilePath));
    formData.append('authors', JSON.stringify([
      {
        name: 'João Silva',
        email: 'joao@test.com',
        institution: 'Universidade Teste',
        is_advisor: true,
      },
    ]));
    formData.append('participants', JSON.stringify([
      {
        name: 'Maria Santos',
        email: 'maria@test.com',
        role: 'Pesquisadora',
        is_advisor: false,
      },
    ]));
    formData.append('project_config', JSON.stringify({
      max_authors: 1,
      max_participants: 4,
      max_advisors: 1,
    }));

    const response = await fetch(`${API_BASE_URL}/api/v1/articles/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        ...formData.getHeaders(),
      },
      body: formData as any,
    });

    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    const data = await response.json() as any;

    if (data.success && data.data?._id) {
      results.push({
        name: 'POST /api/v1/articles/submit',
        status: 'PASS',
        message: `Trabalho submetido com ID: ${data.data._id}`,
      });
      console.log('✅ Sucesso');
      return data.data._id;
    } else {
      throw new Error('Resposta inválida');
    }
  } catch (error) {
    results.push({
      name: 'POST /api/v1/articles/submit',
      status: 'FAIL',
      message: 'Erro ao submeter trabalho',
      error,
    });
    console.log('❌ Erro:', error);
    return null;
  }
}

async function testListArticles() {
  try {
    console.log('\n📚 Testando GET /api/v1/articles/list...');

    const response = await fetch(`${API_BASE_URL}/api/v1/articles/list`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    const data = await response.json() as any;

    if (data.success && Array.isArray(data.data)) {
      results.push({
        name: 'GET /api/v1/articles/list',
        status: 'PASS',
        message: `Retornou ${data.data.length} trabalho(s)`,
      });
      console.log('✅ Sucesso');
    } else {
      throw new Error('Resposta inválida');
    }
  } catch (error) {
    results.push({
      name: 'GET /api/v1/articles/list',
      status: 'FAIL',
      message: 'Erro ao listar trabalhos',
      error,
    });
    console.log('❌ Erro:', error);
  }
}

async function runTests() {
  console.log('🧪 Iniciando testes da API de submissão de trabalhos...');
  console.log(`📍 URL Base: ${API_BASE_URL}`);
  console.log(`🔐 Token: ${TEST_TOKEN.substring(0, 20)}...`);

  const eventId = await testGetModalities();
  
  if (eventId) {
    const articleId = await testSubmitArticle(eventId);
    await testListArticles();
  }

  // Relatório final
  console.log('\n\n📊 RELATÓRIO DE TESTES');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.error) {
      console.log(`   Erro: ${result.error}`);
    }
  });

  console.log('='.repeat(50));
  console.log(`Total: ${results.length} | Passou: ${passed} | Falhou: ${failed}`);
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
