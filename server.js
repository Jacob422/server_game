// server.js
const WebSocket = require('ws');
const http = require('http');
const { URL } = require('url'); // Używamy wbudowanego modułu URL

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const lobbies = {};

console.log('Serwer sygnałowy uruchomiony...');

wss.on('connection', (ws, req) => {
    // Niezawodny sposób na odczytanie parametrów URL
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
        // --- KLUCZOWA POPRAWKA ---
        // Konwertujemy otrzymaną wiadomość (która może być Bufferem) na string.
        const messageString = message.toString();

        // Ulepszenie: "uczmy" serwer, jaki jest userId danego połączenia,
        // aby móc obsłużyć jego wyjście w zdarzeniu 'close'.
        try {
            const data = JSON.parse(messageString);
            if (data.type === 'user_joined' && data.userId) {
                ws.userId = data.userId; // Przypisujemy userId do obiektu połączenia
            }
        } catch (e) {
            console.error('Nie udało się sparsować wiadomości:', e);
        }

        // Rozgłaszamy wiadomość do wszystkich w tym samym lobby
        lobby.forEach(client => {
            // Wiadomość powinna być wysłana do wszystkich, w tym do nadawcy,
            // aby potwierdzić własne akcje i uprościć logikę klienta.
            // Serwer sygnałowy jest tylko pośrednikiem.
            // Jeśli jednak chcesz unikać wysyłania do siebie, odkomentuj `client !== ws`
            if (/* client !== ws && */ client.readyState === WebSocket.OPEN) {
                client.send(messageString); // Wysyłamy string, a nie oryginalny obiekt message
            }
        });
    });

    ws.on('close', () => {
        lobby.delete(ws);
        console.log(`Połączenie zamknięte w lobby ${lobbyId}. Pozostało: ${lobby.size}`);
        
        // Ulepszenie: Jeśli użytkownik miał przypisane userId, poinformuj innych, że wyszedł.
        if (ws.userId) {
            console.log(`Użytkownik ${ws.userId} opuścił lobby ${lobbyId}.`);
            const leaveMessage = JSON.stringify({
                type: 'user_left',
                userId: ws.userId
            });
            lobby.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(leaveMessage);
                }
            });
        }

        if (lobby.size === 0) {
            delete lobbies[lobbyId];
            console.log(`Lobby ${lobbyId} jest puste i zostało zamknięte.`);
        }
    });
    
    ws.on('error', (error) => {
        console.error('Błąd WebSocket:', error);
        lobby.delete(ws); // Na wszelki wypadek usuń z lobby przy błędzie
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Serwer nasłuchuje na porcie ${port}`);
});
