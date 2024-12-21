@app.route('/logout')
def logout():
    try:
        if license_manager:
            if license_manager.logout():  # Verifica se o logout foi bem-sucedido
                logger.info("Máquina liberada e usuário realizou logout com sucesso")
                flash('Logout realizado com sucesso!')
            else:
                logger.error("Falha ao liberar a máquina durante o logout")
                flash('Erro ao realizar logout')
        session.clear()
        return redirect(url_for('login'))
    except Exception as e:
        logger.error(f"Erro durante logout: {e}")
        flash('Erro ao realizar logout')
        return redirect(url_for('login'))

@app.route('/encerrar')
def encerrar():
    try:
        logger.info("Iniciando processo de encerramento do servidor")
        if license_manager:
            if license_manager.logout():  # Verifica se o logout foi bem-sucedido
                logger.info("Máquina liberada com sucesso")
            else:
                logger.error("Falha ao liberar a máquina durante o encerramento")
        
        session.clear()
        
        def shutdown():
            try:
                if scheduler and scheduler.running:
                    scheduler.shutdown()
                logger.info("Parando verificação periódica de licença")
                
                time.sleep(1)  # Pequeno delay para garantir que a resposta seja enviada
                func = request.environ.get('werkzeug.server.shutdown')
                if func is not None:
                    func()
                    logger.info("Servidor encerrado com sucesso")
                else:
                    logger.error("Não foi possível encerrar o servidor usando Werkzeug, forçando o encerramento")
                    os._exit(0)  # Força o encerramento se não estiver usando Werkzeug
            except Exception as e:
                logger.error(f"Erro durante encerramento: {e}")
                os._exit(1)
        
        Thread(target=shutdown).start()
        flash('Sistema está sendo encerrado...')
        return redirect(url_for('login'))
    except Exception as e:
        logger.error(f"Erro ao encerrar servidor: {str(e)}")
        flash('Erro ao encerrar o servidor')
        return redirect(url_for('login'))
