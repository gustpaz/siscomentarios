from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    TimeoutException,
    WebDriverException,
    NoSuchElementException,
    StaleElementReferenceException
)
import json
import os
import signal
import psutil
import time
import webbrowser
import logging
from threading import Thread, Lock
from concurrent.futures import ThreadPoolExecutor, as_completed
import undetected_chromedriver as uc
from license_manager import LicenseManager
from datetime import datetime, timedelta
from functools import wraps
import socket
import traceback
import tempfile
import shutil
import requests

# Configuração do Flask
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'sua_chave_secreta_aqui')

# URL da API do sistema de licenças
API_URL = 'http://localhost:3000/api'

# Função para registrar erros no servidor
def registrar_erro(email, erro):
    """Registra um erro da automação no servidor"""
    try:
        response = requests.post(
            f'{API_URL}/erros-automacao',
            json={'email': email, 'erro': erro},
            timeout=10
        )
        if response.status_code == 201:
            logger.info(f"Erro registrado para {email}: {erro}")
        else:
            logger.error(f"Falha ao registrar erro: {response.text}")
    except Exception as e:
        logger.error(f"Erro ao registrar erro no servidor: {e}")

# Configuração do Logger
def setup_logger():
    log_dir = 'logs'
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    logger = logging.getLogger('TikTokBot')
    logger.setLevel(logging.DEBUG)

    log_file = os.path.join(log_dir, f'tiktok_bot_{datetime.now().strftime("%Y%m%d")}.log')
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    return logger

logger = setup_logger()

# Exceções personalizadas
class TikTokError(Exception):
    """Classe base para exceções do TikTok Bot"""
    pass

class CommentError(TikTokError):
    """Erro ao tentar comentar em um vídeo"""
    pass

class ProfileError(TikTokError):
    """Erro relacionado aos perfis"""
    pass

class CookieError(TikTokError):
    """Erro no processamento de cookies"""
    pass

def init_license_manager():
    """Inicializa o gerenciador de licenças"""
    try:
        license_manager = LicenseManager(api_url=API_URL)
        logger.info(f"Sistema de licenças inicializado com API: CommentTikPro")
        return license_manager
    except Exception as e:
        logger.error(f"Erro ao inicializar sistema de licenças: {e}")
        return None

# Inicializa o gerenciador de licenças globalmente
license_manager = init_license_manager()

# Middleware para verificar licença
def require_license(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not license_manager:
            flash('Sistema de licenças não disponível')
            return redirect(url_for('login'))
        
        if 'user_email' not in session or 'password' not in session:
            flash('Faça login para continuar')
            return redirect(url_for('login'))
        
        try:
            if license_manager.verify_license():
                return f(*args, **kwargs)
            else:
                if hasattr(license_manager, 'last_response') and license_manager.last_response:
                    try:
                        response_data = license_manager.last_response.json()
                        if 'erro' in response_data:
                            flash(response_data['erro'])
                    except:
                        flash('Sua licença expirou ou está inválida')
                else:
                    flash('Sua licença expirou ou está inválida')
                session.clear()
                return redirect(url_for('login'))
        except Exception as e:
            logger.error(f"Erro ao verificar licença: {e}")
            session.clear()
            flash('Erro ao verificar licença')
            return redirect(url_for('login'))
            
    return decorated_function

# Lock para sincronização de threads
comment_lock = Lock()

# Configurações de diretórios
DATA_DIR = 'data'
PROFILES_DIR = os.path.join(DATA_DIR, 'profiles')
COMMENTS_DIR = os.path.join(DATA_DIR, 'comments')

def ensure_directory(directory):
    """Garante que o diretório existe"""
    if not os.path.exists(directory):
        os.makedirs(directory)

def safe_load_json(file_path, default_value=None):
    """Carrega arquivo JSON com tratamento de erros"""
    try:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return default_value if default_value is not None else []
    except Exception as e:
        logger.error(f"Erro ao carregar arquivo {file_path}: {e}")
        return default_value if default_value is not None else []

def safe_save_json(file_path, data):
    """Salva arquivo JSON com tratamento de erros"""
    try:
        directory = os.path.dirname(file_path)
        if not os.path.exists(directory):
            os.makedirs(directory)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        return True
    except Exception as e:
        logger.error(f"Erro ao salvar arquivo {file_path}: {e}")
        return False

def get_folders(base_dir):
    """Retorna lista de pastas em um diretório"""
    try:
        ensure_directory(base_dir)
        folders = [d for d in os.listdir(base_dir) 
                  if os.path.isdir(os.path.join(base_dir, d))]
        return folders if folders else ['default']
    except Exception as e:
        logger.error(f"Erro ao listar pastas em {base_dir}: {e}")
        return ['default']

def load_profiles(folder='default'):
    """Carrega perfis de uma pasta específica"""
    file_path = os.path.join(PROFILES_DIR, folder, 'profiles.json')
    return safe_load_json(file_path, [])

def load_comments(folder='default'):
    """Carrega comentários de uma pasta específica"""
    file_path = os.path.join(COMMENTS_DIR, folder, 'comments.json')
    return safe_load_json(file_path, [])

def save_profiles(profiles, folder='default'):
    """Salva perfis em uma pasta específica"""
    file_path = os.path.join(PROFILES_DIR, folder, 'profiles.json')
    return safe_save_json(file_path, profiles)

def save_comments(comments, folder='default'):
    """Salva comentários em uma pasta específica"""
    file_path = os.path.join(COMMENTS_DIR, folder, 'comments.json')
    return safe_save_json(file_path, comments)

def migrate_data():
    """Migra dados dos arquivos antigos para a nova estrutura de pastas"""
    try:
        # Garante que os diretórios existem
        ensure_directory(PROFILES_DIR)
        ensure_directory(COMMENTS_DIR)
        ensure_directory(os.path.join(PROFILES_DIR, 'default'))
        ensure_directory(os.path.join(COMMENTS_DIR, 'default'))
        
        # Migra perfis
        if os.path.exists('profiles.json'):
            logger.info("Migrando perfis para a pasta default...")
            profiles = safe_load_json('profiles.json', [])
            if profiles:
                save_profiles(profiles, 'default')
                # Faz backup do arquivo original
                backup_path = 'profiles.json.bak'
                if os.path.exists(backup_path):
                    os.remove(backup_path)
                os.rename('profiles.json', backup_path)
                logger.info("Migração de perfis concluída")
        
        # Migra comentários
        if os.path.exists('comments.json'):
            logger.info("Migrando comentários para a pasta default...")
            comments = safe_load_json('comments.json', [])
            if comments:
                save_comments(comments, 'default')
                # Faz backup do arquivo original
                backup_path = 'comments.json.bak'
                if os.path.exists(backup_path):
                    os.remove(backup_path)
                os.rename('comments.json', backup_path)
                logger.info("Migração de comentários concluída")
    except Exception as e:
        logger.error(f"Erro durante a migração de dados: {e}\n{traceback.format_exc()}")
        raise

class CookieHandler:
    @staticmethod
    def parse_netscape_format(cookie_string):
        """Parse cookies no formato Netscape/Mozilla"""
        try:
            cookies = []
            lines = cookie_string.strip().split('\n')
            
            for line in lines:
                if line and not line.startswith('#'):
                    try:
                        fields = line.strip().split('\t')
                        if len(fields) >= 7:
                            cookie = {
                                'name': fields[5],
                                'value': fields[6],
                                'domain': fields[0],
                                'path': fields[2]
                            }
                            cookies.append(cookie)
                    except Exception as e:
                        logger.warning(f"Erro ao processar linha de cookie Netscape: {e}")
            return cookies
        except Exception as e:
            logger.error(f"Erro ao processar cookies Netscape: {e}")
            raise CookieError(f"Falha ao processar cookies Netscape: {str(e)}")

    @staticmethod
    def parse_string_format(cookie_string):
        """Parse cookies no formato string"""
        try:
            cookies = []
            pairs = cookie_string.split(';')
            
            for pair in pairs:
                try:
                    if '=' in pair:
                        name, value = pair.split('=', 1)
                        cookie = {
                            'name': name.strip(),
                            'value': value.strip(),
                            'domain': '.tiktok.com',
                            'path': '/'
                        }
                        cookies.append(cookie)
                except Exception as e:
                    logger.warning(f"Erro ao processar par de cookies: {e}")
            return cookies
        except Exception as e:
            logger.error(f"Erro ao processar cookies string: {e}")
            raise CookieError(f"Falha ao processar cookies string: {str(e)}")

    @staticmethod
    def parse_json_format(cookie_string):
        """Parse cookies no formato JSON"""
        try:
            data = json.loads(cookie_string)
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return [data]
        except Exception as e:
            logger.error(f"Erro ao processar cookies JSON: {e}")
            raise CookieError(f"Falha ao processar cookies JSON: {str(e)}")
        return []

    @staticmethod
    def process_cookies(cookie_input):
        """Processa cookies em diferentes formatos com tratamento de erros"""
        try:
            cookie_input = cookie_input.strip()
            logger.debug("Iniciando processamento de cookies")
            
            if cookie_input.startswith('{') or cookie_input.startswith('['):
                cookies = CookieHandler.parse_json_format(cookie_input)
            elif '\t' in cookie_input:
                cookies = CookieHandler.parse_netscape_format(cookie_input)
            else:
                cookies = CookieHandler.parse_string_format(cookie_input)
                
            if not cookies:
                raise CookieError("Nenhum cookie válido encontrado")
                
            logger.info(f"Processados {len(cookies)} cookies com sucesso")
            return cookies
        except Exception as e:
            logger.error(f"Erro no processamento de cookies: {e}")
            raise CookieError(f"Falha no processamento de cookies: {str(e)}")

def cleanup_temp_dir(temp_dir, instance_id, max_retries=3, delay=2):
    """Função auxiliar para limpar diretório temporário com retentativas"""
    for attempt in range(max_retries):
        try:
            # Aguarda um pouco para garantir que todos os processos foram encerrados
            time.sleep(delay)
            
            if os.path.exists(temp_dir):
                # Tenta remover arquivos individualmente primeiro
                for root, dirs, files in os.walk(temp_dir, topdown=False):
                    for name in files:
                        try:
                            file_path = os.path.join(root, name)
                            os.chmod(file_path, 0o777)  # Garante permissões de escrita
                            os.remove(file_path)
                        except Exception as e:
                            logger.warning(f"Não foi possível remover arquivo {name} na instância {instance_id}: {e}")
                    
                    for name in dirs:
                        try:
                            dir_path = os.path.join(root, name)
                            os.chmod(dir_path, 0o777)  # Garante permissões de escrita
                            os.rmdir(dir_path)
                        except Exception as e:
                            logger.warning(f"Não foi possível remover diretório {name} na instância {instance_id}: {e}")
                
                # Tenta remover o diretório principal
                shutil.rmtree(temp_dir, ignore_errors=True)
                
                if not os.path.exists(temp_dir):
                    logger.info(f"Diretório temporário da instância {instance_id} removido com sucesso na tentativa {attempt + 1}")
                    return True
            else:
                logger.info(f"Diretório temporário da instância {instance_id} já não existe")
                return True
                
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Tentativa {attempt + 1} de remover diretório temporário da instância {instance_id} falhou: {e}")
                time.sleep(delay * (attempt + 1))  # Aumenta o delay a cada tentativa
            else:
                logger.error(f"Erro ao remover diretório temporário da instância {instance_id} após {max_retries} tentativas: {e}")
    
    return False

def process_comment_batch(video_url, profile_comment_pairs, instance_id, profile_folder='default'):
    """Processa um lote de comentários em uma única instância do Chrome"""
    driver = None
    temp_dir = None
    try:
        # Cria um diretório temporário único para esta instância
        temp_dir = tempfile.mkdtemp(prefix=f'chrome_instance_{instance_id}_')
        
        # Configura as opções do Chrome com o diretório temporário
        options = uc.ChromeOptions()
        options.add_argument(f'--user-data-dir={temp_dir}')
        options.add_argument('--disable-background-networking')
        options.add_argument('--disable-background-timer-throttling')
        options.add_argument('--disable-backgrounding-occluded-windows')
        
        # Adiciona um pequeno delay baseado no ID da instância para evitar conflitos
        time.sleep(instance_id * 2)
        
        driver = uc.Chrome(options=options)
        logger.info(f"Nova instância do Chrome {instance_id} iniciada para processar {len(profile_comment_pairs)} comentários")

        for profile_name, comment_text in profile_comment_pairs:
            try:
                with comment_lock:
                    profiles = load_profiles(profile_folder)
                    profile_data = next((p for p in profiles if p['name'] == profile_name), None)
                
                if not profile_data:
                    logger.warning(f"Perfil {profile_name} não encontrado")
                    continue

                logger.info(f"Processando comentário para perfil: {profile_name}")
                
                # Login
                driver.get("https://www.tiktok.com/foryou")
                time.sleep(3)

                for cookie in profile_data['cookies']:
                    try:
                        driver.add_cookie({
                            'name': cookie['name'],
                            'value': cookie['value'],
                            'domain': cookie.get('domain', '.tiktok.com'),
                            'path': cookie.get('path', '/')
                        })
                    except Exception as e:
                        erro = f"Erro ao adicionar cookie: {str(e)}"
                        logger.error(f"{erro} para {profile_name}")
                        registrar_erro(profile_data['email'], erro)
                        continue

                driver.get("https://www.tiktok.com/")
                time.sleep(3)

                # Navega para o vídeo
                driver.get(video_url)
                time.sleep(5)

                # Tenta encontrar a caixa de comentário
                try:
                    comment_box = WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.XPATH, "//div[@contenteditable='true' and @role='textbox']"))
                    )
                except TimeoutException:
                    erro = f"Caixa de comentário não encontrada para {video_url}"
                    logger.warning(erro)
                    registrar_erro(profile_data['email'], erro)
                    continue

                comment_box.clear()
                comment_box.send_keys(comment_text)

                time.sleep(2)

                try:
                    publish_button = WebDriverWait(driver, 10).until(
                        EC.element_to_be_clickable((By.XPATH, "//div[@aria-label='Publicar' and @role='button']"))
                    )
                except TimeoutException:
                    erro = "Botão de publicar não encontrado"
                    logger.warning(erro)
                    registrar_erro(profile_data['email'], erro)
                    continue

                driver.execute_script("arguments[0].scrollIntoView();", publish_button)

                for _ in range(3):
                    try:
                        publish_button.click()
                        time.sleep(3)
                        break
                    except ElementClickInterceptedException:
                        logger.warning("Tentativa de clique falhou, tentando novamente...")
                        time.sleep(2)
                else:
                    try:
                        driver.execute_script("arguments[0].click();", publish_button)
                    except Exception as e:
                        erro = f"Falha ao clicar no botão de publicar: {str(e)}"
                        logger.error(erro)
                        registrar_erro(profile_data['email'], erro)
                        continue

                time.sleep(3)
                logger.info(f"Comentário enviado com sucesso para o perfil {profile_name}")

            except Exception as e:
                erro = f"Erro ao processar comentário: {str(e)}\n{traceback.format_exc()}"
                logger.error(f"{erro} para {profile_name}")
                registrar_erro(profile_data['email'], erro)
                continue

    except Exception as e:
        erro = f"Erro na instância do Chrome {instance_id}: {str(e)}\n{traceback.format_exc()}"
        logger.error(erro)
        if profile_data:
            registrar_erro(profile_data['email'], erro)

    finally:
        if driver:
            try:
                # Fecha todas as janelas e encerra o processo
                driver.quit()
                logger.info(f"Instância do Chrome {instance_id} fechada com sucesso")
            except Exception as e:
                logger.error(f"Erro ao fechar instância do Chrome {instance_id}: {e}")
        
        # Tenta limpar o diretório temporário com retentativas
        if temp_dir:
            cleanup_temp_dir(temp_dir, instance_id)

def divide_pairs_into_batches(pairs, num_batches):
    """Divide os pares de perfil-comentário em lotes para processamento paralelo"""
    batch_size = len(pairs) // num_batches
    if batch_size == 0:
        batch_size = 1
    
    batches = []
    for i in range(0, len(pairs), batch_size):
        batch = pairs[i:i + batch_size]
        if batch:  # Só adiciona se o lote não estiver vazio
            batches.append(batch)
    
    return batches

@app.route('/')
@require_license
def index():
    try:
        # Lista todas as pastas disponíveis
        profile_folders = get_folders(PROFILES_DIR)
        comment_folders = get_folders(COMMENTS_DIR)
        
        # Carrega dados da pasta selecionada (ou default)
        selected_profile_folder = request.args.get('profile_folder', 'default')
        selected_comment_folder = request.args.get('comment_folder', 'default')
        
        profiles = load_profiles(selected_profile_folder)
        comments = load_comments(selected_comment_folder)
        
        return render_template('index.html', 
                             profiles=profiles, 
                             comments=comments,
                             profile_folders=profile_folders,
                             comment_folders=comment_folders,
                             selected_profile_folder=selected_profile_folder,
                             selected_comment_folder=selected_comment_folder)
    except Exception as e:
        logger.error(f"Erro ao carregar página inicial: {e}\n{traceback.format_exc()}")
        flash('Erro ao carregar dados')
        return render_template('index.html', 
                             profiles=[], 
                             comments=[],
                             profile_folders=['default'],
                             comment_folders=['default'],
                             selected_profile_folder='default',
                             selected_comment_folder='default')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if not license_manager:
        init_license_manager()
        if not license_manager:
            flash('Sistema de licenças não disponível')
            return render_template('login.html')
    
    if 'user_email' in session and 'password' in session:
        try:
            if license_manager.verify_license():
                return redirect(url_for('index'))
        except Exception as e:
            logger.error(f"Erro na verificação de licença durante login: {e}")
            session.clear()
        
    if request.method == 'POST':
        email = request.form.get('email')
        senha = request.form.get('senha')
        
        try:
            if 'user_email' in session:
                flash('Você já está logado. Faça logout para acessar com outra conta.')
                return redirect(url_for('index'))

            if license_manager.login(email, senha):
                session['user_email'] = email
                session['password'] = senha
                flash('Login realizado com sucesso!')
                return redirect(url_for('index'))
            else:
                # Verifica se há uma resposta da última requisição
                if hasattr(license_manager, 'last_response') and license_manager.last_response:
                    try:
                        response_data = license_manager.last_response.json()
                        if 'erro' in response_data and 'licença já está em uso' in response_data['erro'].lower():
                            ultimo_acesso = response_data.get('ultimoAcesso', 'desconhecido')
                            flash(f"A licença já está em uso em outra máquina. Último acesso: {ultimo_acesso}.")
                            return render_template('login.html', 
                                                error=response_data['erro'],
                                                ultimo_acesso=ultimo_acesso)
                        else:
                            flash(response_data.get('erro', 'Email ou senha inválidos'))
                    except ValueError:
                        flash('Email ou senha inválidos')
                else:
                    flash('Email ou senha inválidos')
        except Exception as e:
            logger.error(f"Erro durante login: {e}")
            flash('Erro ao realizar login')
            
    return render_template('login.html')



    logger.info("Iniciando processo de encerramento do servidor")
    
    # Libera a licença se estiver logado
    if license_manager and 'user_email' in session:
        # Para a verificação periódica de licença antes de fazer logout
        license_manager.stop()
        logger.info("Verificação periódica de licença parada")
        
        license_manager.logout()
        logger.info("Máquina liberada com sucesso")
    
    # Limpa a sessão
    session.clear()
    
    logger.info("Máquina liberada e usuário realizou logout com sucesso.")
    
    # Tenta encerrar o servidor Werkzeug
    func = request.environ.get('werkzeug.server.shutdown')
    if func is not None:
        func()
        logger.info("Servidor encerrado via Werkzeug")
    else:
        logger.warning("Não foi possível encerrar o servidor via Werkzeug, forçando encerramento")
        pid = os.getpid()
        os.kill(pid, signal.SIGTERM)
    
    # Retorna resposta imediatamente
    flash('Sistema está sendo encerrado...')
    return redirect(url_for('login'))
    except Exception as e:
        logger.error(f"Erro durante logout: {e}")
        flash('Erro ao realizar logout')
        return redirect(url_for('login'))
=======
    logger.info("Iniciando processo de encerramento do servidor")
    
    # Libera a licença se estiver logado
    if license_manager and 'user_email' in session:
        # Para a verificação periódica de licença antes de fazer logout
        license_manager.stop()
        logger.info("Verificação periódica de licença parada")
        
        license_manager.logout()
        logger.info("Máquina liberada com sucesso")
    
    # Limpa a sessão
    session.clear()
    
    logger.info("Máquina liberada e usuário realizou logout com sucesso.")
    
    # Tenta encerrar o servidor Werkzeug
    func = request.environ.get('werkzeug.server.shutdown')
    if func is not None:
        func()
        logger.info("Servidor encerrado via Werkzeug")
    else:
        logger.warning("Não foi possível encerrar o servidor via Werkzeug, forçando encerramento")
        pid = os.getpid()
        os.kill(pid, signal.SIGTERM)
    
    # Retorna resposta imediatamente
    flash('Sistema está sendo encerrado...')
    return redirect(url_for('login'))
        session.clear()
        flash('Logout realizado com sucesso!')
        return redirect(url_for('login'))
    except Exception as e:
        logger.error(f"Erro durante logout: {e}")
        flash('Erro ao realizar logout')
        return redirect(url_for('login'))
=======
@app.route('/logout')
def logout():
    """Realiza o logout do usuário e encerra o servidor"""
    try:
        logger.info("Iniciando processo de logout")
        
        # Libera a licença se estiver logado
        if license_manager and 'user_email' in session:
            license_manager.stop()
            logger.info("Verificação periódica de licença parada")
            
            license_manager.logout()
            logger.info("Máquina liberada com sucesso")
        
        # Limpa a sessão
        session.clear()
        logger.info("Sessão limpa com sucesso")
        
        # Retorna resposta imediatamente
        flash('Logout realizado com sucesso!')
        return redirect(url_for('login'))
        
    except Exception as e:
        logger.error(f"Erro durante logout: {e}")
        flash('Erro ao realizar logout')
        return redirect(url_for('login'))
=======
    logger.info("Iniciando processo de encerramento do servidor")
    
    # Libera a licença se estiver logado
    if license_manager and 'user_email' in session:
        # Para a verificação periódica de licença antes de fazer logout
        license_manager.stop()
        logger.info("Verificação periódica de licença parada")
        
        license_manager.logout()
        logger.info("Máquina liberada com sucesso")
    
    # Limpa a sessão
    session.clear()
    
    logger.info("Máquina liberada e usuário realizou logout com sucesso.")
    
    # Tenta encerrar o servidor Werkzeug
    func = request.environ.get('werkzeug.server.shutdown')
    if func is not None:
        func()
        logger.info("Servidor encerrado via Werkzeug")
    else:
        logger.warning("Não foi possível encerrar o servidor via Werkzeug, forçando encerramento")
        pid = os.getpid()
        os.kill(pid, signal.SIGTERM)
    
    # Retorna resposta imediatamente
    flash('Sistema está sendo encerrado...')
    return redirect(url_for('login'))
    except Exception as e:
        logger.error(f"Erro durante logout: {e}")
        flash('Erro ao realizar logout')
        return redirect(url_for('login'))
=======
    logger.info("Iniciando processo de encerramento do servidor")
    
    # Libera a licença se estiver logado
    if license_manager and 'user_email' in session:
        # Para a verificação periódica de licença antes de fazer logout
        license_manager.stop()
        logger.info("Verificação periódica de licença parada")
        
        license_manager.logout()
        logger.info("Máquina liberada com sucesso")
    
    # Limpa a sessão
    session.clear()
    
    logger.info("Máquina liberada e usuário realizou logout com sucesso.")
    
    # Tenta encerrar o servidor Werkzeug
    func = request.environ.get('werkzeug.server.shutdown')
    if func is not None:
        func()
        logger.info("Servidor encerrado via Werkzeug")
    else:
        logger.warning("Não foi possível encerrar o servidor via Werkzeug, forçando encerramento")
        pid = os.getpid()
        os.kill(pid, signal.SIGTERM)
    
    # Retorna resposta imediatamente
    flash('Sistema está sendo encerrado...')
    return redirect(url_for('login'))
        session.clear()
        flash('Logout realizado com sucesso!')
        return redirect(url_for('login'))
    except Exception as e:
        logger.error(f"Erro durante logout: {e}")
        flash('Erro ao realizar logout')
        return redirect(url_for('login'))

# A segunda definição da função 'encerrar' foi removida

@app.route('/add_profile', methods=['POST'])
@require_license
def add_profile():
    try:
        name = request.form['name']
        cookies_raw = request.form['cookies'].strip()
        folder = request.form.get('folder', 'default')
        
        if not name or not cookies_raw:
            raise ValueError("Nome do perfil e cookies são obrigatórios")
        
        processed_cookies = CookieHandler.process_cookies(cookies_raw)
        
        if not processed_cookies:
            raise CookieError("Nenhum cookie válido encontrado")
        
        profiles = load_profiles(folder)
        
        # Verifica se já existe um perfil com o mesmo nome
        if any(p['name'] == name for p in profiles):
            raise ProfileError("Já existe um perfil com este nome")
            
        profiles.append({'name': name, 'cookies': processed_cookies})
        
        if save_profiles(profiles, folder):
            logger.info(f"Perfil '{name}' adicionado com sucesso na pasta '{folder}'")
            flash('Perfil adicionado com sucesso!')
        else:
            raise ProfileError("Erro ao salvar o perfil")
            
    except (ValueError, CookieError, ProfileError) as e:
        logger.warning(f"Erro ao adicionar perfil: {str(e)}")
        flash(f'Erro: {str(e)}')
    except Exception as e:
        logger.error(f"Erro inesperado ao adicionar perfil: {e}\n{traceback.format_exc()}")
        flash('Erro inesperado ao adicionar perfil')
        
    return redirect(url_for('index'))

@app.route('/add_comment', methods=['POST'])
@require_license
def add_comment():
    try:
        comment = request.form['comment'].strip()
        folder = request.form.get('folder', 'default')
        
        if any(ord(char) > 10000 for char in comment):
            flash('Não é possível adicionar emojis nos comentários!')
            return redirect(url_for('index'))
        
        comments = load_comments(folder)
        comments.append(comment)

        if save_comments(comments, folder):
            logger.info(f"Comentário adicionado com sucesso na pasta '{folder}'")
            flash('Comentário adicionado com sucesso!')
        else:
            raise Exception("Erro ao salvar comentário")

    except Exception as e:
        logger.error(f"Erro ao adicionar comentário: {e}")
        flash(f'Erro ao adicionar comentário: {str(e)}')
        
    return redirect(url_for('index'))

@app.route('/create_folder', methods=['POST'])
@require_license
def create_folder():
    try:
        folder_name = request.form['folder_name'].strip()
        folder_type = request.form['folder_type']  # 'profiles' ou 'comments'
        
        if not folder_name:
            raise ValueError("Nome da pasta é obrigatório")
            
        if folder_type not in ['profiles', 'comments']:
            raise ValueError("Tipo de pasta inválido")
            
        base_dir = PROFILES_DIR if folder_type == 'profiles' else COMMENTS_DIR
        new_folder_path = os.path.join(base_dir, folder_name)
        
        if os.path.exists(new_folder_path):
            raise ValueError("Já existe uma pasta com este nome")
            
        os.makedirs(new_folder_path)
        
        # Cria arquivo JSON vazio na nova pasta
        file_name = 'profiles.json' if folder_type == 'profiles' else 'comments.json'
        safe_save_json(os.path.join(new_folder_path, file_name), [])
        
        logger.info(f"Pasta '{folder_name}' criada com sucesso para {folder_type}")
        flash('Pasta criada com sucesso!')
        
    except Exception as e:
        logger.error(f"Erro ao criar pasta: {e}")
        flash(f'Erro ao criar pasta: {str(e)}')
        
    return redirect(url_for('index'))

@app.route('/remove_folder', methods=['POST'])
@require_license
def remove_folder():
    try:
        folder_name = request.form['folder_name'].strip()
        folder_type = request.form['folder_type']  # 'profiles' ou 'comments'
        
        if folder_name == 'default':
            raise ValueError("A pasta 'default' não pode ser removida")
            
        if folder_type not in ['profiles', 'comments']:
            raise ValueError("Tipo de pasta inválido")
            
        base_dir = PROFILES_DIR if folder_type == 'profiles' else COMMENTS_DIR
        folder_path = os.path.join(base_dir, folder_name)
        
        if not os.path.exists(folder_path):
            raise ValueError("Pasta não encontrada")
            
        # Remove a pasta e seu conteúdo
        import shutil
        shutil.rmtree(folder_path)
        
        logger.info(f"Pasta '{folder_name}' removida com sucesso de {folder_type}")
        flash('Pasta removida com sucesso!')
        
    except Exception as e:
        logger.error(f"Erro ao remover pasta: {e}")
        flash(f'Erro ao remover pasta: {str(e)}')
        
    return redirect(url_for('edit_remove'))

@app.route('/comment', methods=['POST'])
@require_license
def comment():
    try:
        video_url = request.form['video_url']
        selected_comments = request.form.getlist('comments')
        selected_profiles = request.form.getlist('profiles')
        num_instances = int(request.form.get('num_instances', 1))

        if len(selected_comments) != len(selected_profiles):
            raise ValueError('O número de comentários deve ser igual ao número de perfis selecionados.')

        # Cria pares de perfil-comentário
        profile_comment_pairs = list(zip(selected_profiles, selected_comments))
        
        # Divide os pares em lotes baseado no número de instâncias
        batches = divide_pairs_into_batches(profile_comment_pairs, num_instances)
        
        # Processa os lotes em paralelo
        with ThreadPoolExecutor(max_workers=num_instances) as executor:
            futures = []
            for i, batch in enumerate(batches):
                selected_profile_folder = request.form.get('profile_folder', 'default')
                future = executor.submit(process_comment_batch, video_url, batch, i, selected_profile_folder)
                futures.append(future)
            
            # Aguarda todos os lotes terminarem
            for future in as_completed(futures):
                try:
                    future.result()  # Obtém o resultado ou exceção
                except Exception as e:
                    logger.error(f"Erro em um dos lotes de comentários: {e}")

        flash('Comentários enviados com sucesso!')
        
    except ValueError as e:
        flash(f'Erro: {str(e)}')
        logger.error(f"Erro de validação: {e}")
    except Exception as e:
        flash('Erro ao processar comentários')
        logger.error(f"Erro no processo de comentários: {e}\n{traceback.format_exc()}")

    return redirect(url_for('index'))

@app.route('/edit_remove')
@require_license
def edit_remove():
    try:
        # Verifica se o usuário está logado
        if 'user_email' not in session:
            flash('Faça login para continuar')
            return redirect(url_for('login'))

        # Verifica se a licença é válida
        if not license_manager.verify_license():
            flash('Licença inválida ou expirada')
            session.clear()
            return redirect(url_for('login'))

        # Lista todas as pastas disponíveis
        profile_folders = get_folders(PROFILES_DIR)
        comment_folders = get_folders(COMMENTS_DIR)
        
        # Carrega dados da pasta selecionada (ou default)
        selected_profile_folder = request.args.get('profile_folder', 'default')
        selected_comment_folder = request.args.get('comment_folder', 'default')
        
        # Garante que os diretórios existem
        ensure_directory(os.path.join(PROFILES_DIR, selected_profile_folder))
        ensure_directory(os.path.join(COMMENTS_DIR, selected_comment_folder))
        
        # Carrega os dados
        profiles = load_profiles(selected_profile_folder)
        comments = load_comments(selected_comment_folder)
        
        # Renderiza o template com os dados
        return render_template('edit_remove.html', 
                             profiles=profiles, 
                             comments=comments,
                             profile_folders=profile_folders,
                             comment_folders=comment_folders,
                             selected_profile_folder=selected_profile_folder,
                             selected_comment_folder=selected_comment_folder)
    except Exception as e:
        logger.error(f"Erro ao carregar dados: {e}\n{traceback.format_exc()}")
        flash('Erro ao carregar dados. Verifique se os arquivos de perfis e comentários existem e estão acessíveis.')
        return redirect(url_for('index'))

@app.route('/remove', methods=['POST'])
@require_license
def remove():
    try:
        selected_comments = request.form.getlist('remove_comments')
        selected_profiles = request.form.getlist('remove_profiles')

        if not selected_comments and not selected_profiles:
            flash('Nenhum item selecionado para remoção')
            return redirect(url_for('edit_remove'))

        # Remove comentários
        if selected_comments:
            comment_folder = request.form.get('comment_folder', 'default')
            comments = load_comments(comment_folder)
            comments = [c for c in comments if c not in selected_comments]
            if not save_comments(comments, comment_folder):
                raise Exception("Erro ao salvar comentários atualizados")
            logger.info(f"Removidos {len(selected_comments)} comentários da pasta '{comment_folder}'")

        # Remove perfis
        if selected_profiles:
            profile_folder = request.form.get('profile_folder', 'default')
            profiles = load_profiles(profile_folder)
            profiles = [p for p in profiles if p['name'] not in selected_profiles]
            if not save_profiles(profiles, profile_folder):
                raise Exception("Erro ao salvar perfis atualizados")
            logger.info(f"Removidos {len(selected_profiles)} perfis da pasta '{profile_folder}'")

        flash('Itens removidos com sucesso!')
        
    except Exception as e:
        logger.error(f"Erro ao remover itens: {e}\n{traceback.format_exc()}")
        flash('Erro ao remover itens')
        
    return redirect(url_for('edit_remove'))

@app.route('/edit_profile', methods=['POST'])
@require_license
def edit_profile():
    try:
        old_name = request.form['old_name']
        new_name = request.form['new_name']
        new_cookies_raw = request.form['new_cookies'].strip()
        folder = request.form.get('folder', 'default')
        
        if not new_name or not new_cookies_raw:
            raise ValueError("Nome do perfil e cookies são obrigatórios")
        
        # Processa os novos cookies
        processed_cookies = CookieHandler.process_cookies(new_cookies_raw)
        
        if not processed_cookies:
            raise CookieError("Nenhum cookie válido encontrado")

        profiles = load_profiles(folder)
        
        # Verifica se o novo nome já existe (exceto se for o mesmo perfil)
        if new_name != old_name and any(p['name'] == new_name for p in profiles):
            raise ProfileError("Já existe um perfil com este nome")

        # Atualiza o perfil
        profile_updated = False
        for profile in profiles:
            if profile['name'] == old_name:
                profile['name'] = new_name
                profile['cookies'] = processed_cookies
                profile_updated = True
                break

        if not profile_updated:
            raise ProfileError("Perfil não encontrado")

        if not save_profiles(profiles, folder):
            raise Exception("Erro ao salvar alterações do perfil")

        logger.info(f"Perfil '{old_name}' editado com sucesso para '{new_name}'")
        flash('Perfil editado com sucesso!')
        
    except (ValueError, CookieError, ProfileError) as e:
        logger.warning(f"Erro ao editar perfil: {str(e)}")
        flash(f'Erro: {str(e)}')
    except Exception as e:
        logger.error(f"Erro inesperado ao editar perfil: {e}\n{traceback.format_exc()}")
        flash('Erro inesperado ao editar perfil')
    
    return redirect(url_for('edit_remove'))

@app.route('/edit_comment', methods=['POST'])
@require_license
def edit_comment():
    try:
        old_comment = request.form['old_comment']
        new_comment = request.form['new_comment'].strip()
        folder = request.form.get('folder', 'default')

        if not new_comment:
            raise ValueError("O comentário não pode estar vazio")

        if any(ord(char) > 10000 for char in new_comment):
            raise ValueError('Não é possível adicionar emojis nos comentários')

        comments = load_comments(folder)
        
        # Procura e atualiza o comentário
        comment_updated = False
        for i, comment in enumerate(comments):
            if comment == old_comment:
                comments[i] = new_comment
                comment_updated = True
                break

        if not comment_updated:
            raise ValueError("Comentário original não encontrado")

        if not save_comments(comments, folder):
            raise Exception("Erro ao salvar alterações do comentário")

        logger.info(f"Comentário editado com sucesso: '{old_comment}' -> '{new_comment}'")
        flash('Comentário editado com sucesso!')
        
    except ValueError as e:
        logger.warning(f"Erro ao editar comentário: {str(e)}")
        flash(f'Erro: {str(e)}')
    except Exception as e:
        logger.error(f"Erro inesperado ao editar comentário: {e}\n{traceback.format_exc()}")
        flash('Erro inesperado ao editar comentário')
        
    return redirect(url_for('edit_remove'))

@app.route('/move_to_folder', methods=['POST'])
@require_license
def move_to_folder():
    try:
        source_folder = request.form.get('source_folder')
        target_folder = request.form.get('target_folder')
        item_type = request.form.get('item_type')
        items = request.form.getlist('items[]')

        if not all([source_folder, target_folder, item_type, items]):
            flash('Dados incompletos para mover itens')
            return redirect(url_for('edit_remove'))

        if item_type == 'profiles':
            # Move perfis
            source_profiles = load_profiles(source_folder)
            target_profiles = load_profiles(target_folder)
            
            # Filtra os perfis a serem movidos
            profiles_to_move = [p for p in source_profiles if p['name'] in items]
            remaining_profiles = [p for p in source_profiles if p['name'] not in items]
            
            # Adiciona os perfis ao destino
            target_profiles.extend(profiles_to_move)
            
            # Salva as alterações
            if save_profiles(remaining_profiles, source_folder) and save_profiles(target_profiles, target_folder):
                flash('Perfis movidos com sucesso!')
            else:
                flash('Erro ao mover perfis')
                
        elif item_type == 'comments':
            # Move comentários
            source_comments = load_comments(source_folder)
            target_comments = load_comments(target_folder)
            
            # Filtra os comentários a serem movidos
            comments_to_move = [c for c in source_comments if c in items]
            remaining_comments = [c for c in source_comments if c not in items]
            
            # Adiciona os comentários ao destino
            target_comments.extend(comments_to_move)
            
            # Salva as alterações
            if save_comments(remaining_comments, source_folder) and save_comments(target_comments, target_folder):
                flash('Comentários movidos com sucesso!')
            else:
                flash('Erro ao mover comentários')
        
        else:
            flash('Tipo de item inválido')
            
    except Exception as e:
        logger.error(f"Erro ao mover itens: {e}\n{traceback.format_exc()}")
        flash('Erro ao mover itens')
        
    return redirect(url_for('edit_remove'))

@app.route('/encerrar')
def encerrar():
    """Encerra o servidor Flask e libera a licença"""
    logger.info("Iniciando processo de encerramento do servidor")
    
    # Libera a licença se estiver logado
    if license_manager and 'user_email' in session:
        # Para a verificação periódica de licença antes de fazer logout
        license_manager.stop()
        logger.info("Verificação periódica de licença parada")
        
        license_manager.logout()
        logger.info("Máquina liberada com sucesso")
    
    # Limpa a sessão
    session.clear()
    
    logger.info("Máquina liberada e usuário realizou logout com sucesso.")
    
    # Tenta encerrar o servidor Werkzeug
    func = request.environ.get('werkzeug.server.shutdown')
    if func is not None:
        func()
        logger.info("Servidor encerrado via Werkzeug")
    else:
        logger.warning("Não foi possível encerrar o servidor via Werkzeug, forçando encerramento")
        pid = os.getpid()
        os.kill(pid, signal.SIGTERM)
    
    # Retorna resposta imediatamente
    flash('Sistema está sendo encerrado...')
    return redirect(url_for('login'))

if __name__ == '__main__':
    try:
        # Garante que os diretórios de dados existem
        ensure_directory(DATA_DIR)
        ensure_directory(PROFILES_DIR)
        ensure_directory(COMMENTS_DIR)
        ensure_directory(os.path.join(PROFILES_DIR, 'default'))
        ensure_directory(os.path.join(COMMENTS_DIR, 'default'))

        # Cria arquivos JSON vazios se não existirem
        default_profile_file = os.path.join(PROFILES_DIR, 'default', 'profiles.json')
        default_comment_file = os.path.join(COMMENTS_DIR, 'default', 'comments.json')
        
        if not os.path.exists(default_profile_file):
            safe_save_json(default_profile_file, [])
        if not os.path.exists(default_comment_file):
            safe_save_json(default_comment_file, [])

        # Migra dados antigos para a nova estrutura
        migrate_data()
        
        app.run(debug=True)
    except Exception as e:
        logger.critical(f"Erro fatal na aplicação: {e}\n{traceback.format_exc()}")
