"""
小说工作台本地服务器
启动方式: python server.py
访问地址: http://localhost:8266
"""
import http.server
import json
import os

PORT = 8266
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_DIR = BASE_DIR
DATA_FILE = os.path.join(WORKSPACE_DIR, 'data')
HTML_FILE = os.path.join(WORKSPACE_DIR, 'novel-studio.html')


class NovelHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WORKSPACE_DIR, **kwargs)

    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            # 返回工作台页面
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            with open(HTML_FILE, 'rb') as f:
                self.wfile.write(f.read())
        elif self.path == '/api/data':
            # 返回所有小说数据（合并所有JSON文件）
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            all_data = {}
            if os.path.isdir(DATA_FILE):
                for fname in os.listdir(DATA_FILE):
                    if fname.endswith('.json'):
                        key = fname[:-5]  # 去掉.json后缀
                        fpath = os.path.join(DATA_FILE, fname)
                        try:
                            with open(fpath, 'r', encoding='utf-8') as f:
                                all_data[key] = json.load(f)
                        except:
                            pass
            self.wfile.write(json.dumps(all_data, ensure_ascii=False).encode('utf-8'))
        elif self.path.startswith('/api/save/'):
            # 单文件读取
            key = self.path[len('/api/save/'):]
            fpath = os.path.join(DATA_FILE, f'{key}.json')
            if os.path.exists(fpath):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                with open(fpath, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/data':
            # 保存全部数据（兼容旧模式）
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode('utf-8'))
                os.makedirs(DATA_FILE, exist_ok=True)
                for key, value in data.items():
                    fpath = os.path.join(DATA_FILE, f'{key}.json')
                    with open(fpath, 'w', encoding='utf-8') as f:
                        json.dump(value, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f'{{"error":"{str(e)}"}}'.encode())
        elif self.path.startswith('/api/save/'):
            # 保存单个数据文件
            key = self.path[len('/api/save/'):]
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode('utf-8'))
                os.makedirs(DATA_FILE, exist_ok=True)
                fpath = os.path.join(DATA_FILE, f'{key}.json')
                with open(fpath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f'{{"error":"{str(e)}"}}'.encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        print(f"[服务器] {args[0]}")


if __name__ == '__main__':
    print(f"=" * 50)
    print(f"  小说工作台服务器启动中...")
    print(f"  访问地址: http://localhost:{PORT}")
    print(f"  数据文件: {DATA_FILE}")
    print(f"  按 Ctrl+C 停止服务器")
    print(f"=" * 50)
    
    server = http.server.HTTPServer(('localhost', PORT), NovelHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
        server.server_close()
