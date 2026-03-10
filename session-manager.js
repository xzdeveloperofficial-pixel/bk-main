const fs = require('fs');
const path = require('path');

const SESSION_DIR = process.env.WA_SESSION_FOLDER || './auth_wa';
const PACKED_FILE = './session-packed.json';

function packSession() {
    if (!fs.existsSync(SESSION_DIR)) {
        console.log('[SESSION PACK] No session folder found');
        return false;
    }

    const files = fs.readdirSync(SESSION_DIR).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
        console.log('[SESSION PACK] No session files found');
        return false;
    }

    const packed = {};
    let count = 0;
    for (const file of files) {
        try {
            const content = fs.readFileSync(path.join(SESSION_DIR, file), 'utf8');
            packed[file] = JSON.parse(content);
            count++;
        } catch (e) {
            const raw = fs.readFileSync(path.join(SESSION_DIR, file), 'utf8');
            packed[file] = { __raw: raw };
            count++;
        }
    }

    fs.writeFileSync(PACKED_FILE, JSON.stringify(packed));
    const sizeMB = (fs.statSync(PACKED_FILE).size / 1024 / 1024).toFixed(2);
    console.log(`[SESSION PACK] Packed ${count} files into session-packed.json (${sizeMB} MB)`);
    return true;
}

function unpackSession() {
    if (!fs.existsSync(PACKED_FILE)) {
        console.log('[SESSION UNPACK] No packed session file found');
        return false;
    }

    if (fs.existsSync(SESSION_DIR)) {
        const existing = fs.readdirSync(SESSION_DIR).filter(f => f.endsWith('.json'));
        if (existing.length > 5) {
            console.log(`[SESSION UNPACK] Session folder already has ${existing.length} files, skipping unpack`);
            return false;
        }
    }

    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    try {
        const packed = JSON.parse(fs.readFileSync(PACKED_FILE, 'utf8'));
        let count = 0;

        for (const [filename, data] of Object.entries(packed)) {
            const filePath = path.join(SESSION_DIR, filename);
            if (data && data.__raw) {
                fs.writeFileSync(filePath, data.__raw);
            } else {
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            }
            count++;
        }

        console.log(`[SESSION UNPACK] Restored ${count} session files to ${SESSION_DIR}/`);
        return true;
    } catch (e) {
        console.error('[SESSION UNPACK] Error:', e.message);
        return false;
    }
}

if (require.main === module) {
    const cmd = process.argv[2];
    if (cmd === 'pack') {
        packSession();
    } else if (cmd === 'unpack') {
        unpackSession();
    } else {
        console.log('Usage: node session-manager.js [pack|unpack]');
        console.log('  pack   - Pack all auth_wa files into one session-packed.json');
        console.log('  unpack - Restore auth_wa files from session-packed.json');
    }
}

module.exports = { packSession, unpackSession };
