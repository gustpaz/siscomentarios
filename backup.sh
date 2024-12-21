#!/bin/bash

# Diretório de backup
BACKUP_DIR="/var/backups/sistema-licencas"
DATE=$(date +%Y%m%d_%H%M%S)

# Criar diretório de backup se não existir
mkdir -p $BACKUP_DIR

# Fazer backup do banco SQLite
cp /var/www/sistema-licencas/server/database.sqlite "$BACKUP_DIR/database_$DATE.sqlite"

# Manter apenas os últimos 7 backups
find $BACKUP_DIR -name "database_*.sqlite" -type f -mtime +7 -delete