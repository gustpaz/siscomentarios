import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

export default function createAuthRouter(db, JWT_SECRET) {
  // Rota de verificação de licença
  router.post('/verify', async (req, res) => {
    console.log('Requisição de verificação recebida:', req.body);
    const { email, password } = req.body;

    try {
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
        return res.status(403).json({ erro: 'Licença expirada' });
      }

      const senhaValida = await bcrypt.compare(password, usuario.senha);
      if (!senhaValida) {
        console.log('Senha inválida para:', email);
        return res.status(401).json({ erro: 'Credenciais inválidas' });
      }

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

  // Rota de login
  router.post('/login', async (req, res) => {
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

  return router;
}