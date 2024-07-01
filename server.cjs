const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Setting up the WebSocket server on the same port as HTTP server
const wss = new WebSocket.Server({ server });

// Path to the GLB file
const glbFilePath = path.join(__dirname, 'out.glb');

// Watch the GLB file for changes and notify connected clients
fs.watch(glbFilePath, (eventType) => {
    if (eventType === 'change') {
        console.log('out.glb has been updated.');
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send('update');
            }
        });
    }
});

// Serve the static HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the GLB file
app.get('/out.glb', (req, res) => {
    res.sendFile(glbFilePath);
});

// Handle WebSocket connections
wss.on('connection', function connection(ws) {
    console.log('A new client connected.');
    ws.send('Welcome New Client!');

    // Send a message when the model updates
    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
    });
});

// Define the server port
const PORT = process.env.PORT || 3000;

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}/`);
});