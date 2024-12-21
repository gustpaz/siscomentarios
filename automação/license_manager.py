import requests
import threading
import time
from datetime import datetime
import logging
import uuid
import platform
import hashlib
import socket

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class LicenseManager:
    def __init__(self, api_url='http://localhost:3000/api'):
        self.api_url = api_url
        self.email = None
        self.senha = None
        self.is_valid = False
        self.check_thread = None
        self.running = False
        self.machine_id = self._generate_machine_id()
        self.last_response = None  # Armazena a última resposta da API
        logging.info(f"LicenseManager inicializado com API URL: {api_url}")
        logging.info(f"ID da máquina: {self.machine_id}")

    def _generate_machine_id(self):
        """Gera um ID único para a máquina baseado em características do hardware"""
        try:
            # Coleta informações do sistema
            system_info = [
                platform.node(),  # Nome do computador
                platform.machine(),  # Arquitetura da máquina
                platform.processor(),  # Informação do processador
                str(uuid.getnode()),  # Endereço MAC
                socket.gethostname()  # Nome do host
            ]
            
            # Combina todas as informações e cria um hash
            system_str = ''.join(system_info)
            machine_id = hashlib.sha256(system_str.encode()).hexdigest()
            
            return machine_id
        except Exception as e:
            logging.error(f"Erro ao gerar ID da máquina: {str(e)}")
            # Fallback para um UUID aleatório em caso de erro
            return str(uuid.uuid4())

    def _make_request(self, endpoint, data):
        """Faz uma requisição para a API e armazena a resposta"""
        try:
            url = f"{self.api_url}/{endpoint}"
            self.last_response = requests.post(url, json=data, timeout=10)
            
            # Tenta parsear a resposta JSON
            try:
                self.last_response.json()
            except ValueError:
                logging.error(f"Resposta não-JSON recebida: {self.last_response.text}")
                return False
                
            return self.last_response.status_code == 200
        except requests.exceptions.RequestException as e:
            logging.error(f"Erro na requisição: {str(e)}")
            return False

    def login(self, email, senha):
        """Realiza o login e inicia a verificação periódica"""
        logging.info(f"Tentando login para o email: {email}")
        try:
            self.last_response = requests.post(
                f'{self.api_url}/auth/verify',
                json={
                    'email': email, 
                    'password': senha,
                    'machineId': self.machine_id
                },
                timeout=10
            )
            
            logging.info(f"Resposta do servidor: Status {self.last_response.status_code}")
            
            if self.last_response.status_code == 200:
                self.email = email
                self.senha = senha
                self.is_valid = True
                self._start_periodic_check()
                logging.info("Login realizado com sucesso")
                return True
            elif self.last_response.status_code == 403:
                try:
                    response_data = self.last_response.json()
                    if 'erro' in response_data and 'licença já está em uso' in response_data['erro'].lower():
                        ultimo_acesso = response_data.get('ultimoAcesso', 'desconhecido')
                        logging.error(f"Licença em uso em outra máquina. Último acesso: {ultimo_acesso}")
                    else:
                        logging.error(f"Falha no login: {response_data.get('erro', 'Erro desconhecido')}")
                except ValueError:
                    logging.error("Erro ao processar resposta do servidor")
                self.is_valid = False
                return False
            else:
                try:
                    error_msg = self.last_response.json().get('erro', 'Erro desconhecido')
                    logging.error(f"Falha no login: {error_msg}")
                except ValueError:
                    logging.error("Erro ao processar resposta do servidor")
                self.is_valid = False
                return False
                
        except requests.exceptions.Timeout:
            logging.error("Timeout ao conectar com o servidor de licenças")
            self.is_valid = False
            return False
        except requests.exceptions.ConnectionError:
            logging.error("Erro de conexão com o servidor de licenças")
            self.is_valid = False
            return False
        except Exception as e:
            logging.error(f"Erro inesperado ao verificar licença: {str(e)}")
            self.is_valid = False
            return False

    def logout(self):
        """Realiza o logout e libera a máquina"""
        if self.email and self.machine_id:
            try:
                logging.info(f"Tentando liberar máquina para o email: {self.email}")
                self.last_response = requests.post(
                    f'{self.api_url}/auth/liberar-maquina',
                    json={
                        'email': self.email,
                        'machineId': self.machine_id
                    },
                    timeout=10
                )
                
                if self.last_response.status_code == 200:
                    logging.info("Máquina liberada com sucesso")
                else:
                    try:
                        error_msg = self.last_response.json().get('erro', 'Erro desconhecido')
                        logging.error(f"Erro ao liberar máquina: {error_msg}")
                    except ValueError:
                        logging.error("Erro ao processar resposta do servidor")
                    
            except Exception as e:
                logging.error(f"Erro ao liberar máquina: {str(e)}")
            
            # Limpa as credenciais e para a verificação
            self.stop()
            self.email = None
            self.senha = None
            self.is_valid = False

    def _start_periodic_check(self):
        """Inicia a thread de verificação periódica"""
        if self.check_thread is None:
            self.running = True
            self.check_thread = threading.Thread(target=self._periodic_check)
            self.check_thread.daemon = True
            self.check_thread.start()
            logging.info("Iniciada verificação periódica de licença")

    def _periodic_check(self):
        """Verifica a licença a cada 30 minutos"""
        while self.running:
            time.sleep(1800)  # 30 minutos
            logging.info("Realizando verificação periódica de licença")
            if not self.verify_license():
                logging.warning("Licença expirada ou inválida durante verificação periódica")
                self.is_valid = False
                break

    def verify_license(self):
        """Verifica se a licença ainda é válida"""
        if not self.email or not self.senha:
            return False
            
        try:
            logging.info(f"Verificando licença para o email: {self.email}")
            self.last_response = requests.post(
                f'{self.api_url}/auth/verify',
                json={
                    'email': self.email, 
                    'password': self.senha,
                    'machineId': self.machine_id
                },
                timeout=10
            )
            
            if self.last_response.status_code == 200:
                logging.info("Verificação de licença bem-sucedida")
                return True
            elif self.last_response.status_code == 403:
                try:
                    response_data = self.last_response.json()
                    if 'erro' in response_data and 'licença já está em uso' in response_data['erro'].lower():
                        ultimo_acesso = response_data.get('ultimoAcesso', 'desconhecido')
                        logging.error(f"Licença em uso em outra máquina. Último acesso: {ultimo_acesso}")
                    else:
                        logging.error(f"Falha na verificação: {response_data.get('erro', 'Erro desconhecido')}")
                except ValueError:
                    logging.error("Erro ao processar resposta do servidor")
                return False
            else:
                try:
                    error_msg = self.last_response.json().get('erro', 'Erro desconhecido')
                    logging.error(f"Falha na verificação de licença: {error_msg}")
                except ValueError:
                    logging.error("Erro ao processar resposta do servidor")
                return False
                
        except requests.exceptions.Timeout:
            logging.error("Timeout ao verificar licença")
            return False
        except requests.exceptions.ConnectionError:
            logging.error("Erro de conexão ao verificar licença")
            return False
        except Exception as e:
            logging.error(f"Erro inesperado ao verificar licença: {str(e)}")
            return False

    def stop(self):
        """Para a verificação periódica"""
        logging.info("Parando verificação periódica de licença")
        self.running = False
        if self.check_thread:
            self.check_thread.join()
            self.check_thread = None
