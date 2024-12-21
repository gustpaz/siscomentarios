import axios from 'axios';

const API_URL = process.env.API_URL || 'https://www.cryptomillion.cloud/api';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'test123';

async function testEndpoint(endpoint, method = 'GET', data = null) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
      validateStatus: null // Para receber todos os status codes
    };

    if (data) {
      config.data = data;
    }

    console.log(`\nTestando ${method} ${API_URL}${endpoint}`);
    const response = await axios(config);
    
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    console.log('Response:', response.data);
    
    return response;
  } catch (error) {
    console.error('Erro:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return null;
  }
}

async function runDiagnostics() {
  console.log('Iniciando diagnóstico do sistema...\n');
  
  // 1. Teste de conectividade básica
  console.log('=== Teste de Conectividade ===');
  try {
    await axios.get(API_URL);
    console.log('✅ Servidor está acessível');
  } catch (error) {
    console.error('❌ Erro de conectividade:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('Sugestão: Verifique se o servidor está rodando e a porta está correta');
    }
  }

  // 2. Teste dos endpoints principais
  console.log('\n=== Teste de Endpoints ===');
  
  // Teste de verificação
  await testEndpoint('/auth/verify', 'POST', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });

  // Teste de login
  const loginResponse = await testEndpoint('/auth/login', 'POST', {
    email: TEST_EMAIL,
    senha: TEST_PASSWORD
  });

  // Se conseguiu fazer login, testa endpoints autenticados
  if (loginResponse?.data?.token) {
    const token = loginResponse.data.token;
    
    // Teste de usuários com autenticação
    await testEndpoint('/usuarios', 'GET', null, {
      Authorization: `Bearer ${token}`
    });
  }

  console.log('\n=== Verificação de Configurações ===');
  console.log('API URL:', API_URL);
  console.log('Node Version:', process.version);
  console.log('Environment:', process.env.NODE_ENV);
}

// Executa os diagnósticos
runDiagnostics().catch(console.error);