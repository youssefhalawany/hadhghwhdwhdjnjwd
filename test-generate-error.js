const http = require('http');
const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/api/schedule/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};
const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('STATUS:', res.statusCode, '\nBODY:', body.substring(0, 300)));
});
req.write('{invalid_json');
req.end();
