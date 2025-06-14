// server.js
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const lobbies = {};

console.log('Serwer sygnałowy uruchomiony...');

wss.on('connection', (ws, req) => {
    // Standardowy, niezawodny sposób na odczytanie parametrów URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const lobbyId = url.searchParams.get('lobby');
    
    if (!lobbyId) {
        console.log('Odrzucono połączenie: brak ID lobby.');
        ws.close(1008, 'Brak ID lobby');
        return;
    }

    if (!lobbies[lobbyId]) {
        lobbies[lobbyId] = new Set();
    }
    
    const lobby = lobbies[lobbyId];
    lobby.add(ws);
    
    console.log(`Nowe połączenie w lobby ${lobbyId}. Uczestników: ${lobby.size}`);

    ws.on('message', message => {
        // Rozgłaszamy wiadomość do wszystkich w tym samym lobby, oprócz nadawcy
        lobby.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        lobby.delete(ws);
        console.log(`Połączenie zamknięte w lobby ${lobbyId}. Pozostało: ${lobby.size}`);
        if (lobby.size === 0) {
            delete lobbies[lobbyId];
            console.log(`Lobby ${lobbyId} jest puste i zostało zamknięte.`);
        }
    });
    
    ws.on('error', (error) => {
        console.error('Błąd WebSocket:', error);
        lobby.delete(ws);
    });
});

// Railway dostarczy port przez zmienną środowiskową PORT
const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Serwer nasłuchuje na porcie ${port}`);
});
