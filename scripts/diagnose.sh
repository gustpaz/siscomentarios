#!/bin/bash

echo "=== Sistema de Diagnóstico ==="
echo "Data: $(date)"
echo

echo "=== 1. Verificando processos Node.js ==="
echo "Processos Node:"
ps aux | grep node
echo "Processos PM2:"
pm2 list
echo

echo "=== 2. Verificando portas em uso ==="
echo "Porta 3000 (API):"
netstat -tlpn | grep :3000
echo "Porta 5173 (Vite):"
netstat -tlpn | grep :5173
echo "Porta 80/443 (Nginx):"
netstat -tlpn | grep ':(80|443)'
echo

echo "=== 3. Verificando logs do servidor ==="
echo "Últimas 20 linhas do log PM2:"
pm2 logs --lines 20
echo

echo "=== 4. Verificando conectividade ==="
echo "Testando API local:"
curl -I http://localhost:3000/api/health
echo "Testando Vite local:"
curl -I http://localhost:5173
echo

echo "=== 5. Verificando configuração Nginx ==="
echo "Status do Nginx:"
systemctl status nginx
echo "Testando configuração:"
nginx -t
echo

echo "=== 6. Verificando permissões ==="
echo "Diretório do projeto:"
ls -la /var/www/sistema-licencas/
echo "Diretório dist:"
ls -la /var/www/sistema-licencas/dist/
echo "Diretório server:"
ls -la /var/www/sistema-licencas/server/
echo

echo "=== 7. Verificando banco de dados ==="
echo "Arquivo do banco:"
ls -la /var/www/sistema-licencas/server/database.sqlite
echo

echo "=== 8. Verificando memória e CPU ==="
echo "Uso de memória:"
free -h
echo "Carga do sistema:"
uptime
echo

echo "=== Diagnóstico concluído ==="