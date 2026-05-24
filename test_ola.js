const https = require('https');
const apiKey = 'HWcjG1Rr4pvgVw3Unclhtfr5iiU7gnZEjoX0yutE';
const url = `https://api.olamaps.io/places/v1/autocomplete?input=Bangalore&api_key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Headers:`, res.headers);
        console.log(`Body:`, data);
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
