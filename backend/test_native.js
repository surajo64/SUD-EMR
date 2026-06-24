const http = require('http');

// Helper to do POST request
const post = (url, data) => {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: u.hostname,
            port: u.port,
            path: u.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
};

// Helper to do GET request with header
const get = (url, token) => {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            port: u.port,
            path: u.pathname,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch(e) {
                    resolve(body);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
};

const run = async () => {
    try {
        const loginRes = await post('http://localhost:5000/api/users/login', {
            email: 'admin@example.com',
            password: 'password123'
        });
        const token = loginRes.token;
        console.log('Login token:', token);

        const res = await get('http://localhost:5000/api/hmo-transactions/total-retainership-balance', token);
        console.log('API Endpoint Response:', res);
    } catch(err) {
        console.error('Error:', err);
    }
};

run();
