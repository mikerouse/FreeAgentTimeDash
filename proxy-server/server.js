const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
	origin: [
		'chrome-extension://*',
		/^chrome-extension:\/\/.*/,
		'http://localhost:*'
	],
	credentials: true
}));
app.use(express.json());

// FreeAgent OAuth configuration
const FREEAGENT_CLIENT_ID = process.env.FREEAGENT_CLIENT_ID;
const FREEAGENT_CLIENT_SECRET = process.env.FREEAGENT_CLIENT_SECRET;
const FREEAGENT_TOKEN_URL = 'https://api.freeagent.com/v2/token_endpoint';

// Health check endpoint
app.get('/health', (req, res) => {
	res.json({ status: 'OK', message: 'FreeAgent proxy server is running' });
});

// Token exchange endpoint
app.post('/api/freeagent/token', async (req, res) => {
	const { code, redirect_uri } = req.body;
	
	if (!code || !redirect_uri) {
		return res.status(400).json({ 
			error: 'Missing required parameters',
			details: 'Both code and redirect_uri are required'
		});
	}
	
	try {
		console.log('Exchanging code for tokens...');
		
		// Exchange authorization code for tokens
		const response = await axios.post(FREEAGENT_TOKEN_URL, 
			new URLSearchParams({
				grant_type: 'authorization_code',
				client_id: FREEAGENT_CLIENT_ID,
				client_secret: FREEAGENT_CLIENT_SECRET,
				code: code,
				redirect_uri: redirect_uri
			}), {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Accept': 'application/json'
				}
			}
		);
		
		console.log('Token exchange successful');
		res.json(response.data);
		
	} catch (error) {
		console.error('Token exchange error:', error.response?.data || error.message);
		
		if (error.response) {
			res.status(error.response.status).json({
				error: 'Token exchange failed',
				details: error.response.data
			});
		} else {
			res.status(500).json({
				error: 'Internal server error',
				details: error.message
			});
		}
	}
});

// Token refresh endpoint
app.post('/api/freeagent/refresh', async (req, res) => {
	const { refresh_token } = req.body;
	
	if (!refresh_token) {
		return res.status(400).json({ 
			error: 'Missing refresh_token'
		});
	}
	
	try {
		console.log('Refreshing access token...');
		
		const response = await axios.post(FREEAGENT_TOKEN_URL,
			new URLSearchParams({
				grant_type: 'refresh_token',
				client_id: FREEAGENT_CLIENT_ID,
				client_secret: FREEAGENT_CLIENT_SECRET,
				refresh_token: refresh_token
			}), {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Accept': 'application/json'
				}
			}
		);
		
		console.log('Token refresh successful');
		res.json(response.data);
		
	} catch (error) {
		console.error('Token refresh error:', error.response?.data || error.message);
		
		if (error.response) {
			res.status(error.response.status).json({
				error: 'Token refresh failed',
				details: error.response.data
			});
		} else {
			res.status(500).json({
				error: 'Internal server error',
				details: error.message
			});
		}
	}
});

// Proxy API requests to FreeAgent (optional, for additional security)
app.all('/api/freeagent/proxy/*', async (req, res) => {
	const path = req.params[0];
	const accessToken = req.headers.authorization?.replace('Bearer ', '');
	
	if (!accessToken) {
		return res.status(401).json({ error: 'No access token provided' });
	}
	
	try {
		const response = await axios({
			method: req.method,
			url: `https://api.freeagent.com/v2/${path}`,
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			data: req.body
		});
		
		res.json(response.data);
		
	} catch (error) {
		if (error.response) {
			res.status(error.response.status).json(error.response.data);
		} else {
			res.status(500).json({ error: 'Proxy request failed' });
		}
	}
});

app.listen(PORT, () => {
	console.log(`FreeAgent proxy server running on port ${PORT}`);
	console.log(`Health check: http://localhost:${PORT}/health`);
	
	if (!FREEAGENT_CLIENT_ID || !FREEAGENT_CLIENT_SECRET) {
		console.error('WARNING: FREEAGENT_CLIENT_ID and FREEAGENT_CLIENT_SECRET must be set in .env file');
	}
});