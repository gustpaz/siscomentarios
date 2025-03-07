import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratamento de erros
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface LoginResponse {
  token: string;
}

export interface MaquinaAtiva {
  machine_id: string;
  ultimo_acesso: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senha?: string;
  status: 'ativo' | 'inativo';
  validade: string;
  ativo?: MaquinaAtiva | null;
}

export interface LogEntry {
  id: string;
  tipo: string;
  usuario: string;
  ip: string;
  data: string;
}

export interface Stats {
  totalUsuarios: number;
  usuariosAtivos: number;
  usuariosInativos: number;
  licencasExpiradas: number;
  usuariosOnline: number;
}

export interface ErroAutomacao {
  id: string;
  email: string;
  erro: string;
  data: string;
  resolvido: boolean;
  nome_usuario: string;
}

export const login = async (email: string, senha: string): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', { email, senha });
  return response.data;
};

export const getUsuarios = async (): Promise<Usuario[]> => {
  const response = await api.get<Usuario[]>('/usuarios');
  return response.data;
};

export const createUsuario = async (usuario: Omit<Usuario, 'id' | 'status' | 'ativo'>): Promise<Usuario> => {
  const response = await api.post<Usuario>('/usuarios', usuario);
  return response.data;
};

export const updateUsuario = async (id: string, usuario: Partial<Usuario>): Promise<Usuario> => {
  const response = await api.put<Usuario>(`/usuarios/${id}`, usuario);
  return response.data;
};

export const toggleUsuarioStatus = async (id: string): Promise<Usuario> => {
  const response = await api.patch<Usuario>(`/usuarios/${id}/toggle-status`);
  return response.data;
};

export const deleteUsuario = async (id: string): Promise<void> => {
  await api.delete(`/usuarios/${id}`);
};

export const getStats = async (): Promise<Stats> => {
  const response = await api.get<Stats>('/stats');
  return response.data;
};

export const getErrosAutomacao = async (): Promise<ErroAutomacao[]> => {
  const response = await api.get<ErroAutomacao[]>('/erros-automacao');
  return response.data;
};

export const resolverErroAutomacao = async (id: string): Promise<void> => {
  await api.patch(`/erros-automacao/${id}/resolver`);
};

export const getLogs = async (): Promise<LogEntry[]> => {
  const response = await api.get<LogEntry[]>('/logs');
  return response.data;
};

export default api;
