const Database = require('better-sqlite3');
const db = new Database('data/delta-saas.db');
const row = db.prepare("SELECT COUNT(*) as c FROM exam_versions WHERE certification_id = 'cert-aws-saa'").get();
console.log('AWS Exam versions:', row.c);
