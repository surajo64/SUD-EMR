const axios = require('axios');

const run = async () => {
    try {
        // Log in to get token
        const loginRes = await axios.post('http://localhost:5000/api/users/login', {
            email: 'admin@example.com', // or the admin user credentials
            password: 'password123'
        });
        const token = loginRes.data.token;
        console.log('Logged in successfully, token acquired.');

        const config = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get('http://localhost:5000/api/hmo-transactions/total-retainership-balance', config);
        console.log('API Response:', res.data);
    } catch (err) {
        console.error('API Error:', err.response ? err.response.data : err.message);
    }
};

run();
