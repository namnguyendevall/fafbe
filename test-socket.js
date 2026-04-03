const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: 10, email: 'test@example.com', role: 'user' }, 'er5feb54!@1');

const socket = io('http://localhost:5000', {
    auth: { token }
});

socket.on('connect', () => {
    console.log('Connected! Sending message...');
    socket.emit('send_message', {
        conversationId: 6,
        content: 'test message with image',
        imageUrl: 'https://test.com/image.png'
    });
});

socket.on('receive_message', (msg) => {
    console.log('Received back:', msg);
    process.exit(0);
});

setTimeout(() => {
    console.log('Timeout');
    process.exit(1);
}, 5000);
