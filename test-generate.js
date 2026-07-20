const http = require('http');
const data = JSON.stringify({
  storeId: "eL-alamein-4",
  month: "2026-08",
  rules: {
    minEmployeesMorning: 2,
    minEmployeesNoon: 0,
    minEmployeesNight: 2,
    maxDaysOffPerMonth: 4,
    allowConsecutiveDaysOff: true,
    maxConsecutiveDaysOff: 2
  }
});
const options = {
  hostname: 'localhost',
  port: 3005,
  path: '/api/schedule/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};
const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(body));
});
req.write(data);
req.end();
