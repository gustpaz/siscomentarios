import express from 'express';
import cors from 'cors';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'seu_jwt_secret_aqui';

const app = express();

// Configuração de logs detalhados
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  if (req.body) console.log('Body:', req.body);
  next();
});

// Configurar CORS
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Servir arquivos estáticos do build do React
app.use(express.static(path.join(__dirname, '../dist')));

let db;
async function initializeDatabase() {
  db = await open({
    filename: join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      status TEXT CHECK(status IN ('ativo', 'inativo')) DEFAULT 'ativo',
      validade DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      usuario TEXT NOT NULL,
      ip TEXT NOT NULL,
      data DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS maquinas_ativas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      machine_id TEXT NOT NULL,
      ultimo_acesso DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(email, machine_id)
    );

    CREATE TABLE IF NOT EXISTS erros_automacao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      erro TEXT NOT NULL,
      data DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolvido BOOLEAN DEFAULT 0,
      FOREIGN KEY(email) REFERENCES usuarios(email)
    );
  `);

  const adminExists = await db.get('SELECT * FROM admins WHERE email = ?', ['admin@sistema.com']);
  if (!adminExists) {
    const senhaHash = await bcrypt.hash('admin123', 10);
    await db.run('INSERT INTO admins (email, senha) VALUES (?, ?)', ['admin@sistema.com', senhaHash]);
  }
}

// Função para limpar máquinas inativas
async function limparMaquinasInativas() {
  try {
    await db.run(`
      DELETE FROM maquinas_ativas 
      WHERE datetime(ultimo_acesso) < datetime('now', '-1 hour')
    `);
  } catch (error) {
    console.error('Erro ao limpar máquinas inativas:', error);
  }
}

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ erro: 'Token não fornecido' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ erro: 'Token inválido' });
  }
};

// Rota de verificação de licença
app.post('/api/auth/verify', async (req, res) => {
  console.log('Requisição de verificação recebida:', req.body);
  const { email, password, machineId } = req.body;

  if (!machineId) {
    return res.status(400).json({ erro: 'ID da máquina não fornecido' });
  }

  try {
    // Limpar máquinas inativas antes da verificação
    await limparMaquinasInativas();

    const usuario = await db.get('SELECT * FROM usuarios WHERE email = ?', [email]);
    
    if (!usuario) {
      console.log('Usuário não encontrado:', email);
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    console.log('Usuário encontrado, verificando status e validade');
    
    if (usuario.status !== 'ativo') {
      console.log('Licença inativa para:', email);
      return res.status(403).json({ erro: 'Licença inativa' });
    }

    const validadeDate = new Date(usuario.validade);
    const hoje = new Date();

    if (validadeDate < hoje) {
      console.log('Licença expirada para:', email);
      // Atualiza o status para inativo automaticamente
      await db.run('UPDATE usuarios SET status = ? WHERE id = ?', ['inativo', usuario.id]);
      return res.status(403).json({ erro: 'Licença expirada' });
    }

    const senhaValida = await bcrypt.compare(password, usuario.senha);
    if (!senhaValida) {
      console.log('Senha inválida para:', email);
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    // Verificar se já existe uma máquina ativa para este usuário
    const maquinaAtiva = await db.get(
      'SELECT * FROM maquinas_ativas WHERE email = ? AND machine_id != ?',
      [email, machineId]
    );

    if (maquinaAtiva) {
      console.log('Outra máquina já está ativa para esta licença:', email);
      return res.status(403).json({ 
        erro: 'Esta licença já está em uso em outra máquina',
        ultimoAcesso: maquinaAtiva.ultimo_acesso
      });
    }

    // Atualizar ou inserir registro da máquina ativa
    await db.run(`
      INSERT OR REPLACE INTO maquinas_ativas (email, machine_id, ultimo_acesso)
      VALUES (?, ?, datetime('now'))
    `, [email, machineId]);

    console.log('Verificação bem-sucedida para:', email);
    res.json({
      valid: true,
      validUntil: usuario.validade,
      status: usuario.status
    });
  } catch (error) {
    console.error('Erro na verificação:', error);
    res.status(500).json({ erro: 'Erro ao verificar licença' });
  }
});

// Rota para liberar máquina
app.post('/api/auth/liberar-maquina', async (req, res) => {
  const { email, machineId } = req.body;

  if (!email || !machineId) {
    return res.status(400).json({ erro: 'Parâmetros inválidos' });
  }

  try {
    await db.run(
      'DELETE FROM maquinas_ativas WHERE email = ? AND machine_id = ?',
      [email, machineId]
    );

    console.log(`Máquina liberada para: ${email}`);
    res.json({ mensagem: 'Máquina liberada com sucesso' });
  } catch (error) {
    console.error('Erro ao liberar máquina:', error);
    res.status(500).json({ erro: 'Erro ao liberar máquina' });
  }
});

// Rota de login
app.post('/api/auth/login', async (req, res) => {
  console.log('Tentativa de login recebida:', req.body);
  const { email, senha } = req.body;

  try {
    const admin = await db.get('SELECT * FROM admins WHERE email = ?', [email]);
    
    if (!admin) {
      console.log('Admin não encontrado:', email);
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const senhaValida = await bcrypt.compare(senha, admin.senha);
    if (!senhaValida) {
      console.log('Senha inválida para admin:', email);
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: '24h' });
    
    await db.run(
      'INSERT INTO logs (tipo, usuario, ip) VALUES (?, ?, ?)',
      ['Login admin', email, req.ip]
    );

    console.log('Login bem-sucedido para:', email);
    res.json({ token });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ erro: 'Erro ao realizar login' });
  }
});

// Rotas protegidas
app.get('/api/usuarios', authMiddleware, async (req, res) => {
  try {
    const usuarios = await db.all('SELECT id, nome, email, status, validade FROM usuarios ORDER BY created_at DESC');
    
    // Buscar informações de máquinas ativas para cada usuário
    const maquinasAtivas = await db.all('SELECT * FROM maquinas_ativas');
    
    // Adicionar informação de atividade a cada usuário
    const usuariosComAtividade = usuarios.map(usuario => ({
      ...usuario,
      ativo: maquinasAtivas.find(m => m.email === usuario.email) || null
    }));

    res.json(usuariosComAtividade);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ erro: 'Erro ao buscar usuários' });
  }
});

// Rota para obter estatísticas
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const [
      totalUsuarios,
      usuariosAtivos,
      usuariosInativos,
      licencasExpiradas,
      usuariosOnline
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as total FROM usuarios'),
      db.get('SELECT COUNT(*) as total FROM usuarios WHERE status = ?', ['ativo']),
      db.get('SELECT COUNT(*) as total FROM usuarios WHERE status = ?', ['inativo']),
      db.get('SELECT COUNT(*) as total FROM usuarios WHERE validade < datetime("now")'),
      db.get('SELECT COUNT(DISTINCT email) as total FROM maquinas_ativas')
    ]);

    res.json({
      totalUsuarios: totalUsuarios.total,
      usuariosAtivos: usuariosAtivos.total,
      usuariosInativos: usuariosInativos.total,
      licencasExpiradas: licencasExpiradas.total,
      usuariosOnline: usuariosOnline.total
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
  }
});

app.post('/api/usuarios', authMiddleware, async (req, res) => {
  const { nome, email, senha, validade } = req.body;

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const result = await db.run(
      'INSERT INTO usuarios (nome, email, senha, validade) VALUES (?, ?, ?, ?)',
      [nome, email, senhaHash, validade]
    );

    const novoUsuario = await db.get('SELECT id, nome, email, status, validade FROM usuarios WHERE id = ?', [result.lastID]);

    await db.run(
      'INSERT INTO logs (tipo, usuario, ip) VALUES (?, ?, ?)',
      ['Usuário criado', email, req.ip]
    );

    res.status(201).json(novoUsuario);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

app.put('/api/usuarios/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { nome, email, senha, validade } = req.body;

  try {
    if (senha) {
      const senhaHash = await bcrypt.hash(senha, 10);
      await db.run(
        'UPDATE usuarios SET nome = ?, email = ?, senha = ?, validade = ? WHERE id = ?',
        [nome, email, senhaHash, validade, id]
      );
    } else {
      await db.run(
        'UPDATE usuarios SET nome = ?, email = ?, validade = ? WHERE id = ?',
        [nome, email, validade, id]
      );
    }

    const usuarioAtualizado = await db.get(
      'SELECT id, nome, email, status, validade FROM usuarios WHERE id = ?',
      [id]
    );

    await db.run(
      'INSERT INTO logs (tipo, usuario, ip) VALUES (?, ?, ?)',
      ['Usuário atualizado', email, req.ip]
    );

    res.json(usuarioAtualizado);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ erro: 'Erro ao atualizar usuário' });
  }
});

app.patch('/api/usuarios/:id/toggle-status', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [id]);
    const novoStatus = usuario.status === 'ativo' ? 'inativo' : 'ativo';

    await db.run('UPDATE usuarios SET status = ? WHERE id = ?', [novoStatus, id]);

    const usuarioAtualizado = await db.get(
      'SELECT id, nome, email, status, validade FROM usuarios WHERE id = ?',
      [id]
    );

    await db.run(
      'INSERT INTO logs (tipo, usuario, ip) VALUES (?, ?, ?)',
      [`Status do usuário alterado para ${novoStatus}`, usuario.email, req.ip]
    );

    res.json(usuarioAtualizado);
  } catch (error) {
    console.error('Erro ao alterar status:', error);
    res.status(500).json({ erro: 'Erro ao alterar status do usuário' });
  }
});

// Rota para excluir usuário
app.delete('/api/usuarios/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    await db.run('DELETE FROM usuarios WHERE id = ?', [id]);
    await db.run('DELETE FROM maquinas_ativas WHERE email = ?', [usuario.email]);

    await db.run(
      'INSERT INTO logs (tipo, usuario, ip) VALUES (?, ?, ?)',
      ['Usuário excluído', usuario.email, req.ip]
    );

    res.json({ mensagem: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({ erro: 'Erro ao excluir usuário' });
  }
});

// Rota para registrar erro da automação
app.post('/api/erros-automacao', async (req, res) => {
  const { email, erro } = req.body;

  try {
    await db.run(
      'INSERT INTO erros_automacao (email, erro) VALUES (?, ?)',
      [email, erro]
    );

    res.status(201).json({ mensagem: 'Erro registrado com sucesso' });
  } catch (error) {
    console.error('Erro ao registrar erro da automação:', error);
    res.status(500).json({ erro: 'Erro ao registrar erro da automação' });
  }
});

// Rota para buscar erros da automação
app.get('/api/erros-automacao', authMiddleware, async (req, res) => {
  try {
    const erros = await db.all(`
      SELECT ea.*, u.nome as nome_usuario 
      FROM erros_automacao ea 
      JOIN usuarios u ON ea.email = u.email 
      ORDER BY ea.data DESC
    `);
    res.json(erros);
  } catch (error) {
    console.error('Erro ao buscar erros da automação:', error);
    res.status(500).json({ erro: 'Erro ao buscar erros da automação' });
  }
});

// Rota para marcar erro como resolvido
app.patch('/api/erros-automacao/:id/resolver', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    await db.run(
      'UPDATE erros_automacao SET resolvido = 1 WHERE id = ?',
      [id]
    );

    res.json({ mensagem: 'Erro marcado como resolvido' });
  } catch (error) {
    console.error('Erro ao marcar erro como resolvido:', error);
    res.status(500).json({ erro: 'Erro ao marcar erro como resolvido' });
  }
});

app.get('/api/logs', authMiddleware, async (req, res) => {
  try {
    const logs = await db.all('SELECT * FROM logs ORDER BY data DESC LIMIT 100');
    res.json(logs);
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({ erro: 'Erro ao buscar logs' });
  }
});

// Rota para todas as outras requisições - serve o app React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;

initializeDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}).catch(console.error);
