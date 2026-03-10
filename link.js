const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { qrcode } = require('qrcode');
const fs = require('fs');
const readline = require('readline');

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_wa');
    const { version } = await fetchLatestBaileysVersion();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (text) => new Promise((resolve) => rl.question(text, resolve));

    async function connectToWhatsApp() {
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            browser: Browsers.macOS('Desktop'),
            printQRInTerminal: false
        });

        if (!sock.authState.creds.registered) {
            console.log('\n--- WHATSAPP PAIRING ---');
            console.log('1. QR Code');
            console.log('2. Pairing Code');
            const choice = await question('\nSelect method (1/2): ');

            if (choice === '2') {
                const phoneNumber = await question('Enter phone number (with country code, e.g., 923123456789): ');
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\nYOUR PAIRING CODE: ${code}\n`);
            } else {
                sock.ev.on('creds.update', saveCreds);
                sock.ev.on('connection.update', (update) => {
                    const { qr } = update;
                    if (qr) {
                        require('qrcode-terminal').generate(qr, { small: true });
                        console.log('Scan the QR code above to connect.');
                    }
                });
            }
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) connectToWhatsApp();
            } else if (connection === 'open') {
                console.log('\n[CONNECTED] WhatsApp is ready!');
                rl.close();
            }
        });
    }

    const phoneNumber = state.creds?.me?.id?.split(':')[0];
    if (phoneNumber) {
        console.log(`\nAlready logged in as: ${phoneNumber}`);
        const logout = await question('Logout? (y/n): ');
        if (logout.toLowerCase() === 'y') {
            fs.rmSync('./auth_wa', { recursive: true, force: true });
            console.log('Logged out. Restart to pair again.');
            rl.close();
            process.exit(0);
        }
    }

    await connectToWhatsApp();
}

start().catch(err => {
    console.error('[ERROR]', err);
    process.exit(1);
});
