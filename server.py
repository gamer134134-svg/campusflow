import http.server
import json
import os

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    """
    Serves static files (HTML, CSS, JS, etc.) with correct Content-Type via parent class,
    and handles POST /api/sync to write data.json for Windows scheduled notification script.
    """

    def do_GET(self):
        # Delegate all GET requests to SimpleHTTPRequestHandler (handles Content-Type correctly)
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def send_response(self, code, message=None):
        # Inject ngrok bypass header so external scanners (e.g. PWABuilder) skip the warning page
        super().send_response(code, message)
        self.send_header('ngrok-skip-browser-warning', '1')

    def do_POST(self):
        if self.path == '/api/sync':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)

            try:
                data = json.loads(post_data.decode('utf-8'))
                with open('data.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                http.server.SimpleHTTPRequestHandler.end_headers(self)
                self.wfile.write(b'{"status":"success"}')
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                http.server.SimpleHTTPRequestHandler.end_headers(self)
                self.wfile.write(f'{{"error":"{str(e)}"}}'.encode('utf-8'))
        else:
            self.send_response(404)
            http.server.SimpleHTTPRequestHandler.end_headers(self)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        http.server.SimpleHTTPRequestHandler.end_headers(self)

# Run the server
if __name__ == '__main__':
    port = 8000
    server_address = ('', port)
    httpd = http.server.HTTPServer(server_address, CustomHandler)
    print(f"Starting '時間割' server on http://localhost:{port}")
    print(f"Serving files from: {os.getcwd()}")
    httpd.serve_forever()
