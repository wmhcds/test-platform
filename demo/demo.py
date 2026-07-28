import requests

url = "https://www.baidu.com"

response = requests.get(url, timeout=10)
assert response.status_code == 300,'访问失败'
