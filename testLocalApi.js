const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { userId: '6a476826d9e63b6e414cfe92', role: 'SUPER_ADMIN', email: 'admin@admin.com' },
  'agasthya_jwt_secret_prod_2026',
  { expiresIn: '1h' }
);

fetch('http://localhost:3000/api/departments', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
}).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(err => console.error(err));
