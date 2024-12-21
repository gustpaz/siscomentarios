import requests
import sys
import os
from datetime import datetime

error_message = f"""Erro ao tentar acessar o TikTok: Página não carregou corretamente

Stack Trace:
Traceback (most recent call last):
  File "app.py", line 245, in process_comment_batch
    driver.get("https://www.tiktok.com/foryou")
  File "selenium/webdriver/remote/webdriver.py", line 449, in get
    self.execute(Command.GET, {{"url": url}})
TimeoutError: Page load timed out after 30 seconds

Informações do Sistema:
- Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- Sistema Operacional: {os.name}
- Python Version: {sys.version.split()[0]}
- Browser: Chrome 120.0.6099.110
- Selenium: 4.16.0
- URL: https://www.tiktok.com/foryou
- Machine ID: 4dfd0f12ecf48f16c18e16425f01638bab7c1f003ba8473a5c4af53fd139b9e1

Logs do Chrome:
[1702923615.892] [ERROR:device_event_log_impl.cc(192)] [16:35:15.892] USB: usb_device_handle_win.cc:1046 Failed to read descriptor from node connection
[1702923615.895] [ERROR:network_service.cc(405)] Network service crashed, restarting service.
[1702923615.897] [ERROR:page_load_metrics_update_dispatcher.cc(178)] Invalid first_paint 0.002 s for first_meaningful_paint 0.001 s"""

response = requests.post(
    'http://localhost:3000/api/erros-automacao',
    json={'email': 'Gustpaz@gmail.com', 'erro': error_message}
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
